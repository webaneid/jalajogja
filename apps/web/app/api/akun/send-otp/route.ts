export const dynamic = "force-dynamic";
// POST /api/akun/send-otp
// Kirim OTP 6-digit ke nomor WhatsApp via GOWA.
// Rate limit: max 3 OTP per phone per jam.
// OTP berlaku 5 menit.

import { NextRequest, NextResponse }  from "next/server";
import { db, otpTokens, createTenantDb, getSettings, members, contacts, resolveCheckoutContact } from "@jalajogja/db";
import { eq, and, gt, count, sql }   from "drizzle-orm";
import { sendWaNotification }         from "@/lib/whatsapp";
import { renderTemplateString }       from "@/lib/wa-templates";
import { resolveWaTemplateText }      from "@/lib/wa-notify";
import { findUserByPhone }            from "@/lib/find-user-by-phone";
import { normalizePhone }             from "@/lib/phone";
import { rateLimitGuard }             from "@/lib/rate-limit";
import { maskPhone }                  from "@/lib/mask-phone";
import type { WaNotifConfig }         from "@/lib/whatsapp";

const OTP_TTL_MINUTES   = 5;
const RATE_LIMIT_MAX    = 3;  // per phone, per jam
const RATE_LIMIT_WINDOW = 60; // menit

export async function POST(request: NextRequest) {
  // Rate limit per-IP — pelengkap limit per-phone di bawah. Limit per-phone
  // sendiri tidak mencegah satu IP mengirim OTP ke BANYAK nomor berbeda
  // (mis. spam/harassment ke nomor anggota lain, atau biaya WA membengkak).
  const ipBlocked = rateLimitGuard(request, "send-otp", 10, 60_000);
  if (ipBlocked) return ipBlocked;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { phone: rawPhone, type, slug, claimMemberId } = body as {
    phone?: string; type?: string; slug?: string; claimMemberId?: string;
  };

  if (!type || !slug) {
    return NextResponse.json({ error: "type dan slug wajib diisi" }, { status: 400 });
  }
  if (type !== "register" && type !== "reset_password" && type !== "login" && type !== "checkout_verify") {
    return NextResponse.json({ error: "type tidak valid" }, { status: 400 });
  }

  const validType = type as "register" | "reset_password" | "login" | "checkout_verify";

  // ── Klaim akun member: OTP WAJIB dikirim ke nomor WA yang SUDAH tercatat di data
  // keanggotaan (contacts.whatsapp/phone), BUKAN ke nomor yang diketik bebas oleh
  // pendaftar di form — kalau tidak, OTP tidak pernah membuktikan kepemilikan identitas
  // yang diklaim (siapa saja bisa daftar pakai HP sendiri lalu klaim member manapun).
  let phone: string;
  let phoneMasked: string | undefined;
  if (validType === "register" && claimMemberId) {
    const [row] = await db
      .select({ phone: contacts.phone, whatsapp: contacts.whatsapp })
      .from(members)
      .innerJoin(contacts, eq(contacts.id, members.contactId))
      .where(eq(members.id, claimMemberId))
      .limit(1);
    const onFile = row?.whatsapp ?? row?.phone;
    if (!onFile) {
      return NextResponse.json(
        { error: "Nomor WhatsApp anggota belum terdaftar di data keanggotaan. Hubungi admin untuk verifikasi manual." },
        { status: 422 },
      );
    }
    phone = normalizePhone(onFile) ?? onFile;
    phoneMasked = maskPhone(phone);
  } else {
    if (!rawPhone) return NextResponse.json({ error: "phone wajib diisi" }, { status: 400 });
    phone = normalizePhone(rawPhone) ?? rawPhone.trim();
  }

  // ── Login & reset password: tolak sebelum kirim OTP kalau nomor belum terdaftar di akun
  // manapun — cegah kirim WA sia-sia (biaya + membingungkan user yang OTP-nya tidak akan pernah
  // valid, karena login-via-otp/verify-otp toh akan menolaknya lagi di titik verifikasi).
  // "register" TIDAK dicek di sini — itu memang untuk nomor baru.
  if (validType === "login" || validType === "reset_password") {
    const existingUserId = await findUserByPhone(phone);
    if (!existingUserId) {
      return NextResponse.json(
        { error: "Nomor ini belum terdaftar di akun manapun." },
        { status: 404 },
      );
    }
  }

  // ── Checkout: auto-isi Nama/Email/Alamat — HANYA kirim OTP kalau nomor cocok dengan data
  // yang sudah ada (member/profile/riwayat tamu tenant ini). Kalau tidak cocok, jangan kirim
  // OTP sama sekali — balas sukses generik `found:false` (BUKAN error) supaya client tahu
  // lanjut isi manual tanpa menampilkan pesan error apa pun. Ini murni kemudahan transaksi,
  // BUKAN alur klaim keanggotaan. Lihat docs/arsitektur-billing.md § 16.
  if (validType === "checkout_verify") {
    // Rate limit TERPISAH dan lebih ketat dari budget generik di atas — endpoint ini terpicu
    // otomatis (blur field, bukan klik tombol eksplisit seperti register/login) dan mengirim WA
    // sungguhan ke nomor yang match, jadi lebih rawan disalahgunakan untuk enumerasi nomor
    // terdaftar dari satu IP kalau berbagi budget dengan type lain.
    const checkoutIpBlocked = rateLimitGuard(request, "send-otp-checkout-verify", 5, 10 * 60_000);
    if (checkoutIpBlocked) return checkoutIpBlocked;

    try {
      const { db: checkoutTenantDb, schema: checkoutSchema } = createTenantDb(slug);
      const match = await resolveCheckoutContact(db, checkoutTenantDb, checkoutSchema, phone);
      if (!match.found) {
        return NextResponse.json({ ok: true, found: false });
      }
    } catch (err) {
      // Kegagalan teknis di titik lookup TIDAK BOLEH memblokir checkout — anggap sama seperti
      // tidak cocok apa pun, customer lanjut isi manual.
      console.error("[send-otp checkout_verify] resolveCheckoutContact gagal:", err);
      return NextResponse.json({ ok: true, found: false });
    }
  }

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
  const tenantClient = createTenantDb(slug);
  try {
    const generalCfg = await getSettings(tenantClient, "general");
    const notifCfg    = await getSettings(tenantClient, "notif");

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
  const eventKey = type === "register"         ? "otp_register"
                 : type === "login"            ? "otp_login"
                 : type === "checkout_verify"  ? "otp_checkout_verify"
                 :                                "otp_reset_password";
  const tpl      = await resolveWaTemplateText(tenantClient, eventKey);
  const message  = tpl ? renderTemplateString(tpl, {
    orgName,
    otp:    code,
    expiry: String(OTP_TTL_MINUTES),
  }) : null;

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

  return NextResponse.json({
    ok: true,
    expiresIn: OTP_TTL_MINUTES,
    phoneMasked,
    ...(validType === "checkout_verify" ? { found: true } : {}),
  });
}
