// Detail satu pesanan produsen — tampilan SAMA PERSIS dengan halaman admin (komponen bersama OrderDetailView; permintaan user
// 2026-11-01, docs/arsitektur-portal-produsen.md § 23.4). Perbedaan yang diputuskan user: hanya item MILIK produsen yang tampil (dengan
// harga), tanpa email pelanggan, tanpa tautan pembayaran, kartu pengiriman tanpa tombol ubah status (status lewat batch/resi).
// Kepemilikan dibuktikan di getProducerOrder (invoice lunas + memuat item produsen dari SESI); selain itu 404.
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { getProducerOrder } from "@/lib/producer-orders.server";
import { isValidUuid } from "@/lib/is-uuid";
import { displayPhone } from "@/lib/phone";
import { mapTenantLines, firstProductImage } from "@/lib/order-detail.server";
import { OrderDetailActions } from "@/components/orders/order-detail-actions";
import { PrintLabelsButton } from "@/components/orders/print-label-dialog";
import { OrderDetailView, type OrderDetailVM } from "@/components/orders/order-detail-view";

export default async function ProducerOrderDetailPage({ params }: { params: Promise<{ tenant: string; invoiceId: string }> }) {
  const { tenant: slug, invoiceId } = await params;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");
  if (!isValidUuid(invoiceId)) notFound();

  const order = await getProducerOrder(createTenantDb(access.tenant.slug), access.producer.id, invoiceId);
  if (!order) notFound();

  const lines = mapTenantLines(order.shippingRows, access.tenant.slug);
  const rowOf = new Map(order.rows.map((r) => [r.lineId, r]));
  // Batch per PENGIRIMAN, hanya ditampilkan bila milik produsen ini (getLineBatches tidak memeriksa pemilik — audit § 23.4 L2)
  const batchOf = (lineId: string) => {
    const b = order.batches.get(lineId);
    return b && b.producerId === access.producer.id ? b : null;
  };

  // Rincian biaya: invoice yang HANYA berisi barang & pengiriman produsen ini → angka invoice persis seperti admin.
  // Invoice yang juga memuat barang/pengiriman pihak lain → hanya dari item miliknya + ongkos pengiriman miliknya
  // (angka barang pihak lain tidak boleh terlihat).
  const own = order.itemsDetail;
  const a = order.invoiceAmounts;
  const breakdown = !order.singleProducer
    ? (() => {
        const subtotal = own.reduce((x, i) => x + i.total, 0);
        const shipping = lines.reduce((x, l) => x + l.cost, 0);
        return { subtotal, shipping, discount: 0, total: subtotal + shipping, paid: subtotal + shipping,
          note: "Invoice ini juga memuat barang dari penjual/produsen lain — rincian di atas dihitung dari barang dan pengiriman Anda saja." };
      })()
    : { subtotal: a.subtotal, shipping: a.shipping, discount: a.discount, total: a.total, paid: a.paid };

  const lineAction = (l: (typeof lines)[number]) => {
    const row = rowOf.get(l.id);
    const b = batchOf(l.id);
    return (
      <OrderDetailActions
        slug={slug} lineId={l.id} status={l.status}
        batch={b ? { id: b.id, name: b.name } : null}
        trackingNumber={l.trackingNumber} proofUrl={l.trackingProofUrl ?? null}
        canChangePhoto={!l.shippedAt || Date.now() - new Date(l.shippedAt).getTime() <= 30 * 86_400_000}
        canPrint={row?.deliveryMethod === "courier"}
        printReason="Ambil sendiri — tidak dikirim kurir"
        canResi
      />
    );
  };
  const multi = lines.length > 1;
  const batchLinks = lines.map((l) => batchOf(l.id)).filter((b): b is NonNullable<ReturnType<typeof batchOf>> => !!b);

  const vm: OrderDetailVM = {
    slug,
    backHref: `/app/${slug}/portal-produsen/pesanan`, backLabel: "Pesanan",
    statusBadge: { label: "Lunas", cls: "bg-green-100 text-green-700" }, // detail produsen hanya untuk invoice lunas
    invoiceNumber: order.invoiceNumber, customerName: order.customerName, createdAt: order.createdAt,
    // Satu pengiriman → aksi di header; beberapa → "Cetak semua label" + aksi per kartu (sama seperti halaman admin)
    actions: multi
      ? <PrintLabelsButton slug={slug} shipmentIds={lines.filter((l) => rowOf.get(l.id)?.deliveryMethod === "courier").map((l) => l.id)} label="Cetak Semua Label" />
      : lineAction(lines[0]),
    lineActions: multi ? Object.fromEntries(lines.map((l) => [l.id, lineAction(l)])) : undefined,
    info: [
      ["Telepon", order.customerPhone ? displayPhone(order.customerPhone) : "—"],
      ["Alamat Kirim", order.checkoutAddress || "—"],
      ...(order.notes ? [["Catatan", order.notes] as [string, React.ReactNode]] : []),
      ...(batchLinks.length ? [["Batch Pengiriman", (
        <span key="b" className="flex flex-wrap justify-end gap-x-3">
          {batchLinks.map((b) => (
            <Link key={b.id} href={`/app/${slug}/portal-produsen/pengiriman/${b.id}`} className="font-mono text-primary hover:underline">{b.name}</Link>
          ))}
        </span>
      )] as [string, React.ReactNode]] : []),
    ],
    items: own.map((i) => ({
      id: i.id, name: i.name, description: i.description, thumb: firstProductImage(i.images),
      unitPrice: i.unitPrice, quantity: i.quantity, total: i.total,
    })),
    breakdown,
    lines, invoicePaid: true, readOnlyFulfillment: true,
    billingHref: null, // halaman keuangan admin — bukan untuk produsen
    padded: false,     // layout portal sudah memberi padding
  };

  return <OrderDetailView vm={vm} />;
}
