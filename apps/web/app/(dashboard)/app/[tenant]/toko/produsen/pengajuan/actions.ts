"use server";
// Server Actions tinjauan Pengajuan Produsen — docs/arsitektur-pengajuan-produsen.md § 10–11.
// Setiap aksi: getTenantAccess(slug) + hasFullAccess(anggota) (Owner/Ketua/Sekretaris; tanpa role baru). Logika & kompensasi ada di
// lib/producer-application-review.server.ts; `slug` hanya dipakai setelah divalidasi getTenantAccess ke sesi.
import { revalidatePath } from "next/cache";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, hasReadAccess } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { approveApplication, rejectApplication } from "@/lib/producer-application-review.server";

type Result<T = void> = { success: true; data: T } | { success: false; error: string };

async function guard(slug: string) {
  const access = await getTenantAccess(slug);
  // anggota:full = berwenang memutuskan (Owner/Ketua/Sekretaris). toko:read = konsisten dengan halamannya (rute di bawah /toko) dan
  // menutup pemanggilan langsung Server Action oleh peran kustom yang tak punya akses Toko sama sekali.
  if (!access || !hasFullAccess(access.tenantUser, "anggota") || !hasReadAccess(access.tenantUser, "toko")) return null;
  return access;
}

function refresh(slug: string, id: string) {
  revalidatePath(`/app/${slug}/toko/produsen/pengajuan`);
  revalidatePath(`/app/${slug}/toko/produsen/pengajuan/${id}`);
  revalidatePath(`/app/${slug}/toko/produsen`);
  revalidatePath(`/app/${slug}/dashboard`);
}

export async function approveProducerApplicationAction(
  slug: string, id: string, input: { sharePercent: string; note?: string },
): Promise<Result<{ producerId: string }>> {
  try {
    const access = await guard(slug);
    if (!access) return { success: false, error: "Akses ditolak." };
    if (!checkRateLimit(`prodapp-approve:${access.tenantUser.id}`, 60, 60 * 60_000).allowed) return { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." };
    if (typeof input !== "object" || input === null) return { success: false, error: "Data tidak valid." };
    const res = await approveApplication(access, id, { sharePercent: input.sharePercent, note: input.note });
    if (res.ok) refresh(slug, id);
    return res.ok ? { success: true, data: res.data } : { success: false, error: res.error };
  } catch (e) {
    console.error("[approveProducerApplicationAction]", e instanceof Error ? e.message : "unknown");   // jangan log objek galat utuh (bisa memuat parameter query)
    return { success: false, error: "Gagal menyetujui pengajuan." };
  }
}

export async function rejectProducerApplicationAction(
  slug: string, id: string, input: { reason: string; note?: string },
): Promise<Result> {
  try {
    const access = await guard(slug);
    if (!access) return { success: false, error: "Akses ditolak." };
    if (!checkRateLimit(`prodapp-reject:${access.tenantUser.id}`, 60, 60 * 60_000).allowed) return { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." };
    if (typeof input !== "object" || input === null) return { success: false, error: "Data tidak valid." };
    const res = await rejectApplication(access, id, { reason: input.reason, note: input.note });
    if (res.ok) refresh(slug, id);
    return res.ok ? { success: true, data: undefined } : { success: false, error: res.error };
  } catch (e) {
    console.error("[rejectProducerApplicationAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal menolak pengajuan." };
  }
}
