// Asal kirim UTAMA produsen (pembungkus tipis di atas shipping_origins — docs/arsitektur-alamat.md § 20). Dipakai: checkout publik
// (alamat ambil-di-tempat diturunkan server), pesanan manual admin. Hanya produsen AKTIF (nonaktif = produknya tak bisa dipesan).
import "server-only";
import type { TenantDb } from "@jalajogja/db";
import { loadOriginIndex } from "@/lib/shipping-origins.server";

export type WarehouseOrigin = {
  cityId: number;
  /** Label AMAN untuk pembeli ("KOTA, PROVINSI") — dipakai judul paket & asal ongkir. */
  cityLabel: string;
  /** Detail gudang — HANYA untuk opsi "Ambil di tempat" yang dipilih pembeli (alamat lengkap). */
  name: string;
  addressDetail: string;
  fullLabel: string;
};

export { publicCityLabel } from "@/lib/city-label";
import { publicCityLabel } from "@/lib/city-label";

/** producerId → asal kirim UTAMA produsen (hanya produsen aktif yang punya asal). Pembungkus tipis di atas shipping_origins (§ 20). */
export async function loadDefaultWarehouses(tenantClient: TenantDb, producerIds: string[]): Promise<Map<string, WarehouseOrigin>> {
  const out = new Map<string, WarehouseOrigin>();
  const ids = new Set(producerIds.filter(Boolean));
  if (ids.size === 0) return out;
  const index = await loadOriginIndex(tenantClient); // gagal baca → indeks kosong + log (tak merusak checkout)
  for (const id of ids) {
    const o = index.producerDefault.get(id);
    if (o) out.set(id, { cityId: o.cityId, cityLabel: publicCityLabel(o.fullLabel), name: o.name, addressDetail: o.addressDetail, fullLabel: o.fullLabel });
  }
  return out;
}
