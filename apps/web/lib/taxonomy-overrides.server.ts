import "server-only";
import { getSettings, type TenantDb } from "@jalajogja/db";
import { EMPTY_TAXONOMY_OVERRIDES, type TaxonomyOverrides } from "./taxonomy-overrides";

/**
 * Fetch override label Kategori/Sektor/Bidang Usaha + toggle enable Sektor + Bidang Usaha
 * custom tenant. `tenantClient` HARUS objek TenantDb utuh ({db, schema}) — bukan hasil
 * destructure `.db` saja (lesson lama: getSettings/getSetting butuh TenantDb lengkap).
 *
 * Group "ekosistem", key "taxonomy_overrides" — group yang SAMA dipakai toggle enable/disable
 * modul (lib/ekosistem-modules.server.ts), nol migrasi tambahan. Fallback ke
 * EMPTY_TAXONOMY_OVERRIDES kalau key belum pernah disimpan (tenant belum pernah buka halaman
 * pengaturan) atau JSON-nya rusak — jangan pernah throw, halaman lain yang cuma butuh label
 * kanonik (default) tidak boleh ikut gagal.
 *
 * Detail arsitektur: docs/arsitektur-ekosistem.md § 10.
 */
export async function getTaxonomyOverrides(tenantClient: TenantDb): Promise<TaxonomyOverrides> {
  const settings = await getSettings(tenantClient, "ekosistem");
  const raw = settings["taxonomy_overrides"];
  if (!raw || typeof raw !== "object") return EMPTY_TAXONOMY_OVERRIDES;
  return raw as TaxonomyOverrides;
}
