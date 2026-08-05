import { createTenantDb, getSettings } from "@jalajogja/db";

export type TokoSettings = {
  mitraEnabled:     boolean;
  mitraMaxProducts: number;
  minKomisiMitra:   number;
  tokoDescription:  string;
  tokoWhatsapp:     string;
  // Opsi pengiriman & pembayaran toko (penjual = tenant sendiri). Lihat docs/arsitektur-billing.md
  // § COD & Ambil Sendiri — konfigurasi mitra terpisah, disimpan di tabel mitras sendiri.
  codEnabled:         boolean;
  pickupEnabled:      boolean;
  pickupLocationName: string;
  pickupAddress:      string;
  pickupMapsUrl:      string;
};

export const DEFAULT_TOKO_SETTINGS: TokoSettings = {
  mitraEnabled:     false,
  mitraMaxProducts: 20,
  minKomisiMitra:   10,
  tokoDescription:  "",
  tokoWhatsapp:     "",
  codEnabled:         false,
  pickupEnabled:      false,
  pickupLocationName: "",
  pickupAddress:      "",
  pickupMapsUrl:      "",
};

export async function getTokoSettings(slug: string): Promise<TokoSettings> {
  const tenantDb = createTenantDb(slug);
  const raw      = await getSettings(tenantDb, "toko");
  return {
    mitraEnabled:     (raw.mitra_enabled     as boolean | undefined) ?? DEFAULT_TOKO_SETTINGS.mitraEnabled,
    mitraMaxProducts: (raw.mitra_max_products as number  | undefined) ?? DEFAULT_TOKO_SETTINGS.mitraMaxProducts,
    minKomisiMitra:   (raw.min_komisi_mitra  as number  | undefined) ?? DEFAULT_TOKO_SETTINGS.minKomisiMitra,
    tokoDescription:  (raw.toko_description  as string  | undefined) ?? DEFAULT_TOKO_SETTINGS.tokoDescription,
    tokoWhatsapp:     (raw.toko_whatsapp     as string  | undefined) ?? DEFAULT_TOKO_SETTINGS.tokoWhatsapp,
    codEnabled:         (raw.cod_enabled          as boolean | undefined) ?? DEFAULT_TOKO_SETTINGS.codEnabled,
    pickupEnabled:      (raw.pickup_enabled       as boolean | undefined) ?? DEFAULT_TOKO_SETTINGS.pickupEnabled,
    pickupLocationName: (raw.pickup_location_name as string  | undefined) ?? DEFAULT_TOKO_SETTINGS.pickupLocationName,
    pickupAddress:      (raw.pickup_address       as string  | undefined) ?? DEFAULT_TOKO_SETTINGS.pickupAddress,
    pickupMapsUrl:      (raw.pickup_maps_url      as string  | undefined) ?? DEFAULT_TOKO_SETTINGS.pickupMapsUrl,
  };
}
