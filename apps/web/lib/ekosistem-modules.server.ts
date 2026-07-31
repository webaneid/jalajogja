import "server-only";
import { getSettings, type TenantDb } from "@jalajogja/db";
import { resolveEkosistemModulesConfig, type EkosistemModulesConfig } from "./ekosistem-modules";

/**
 * Fetch toggle modul ekosistem (Usaha/Pesantren/Profesional) untuk tenant tertentu.
 * `tenantClient` HARUS objek TenantDb utuh ({db, schema}) — bukan hasil destructure `.db` saja
 * (lesson lama: getSettings/getSetting butuh TenantDb lengkap).
 */
export async function getEnabledEkosistemModules(tenantClient: TenantDb): Promise<EkosistemModulesConfig> {
  const settings = await getSettings(tenantClient, "general");
  return resolveEkosistemModulesConfig(settings);
}
