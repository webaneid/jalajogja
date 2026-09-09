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
  // Auto-cancel pesanan (invoice dengan item produk) yang belum dibayar. Lihat
  // docs/arsitektur-stok.md. Reminder H-1 sebelum dueDate TETAP jalan terlepas toggle ini —
  // ini cuma soal apa yang terjadi SETELAH dueDate lewat tanpa pembayaran.
  autoCancelEnabled:      boolean;
  autoCancelDaysAfterDue: number; // hari setelah dueDate lewat sebelum invoice dibatalkan otomatis
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
  autoCancelEnabled:      false,
  autoCancelDaysAfterDue: 2,
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
    autoCancelEnabled:      (raw.auto_cancel_enabled         as boolean | undefined) ?? DEFAULT_TOKO_SETTINGS.autoCancelEnabled,
    autoCancelDaysAfterDue: (raw.auto_cancel_days_after_due  as number  | undefined) ?? DEFAULT_TOKO_SETTINGS.autoCancelDaysAfterDue,
  };
}
