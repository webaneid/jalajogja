export const dynamic = "force-dynamic";
// POST /api/akun/verify-otp
// Verifikasi kode OTP. Dua mode:
//   type=register       → return { valid: true }
//   type=reset_password → inject token ke Better Auth verification table
//                         → return { valid: true, token: string }

import { NextRequest, NextResponse }           from "next/server";
import { db, otpTokens, verification }         from "@jalajogja/db";
import { eq, and, gt, isNull }                 from "drizzle-orm";
import { toE164 }                              from "@/lib/whatsapp";
import { findUserByPhone }                     from "@/lib/find-user-by-phone";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { phone: rawPhone, code, type, slug } = body as {
    phone?: string; code?: string; type?: string; slug?: string;
  };

  if (!rawPhone || !code || !type || !slug) {
    return NextResponse.json({ error: "phone, code, type, dan slug wajib diisi" }, { status: 400 });
  }
  if (type !== "register" && type !== "reset_password" && type !== "login") {
    return NextResponse.json({ error: "type tidak valid" }, { status: 400 });
  }

  const phone = toE164(rawPhone);
  const now   = new Date();

  // ── Cari OTP valid ────────────────────────────────────────────────────────────
  const [token] = await db
    .select()
    .from(otpTokens)
    .where(and(
      eq(otpTokens.phone, phone),
      eq(otpTokens.code,  code.trim()),
      eq(otpTokens.type,  type as "register" | "reset_password" | "login"),
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

  return NextResponse.json({ valid: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken24(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
