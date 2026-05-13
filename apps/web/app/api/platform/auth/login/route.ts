import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@jalajogja/db";
import { platformUsers } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { signPlatformToken, setPlatformSessionCookie } from "@/lib/platform-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }

    const [user] = await db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    // Update last_login_at
    await db.update(platformUsers)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(platformUsers.id, user.id));

    const token = await signPlatformToken({
      userId: user.id,
      email:  user.email,
      name:   user.name,
      role:   user.role as "owner" | "admin" | "staff",
    });

    await setPlatformSessionCookie(token);

    return NextResponse.json({ ok: true, role: user.role });
  } catch (err) {
    console.error("[platform/auth/login]", err);
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
