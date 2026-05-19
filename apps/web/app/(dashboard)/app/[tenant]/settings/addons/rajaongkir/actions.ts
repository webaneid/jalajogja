"use server";

import { db, tenantAddonInstallations } from "@jalajogja/db";
import { eq } from "drizzle-orm";

type RajaOngkirConfig = {
  origin_city_id:   number | null;
  origin_city_name: string;
  couriers:         string[];
};

export async function saveRajaOngkirConfigAction(
  installationId: string,
  config: RajaOngkirConfig,
): Promise<{ ok: true } | { error: string }> {
  try {
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
