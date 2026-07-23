"use server";

import { createTenantDb, upsertSettings, upsertSetting } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { canManageUsers, hasFullAccess } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { revalidatePath } from "next/cache";
import type { TokoSettings } from "@/lib/toko-settings";
import { PRODUCT_ARCHIVE_CARD_DESIGN_IDS, type ProductArchiveCardDesignId } from "@/lib/product-archive-card-designs";

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
    toko_whatsapp:      normalizePhone(values.tokoWhatsapp) ?? "",
  });

  revalidatePath(`/app/${slug}/toko/pengaturan`);
  return {};
}

// ─── Desain Kartu Arsip — docs/arsitektur-product.md ──────────────────────────

export async function saveProductArchiveDesignAction(
  slug:   string,
  design: ProductArchiveCardDesignId,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { error: "Akses ditolak." };

  if (!PRODUCT_ARCHIVE_CARD_DESIGN_IDS.includes(design))
    return { error: "Pilihan desain tidak valid." };

  const tenantDb = createTenantDb(slug);
  await upsertSetting(tenantDb, "product_archive_design", "toko", { design });

  revalidatePath(`/${slug}/produk`);
  revalidatePath(`/app/${slug}/toko/pengaturan`);
  return {};
}
