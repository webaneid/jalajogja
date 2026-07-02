export const dynamic = "force-dynamic";
// POST /api/akun/send-otp
// Kirim OTP 6-digit ke nomor WhatsApp via GOWA.
// Rate limit: max 3 OTP per phone per jam.
// OTP berlaku 5 menit.

import { NextRequest, NextResponse }  from "next/server";
import { db, otpTokens, createTenantDb, getSettings } from "@jalajogja/db";
import { eq, and, gt, count, sql }   from "drizzle-orm";
import { sendWaNotification, toE164 } from "@/lib/whatsapp";
import { renderWaTemplate }           from "@/lib/wa-templates";
import type { WaNotifConfig }         from "@/lib/whatsapp";

const OTP_TTL_MINUTES   = 5;
const RATE_LIMIT_MAX    = 3;
const RATE_LIMIT_WINDOW = 60; // menit

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { phone: rawPhone, type, slug } = body as {
    phone?: string; type?: string; slug?: string;
  };

  if (!rawPhone || !type || !slug) {
    return NextResponse.json({ error: "phone, type, dan slug wajib diisi" }, { status: 400 });
  }
  if (type !== "register" && type !== "reset_password" && type !== "login") {
    return NextResponse.json({ error: "type tidak valid" }, { status: 400 });
  }

  const validType = type as "register" | "reset_password" | "login";

  const phone = toE164(rawPhone);

  // ── Rate limiting ──────────────────────────────────────────────────────────────
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW * 60 * 1000);
  const [{ total }] = await db
    .select({ total: count() })
    .from(otpTokens)
    .where(and(
      eq(otpTokens.phone, phone),
      eq(otpTokens.type, validType),
      gt(otpTokens.createdAt, windowStart),
    ));

  if (Number(total) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan OTP. Coba lagi dalam ${RATE_LIMIT_WINDOW} menit.` },
      { status: 429 },
    );
  }

  // ── Hapus OTP lama yang belum dipakai untuk phone+type ini ───────────────────
  await db.delete(otpTokens).where(and(
    eq(otpTokens.phone, phone),
    eq(otpTokens.type, validType),
    sql`${otpTokens.usedAt} IS NULL`,
  ));

  // ── Generate OTP ──────────────────────────────────────────────────────────────
  const code      = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.insert(otpTokens).values({
    phone,
    code,
    type: validType,
    slug,
    expiresAt,
  });

  // ── Ambil nama organisasi dari settings ───────────────────────────────────────
  let orgName = "Aplikasi";
  try {
    const tenantClient = createTenantDb(slug);
    const generalCfg   = await getSettings(tenantClient, "general");
    const notifCfg     = await getSettings(tenantClient, "notif");

    orgName = (generalCfg["site_name"] as string | undefined) ?? orgName;

    // Verifikasi WA dikonfigurasi sebelum kirim (kecuali untuk login — boleh kirim meski belum verified)
    const waCfg = notifCfg["whatsapp_config"] as WaNotifConfig | undefined;
    if (!waCfg?.device_id || !waCfg.verified) {
      return NextResponse.json({ error: "WhatsApp Gateway belum dikonfigurasi oleh admin." }, { status: 503 });
    }

  } catch {
    return NextResponse.json({ error: "Gagal membaca konfigurasi tenant." }, { status: 500 });
  }

  // ── Kirim via WA ──────────────────────────────────────────────────────────────
  const eventKey = type === "register" ? "otp_register"
                 : type === "login"    ? "otp_login"
                 :                       "otp_reset_password";
  const message  = renderWaTemplate(eventKey, {
    orgName,
    otp:    code,
    expiry: String(OTP_TTL_MINUTES),
  });

  if (!message) {
    return NextResponse.json({ error: "Template WA tidak ditemukan." }, { status: 500 });
  }

  const result = await sendWaNotification({ slug, event: eventKey, to: phone, message });

  if (!result.ok) {
    const reasonMap: Record<string, string> = {
      not_configured: "WhatsApp Gateway belum dikonfigurasi.",
      not_verified:   "WhatsApp Gateway belum terverifikasi.",
      event_disabled: "Notifikasi OTP belum diaktifkan admin.",
      send_failed:    "Gagal mengirim pesan WhatsApp. Coba lagi.",
    };
    const errorMsg = reasonMap[result.reason] ?? "Gagal mengirim OTP.";
    return NextResponse.json({ error: errorMsg }, { status: 503 });
  }

  return NextResponse.json({ ok: true, expiresIn: OTP_TTL_MINUTES });
}
