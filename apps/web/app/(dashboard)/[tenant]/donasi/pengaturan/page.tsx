import { redirect }                   from "next/navigation";
import { getTenantAccess }             from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { DonationSettingsClient }      from "@/components/donasi/donation-settings-client";
import { QurbanSettingsClient }        from "@/components/donasi/qurban-settings-client";
import type { QurbanConfig }           from "@/app/(dashboard)/[tenant]/donasi/actions";

export default async function DonationSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const tenantClient = createTenantDb(slug);
  const settings     = await getSettings(tenantClient, "donasi");

  // Rekomendasi nominal donasi
  const donationConfig = settings.donation_config as
    | { recommended_amounts?: number[] }
    | undefined;
  const initialAmounts: number[] = donationConfig?.recommended_amounts ?? [10000, 50000, 100000, 500000];

  // Konfigurasi qurban
  const qurbanRaw = settings.qurban_config as
    | { default_prices?: { domba?: number; kambing?: number; sapi?: number }; admin_fee?: number; admin_fee_label?: string }
    | undefined;
  const qurbanConfig: QurbanConfig = {
    defaultPrices: {
      domba:   qurbanRaw?.default_prices?.domba   ?? 2500000,
      kambing: qurbanRaw?.default_prices?.kambing ?? 1800000,
      sapi:    qurbanRaw?.default_prices?.sapi    ?? 15000000,
    },
    adminFee:      qurbanRaw?.admin_fee       ?? 50000,
    adminFeeLabel: qurbanRaw?.admin_fee_label ?? "Biaya Administrasi",
  };

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
    </div>
  );
}
