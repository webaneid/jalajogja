import { db, profiles, members, contacts } from "@jalajogja/db";
import { eq, and, isNull, sql } from "drizzle-orm";

// Cari betterAuthUserId dari nomor HP/WA (format E.164) — cek public.profiles (akun publik)
// dulu, lalu public.contacts → public.members (anggota IKPM). Return null kalau nomor tidak
// terdaftar di akun manapun. SATU sumber kebenaran — sebelumnya diduplikasi identik di
// login-via-otp/route.ts DAN verify-otp/route.ts (2 salinan persis sama), sekarang dipakai
// bersama termasuk oleh send-otp/route.ts (cegah kirim OTP login ke nomor tak terdaftar).
export async function findUserByPhone(phone: string): Promise<string | null> {
  const [profile] = await db
    .select({ betterAuthUserId: profiles.betterAuthUserId })
    .from(profiles)
    .where(and(eq(profiles.phone, phone), isNull(profiles.deletedAt)))
    .limit(1);
  if (profile?.betterAuthUserId) return profile.betterAuthUserId;

  const [member] = await db
    .select({ betterAuthUserId: members.betterAuthUserId })
    .from(members)
    .innerJoin(contacts, eq(contacts.id, members.contactId))
    .where(eq(sql`COALESCE(${contacts.whatsapp}, ${contacts.phone})`, phone))
    .limit(1);
  if (member?.betterAuthUserId) return member.betterAuthUserId;

  return null;
}
