import { eq, or } from "drizzle-orm";
import type { PublicDb } from "../client";
import { profiles, members, contacts } from "../schema/public";

// ─── resolveIdentity ──────────────────────────────────────────────────────────
// Lookup identitas dari public schema berdasarkan:
//   1. betterAuthUserId (session login) → cari di profiles
//   2. email / phone → cari di profiles
//   3. email / phone → fallback ke members via contacts (lazy-create profile)
//   4. tidak ketemu → guest (profileId = null, memberId = null)
//
// Dipakai di semua checkout: cart, donasi, event.
// Mengembalikan profileId + memberId untuk disimpan ke tabel transaksi.

export type ResolvedIdentity = {
  profileId:    string | null;
  memberId:     string | null;
  resolvedName: string | null; // nama dari profil/member jika ketemu
};

export async function resolveIdentity(
  publicDb: PublicDb,
  opts: {
    betterAuthUserId?: string | null;
    phone?:            string | null;
    email?:            string | null;
  }
): Promise<ResolvedIdentity> {
  const { betterAuthUserId, phone, email } = opts;

  // ── 1. Session login → cari profile by better_auth_user_id ──────────────────
  if (betterAuthUserId) {
    const profile = await publicDb.query.profiles.findFirst({
      where: eq(profiles.betterAuthUserId, betterAuthUserId),
    });
    if (profile) {
      return {
        profileId:    profile.id,
        memberId:     profile.memberId ?? null,
        resolvedName: profile.name,
      };
    }
  }

  // ── 2. Lookup di public.profiles by email atau phone ─────────────────────────
  if (email || phone) {
    const conditions = [];
    if (email) conditions.push(eq(profiles.email, email));
    if (phone) conditions.push(eq(profiles.phone, phone));

    const profile = await publicDb.query.profiles.findFirst({
      where: conditions.length === 1 ? conditions[0] : or(...conditions),
    });
    if (profile && !profile.deletedAt) {
      return {
        profileId:    profile.id,
        memberId:     profile.memberId ?? null,
        resolvedName: profile.name,
      };
    }
  }

  // ── 3. Fallback: lookup di public.members via contacts ───────────────────────
  // Jika alumni IKPM checkout tanpa login → auto-create profile + link member
  if (email || phone) {
    const conditions = [];
    if (email) conditions.push(eq(contacts.email, email));
    if (phone) conditions.push(eq(contacts.phone, phone));

    const rows = await publicDb
      .select({
        memberId:   members.id,
        memberName: members.name,
      })
      .from(members)
      .innerJoin(contacts, eq(contacts.id, members.contactId))
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(1);

    if (rows[0]) {
      // Lazy-create profile linked ke member
      const [newProfile] = await publicDb
        .insert(profiles)
        .values({
          name:     rows[0].memberName,
          email:    email ?? `noemail-${rows[0].memberId}@placeholder.internal`,
          phone:    phone ?? `nophone-${rows[0].memberId}`,
          memberId: rows[0].memberId,
          accountType: "member",
        })
        .onConflictDoNothing()
        .returning({ id: profiles.id });

      return {
        profileId:    newProfile?.id ?? null,
        memberId:     rows[0].memberId,
        resolvedName: rows[0].memberName,
      };
    }
  }

  // ── 4. Guest murni — tidak ada di sistem ────────────────────────────────────
  return { profileId: null, memberId: null, resolvedName: null };
}
