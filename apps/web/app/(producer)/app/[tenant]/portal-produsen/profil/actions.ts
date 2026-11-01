"use server";

// Aksi tulis Profil produsen: simpan Gudang Pengiriman (alamat utama, format RajaOngkir). Doc: arsitektur-portal-produsen.md § 20.
// producerId SELALU dari getProducerAccess (sesi) — tidak pernah dari input. Hanya baris alamat UTAMA milik produsen sesi
// yang dibuat/diubah. Pengaruh ke ongkir hanya untuk produk produsen itu sendiri.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { parseCouriersInput } from "@/lib/producer-couriers";

type Result = { success: true } | { success: false; error: string };

function isUniqueViolation(e: unknown): boolean {
  const any = e as { code?: string; cause?: { code?: string } };
  return any?.code === "23505" || any?.cause?.code === "23505";
}

export async function saveWarehouseAction(
  slug: string,
  input: { label: string; addressDetail: string; cityId: number; cityLabel: string; postalCode: string },
): Promise<Result> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const label = String(input?.label ?? "").trim();
  const addressDetail = String(input?.addressDetail ?? "").trim();
  const cityLabel = String(input?.cityLabel ?? "").trim();
  const postalCode = String(input?.postalCode ?? "").trim();
  const cityId = Number(input?.cityId);

  if (label.length < 1 || label.length > 60) return { success: false, error: "Nama gudang 1–60 karakter." };
  if (addressDetail.length < 5 || addressDetail.length > 300) return { success: false, error: "Alamat lengkap 5–300 karakter." };
  if (!Number.isInteger(cityId) || cityId <= 0 || cityId > 2_000_000_000 || cityLabel.length < 3 || cityLabel.length > 200) {
    return { success: false, error: "Pilih lokasi (kelurahan/kecamatan) dari daftar pencarian." };
  }
  if (postalCode && !/^\d{4,10}$/.test(postalCode)) return { success: false, error: "Kode pos hanya angka." };

  const { db, schema } = createTenantDb(access.tenant.slug);
  const W = schema.producerWarehouses;
  const values = { label, addressDetail, rajaongkirCityId: cityId, rajaongkirCityLabel: cityLabel, postalCode: postalCode || null, updatedAt: new Date() };

  try {
    const [existing] = await db.select({ id: W.id }).from(W)
      .where(and(eq(W.producerId, access.producer.id), eq(W.isDefault, true))).limit(1);
    if (existing) {
      await db.update(W).set(values).where(and(eq(W.id, existing.id), eq(W.producerId, access.producer.id)));
    } else {
      await db.insert(W).values({ producerId: access.producer.id, isDefault: true, ...values });
    }
    revalidatePath(`/app/${slug}/portal-produsen/profil`);
    return { success: true };
  } catch (e) {
    // Dua simpan bersamaan sama-sama melihat "belum ada" → yang kalah kena unique index; coba ubah sekali lagi
    if (isUniqueViolation(e)) {
      try {
        await db.update(W).set(values).where(and(eq(W.producerId, access.producer.id), eq(W.isDefault, true)));
        revalidatePath(`/app/${slug}/portal-produsen/profil`);
        return { success: true };
      } catch (e2) { console.error("[producer-warehouse] ulang gagal:", e2); }
    } else {
      console.error("[producer-warehouse] simpan gagal:", e);
    }
    return { success: false, error: "Gagal menyimpan gudang." };
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
