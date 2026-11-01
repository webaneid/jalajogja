import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { createTenantDb, getSettings, db as publicDb, tenantAddonInstallations, addons } from "@jalajogja/db";
import { and, eq } from "drizzle-orm";
import { RAJAONGKIR_COURIER_OPTIONS } from "@/lib/rajaongkir-couriers";
import { sanitizeCouriers } from "@/lib/producer-couriers";
import { CourierLogosForm } from "./courier-logos-form";
import { getTokoSettings } from "@/lib/toko-settings";
import { TokoSettingsForm } from "./toko-settings-form";
import { ProductArchiveDesignForm } from "./product-archive-design-form";
import { PRODUCT_ARCHIVE_CARD_DESIGN_IDS, type ProductArchiveCardDesignId } from "@/lib/product-archive-card-designs";

export default async function TokoSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const settings = await getTokoSettings(slug);

  // Desain kartu arsip — lihat docs/arsitektur-product.md
  const tenantClient     = createTenantDb(slug);
  const tokoSettingsRaw  = await getSettings(tenantClient, "toko");
  const archiveDesignRaw = tokoSettingsRaw.product_archive_design as { design?: string } | undefined;
  const archiveDesign: ProductArchiveCardDesignId = PRODUCT_ARCHIVE_CARD_DESIGN_IDS.includes(archiveDesignRaw?.design as ProductArchiveCardDesignId)
    ? (archiveDesignRaw!.design as ProductArchiveCardDesignId)
    : "1";

  // Logo kurir: daftar kurir = yang diaktifkan tenant di add-on RajaOngkir (bila terpasang), selain itu semua kurir yang didukung
  const logoMap = (tokoSettingsRaw.courier_logos as Record<string, string> | undefined) ?? {};
  let enabledCodes: string[] | null = null;
  try {
    const inst = await publicDb
      .select({ config: tenantAddonInstallations.config })
      .from(tenantAddonInstallations)
      .innerJoin(addons, eq(addons.id, tenantAddonInstallations.addonId))
      .where(and(eq(tenantAddonInstallations.tenantId, access.tenant.id), eq(addons.slug, "rajaongkir")))
      .limit(1).then((r) => r[0]);
    const cs = (inst?.config as { couriers?: string[] } | undefined)?.couriers;
    if (Array.isArray(cs) && cs.length > 0) enabledCodes = cs;
  } catch { /* add-on belum terpasang → tampilkan semua */ }
  // Kurir pilihan produsen (§ 25) ikut tampil, supaya label produsen yang memakai kurir di luar daftar admin tetap bisa berlogo
  if (enabledCodes) {
    try {
      const prodRows = await tenantClient.db.select({ couriers: tenantClient.schema.producers.couriers }).from(tenantClient.schema.producers);
      const extra = new Set(enabledCodes);
      for (const r of prodRows) for (const c of sanitizeCouriers(r.couriers) ?? []) extra.add(c);
      enabledCodes = [...extra];
    } catch { /* kolom/tabel belum ada → pakai daftar admin saja */ }
  }
  const courierOptions = RAJAONGKIR_COURIER_OPTIONS
    .filter((c) => !enabledCodes || enabledCodes.includes(c.value))
    .map((c) => ({ code: c.value as string, label: c.label as string }));

  return (
    <div className="p-6 max-w-2xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Toko</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konfigurasi sistem mitra dan informasi toko.
        </p>
      </div>
      <TokoSettingsForm slug={slug} initialSettings={settings} />

      <div className="border-t border-border" />

      <ProductArchiveDesignForm slug={slug} initialDesign={archiveDesign} />

      <div className="border-t border-border" />

      <CourierLogosForm slug={slug} couriers={courierOptions} initialLogos={logoMap} canEdit={hasFullAccess(access.tenantUser, "toko")} />
    </div>
  );
}
