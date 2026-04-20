import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { InvoiceCreateForm } from "@/components/keuangan/billing/invoice-create-form";

export default async function BillingInvoiceNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access           = await getTenantAccess(slug);
  if (!access) redirect("/login");

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

      <div>
        <h1 className="text-xl font-semibold">Buat Invoice Manual</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tagihan langsung tanpa melalui keranjang — untuk transaksi offline atau custom.
        </p>
      </div>

      <InvoiceCreateForm slug={slug} />
    </div>
  );
}
