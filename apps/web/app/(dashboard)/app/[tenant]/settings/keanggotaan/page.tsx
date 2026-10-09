import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSetting } from "@jalajogja/db";
import { MembershipConfigForm } from "@/components/settings/membership-config-form";
import { WhatsappGroupForm } from "@/components/settings/whatsapp-group-form";
import { WHATSAPP_GROUP_SETTING_KEY } from "@/lib/whatsapp-group";
import type { MembershipConfigData } from "../actions";

export default async function KeanggotaanSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");
  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;
  const groupUrl = (await getSetting<string>(tenantDb, WHATSAPP_GROUP_SETTING_KEY, "general")) ?? "";

  // Bagian syarat iuran/info pendaftaran/nomor anggota hanya untuk tenant tipe forum — lihat
  // docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran Forum v2". Tautan grup WhatsApp berlaku
  // untuk SEMUA tipe tenant (docs/arsitektur-gabung-forum.md § 9b).
  if (access.tenant.tenantType !== "forum") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Keanggotaan</h2>
          <p className="text-sm text-muted-foreground">Pengaturan grup WhatsApp untuk anggota.</p>
        </div>
        <WhatsappGroupForm slug={slug} defaultUrl={groupUrl} />
      </div>
    );
  }

  const [config, products, campaigns] = await Promise.all([
    getSetting<MembershipConfigData>(tenantDb, "membership_config", "forum"),
    db.select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.status, "active"))
      .orderBy(schema.products.name),
    db.select({ id: schema.campaigns.id, title: schema.campaigns.title })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.status, "active"))
      .orderBy(schema.campaigns.title),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Keanggotaan Forum</h2>
        <p className="text-sm text-muted-foreground">
          Tulis informasi tentang forum ini + tentukan produk/campaign sebagai syarat iuran
          (opsional) untuk anggota baru yang bergabung lewat halaman pendaftaran forum
          (<code className="text-xs">/gabung</code>).
        </p>
      </div>

      <MembershipConfigForm
        slug={slug}
        products={products.map((p) => ({ id: p.id, label: p.name }))}
        campaigns={campaigns.map((c) => ({ id: c.id, label: c.title }))}
        defaultValues={{
          requiredProductId:  config?.requiredProductId  ?? null,
          productRequired:    config?.productRequired     ?? false,
          requiredCampaignId: config?.requiredCampaignId ?? null,
          campaignRequired:   config?.campaignRequired    ?? false,
          registrationInfo:   config?.registrationInfo    ?? null,
          membershipNumberFormat: config?.membershipNumberFormat ?? null,
        }}
      />

      <WhatsappGroupForm slug={slug} defaultUrl={groupUrl} />
    </div>
  );
}
