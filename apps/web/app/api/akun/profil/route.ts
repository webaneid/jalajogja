export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq }                        from "drizzle-orm";
import { db, profiles, members, contacts } from "@jalajogja/db";
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
    // Fetch kontak
    const contact = m.contactId
      ? await db.query.contacts.findFirst({ where: eq(contacts.id, m.contactId) })
      : null;
    return NextResponse.json({
      success: true,
      type: "member",
      data: {
        id:        m.id,
        name:      m.name,
        email:     contact?.email ?? session.user.email,
        phone:     contact?.phone ?? null,
        whatsapp:  contact?.whatsapp ?? null,
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
      id:       p.id,
      name:     p.name,
      email:    p.email,
      phone:    p.phone,
      whatsapp: p.whatsapp,
      address: {
        detail:     p.addressDetail,
        provinceId: p.provinceId,
        regencyId:  p.regencyId,
        districtId: p.districtId,
        villageId:  p.villageId,
        country:    p.country,
      },
      createdAt: p.createdAt,
    },
  });
}

// ─── PATCH /api/akun/profil ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { session, identity } = await getSessionIdentity(req);
  if (!session) return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  if (!identity.member && !identity.profile)
    return NextResponse.json({ error: "Profil tidak ditemukan." }, { status: 404 });

  const body = await req.json();
  const { name, phone, whatsapp, addressDetail, provinceId, regencyId, districtId, villageId, country } = body as {
    name?: string; phone?: string; whatsapp?: string;
    addressDetail?: string; provinceId?: string; regencyId?: string;
    districtId?: string; villageId?: string; country?: string;
  };

  if (identity.isMember) {
    // Update nama di member (fields lain via /api/akun/member-data)
    if (name !== undefined) {
      await db.update(members).set({ name: name.trim(), updatedAt: new Date() })
        .where(eq(members.id, identity.member.id));
    }
    return NextResponse.json({ success: true });
  }

  // Publik: update profiles
  const p = identity.profile!;
  if (p.deletedAt) return NextResponse.json({ error: "Akun sudah dihapus." }, { status: 410 });

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined)          updateData.name          = name.trim();
  if (phone !== undefined)         updateData.phone         = phone.trim();
  if (whatsapp !== undefined)      updateData.whatsapp      = whatsapp?.trim() || null;
  if (addressDetail !== undefined) updateData.addressDetail = addressDetail?.trim() ?? null;
  if (provinceId !== undefined)    updateData.provinceId    = provinceId || null;
  if (regencyId !== undefined)     updateData.regencyId     = regencyId  || null;
  if (districtId !== undefined)    updateData.districtId    = districtId || null;
  if (villageId !== undefined)     updateData.villageId     = villageId  || null;
  if (country !== undefined)       updateData.country       = country?.trim() || "Indonesia";

  await db.update(profiles).set(updateData).where(eq(profiles.id, p.id));
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
