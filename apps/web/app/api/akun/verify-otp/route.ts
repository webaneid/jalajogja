export const dynamic = "force-dynamic";
// POST /api/akun/verify-otp
// Verifikasi kode OTP. Dua mode:
//   type=register       → return { valid: true }
//   type=reset_password → inject token ke Better Auth verification table
//                         → return { valid: true, token: string }

import { NextRequest, NextResponse }           from "next/server";
import { db, otpTokens, verification, members, contacts, createTenantDb, resolveCheckoutContact } from "@jalajogja/db";
import { eq, and, gt, isNull }                 from "drizzle-orm";
import { normalizePhone }                      from "@/lib/phone";
import { findUserByPhone }                     from "@/lib/find-user-by-phone";
import { rateLimitGuard }                      from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Kode OTP 6-digit = 1 juta kombinasi. Tanpa rate limit di sini, endpoint ini
  // adalah target brute-force langsung (tebak kode sampai kena, tanpa perlu
  // akses WA korban sama sekali). Limit per-IP membuat brute force tidak
  // feasible dalam window TTL OTP (5 menit).
  const ipBlocked = rateLimitGuard(request, "verify-otp", 10, 60_000);
  if (ipBlocked) return ipBlocked;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { phone: rawPhone, code, type, slug, claimMemberId } = body as {
    phone?: string; code?: string; type?: string; slug?: string; claimMemberId?: string;
  };

  if (!code || !type || !slug) {
    return NextResponse.json({ error: "code, type, dan slug wajib diisi" }, { status: 400 });
  }
  if (type !== "register" && type !== "reset_password" && type !== "login" && type !== "checkout_verify") {
    return NextResponse.json({ error: "type tidak valid" }, { status: 400 });
  }

  // ── Klaim akun member: resolve nomor dari data keanggotaan (server-side), SAMA
  // seperti /api/akun/send-otp — jangan percaya `phone` dari client di mode klaim,
  // supaya OTP yang dicocokkan benar-benar OTP yang dikirim ke nomor member terkait.
  let phone: string;
  if (type === "register" && claimMemberId) {
    const [row] = await db
      .select({ phone: contacts.phone, whatsapp: contacts.whatsapp })
      .from(members)
      .innerJoin(contacts, eq(contacts.id, members.contactId))
      .where(eq(members.id, claimMemberId))
      .limit(1);
    const onFile = row?.whatsapp ?? row?.phone;
    if (!onFile) return NextResponse.json({ error: "Data anggota tidak valid." }, { status: 422 });
    phone = normalizePhone(onFile) ?? onFile;
  } else {
    if (!rawPhone) return NextResponse.json({ error: "phone wajib diisi" }, { status: 400 });
    phone = normalizePhone(rawPhone) ?? rawPhone.trim();
  }
  const now   = new Date();

  // ── Cari OTP valid ────────────────────────────────────────────────────────────
  const [token] = await db
    .select()
    .from(otpTokens)
    .where(and(
      eq(otpTokens.phone, phone),
      eq(otpTokens.code,  code.trim()),
      eq(otpTokens.type,  type as "register" | "reset_password" | "login" | "checkout_verify"),
      gt(otpTokens.expiresAt, now),
      isNull(otpTokens.usedAt),
    ))
    .limit(1);

  if (!token) {
    return NextResponse.json({ error: "Kode OTP tidak valid atau sudah kadaluarsa." }, { status: 400 });
  }

  // ── Tandai OTP sebagai sudah dipakai ──────────────────────────────────────────
  await db.update(otpTokens)
    .set({ usedAt: now })
    .where(eq(otpTokens.id, token.id));

  // ── Jika reset password: inject ke Better Auth verification table ─────────────
  if (type === "reset_password") {
    const betterAuthUserId = await findUserByPhone(phone);
    if (!betterAuthUserId) {
      return NextResponse.json(
        { error: "Nomor ini tidak terdaftar di akun manapun." },
        { status: 404 },
      );
    }

    // Generate token acak 24 karakter (sama dengan format Better Auth)
    const resetToken = generateToken24();
    const expiresAt  = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

    // Insert ke verification table — Better Auth akan membaca ini saat resetPassword()
    await db.insert(verification).values({
      id:         crypto.randomUUID(),
      identifier: `reset-password:${resetToken}`,
      value:      betterAuthUserId,
      expiresAt,
    });

    return NextResponse.json({ valid: true, token: resetToken });
  }

  // ── Jika klaim akun member: keluarkan claimToken sekali-pakai sebagai BUKTI
  // verifikasi ke /api/akun/register. Tanpa ini, endpoint register bisa dipanggil
  // langsung dengan claimMemberId tanpa pernah lewat OTP sama sekali (client-side
  // flow control saja bukan proteksi nyata).
  if (type === "register" && claimMemberId) {
    const claimToken = generateToken24();
    await db.insert(verification).values({
      id:         crypto.randomUUID(),
      identifier: `claim-member:${claimToken}`,
      value:      claimMemberId,
      expiresAt:  new Date(Date.now() + 10 * 60 * 1000), // 10 menit
    });
    return NextResponse.json({ valid: true, claimToken });
  }

  // ── Checkout: OTP terverifikasi → BARU SETELAH INI boleh balikin nama/email/alamat untuk
  // auto-isi form. Panggil ulang resolveCheckoutContact() (state HTTP tidak persisten antar
  // request, tidak ada hasil yang disimpan dari send-otp) — murni kemudahan transaksi, BUKAN
  // klaim keanggotaan (tidak menyentuh betterAuthUserId). Lihat docs/arsitektur-billing.md § 16.
  if (type === "checkout_verify") {
    // OTP SUDAH tervalidasi+dipakai di titik ini (tidak bisa dibatalkan) — kalau lookup gagal
    // teknis di sini, tetap balas `valid:true` tanpa data (customer sudah lolos verifikasi,
    // lanjutkan checkout tanpa auto-isi, bukan tampilkan error setelah OTP benar).
    try {
      const { db: checkoutTenantDb, schema: checkoutSchema } = createTenantDb(slug);
      const match = await resolveCheckoutContact(db, checkoutTenantDb, checkoutSchema, phone);

      // Token bukti verifikasi sekali-pakai — checkoutAction WAJIB minta ini + cek ulang
      // resolveCheckoutContact() sendiri sebelum percaya nama/email yang di-submit client untuk
      // nomor yang match (jangan pernah percaya state UI sebagai proteksi anti-fraud).
      let verifyToken: string | undefined;
      if (match.found) {
        verifyToken = generateToken24();
        await db.insert(verification).values({
          id:         crypto.randomUUID(),
          identifier: `checkout-verify:${verifyToken}`,
          value:      phone,
          expiresAt:  new Date(Date.now() + 30 * 60 * 1000), // 30 menit — cukup selesaikan checkout multi-step
        });
      }

      return NextResponse.json({
        valid:   true,
        name:    match.name    ?? null,
        email:   match.email   ?? null,
        address: match.address ?? null,
        verifyToken,
      });
    } catch (err) {
      console.error("[verify-otp checkout_verify] resolveCheckoutContact gagal:", err);
      return NextResponse.json({ valid: true, name: null, email: null, address: null });
    }
  }

  return NextResponse.json({ valid: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken24(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
