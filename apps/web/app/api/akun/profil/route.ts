export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq }                        from "drizzle-orm";
import { db, profiles, members } from "@jalajogja/db";
import { auth }                      from "@/lib/auth";

// ─── Resolve identity dari session ───────────────────────────────────────────
// Return: { isMember, member, profile } — salah satu pasti terisi jika login valid

type SessionIdentity =
  | { isMember: true;  member: typeof members.$inferSelect; profile: null }
  | { isMember: false; member: null; profile: typeof profiles.$inferSelect }
  | { isMember: false; member: null; profile: null };

async function getSessionIdentity(req: NextRequest): Promise<{ session: Awaited<ReturnType<typeof auth.api.getSession>>; identity: SessionIdentity }> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return { session: null, identity: { isMember: false, member: null, profile: null } };

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
  });
  if (member) return { session, identity: { isMember: true, member, profile: null } };

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.betterAuthUserId, session.user.id),
  });
  return { session, identity: { isMember: false, member: null, profile: profile ?? null } };
}

// ─── GET /api/akun/profil ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { session, identity } = await getSessionIdentity(req);
  if (!session)               return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  if (!identity.member && !identity.profile)
    return NextResponse.json({ error: "Profil tidak ditemukan." }, { status: 404 });

  if (identity.isMember) {
    const m = identity.member;
    return NextResponse.json({
      success: true,
      type: "member",
      data: {
        id:        m.id,
        name:      m.name,
        email:     session.user.email,
        stambuk:   m.stambukNumber,
        createdAt: m.createdAt,
      },
    });
  }

  const p = identity.profile!;
  if (p.deletedAt) return NextResponse.json({ error: "Akun sudah dihapus." }, { status: 410 });

  return NextResponse.json({
    success: true,
    type: "public",
    data: {
      id:        p.id,
      name:      p.name,
      email:     p.email,
      createdAt: p.createdAt,
    },
  });
}

// ─── PATCH /api/akun/profil ───────────────────────────────────────────────────
// HANYA untuk field "Info Login" (nama tampilan) — phone/whatsapp/alamat dikelola
// eksklusif oleh /api/akun/profile-data (yang sudah menormalisasi phone/WA dengan benar).
export async function PATCH(req: NextRequest) {
  const { session, identity } = await getSessionIdentity(req);
  if (!session) return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  if (!identity.member && !identity.profile)
    return NextResponse.json({ error: "Profil tidak ditemukan." }, { status: 404 });

  const body = await req.json();
  const { name } = body as { name?: string };

  if (name === undefined || !name.trim())
    return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });

  if (identity.isMember) {
    await db.update(members).set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(members.id, identity.member.id));
    return NextResponse.json({ success: true });
  }

  const p = identity.profile!;
  if (p.deletedAt) return NextResponse.json({ error: "Akun sudah dihapus." }, { status: 410 });

  await db.update(profiles).set({ name: name.trim(), updatedAt: new Date() }).where(eq(profiles.id, p.id));
  return NextResponse.json({ success: true });
}

// ─── DELETE /api/akun/profil ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { session, identity } = await getSessionIdentity(req);
  if (!session) return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });

  if (identity.isMember) {
    // Anggota IKPM tidak bisa hapus akun sendiri — hubungi admin
    return NextResponse.json({ error: "Hubungi admin untuk menonaktifkan akun keanggotaan." }, { status: 403 });
  }

  const p = identity.profile;
  if (!p) return NextResponse.json({ error: "Profil tidak ditemukan." }, { status: 404 });
  if (p.deletedAt) return NextResponse.json({ error: "Akun sudah dihapus." }, { status: 410 });

  await db.update(profiles).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(profiles.id, p.id));
  await auth.api.signOut({ headers: req.headers });

  return NextResponse.json({ success: true });
}
