import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getInvoiceListAction } from "../actions";
import { InvoiceListClient } from "@/components/keuangan/billing/invoice-list-client";

export default async function BillingInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ status?: string; page?: string; search?: string }>;
}) {
  const { tenant: slug }                   = await params;
  const { status, page, search }           = await searchParams;
  const access                             = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const result = await getInvoiceListAction(slug, {
    status: status ?? "all",
    page:   page ? parseInt(page) : 1,
    search,
  });

  const data = result.success ? result.data : { rows: [], total: 0 };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Invoice</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola semua tagihan — manual, toko, donasi, event.
          </p>
        </div>
        <Link
          href={`/${slug}/finance/billing/invoice/new`}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Invoice
        </Link>
      </div>

      <InvoiceListClient
        slug={slug}
        rows={data.rows}
        total={data.total}
        currentStatus={status ?? "all"}
        currentPage={page ? parseInt(page) : 1}
        currentSearch={search ?? ""}
      />
    </div>
  );
}
