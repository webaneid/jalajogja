import { eq } from "drizzle-orm";
import { db, members, profiles, contacts } from "@jalajogja/db";

// ─── AkunIdentity — unified identity untuk semua halaman /akun/* ──────────────
//
// Dua sumber identitas:
//   "member"  → public.members.better_auth_user_id   (alumni IKPM)
//   "public"  → public.profiles.better_auth_user_id  (akun umum)
//
// Semua halaman /akun/* pakai tipe ini — tidak perlu tahu asalnya dari tabel mana.

export type AkunIdentity = {
  type:         "member" | "public";

  // ── Common fields ─────────────────────────────────────────────────────────
  userId:       string;       // Better Auth user.id
  name:         string;
  email:        string;
  phone:        string | null;
  whatsapp:     string | null;

  // ── Member-specific (null jika type === "public") ─────────────────────────
  memberId:     string | null;
  memberNumber: string | null;
  stambuk:      string | null;
  birthDate:    string | null;
  contactId:    string | null;   // untuk cek kelengkapan data

  // ── Public-specific (null jika type === "member") ─────────────────────────
  profileId:    string | null;

  // ── Avatar ────────────────────────────────────────────────────────────────
  photoUrl:     string | null;   // null → gunakan Gravatar sebagai fallback
};

// ── getAkunIdentity ───────────────────────────────────────────────────────────
// Resolve identitas dari Better Auth user.id.
// Return null jika user tidak ditemukan di kedua tabel (misal: pengurus saja).

export async function getAkunIdentity(userId: string): Promise<AkunIdentity | null> {

  // Cek member IKPM yang sudah terhubung via betterAuthUserId.
  // TIDAK ADA auto-link berdasarkan email di sini — klaim identitas anggota HANYA boleh terjadi
  // lewat alur registrasi eksplisit (/api/akun/register), bukan efek samping loading halaman.
  // Email bukan bukti kepemilikan (tidak ada verifikasi email di project ini — lihat lib/auth.ts).
  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, userId),
    columns: {
      id: true, name: true, memberNumber: true, stambukNumber: true,
      birthDate: true, contactId: true, photoUrl: true,
    },
  });

  if (member) {
    const contact = member.contactId
      ? await db.query.contacts.findFirst({
          where: eq(contacts.id, member.contactId),
          columns: { email: true, phone: true, whatsapp: true },
        })
      : null;

    return {
      type:         "member",
      userId,
      name:         member.name,
      email:        contact?.email ?? "",
      phone:        contact?.phone ?? null,
      whatsapp:     contact?.whatsapp ?? null,
      memberId:     member.id,
      memberNumber: member.memberNumber ?? null,
      stambuk:      member.stambukNumber ?? null,
      birthDate:    member.birthDate ?? null,
      contactId:    member.contactId ?? null,
      profileId:    null,
      photoUrl:     member.photoUrl ?? null,
    };
  }

  // Cek akun publik
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.betterAuthUserId, userId),
    columns: {
      id: true, name: true, email: true, phone: true,
      whatsapp: true, deletedAt: true,
    },
  });

  if (!profile || profile.deletedAt) return null;

  return {
    type:         "public",
    userId,
    name:         profile.name,
    email:        profile.email,
    phone:        profile.phone,
    whatsapp:     profile.whatsapp ?? null,
    memberId:     null,
    memberNumber: null,
    stambuk:      null,
    birthDate:    null,
    contactId:    null,
    profileId:    profile.id,
    photoUrl:     null,
  };
}

// ── isMemberDataIncomplete ────────────────────────────────────────────────────
// Cek apakah anggota IKPM perlu melengkapi data.
// Proxy cepat: cukup cek birthDate + contactId.

// Data dianggap lengkap jika Step 1 (birthDate) + Step 2 (contactId + phone) terisi
export function isMemberDataIncomplete(identity: AkunIdentity): boolean {
  if (identity.type !== "member") return false;
  return !identity.birthDate || !identity.contactId || !identity.phone;
}
