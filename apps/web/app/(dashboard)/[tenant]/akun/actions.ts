"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, profiles, members } from "@jalajogja/db";
import { auth } from "@/lib/auth";
import { getTenantAccess } from "@/lib/tenant";

// ─── createProfileAction ──────────────────────────────────────────────────────
// Admin tambah akun publik baru dari dashboard tenant.
// Password opsional — jika diisi, buat Better Auth user sekaligus.

type CreateProfileData = {
  name:          string;
  email:         string;
  phone:         string;
  password?:     string;
  addressDetail?: string;
  provinceId?:   string;
  regencyId?:    string;
  districtId?:   string;
  villageId?:    string;
  country?:      string;
};

export async function createProfileAction(
  slug: string,
  data: CreateProfileData
): Promise<{ success: true; profileId: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const name  = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone.trim();

  if (!name || !email || !phone) {
    return { success: false, error: "Nama, email, dan nomor HP wajib diisi." };
  }

  // Cek duplikat email + phone sekaligus
  const existing = await db.query.profiles.findFirst({
    where: or(eq(profiles.email, email), eq(profiles.phone, phone)),
  });
  if (existing) {
    const field = existing.email === email ? "Email" : "Nomor HP";
    return { success: false, error: `${field} sudah dipakai akun lain.` };
  }

  // Jika password diisi → buat Better Auth user sekaligus
  let betterAuthUserId: string | undefined;
  if (data.password && data.password.length >= 8) {
    try {
      const signUpResult = await auth.api.signUpEmail({
        body: { name, email, password: data.password },
      });
      if (!signUpResult?.user?.id) {
        return { success: false, error: "Gagal membuat akun login. Coba lagi." };
      }
      betterAuthUserId = signUpResult.user.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("email") || msg.includes("duplicate")) {
        return { success: false, error: "Email sudah terdaftar di sistem login." };
      }
      return { success: false, error: "Gagal membuat akun login. Coba lagi." };
    }
  }

  const [created] = await db
    .insert(profiles)
    .values({
      name,
      email,
      phone,
      betterAuthUserId,
      addressDetail:      data.addressDetail?.trim() || undefined,
      provinceId:         data.provinceId   || undefined,
      regencyId:          data.regencyId    || undefined,
      districtId:         data.districtId   || undefined,
      villageId:          data.villageId    || undefined,
      country:            data.country?.trim() || "Indonesia",
      registeredAtTenant: access.tenant.id,
    })
    .returning({ id: profiles.id });

  revalidatePath(`/${slug}/akun`);
  return { success: true, profileId: created.id };
}

// ─── linkProfileToMemberAction ────────────────────────────────────────────────
// Admin link profile publik → anggota IKPM.
// Otomatis set account_type = 'member'.

export async function linkProfileToMemberAction(
  slug: string,
  profileId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
  });
  if (!profile)        return { success: false, error: "Profil tidak ditemukan." };
  if (profile.deletedAt) return { success: false, error: "Profil sudah dihapus." };

  const member = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });
  if (!member) return { success: false, error: "Anggota tidak ditemukan." };

  const existingLink = await db.query.profiles.findFirst({
    where: eq(profiles.memberId, memberId),
  });
  if (existingLink && existingLink.id !== profileId) {
    return { success: false, error: "Anggota ini sudah ter-link ke profil lain." };
  }

  await db
    .update(profiles)
    .set({ memberId, accountType: "member", updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  revalidatePath(`/${slug}/akun/${profileId}`);
  revalidatePath(`/${slug}/akun`);
  return { success: true };
}

// ─── unlinkProfileFromMemberAction ───────────────────────────────────────────
// Lepas link profile dari member → account_type kembali ke 'akun'.

export async function unlinkProfileFromMemberAction(
  slug: string,
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  await db
    .update(profiles)
    .set({ memberId: null, accountType: "akun", updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  revalidatePath(`/${slug}/akun/${profileId}`);
  revalidatePath(`/${slug}/akun`);
  return { success: true };
}
