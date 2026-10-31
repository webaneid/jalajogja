// Detail satu pesanan (ikon mata) — baca-saja. Kepemilikan dibuktikan di getProducerOrder (invoice lunas + memuat
// item produsen dari SESI); selain itu 404. Hanya item milik produsen yang tampil. Tanpa data uang.
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { getProducerOrder } from "@/lib/producer-orders.server";
import { isValidUuid } from "@/lib/is-uuid";
import { publicUrl } from "@/lib/minio";
import { displayPhone } from "@/lib/phone";
import { OrderStatusBadge } from "@/components/producer/order-status-badge";

const fmt = (d: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(d);

export default async function ProducerOrderDetailPage({ params }: { params: Promise<{ tenant: string; invoiceId: string }> }) {
  const { tenant: slug, invoiceId } = await params;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");
  if (!isValidUuid(invoiceId)) notFound();

  const order = await getProducerOrder(createTenantDb(access.tenant.slug), access.producer.id, invoiceId);
  if (!order) notFound();

  const back = `/app/${slug}/portal-produsen/pesanan`;
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali ke Pesanan</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{order.invoiceNumber}</h1>
        <OrderStatusBadge status={order.status} />
        {order.isMixed && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Campuran</span>}
      </div>

      <dl className="divide-y divide-border rounded-lg border border-border bg-card px-4">
        <Row label="Tanggal pesan">{fmt(order.createdAt)}</Row>
        <Row label="Pemesan">{order.customerName}</Row>
        <Row label="No. HP">{order.customerPhone ? displayPhone(order.customerPhone) : "—"}</Row>
        <Row label="Alamat tujuan">{order.checkoutAddress || "—"}</Row>
        <Row label="Kurir">{order.courierLabel}</Row>
        <Row label="No. resi">
          {order.trackingNumber ?? "—"}
          {order.trackingProofPath && <a href={publicUrl(access.tenant.slug, order.trackingProofPath)} target="_blank" rel="noopener noreferrer" className="ml-3 text-primary hover:underline">Lihat foto resi</a>}
        </Row>
        <Row label="Pesanan">
          <ul className="space-y-1">
            {order.items.map((it, i) => (
              <li key={i}>
                {it.name} <span className="text-muted-foreground">× {it.quantity}</span>
                {it.variantLabel && <span className="block text-xs text-muted-foreground">{it.variantLabel}</span>}
              </li>
            ))}
          </ul>
        </Row>
      </dl>
      {order.isMixed && <p className="text-xs text-muted-foreground">Invoice ini juga memuat barang dari penjual lain; hanya barang Anda yang ditampilkan.</p>}
    </div>
  );
}
