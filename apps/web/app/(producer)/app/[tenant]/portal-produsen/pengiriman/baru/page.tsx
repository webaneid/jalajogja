import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { listBatchableOrders, suggestBatchName } from "@/lib/producer-orders.server";
import { BatchCreateForm } from "@/components/producer/batch-create-form";

export default async function NewBatchPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const tdb = createTenantDb(access.tenant.slug);
  const [orders, suggestedName] = await Promise.all([
    listBatchableOrders(tdb, access.producer.id),
    suggestBatchName(tdb, access.producer.id),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()); // YYYY-MM-DD

  return (
    <div className="max-w-3xl space-y-4">
      <Link href={`/app/${slug}/portal-produsen/pengiriman`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali ke Pengiriman</Link>
      <h1 className="text-xl font-semibold">Buat Batch Pengiriman</h1>
      <BatchCreateForm slug={slug} suggestedName={suggestedName} today={today}
        orders={orders.map((o) => ({ invoiceId: o.invoiceId, invoiceNumber: o.invoiceNumber, customerName: o.customerName, summary: o.items.map((i) => i.name).join(", "), qty: o.totalQty }))} />
    </div>
  );
}
