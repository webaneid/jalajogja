export const dynamic = "force-dynamic";
// POST /api/akun/login-via-otp
// Login via OTP WhatsApp — verifikasi kode OTP, buat session Better Auth,
// set signed cookie, return redirectTo.
//
// Signed cookie = `${token}.${HMAC-SHA256-base64(secret, token)}`
// — format yang identik dengan Better Auth internals (lihat better-auth/dist/crypto/index.mjs)

import { NextRequest, NextResponse }  from "next/server";
import { db, otpTokens, profiles, members, contacts, session, user, verification } from "@jalajogja/db";
import { eq, and, gt, isNull, sql }   from "drizzle-orm";
import { toE164 }                     from "@/lib/whatsapp";

const SESSION_COOKIE    = "better-auth.session_token";
const SESSION_EXPIRE_S  = 60 * 60 * 24 * 7; // 7 hari (sama dengan auth.ts config)

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { phone: rawPhone, code, slug } = body as {
    phone?: string; code?: string; slug?: string;
  };

  if (!rawPhone || !code || !slug) {
    return NextResponse.json({ error: "phone, code, dan slug wajib diisi" }, { status: 400 });
  }

  const phone = toE164(rawPhone);
  const now   = new Date();

  // ── 1. Verifikasi OTP ─────────────────────────────────────────────────────────
  const [token] = await db
    .select()
    .from(otpTokens)
    .where(and(
      eq(otpTokens.phone, phone),
      eq(otpTokens.code,  code.trim()),
      eq(otpTokens.type,  "login"),
      gt(otpTokens.expiresAt, now),
      isNull(otpTokens.usedAt),
    ))
    .limit(1);

  if (!token) {
    return NextResponse.json({ error: "Kode OTP tidak valid atau sudah kadaluarsa." }, { status: 400 });
  }

  // ── 2. Tandai OTP sudah dipakai ───────────────────────────────────────────────
  await db.update(otpTokens)
    .set({ usedAt: now })
    .where(eq(otpTokens.id, token.id));

  // ── 3. Cari betterAuthUserId dari nomor HP ────────────────────────────────────
  const betterAuthUserId = await findUserByPhone(phone);
  if (!betterAuthUserId) {
    return NextResponse.json(
      { error: "Nomor ini tidak terdaftar di akun manapun." },
      { status: 404 },
    );
  }

  // ── 4. Buat session di DB ─────────────────────────────────────────────────────
  const sessionId    = crypto.randomUUID();
  const sessionToken = generateToken();
  const expiresAt    = new Date(Date.now() + SESSION_EXPIRE_S * 1000);

  await db.insert(session).values({
    id:        sessionId,
    token:     sessionToken,
    userId:    betterAuthUserId,
    expiresAt,
    ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  // ── 5. Buat signed cookie (format identik Better Auth) ────────────────────────
  const secret      = process.env.BETTER_AUTH_SECRET!;
  const signedValue = await signCookieValue(sessionToken, secret);

  const response = NextResponse.json({ ok: true, redirectTo: `/${slug}/akun` });
  response.cookies.set(SESSION_COOKIE, signedValue, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    maxAge:   SESSION_EXPIRE_S,
    path:     "/",
  });

  return response;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findUserByPhone(phone: string): Promise<string | null> {
  // Cek di public.profiles (akun publik)
  const [profile] = await db
    .select({ betterAuthUserId: profiles.betterAuthUserId })
    .from(profiles)
    .where(and(eq(profiles.phone, phone), isNull(profiles.deletedAt)))
    .limit(1);
  if (profile?.betterAuthUserId) return profile.betterAuthUserId;

  // Cek di public.contacts → public.members (anggota IKPM)
  const [member] = await db
    .select({ betterAuthUserId: members.betterAuthUserId })
    .from(members)
    .innerJoin(contacts, eq(contacts.id, members.contactId))
    .where(eq(sql`COALESCE(${contacts.whatsapp}, ${contacts.phone})`, phone))
    .limit(1);
  if (member?.betterAuthUserId) return member.betterAuthUserId;

  return null;
}

// Replikasi persis better-call/dist/crypto.mjs signCookieValue:
//   1. sign: btoa(HMAC-SHA256(secret, value))
//   2. concat: `${value}.${signature}`
//   3. encodeURIComponent(...)  ← WAJIB, tanpa ini Better Auth tidak bisa verify
async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes  = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  return encodeURIComponent(`${value}.${signature}`);
}

// Token 32-char hex random (cukup entropy, tidak perlu nanoid)
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
