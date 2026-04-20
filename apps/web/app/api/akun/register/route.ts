import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db, profiles, tenants } from "@jalajogja/db";
import { auth } from "@/lib/auth";

// ─── POST /api/akun/register ──────────────────────────────────────────────────
// Daftar akun publik baru: buat Better Auth user + public.profiles sekaligus.
// Login terpisah via Better Auth: POST /api/auth/sign-in/email
//
// Body: { name, email, phone, password, tenantSlug? }
// Response: { profileId, name, email, phone }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, password, tenantSlug } = body as {
      name:        string;
      email:       string;
      phone:       string;
      password:    string;
      tenantSlug?: string;
    };

    // ── Validasi input ────────────────────────────────────────────────────────
    if (!name?.trim())     return NextResponse.json({ error: "Nama wajib diisi." },     { status: 400 });
    if (!email?.trim())    return NextResponse.json({ error: "Email wajib diisi." },    { status: 400 });
    if (!phone?.trim())    return NextResponse.json({ error: "Nomor HP wajib diisi." }, { status: 400 });
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();

    // ── Cek duplikat di public.profiles ──────────────────────────────────────
    const existing = await db.query.profiles.findFirst({
      where: or(
        eq(profiles.email, normalizedEmail),
        eq(profiles.phone, normalizedPhone),
      ),
    });

    if (existing) {
      const field = existing.email === normalizedEmail ? "Email" : "Nomor HP";
      return NextResponse.json(
        { error: `${field} sudah terdaftar. Silakan masuk.` },
        { status: 409 }
      );
    }

    // ── Resolve tenant untuk registered_at_tenant ─────────────────────────────
    let registeredAtTenant: string | null = null;
    if (tenantSlug) {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.slug, tenantSlug),
      });
      registeredAtTenant = tenant?.id ?? null;
    }

    // ── Buat Better Auth user ─────────────────────────────────────────────────
    // signUpEmail menangani hash password dan insert ke public.user
    const signUpResult = await auth.api.signUpEmail({
      body: {
        name:     name.trim(),
        email:    normalizedEmail,
        password,
      },
    });

    if (!signUpResult?.user?.id) {
      return NextResponse.json({ error: "Gagal membuat akun. Coba lagi." }, { status: 500 });
    }

    // ── Buat public.profiles ──────────────────────────────────────────────────
    const [profile] = await db
      .insert(profiles)
      .values({
        name:               name.trim(),
        email:              normalizedEmail,
        phone:              normalizedPhone,
        accountType:        "akun",
        betterAuthUserId:   signUpResult.user.id,
        registeredAtTenant,
      })
      .returning({
        id:    profiles.id,
        name:  profiles.name,
        email: profiles.email,
        phone: profiles.phone,
      });

    return NextResponse.json(
      { success: true, data: profile },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[POST /api/akun/register]", err);
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    // Better Auth melempar error jika email sudah ada di public.user
    if (message.toLowerCase().includes("email") || message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    }
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
