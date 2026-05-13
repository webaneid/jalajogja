"use server";

import { db, tenantAddonInstallations } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";

type RajaOngkirConfig = {
  api_key:          string;
  tier:             "starter" | "pro";
  origin_city_id:   number | null;
  origin_city_name: string;
  couriers:         string[];
};

export async function saveRajaOngkirConfigAction(
  installationId: string,
  config: RajaOngkirConfig,
): Promise<{ ok: true } | { error: string }> {
  try {
    if (!config.api_key) {
      return { error: "API key wajib diisi" };
    }

    await db
      .update(tenantAddonInstallations)
      .set({ config, updatedAt: new Date() })
      .where(eq(tenantAddonInstallations.id, installationId));

    return { ok: true };
  } catch (err) {
    console.error("[saveRajaOngkirConfigAction]", err);
    return { error: "Gagal menyimpan konfigurasi" };
  }
}
