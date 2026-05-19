import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getInvoiceDetailAction } from "../../actions";
import { InvoiceDetailClient } from "@/components/keuangan/billing/invoice-detail-client";

export default async function BillingInvoiceDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const access               = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const result = await getInvoiceDetailAction(slug, id);
  if (!result.success) notFound();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/finance/billing/invoice`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Invoice
        </Link>
      </div>

      <InvoiceDetailClient slug={slug} invoice={result.data} />
    </div>
  );
}
