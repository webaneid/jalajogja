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
import { OrderDetailView, type OrderDetailVM } from "@/components/orders/order-detail-view";

export default async function ProducerOrderDetailPage({ params }: { params: Promise<{ tenant: string; invoiceId: string }> }) {
  const { tenant: slug, invoiceId } = await params;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");
  if (!isValidUuid(invoiceId)) notFound();

  const order = await getProducerOrder(createTenantDb(access.tenant.slug), access.producer.id, invoiceId);
  if (!order) notFound();

  // Batch hanya ditampilkan bila milik produsen ini (getInvoiceBatch tidak memeriksa pemilik; invoice produsen tak mungkin masuk batch orang lain,
  // tetapi tampilan tetap dijaga — audit § 23.4 L2)
  const batch = order.batch && order.batch.producerId === access.producer.id ? order.batch : null;
  const lines = mapTenantLines(order.shippingRows, access.tenant.slug);
  const mainLine = lines[0];

  // Rincian biaya: invoice NON-campuran → angka invoice persis seperti admin. CAMPURAN → hanya dari item miliknya + ongkos baris
  // pengiriman tenant (angka barang penjual lain tidak boleh terlihat).
  const own = order.itemsDetail;
  const a = order.invoiceAmounts;
  const breakdown = order.isMixed
    ? (() => {
        const subtotal = own.reduce((x, i) => x + i.total, 0);
        const shipping = lines.reduce((x, l) => x + l.cost, 0);
        return { subtotal, shipping, discount: 0, total: subtotal + shipping, paid: subtotal + shipping,
          note: "Invoice ini juga memuat barang dari penjual lain — rincian di atas dihitung dari barang Anda saja." };
      })()
    : { subtotal: a.subtotal, shipping: a.shipping, discount: a.discount, total: a.total, paid: a.paid };

  const vm: OrderDetailVM = {
    slug,
    backHref: `/app/${slug}/portal-produsen/pesanan`, backLabel: "Pesanan",
    statusBadge: { label: "Lunas", cls: "bg-green-100 text-green-700" }, // detail produsen hanya untuk invoice lunas
    invoiceNumber: order.invoiceNumber, customerName: order.customerName, createdAt: order.createdAt,
    actions: (
      <OrderDetailActions
        slug={slug} invoiceId={order.invoiceId} status={order.status}
        batch={batch ? { id: batch.id, name: batch.name } : null}
        trackingNumber={mainLine?.trackingNumber ?? null} proofUrl={mainLine?.trackingProofUrl ?? null}
        canChangePhoto={!order.shippedAt || Date.now() - order.shippedAt.getTime() <= 30 * 86_400_000}
        canPrint={order.deliveryMethod !== "pickup" && !order.isMixed}
        printReason={order.deliveryMethod === "pickup" ? "Ambil sendiri — tidak dikirim kurir" : "Pesanan campuran — ditangani admin"}
        canResi
      />
    ),
    info: [
      ["Telepon", order.customerPhone ? displayPhone(order.customerPhone) : "—"],
      ["Alamat Kirim", order.checkoutAddress || "—"],
      ...(order.notes ? [["Catatan", order.notes] as [string, React.ReactNode]] : []),
      ...(batch ? [["Batch Pengiriman", (
        <Link key="b" href={`/app/${slug}/portal-produsen/pengiriman/${batch.id}`} className="font-mono text-primary hover:underline">{batch.name}</Link>
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
