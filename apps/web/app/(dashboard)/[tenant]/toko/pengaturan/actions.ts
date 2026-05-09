"use server";

import { createTenantDb, getSettings, upsertSettings } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { canManageUsers } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

type ActionResult = { error?: string };

export type TokoSettings = {
  mitraEnabled:     boolean;
  mitraMaxProducts: number;   // 0 = tidak terbatas
  minKomisiMitra:   number;   // persen, misal 10 = 10%
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

export async function saveTokoSettingsAction(
  slug: string,
  values: TokoSettings,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  if (values.minKomisiMitra < 0 || values.minKomisiMitra > 100) {
    return { error: "Komisi harus antara 0–100%." };
  }
  if (values.mitraMaxProducts < 0) {
    return { error: "Batas produk tidak boleh negatif." };
  }

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "toko", {
    mitra_enabled:      values.mitraEnabled,
    mitra_max_products: values.mitraMaxProducts,
    min_komisi_mitra:   values.minKomisiMitra,
    toko_description:   values.tokoDescription,
    toko_whatsapp:      values.tokoWhatsapp,
  });

  revalidatePath(`/${slug}/toko/pengaturan`);
  return {};
}
