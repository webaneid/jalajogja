import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { db, tenants, tenantAddonInstallations, addons } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import { RajaOngkirConfigForm } from "./config-form";

export default async function RajaOngkirSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenant = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)
    .then(r => r[0]);

  if (!tenant) redirect("/dashboard-redirect");

  const installation = await db
    .select({
      id:     tenantAddonInstallations.id,
      status: tenantAddonInstallations.status,
      config: tenantAddonInstallations.config,
    })
    .from(tenantAddonInstallations)
    .innerJoin(addons, eq(addons.id, tenantAddonInstallations.addonId))
    .where(and(
      eq(tenantAddonInstallations.tenantId, tenant.id),
      eq(addons.slug, "rajaongkir"),
    ))
    .limit(1)
    .then(r => r[0]);

  if (!installation) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Ongkos Kirim — RajaOngkir</h2>
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Add-on RajaOngkir belum terinstall. Hubungi tim jalakarta untuk mengaktifkannya.
          </p>
        </div>
      </div>
    );
  }

  type Config = {
    api_key?: string;
    tier?: "starter" | "pro";
    origin_city_id?: number;
    origin_city_name?: string;
    couriers?: string[];
  };

  const config = (installation.config as Config) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Ongkos Kirim — RajaOngkir</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konfigurasi API key dan kota asal pengiriman tenant
        </p>
      </div>
      <RajaOngkirConfigForm
        slug={slug}
        installationId={installation.id}
        initialConfig={{
          apiKey:         config.api_key ?? "",
          tier:           config.tier ?? "starter",
          originCityId:   config.origin_city_id ?? null,
          originCityName: config.origin_city_name ?? "",
          couriers:       config.couriers ?? ["jne", "tiki", "pos"],
        }}
      />
    </div>
  );
}
