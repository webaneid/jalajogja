import { redirect }                   from "next/navigation";
import { getTenantAccess }             from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { DonationSettingsClient }      from "@/components/donasi/donation-settings-client";

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

  const config = settings.donation_config as
    | { recommended_amounts?: number[] }
    | undefined;

  const initialAmounts: number[] = config?.recommended_amounts ?? [10000, 50000, 100000, 500000];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Donasi</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konfigurasi nominal rekomendasi untuk form donasi publik.
        </p>
      </div>

      <DonationSettingsClient slug={slug} initialAmounts={initialAmounts} />
    </div>
  );
}
