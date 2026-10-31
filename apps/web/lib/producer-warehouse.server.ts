// Gudang pengiriman produsen → kota asal ongkir. Doc: docs/arsitektur-portal-produsen.md § 20.
// Dipakai di tiga titik: checkout publik, pesanan manual admin, dan form produk (apakah kolom "Kota Asal" per produk
// disembunyikan). Prioritas kota asal produk TENANT: gudang utama produsen → products.origin_city_id → default toko.
// Hanya produsen AKTIF yang gudangnya dipakai (produsen nonaktif = produknya memang tak bisa dipesan, P6).
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";

export type WarehouseOrigin = { cityId: number; cityLabel: string };

/**
 * Label yang AMAN tampil ke pembeli: hanya "KOTA, PROVINSI". Label RajaOngkir lengkap = "KELURAHAN, KECAMATAN, KOTA, PROVINSI, KODEPOS"
 * — kelurahan + kode pos gudang (sering rumah produsen perorangan) tidak boleh terlihat publik di halaman checkout
 * (selaras aturan direktori publik: tidak menampilkan kecamatan/desa). id lokasi (untuk hitung ongkir) tetap tingkat kelurahan.
 */
export function publicCityLabel(label: string): string {
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0 && /^\d{4,10}$/.test(parts[parts.length - 1])) parts.pop(); // buang kode pos
  return parts.length >= 3 ? parts.slice(-2).join(", ") : parts.join(", ");
}

/** producerId → gudang utama (hanya produsen aktif yang punya gudang). */
export async function loadDefaultWarehouses(tenantClient: TenantDb, producerIds: string[]): Promise<Map<string, WarehouseOrigin>> {
  const out = new Map<string, WarehouseOrigin>();
  const ids = [...new Set(producerIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const { db, schema } = tenantClient;
  try {
    const rows = await db.select({
      producerId: schema.producerWarehouses.producerId,
      cityId: schema.producerWarehouses.rajaongkirCityId,
      cityLabel: schema.producerWarehouses.rajaongkirCityLabel,
    }).from(schema.producerWarehouses)
      .innerJoin(schema.producers, eq(schema.producers.id, schema.producerWarehouses.producerId))
      .where(and(
        inArray(schema.producerWarehouses.producerId, ids),
        eq(schema.producerWarehouses.isDefault, true),
        eq(schema.producers.isActive, true),
      ));
    for (const r of rows) out.set(r.producerId, { cityId: r.cityId, cityLabel: publicCityLabel(r.cityLabel) });
  } catch (e) {
    // Tabel belum ada (migration 0080 terlambat/terlewat) tidak boleh merusak checkout: fallback ke kota asal lama.
    // Pemanggil di checkout publik berada dalam try yang bila gagal MENGOSONGKAN seluruh opsi pengiriman — jangan sampai terjadi.
    console.error("[producer-warehouse] loadDefaultWarehouses gagal, memakai kota asal lama:", e);
  }
  return out;
}

/** Id produsen (aktif) yang sudah punya gudang — untuk form produk. */
export async function listProducerIdsWithWarehouse(tenantClient: TenantDb): Promise<string[]> {
  const { db, schema } = tenantClient;
  try {
    const rows = await db.select({ producerId: schema.producerWarehouses.producerId })
      .from(schema.producerWarehouses)
      .innerJoin(schema.producers, eq(schema.producers.id, schema.producerWarehouses.producerId))
      .where(and(eq(schema.producerWarehouses.isDefault, true), eq(schema.producers.isActive, true)));
    return rows.map((r) => r.producerId);
  } catch (e) {
    console.error("[producer-warehouse] listProducerIdsWithWarehouse gagal:", e);
    return [];
  }
}
