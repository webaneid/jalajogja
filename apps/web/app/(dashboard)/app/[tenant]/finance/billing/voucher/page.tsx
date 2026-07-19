import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getVoucherListAction } from "../actions";
import { VoucherListClient } from "@/components/keuangan/billing/voucher-list-client";
import { BillingTabs } from "@/components/keuangan/billing/billing-tabs";

export default async function VoucherListPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const result = await getVoucherListAction(slug);
  const rows = result.success ? result.data : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Voucher</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kode diskon untuk produk, tiket event, atau donasi/qurban — dipotong per item, bukan invoice.
          </p>
        </div>
        <Link
          href={`/app/${slug}/finance/billing/voucher/new`}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Voucher
        </Link>
      </div>

      <BillingTabs slug={slug} active="voucher" />

      <VoucherListClient slug={slug} rows={rows} />
    </div>
  );
}
