import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, profiles } from "@jalajogja/db";
import { auth } from "@/lib/auth";

// ─── Helper: get session + profile ───────────────────────────────────────────

async function getSessionProfile(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return { session: null, profile: null };

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.betterAuthUserId, session.user.id),
  });

  // Profile bisa null jika user adalah pengurus tenant (bukan akun publik)
  return { session, profile: profile ?? null };
}

// ─── GET /api/akun/profil ─────────────────────────────────────────────────────
// Ambil profil akun yang sedang login.
// Response: data profile lengkap (termasuk alamat, account_type, member_id)

export async function GET(req: NextRequest) {
  const { session, profile } = await getSessionProfile(req);

  if (!session) {
    return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profil akun tidak ditemukan." }, { status: 404 });
  }
  if (profile.deletedAt) {
    return NextResponse.json({ error: "Akun sudah dihapus." }, { status: 410 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id:          profile.id,
      name:        profile.name,
      email:       profile.email,
      phone:       profile.phone,
      accountType: profile.accountType,
      memberId:    profile.memberId,
      address: {
        detail:     profile.addressDetail,
        provinceId: profile.provinceId,
        regencyId:  profile.regencyId,
        districtId: profile.districtId,
        villageId:  profile.villageId,
        country:    profile.country,
      },
      createdAt: profile.createdAt,
    },
  });
}

// ─── PATCH /api/akun/profil ───────────────────────────────────────────────────
// Update profil: name, phone, alamat.
// Email tidak bisa diubah di sini (perlu verifikasi terpisah).
//
// Body (semua opsional): { name, phone, addressDetail, provinceId, regencyId,
//                          districtId, villageId, country }

export async function PATCH(req: NextRequest) {
  const { session, profile } = await getSessionProfile(req);

  if (!session) return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "Profil tidak ditemukan." }, { status: 404 });
  if (profile.deletedAt) return NextResponse.json({ error: "Akun sudah dihapus." }, { status: 410 });

  const body = await req.json();
  const {
    name, phone,
    addressDetail, provinceId, regencyId, districtId, villageId, country,
  } = body as {
    name?:          string;
    phone?:         string;
    addressDetail?: string;
    provinceId?:    string;
    regencyId?:     string;
    districtId?:    string;
    villageId?:     string;
    country?:       string;
  };

  // Bangun object update — hanya field yang dikirim
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (name !== undefined)          updateData.name          = name.trim();
  if (phone !== undefined)         updateData.phone         = phone.trim();
  if (addressDetail !== undefined) updateData.addressDetail = addressDetail?.trim() ?? null;
  if (provinceId !== undefined)    updateData.provinceId    = provinceId || null;
  if (regencyId !== undefined)     updateData.regencyId     = regencyId  || null;
  if (districtId !== undefined)    updateData.districtId    = districtId || null;
  if (villageId !== undefined)     updateData.villageId     = villageId  || null;
  if (country !== undefined)       updateData.country       = country?.trim() || "Indonesia";

  if (!updateData.name && name !== undefined) {
    return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
  }

  const [updated] = await db
    .update(profiles)
    .set(updateData)
    .where(eq(profiles.id, profile.id))
    .returning({
      id:    profiles.id,
      name:  profiles.name,
      email: profiles.email,
      phone: profiles.phone,
    });

  return NextResponse.json({ success: true, data: updated });
}

// ─── DELETE /api/akun/profil ──────────────────────────────────────────────────
// Soft delete akun. Transaksi lama tetap ada (profile_id di tabel transaksi tidak null).
// Session di-invalidate oleh Better Auth setelah respons.

export async function DELETE(req: NextRequest) {
  const { session, profile } = await getSessionProfile(req);

  if (!session) return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "Profil tidak ditemukan." }, { status: 404 });
  if (profile.deletedAt) {
    return NextResponse.json({ error: "Akun sudah dihapus." }, { status: 410 });
  }

  await db
    .update(profiles)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));

  // Sign out via Better Auth
  await auth.api.signOut({ headers: req.headers });

  return NextResponse.json({ success: true, data: { message: "Akun berhasil dihapus." } });
}
