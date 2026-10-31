import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { getProducerBatch, listBatchableOrders } from "@/lib/producer-orders.server";
import { isValidUuid } from "@/lib/is-uuid";
import { publicUrl } from "@/lib/minio";
import { displayPhone } from "@/lib/phone";
import { OrderStatusBadge } from "@/components/producer/order-status-badge";
import { BatchAddOrders, BatchPackAll, BatchRowActions } from "@/components/producer/batch-detail-actions";
import { PrintLabelsButton } from "@/components/orders/print-label-dialog";

const fmtDate = (iso: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export default async function BatchDetailPage({ params }: { params: Promise<{ tenant: string; batchId: string }> }) {
  const { tenant: slug, batchId } = await params;
  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");
  if (!isValidUuid(batchId)) notFound();

  const tdb = createTenantDb(access.tenant.slug);
  const data = await getProducerBatch(tdb, access.producer.id, batchId);
  if (!data) notFound();
  const { batch, rows } = data;
  const addable = batch.finished ? [] : await listBatchableOrders(tdb, access.producer.id);
  const base = `/app/${slug}/portal-produsen`;

  return (
    <div className="space-y-4">
      <Link href={`${base}/pengiriman`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali ke Pengiriman</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-semibold">{batch.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Dikirim {fmtDate(batch.shippingDate)} · {batch.total} pesanan{batch.finished ? " · Selesai" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <PrintLabelsButton slug={slug} shipmentIds={rows.map((o) => o.lineId)} label="Cetak Label Batch" />
          <BatchPackAll slug={slug} batchId={batch.id} processingCount={batch.byStatus.processing ?? 0} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Pemesan</th>
              <th className="px-3 py-2 font-medium">Pesanan</th>
              <th className="px-3 py-2 text-right font-medium">Jml</th>
              <th className="px-3 py-2 font-medium">Kurir</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => (
              <tr key={o.lineId} className="align-top">
                <td className="px-3 py-2"><Link href={`${base}/pesanan/${o.invoiceId}`} className="font-mono text-xs hover:underline">{o.invoiceNumber}</Link></td>
                <td className="px-3 py-2"><div className="font-medium">{o.customerName}</div><div className="text-xs text-muted-foreground">{o.customerPhone ? displayPhone(o.customerPhone) : "—"}</div></td>
                <td className="px-3 py-2"><ul className="space-y-0.5">{o.items.map((it, i) => <li key={i}>{it.name}{it.variantLabel && <span className="block text-xs text-muted-foreground">{it.variantLabel}</span>}</li>)}</ul></td>
                <td className="px-3 py-2 text-right tabular-nums">{o.totalQty}</td>
                <td className="whitespace-nowrap px-3 py-2">{o.courierLabel}</td>
                <td className="px-3 py-2"><OrderStatusBadge status={o.status} /></td>
                <td className="px-3 py-2"><BatchRowActions slug={slug} batchId={batch.id} lineId={o.lineId} status={o.status} trackingNumber={o.trackingNumber} proofUrl={o.trackingProofPath ? publicUrl(access.tenant.slug, o.trackingProofPath) : null} canChangePhoto={!o.shippedAt || Date.now() - o.shippedAt.getTime() <= 30 * 86_400_000} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!batch.finished && (
        <BatchAddOrders slug={slug} batchId={batch.id}
          orders={addable.map((o) => ({ lineId: o.lineId, invoiceNumber: o.invoiceNumber, customerName: o.customerName, summary: o.items.map((i) => i.name).join(", "), qty: o.totalQty }))} />
      )}
      <p className="text-xs text-muted-foreground">Alur status: Diproses → Dikemas → (isi nomor resi + foto resi) → Dikirim. Foto resi tersimpan di Foto Saya dan dihapus otomatis 30 hari setelah tanggal kirim (nomor resi tetap).</p>
    </div>
  );
}
