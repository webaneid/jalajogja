// Pemuat pilihan kurir produsen dari DB tenant. Doc: docs/arsitektur-portal-produsen.md § 25.
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db as publicDb, tenants, tenantAddonInstallations, addons } from "@jalajogja/db";
import type { TenantDb } from "@jalajogja/db";
import { sanitizeCouriers } from "@/lib/producer-couriers";

/** producerId → daftar kurir pilihan produsen. Produsen tanpa pilihan (NULL) TIDAK masuk map (= ikut daftar admin). */
export async function loadProducerCouriers(tenantClient: TenantDb, producerIds: (string | null | undefined)[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const ids = [...new Set(producerIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return out;
  const { db, schema } = tenantClient;
  const rows = await db.select({ id: schema.producers.id, couriers: schema.producers.couriers })
    .from(schema.producers).where(inArray(schema.producers.id, ids));
  for (const r of rows) {
    const c = sanitizeCouriers(r.couriers);
    if (c) out.set(r.id, c);
  }
  return out;
}

/** Daftar kurir admin tenant (add-on RajaOngkir aktif → config.couriers, sudah disanitasi); selain itu kosong. */
export async function loadTenantCouriers(slug: string): Promise<string[]> {
  const [row] = await publicDb
    .select({ config: tenantAddonInstallations.config, status: tenantAddonInstallations.status })
    .from(tenants)
    .innerJoin(tenantAddonInstallations, eq(tenantAddonInstallations.tenantId, tenants.id))
    .innerJoin(addons, eq(addons.id, tenantAddonInstallations.addonId))
    .where(and(eq(tenants.slug, slug), eq(addons.slug, "rajaongkir")))
    .limit(1);
  if (!row || row.status === "expired" || row.status === "inactive") return [];
  return sanitizeCouriers((row.config as { couriers?: unknown } | null)?.couriers) ?? [];
}
