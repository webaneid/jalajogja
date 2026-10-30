"use server";

import { db, tenantAddonInstallations } from "@jalajogja/db";
import { and, eq } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { isValidUuid } from "@/lib/is-uuid";
import { RAJAONGKIR_COURIER_CODES } from "@/lib/rajaongkir-couriers";

type RajaOngkirConfig = {
  origin_city_id:   number | null;
  origin_city_name: string;
  couriers:         string[];
};

// Dulu action ini TANPA autentikasi (siapa pun yang tahu installationId bisa mengubah konfigurasi ongkir tenant mana
// pun — temuan audit 2026-10-31). Kini: sesi + akses penuh modul Toko (ongkir = pengiriman toko), baris instalasi
// WAJIB milik tenant dari session (bukan hanya id dari klien), dan bentuk config divalidasi di server.
export async function saveRajaOngkirConfigAction(
  slug: string,
  installationId: string,
  config: RajaOngkirConfig,
): Promise<{ ok: true } | { error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { error: "Akses ditolak." };
  if (!isValidUuid(installationId)) return { error: "Instalasi tidak valid." };

  const cityId = config?.origin_city_id;
  if (cityId !== null && !(Number.isInteger(cityId) && cityId > 0)) return { error: "Kota asal tidak valid." };
  const cityName = typeof config?.origin_city_name === "string" ? config.origin_city_name.trim().slice(0, 150) : "";
  const couriers = Array.isArray(config?.couriers) ? config.couriers : null;
  if (!couriers || couriers.length > RAJAONGKIR_COURIER_CODES.length || !couriers.every((c) => typeof c === "string" && RAJAONGKIR_COURIER_CODES.includes(c))) {
    return { error: "Daftar kurir tidak valid." };
  }

  try {
    const updated = await db
      .update(tenantAddonInstallations)
      .set({ config: { origin_city_id: cityId, origin_city_name: cityName, couriers: [...new Set(couriers)] }, updatedAt: new Date() })
      .where(and(eq(tenantAddonInstallations.id, installationId), eq(tenantAddonInstallations.tenantId, access.tenant.id)))
      .returning({ id: tenantAddonInstallations.id });
    if (updated.length === 0) return { error: "Instalasi tidak ditemukan." };
    return { ok: true };
  } catch (err) {
    console.error("[saveRajaOngkirConfigAction]", err);
    return { error: "Gagal menyimpan konfigurasi" };
  }
}
