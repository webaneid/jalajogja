"use server";

// Aksi tulis Profil produsen: kelola ASAL KIRIM (gudang/pabrik, banyak alamat — shipping_origins, docs/arsitektur-alamat.md § 20) dan
// kurir pilihan. producerId SELALU dari getProducerAccess (sesi) — tidak pernah dari input; setiap query terikat produsen itu.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { parseCouriersInput } from "@/lib/producer-couriers";
import { parseOriginInput, type OriginDTO } from "@/lib/shipping-origins";
import { isUuid } from "@/lib/address-book";
import { saveOrigin, deleteOrigin, setDefaultOrigin } from "@/lib/shipping-origins.server";

type Result = { success: true } | { success: false; error: string };
type OriginsResult = { success: true; origins: OriginDTO[] } | { success: false; error: string };

export async function saveOriginAction(slug: string, input: unknown): Promise<OriginsResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  const parsed = parseOriginInput(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const r = await saveOrigin(createTenantDb(access.tenant.slug), { producerId: access.producer.id }, parsed.value);
    if (r.ok) revalidatePath(`/app/${slug}/portal-produsen/profil`);
    return r.ok ? { success: true, origins: r.origins } : { success: false, error: r.error };
  } catch (e) {
    console.error("[producer-origin] simpan gagal:", e);
    return { success: false, error: "Gagal menyimpan asal kirim." };
  }
}

export async function deleteOriginAction(slug: string, id: string): Promise<OriginsResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isUuid(id)) return { success: false, error: "Asal kirim tidak ditemukan." };
  try {
    const r = await deleteOrigin(createTenantDb(access.tenant.slug), { producerId: access.producer.id }, id);
    if (r.ok) revalidatePath(`/app/${slug}/portal-produsen/profil`);
    return r.ok ? { success: true, origins: r.origins } : { success: false, error: r.error };
  } catch (e) {
    console.error("[producer-origin] hapus gagal:", e);
    return { success: false, error: "Gagal menghapus asal kirim." };
  }
}

export async function setDefaultOriginAction(slug: string, id: string): Promise<OriginsResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isUuid(id)) return { success: false, error: "Asal kirim tidak ditemukan." };
  try {
    const r = await setDefaultOrigin(createTenantDb(access.tenant.slug), { producerId: access.producer.id }, id);
    if (r.ok) revalidatePath(`/app/${slug}/portal-produsen/profil`);
    return r.ok ? { success: true, origins: r.origins } : { success: false, error: r.error };
  } catch (e) {
    console.error("[producer-origin] ubah utama gagal:", e);
    return { success: false, error: "Gagal mengubah asal kirim utama." };
  }
}

/** Simpan kurir pilihan produsen (§ 25). null = ikut pengaturan admin. producerId dari sesi, bukan input. */
export async function saveProducerCouriersAction(slug: string, couriers: string[] | null): Promise<Result> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  const parsed = parseCouriersInput(couriers);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const { db, schema } = createTenantDb(access.tenant.slug);
    await db.update(schema.producers).set({ couriers: parsed.value, updatedAt: new Date() })
      .where(eq(schema.producers.id, access.producer.id));
    revalidatePath(`/app/${slug}/portal-produsen/profil`);
    return { success: true };
  } catch (e) {
    console.error("[producer-couriers] simpan gagal:", e);
    return { success: false, error: "Gagal menyimpan kurir." };
  }
}
