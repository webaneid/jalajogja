// lib/wa-notify.ts
// Helper terpusat untuk semua pemanggilan notifikasi WA dari business-logic actions
// (billing, event, donasi, dll). Satu tempat untuk: resolve nama organisasi, format
// Rupiah, dan format URL absolut — supaya tidak reimplementasi berulang di tiap action
// dengan cara yang berbeda-beda (sumber bug yang sudah pernah terjadi untuk URL custom domain).

import type { TenantDb } from "@jalajogja/db";
import { getSettings, db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { sendWaNotification, type WaNotifKey } from "@/lib/whatsapp";
import { WA_TEMPLATE_DEFAULTS, renderTemplateString, type WaTemplateVars } from "@/lib/wa-templates";
import { sendMailForTenant } from "@/lib/mail-dispatch.server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  CHANNEL_MODE_KEY, EMAIL_NOTIF_KEY, parseChannelMode,
  emailSubjectTemplate, isEmailEventDefaultOn, isEmailCapableEvent,
} from "@/lib/email-notify";

// Key settings tempat override teks per-tenant disimpan (group="notif").
export const WA_TEMPLATE_SETTINGS_KEY = "wa_message_templates";

/**
 * Resolusi teks template: custom tenant (jika ada) → default kode.
 * Dipakai oleh notifyWa() di sini dan oleh caller lain yang perlu render manual (mis. OTP route).
 */
export async function resolveWaTemplateText(tenantDb: TenantDb, event: string): Promise<string | null> {
  try {
    const cfg    = await getSettings(tenantDb, "notif");
    const custom = (cfg[WA_TEMPLATE_SETTINGS_KEY] as Record<string, string> | undefined)?.[event];
    return custom?.trim() || WA_TEMPLATE_DEFAULTS[event] || null;
  } catch {
    return WA_TEMPLATE_DEFAULTS[event] ?? null;
  }
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com").replace(/\/$/, "");

// URL absolut ke halaman publik tenant — WAJIB dipakai untuk semua link di pesan WA.
// Jangan pernah hardcode `/${slug}/...` di caller — custom domain redirect middleware
// menolak path admin/relatif yang salah bentuk (lihat lesson CLAUDE.md § custom domain).
//
// Tenant-aware: kalau tenant punya custom domain AKTIF (custom_domain_status='active'),
// link dibangun pakai domain sendiri tanpa prefix slug (mis. https://visikita.com/invoice/123)
// — bukan selalu jalakarta.com/{slug}/... Fallback ke jalakarta.com kalau custom domain
// tidak ada/belum aktif, atau kalau lookup gagal (fail-safe, jangan sampai notifikasi gagal
// terkirim gara-gara query custom domain error).
export async function waAppUrl(slug: string, path: string): Promise<string> {
  const p = path.startsWith("/") ? path : `/${path}`;

  try {
    const [row] = await db
      .select({ customDomain: tenants.customDomain, customDomainStatus: tenants.customDomainStatus })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (row?.customDomain && row.customDomainStatus === "active") {
      return `https://${row.customDomain}${p}`;
    }
  } catch {
    // fall through ke default jalakarta.com di bawah
  }

  return `${APP_URL}/${slug}${p}`;
}

export function waRupiah(amount: number | string): string {
  return Number(amount).toLocaleString("id-ID");
}

export async function resolveOrgName(tenantDb: TenantDb, slug: string): Promise<string> {
  try {
    const cfg = await getSettings(tenantDb, "general");
    return (cfg["site_name"] as string | undefined)?.trim() || slug;
  } catch {
    return slug;
  }
}

type NotifyWaOptions = {
  slug:     string;
  tenantDb: TenantDb;
  event:    WaNotifKey;
  phone:    string | null | undefined;
  /** Email penerima (data tercatat: invoice/pendaftaran/anggota — BUKAN input mentah). Opsional. */
  email?:   string | null;
  vars:     WaTemplateVars;
};

/** Mode kanal tenant (default email_first). Dipakai juga oleh jalur non-notifyWa (PJ, aktivasi anggota). */
export async function resolveChannelMode(tenantDb: TenantDb): Promise<import("@/lib/email-notify").ChannelMode> {
  try {
    const prefs = await getSettings(tenantDb, "notif");
    return parseChannelMode(prefs[CHANNEL_MODE_KEY]);
  } catch {
    return parseChannelMode(undefined);
  }
}

// Nama orang dari input publik → aman ditaruh di email: tanpa URL/domain, tanpa karakter format, maks 60.
function cleanPersonName(raw: string | undefined): string {
  return (raw ?? "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b[\w-]+(\.[\w-]+)+\/\S*/g, "")
    .replace(/[*_~`<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || "Pelanggan";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Teks template WA (format *tebal*) → HTML email. Seluruh teks di-escape DULU (vars berisi input pengguna,
// mis. nama), baru URL dijadikan tautan — pola sama pj-notification.
function waTextToEmailHtml(text: string): string {
  const safe = escapeHtml(text.replace(/\*/g, ""))
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${safe}</div>`;
}

/**
 * Kirim notifikasi ke pelanggan lewat Email dan/atau WA sesuai `channel_mode` tenant — fire-and-forget,
 * tidak pernah throw ke caller. `orgName` otomatis di-resolve dan disuntik ke vars jika belum ada.
 * Selalu panggil sebagai `void notifyWa(...)` — jangan await di jalur transaksi utama.
 *
 * Aturan kanal (docs/arsitektur-notifikasi-email.md § 3.3):
 *  - Email dikirim bila: ada `email`, event punya jalur email, toggle email event aktif, mode bukan wa_only.
 *  - WA dikirim bila: ada `phone`, mode bukan email_only, dan (mode both/wa_only ATAU email tidak terkirim).
 *    (Toggle WA + status gateway tetap dicek di sendWaNotification.)
 *  - Caller lama yang tidak memberi `email` berperilaku persis seperti sebelumnya (WA saja).
 */
export async function notifyWa(opts: NotifyWaOptions): Promise<void> {
  const { slug, tenantDb, event, phone, email, vars } = opts;
  if (!phone && !email) return;

  try {
    const orgName = vars.orgName ?? (await resolveOrgName(tenantDb, slug));
    const tpl     = await resolveWaTemplateText(tenantDb, event);
    if (!tpl) return;
    const message = renderTemplateString(tpl, { ...vars, orgName });

    const prefs = await getSettings(tenantDb, "notif").catch(() => ({} as Record<string, unknown>));
    const mode  = parseChannelMode(prefs[CHANNEL_MODE_KEY]);

    let emailSent = false;
    // Batas per alamat penerima: email tujuan diketik pelanggan anonim saat checkout/pendaftaran (bisa milik
    // orang lain) — cegah tenant dijadikan relay spam ke satu alamat. In-memory per proses (cukup 1 VPS).
    const emailAllowed = !email || checkRateLimit(`notif-email:${email.trim().toLowerCase()}`, 10, 60 * 60_000).allowed;
    if (email && !emailAllowed) console.warn(`[notifyWa:${event}] email dilewati: batas per-penerima tercapai`);
    if (email && emailAllowed && mode !== "wa_only" && isEmailCapableEvent(event)) {
      // `name` diketik pelanggan anonim saat checkout (email tujuan bisa milik orang lain) — buang URL
      // dan format dari nama supaya email resmi tenant tidak bisa dipakai membawa tautan penyerang.
      const emailMessage = renderTemplateString(tpl, { ...vars, orgName, name: cleanPersonName(vars.name) });
      const toggles = prefs[EMAIL_NOTIF_KEY] as Record<string, boolean> | undefined;
      const enabled = typeof toggles?.[event] === "boolean" ? toggles[event]! : isEmailEventDefaultOn(event);
      if (enabled) {
        const subject = renderTemplateString(emailSubjectTemplate(event) ?? "Notifikasi — {{orgName}}", { orgName });
        const sent = await sendMailForTenant(tenantDb, { to: email, subject, html: waTextToEmailHtml(emailMessage) });
        emailSent = sent.ok;
        if (!sent.ok) console.error(`[notifyWa:${event}] email gagal:`, sent.error);
      }
    }

    const wantWa = !!phone && mode !== "email_only" && (mode === "both" || mode === "wa_only" || !emailSent);
    if (wantWa) await sendWaNotification({ slug, event, to: phone!, message });
  } catch (err) {
    console.error(`[notifyWa:${event}]`, err);
  }
}
