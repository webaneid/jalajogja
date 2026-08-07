import "server-only";
import { getSettings, type TenantDb } from "@jalajogja/db";
import {
  resolveEkosistemModulesConfig, resolveEkosistemModuleLabels,
  type EkosistemModulesConfig, type EkosistemModuleLabels,
} from "./ekosistem-modules";

/**
 * Fetch toggle modul ekosistem (Usaha/Pesantren/Profesional) untuk tenant tertentu.
 * `tenantClient` HARUS objek TenantDb utuh ({db, schema}) — bukan hasil destructure `.db` saja
 * (lesson lama: getSettings/getSetting butuh TenantDb lengkap).
 *
 * Group "ekosistem" (bukan "general") sejak modul admin /app/{slug}/ekosistem dibangun
 * (2026-08-07, migration 0061) — SATU-SATUNYA titik yang perlu tahu group ini, seluruh ~20
 * caller `getEnabledEkosistemModules()` di app tidak perlu disentuh kalau group berubah lagi
 * nanti.
 */
export async function getEnabledEkosistemModules(tenantClient: TenantDb): Promise<EkosistemModulesConfig> {
  const settings = await getSettings(tenantClient, "ekosistem");
  return resolveEkosistemModulesConfig(settings);
}

/**
 * Fetch label custom nama modul (2026-08-07) — SENGAJA fungsi TERPISAH dari
 * getEnabledEkosistemModules() (bukan digabung ke return-nya) supaya ~20 caller lama yang
 * cuma butuh boolean gate tidak perlu disentuh sama sekali. Konsekuensi: caller yang butuh
 * KEDUANYA (enabled + label) memanggil getSettings dua kali — biaya kecil (satu SELECT ringan
 * per group), konsisten pola getTaxonomyOverrides() yang juga terpisah dari fungsi ini.
 */
export async function getEkosistemModuleLabels(tenantClient: TenantDb): Promise<EkosistemModuleLabels> {
  const settings = await getSettings(tenantClient, "ekosistem");
  return resolveEkosistemModuleLabels(settings);
}
