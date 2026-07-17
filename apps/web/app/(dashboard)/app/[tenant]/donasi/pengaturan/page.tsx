import { redirect }                   from "next/navigation";
import { getTenantAccess }             from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { DonationSettingsClient }      from "@/components/donasi/donation-settings-client";
import { QurbanSettingsClient }        from "@/components/donasi/qurban-settings-client";
import { CampaignArchiveDesignSettingsClient } from "@/components/donasi/campaign-archive-design-settings-client";
import type { QurbanConfig }           from "@/app/(dashboard)/app/[tenant]/donasi/actions";
import { CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS, type CampaignArchiveCardDesignId } from "@/lib/campaign-archive-card-designs";

export default async function DonationSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);
  const settings     = await getSettings(tenantClient, "donasi");

  // Rekomendasi nominal donasi
  const donationConfig = settings.donation_config as
    | { recommended_amounts?: number[] }
    | undefined;
  const initialAmounts: number[] = donationConfig?.recommended_amounts ?? [10000, 50000, 100000, 500000];

  // Konfigurasi qurban — biaya administrasi penyembelihan per hewan
  const qurbanRaw = settings.qurban_config as
    | { slaughter_fees?: { domba?: number; kambing?: number; sapi?: number } }
    | undefined;
  const qurbanConfig: QurbanConfig = {
    slaughterFees: {
      domba:   qurbanRaw?.slaughter_fees?.domba   ?? 0,
      kambing: qurbanRaw?.slaughter_fees?.kambing ?? 0,
      sapi:    qurbanRaw?.slaughter_fees?.sapi    ?? 0,
    },
  };

  // Desain kartu arsip — lihat docs/arsitektur-donasi.md § 14l
  const archiveDesignRaw = settings.campaign_archive_design as { design?: string } | undefined;
  const archiveDesign: CampaignArchiveCardDesignId = CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS.includes(archiveDesignRaw?.design as CampaignArchiveCardDesignId)
    ? (archiveDesignRaw!.design as CampaignArchiveCardDesignId)
    : "1";

  return (
    <div className="p-6 space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Donasi</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konfigurasi umum untuk modul donasi dan qurban.
        </p>
      </div>

      {/* Section 1 — Rekomendasi nominal */}
      <section>
        <DonationSettingsClient slug={slug} initialAmounts={initialAmounts} />
      </section>

      <div className="border-t border-border" />

      {/* Section 2 — Pengaturan Qurban */}
      <section>
        <QurbanSettingsClient slug={slug} config={qurbanConfig} />
      </section>

      <div className="border-t border-border" />

      {/* Section 3 — Desain Kartu Arsip */}
      <section>
        <CampaignArchiveDesignSettingsClient slug={slug} initialDesign={archiveDesign} />
      </section>
    </div>
  );
}
