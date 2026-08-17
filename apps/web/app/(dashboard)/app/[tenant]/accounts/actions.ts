"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, profiles, user as authUser } from "@jalajogja/db";
import { auth } from "@/lib/auth";
import { getTenantAccess } from "@/lib/tenant";
import { normalizePhone } from "@/lib/phone";

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
  const phone = normalizePhone(data.phone);

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

  revalidatePath(`/app/${slug}/accounts`);
  return { success: true, profileId: created.id };
}

// ─── deleteProfileAction ──────────────────────────────────────────────────────
// Hard delete akun publik — dipakai untuk membersihkan registrasi yang salah
// jalur (harusnya anggota IKPM, tapi terlanjur daftar via jalur publik).
//
// Soft delete (DELETE /api/akun/profil, self-service) TIDAK cukup untuk kasus
// ini: hanya set deletedAt, email/phone tetap terkunci di kolom UNIQUE, dan
// akun Better Auth-nya tidak pernah dihapus — jadi orang tsb tetap tidak bisa
// daftar ulang sebagai anggota dengan email/HP yang sama.
//
// Aman dilakukan sebagai hard delete: session/account cascade dari public.user
// (onDelete: "cascade"), dan profile_id di semua tabel transaksi tenant
// (invoices/orders/donations/event_registrations) adalah ON DELETE SET NULL —
// riwayat transaksi tidak ikut terhapus, hanya kehilangan link ke profil ini.
export async function deleteProfileAction(
  slug: string,
  profileId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const existing = await db.query.profiles.findFirst({
    where:   eq(profiles.id, profileId),
    columns: { id: true, betterAuthUserId: true },
  });
  if (!existing) return { success: false, error: "Akun tidak ditemukan." };

  await db.transaction(async (tx) => {
    if (existing.betterAuthUserId) {
      await tx.delete(authUser).where(eq(authUser.id, existing.betterAuthUserId));
    }
    await tx.delete(profiles).where(eq(profiles.id, profileId));
  });

  revalidatePath(`/app/${slug}/accounts`);
  return { success: true };
}

