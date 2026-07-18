import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getInstallmentPlanListAction } from "../actions";
import { InstallmentPlanListClient } from "@/components/keuangan/billing/installment-plan-list-client";
import { BillingTabs } from "@/components/keuangan/billing/billing-tabs";

export default async function CicilanListPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const result = await getInstallmentPlanListAction(slug);
  const rows = result.success ? result.data : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cicilan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Program bayar bertahap terjadwal — saat ini untuk tiket event.
          </p>
        </div>
        <Link
          href={`/app/${slug}/finance/billing/cicilan/new`}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Program
        </Link>
      </div>

      <BillingTabs slug={slug} active="cicilan" />

      <InstallmentPlanListClient slug={slug} rows={rows} />
    </div>
  );
}
