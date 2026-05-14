import { createTenantDb, getSettings } from "@jalajogja/db";

export type TokoSettings = {
  mitraEnabled:     boolean;
  mitraMaxProducts: number;
  minKomisiMitra:   number;
  tokoDescription:  string;
  tokoWhatsapp:     string;
};

export const DEFAULT_TOKO_SETTINGS: TokoSettings = {
  mitraEnabled:     false,
  mitraMaxProducts: 20,
  minKomisiMitra:   10,
  tokoDescription:  "",
  tokoWhatsapp:     "",
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
  };
}
