import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { createTenantDb, getSettings } from "@jalajogja/db";
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
    </div>
  );
}
