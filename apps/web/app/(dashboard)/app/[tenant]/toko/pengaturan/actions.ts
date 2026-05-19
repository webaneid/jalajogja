"use server";

import { createTenantDb, upsertSettings } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { canManageUsers } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { TokoSettings } from "@/lib/toko-settings";

type ActionResult = { error?: string };

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
