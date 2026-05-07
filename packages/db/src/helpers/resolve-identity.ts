import { eq, or } from "drizzle-orm";
import type { PublicDb } from "../client";
import { profiles, members, contacts } from "../schema/public";

// ─── resolveIdentity ──────────────────────────────────────────────────────────
// Lookup identitas dari public schema berdasarkan session atau email/phone.
//
// Urutan lookup:
//   1. betterAuthUserId → cek public.members dulu (anggota IKPM), lalu public.profiles (publik)
//   2. email / phone    → cek contacts → members, lalu profiles
//   3. tidak ketemu     → guest (keduanya null)
//
// Dipakai di semua checkout: cart, donasi, event.
// member_id  → anggota IKPM (dari public.members)
// profile_id → akun publik  (dari public.profiles)

export type ResolvedIdentity = {
  profileId:    string | null;
  memberId:     string | null;
  resolvedName: string | null;
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

  // ── 1a. Session login → cek public.members (anggota IKPM) ───────────────────
  if (betterAuthUserId) {
    const member = await publicDb.query.members.findFirst({
      where: eq(members.betterAuthUserId, betterAuthUserId),
      columns: { id: true, name: true },
    });
    if (member) {
      return { profileId: null, memberId: member.id, resolvedName: member.name };
    }

    // ── 1b. Session login → cek public.profiles (akun publik) ─────────────────
    const profile = await publicDb.query.profiles.findFirst({
      where: eq(profiles.betterAuthUserId, betterAuthUserId),
      columns: { id: true, name: true, deletedAt: true },
    });
    if (profile && !profile.deletedAt) {
      return { profileId: profile.id, memberId: null, resolvedName: profile.name };
    }
  }

  // ── 2a. Lookup via email/phone → contacts → members ──────────────────────────
  if (email || phone) {
    const conditions = [];
    if (email) conditions.push(eq(contacts.email, email));
    if (phone) conditions.push(eq(contacts.phone, phone));
    const cond = conditions.length === 1 ? conditions[0] : or(...conditions);

    const rows = await publicDb
      .select({ memberId: members.id, memberName: members.name })
      .from(members)
      .innerJoin(contacts, eq(contacts.id, members.contactId))
      .where(cond)
      .limit(1);

    if (rows[0]) {
      return { profileId: null, memberId: rows[0].memberId, resolvedName: rows[0].memberName };
    }

    // ── 2b. Lookup via email/phone → public.profiles ─────────────────────────
    const pcond = [];
    if (email) pcond.push(eq(profiles.email, email));
    if (phone) pcond.push(eq(profiles.phone, phone));

    const profile = await publicDb.query.profiles.findFirst({
      where: pcond.length === 1 ? pcond[0] : or(...pcond),
      columns: { id: true, name: true, deletedAt: true },
    });
    if (profile && !profile.deletedAt) {
      return { profileId: profile.id, memberId: null, resolvedName: profile.name };
    }
  }

  // ── 3. Guest murni ────────────────────────────────────────────────────────────
  return { profileId: null, memberId: null, resolvedName: null };
}
