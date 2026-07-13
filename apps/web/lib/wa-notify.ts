// lib/wa-notify.ts
// Helper terpusat untuk semua pemanggilan notifikasi WA dari business-logic actions
// (billing, event, donasi, dll). Satu tempat untuk: resolve nama organisasi, format
// Rupiah, dan format URL absolut — supaya tidak reimplementasi berulang di tiap action
// dengan cara yang berbeda-beda (sumber bug yang sudah pernah terjadi untuk URL custom domain).

import type { TenantDb } from "@jalajogja/db";
import { getSettings } from "@jalajogja/db";
import { sendWaNotification, type WaNotifKey } from "@/lib/whatsapp";
import { WA_TEMPLATE_DEFAULTS, renderTemplateString, type WaTemplateVars } from "@/lib/wa-templates";

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
export function waAppUrl(slug: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
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
  vars:     WaTemplateVars;
};

/**
 * Kirim notifikasi WA — fire-and-forget, tidak pernah throw ke caller.
 * `orgName` otomatis di-resolve dan disuntik ke vars jika caller belum menyertakannya.
 * Selalu panggil sebagai `void notifyWa(...)` — jangan await di jalur transaksi utama.
 */
export async function notifyWa(opts: NotifyWaOptions): Promise<void> {
  const { slug, tenantDb, event, phone, vars } = opts;
  if (!phone) return;

  try {
    const orgName = vars.orgName ?? (await resolveOrgName(tenantDb, slug));
    const tpl     = await resolveWaTemplateText(tenantDb, event);
    if (!tpl) return;
    const message = renderTemplateString(tpl, { ...vars, orgName });
    await sendWaNotification({ slug, event, to: phone, message });
  } catch (err) {
    console.error(`[notifyWa:${event}]`, err);
  }
}
