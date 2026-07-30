import { eq, and, isNull } from "drizzle-orm";
import { db, members, profiles, contacts, user } from "@jalajogja/db";

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

  // 1. Cek member IKPM yang sudah terhubung via betterAuthUserId
  let member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, userId),
    columns: {
      id: true, name: true, memberNumber: true, stambukNumber: true,
      birthDate: true, contactId: true, photoUrl: true,
    },
  });

  // 2. Jika belum terhubung (betterAuthUserId null), coba auto-link via email pengguna yang sama
  if (!member) {
    const userRow = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { email: true },
    });

    const userEmail = userRow?.email?.trim().toLowerCase();

    if (userEmail) {
      const matchedMember = await db
        .select({
          id: members.id,
          name: members.name,
          memberNumber: members.memberNumber,
          stambukNumber: members.stambukNumber,
          birthDate: members.birthDate,
          contactId: members.contactId,
          photoUrl: members.photoUrl,
        })
        .from(members)
        .innerJoin(contacts, eq(contacts.id, members.contactId))
        .where(
          and(
            eq(contacts.email, userEmail),
            isNull(members.betterAuthUserId)
          )
        )
        .limit(1)
        .then((r) => r[0]);

      if (matchedMember) {
        await db
          .update(members)
          .set({ betterAuthUserId: userId, updatedAt: new Date() })
          .where(and(eq(members.id, matchedMember.id), isNull(members.betterAuthUserId)));

        member = matchedMember;
      }
    }
  }

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
