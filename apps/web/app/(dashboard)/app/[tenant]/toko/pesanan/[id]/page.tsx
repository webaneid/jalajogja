import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OrderActions } from "@/components/toko/order-detail-client";

function formatRupiah(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending:    "Menunggu Bayar",
  paid:       "Lunas",
  processing: "Diproses",
  shipped:    "Dikirim",
  done:       "Selesai",
  cancelled:  "Dibatalkan",
};

const STATUS_COLOR: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  paid:       "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped:    "bg-purple-100 text-purple-700",
  done:       "bg-green-100 text-green-700",
  cancelled:  "bg-zinc-100 text-zinc-500",
};

const METHOD_LABEL: Record<string, string> = {
  cash:     "Tunai",
  transfer: "Transfer Bank",
  qris:     "QRIS",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending:   "Menunggu",
  submitted: "Perlu Konfirmasi",
  paid:      "Lunas",
  cancelled: "Dibatalkan",
};

export default async function PesananDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: orderId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);

  if (!order) notFound();

  // Items + gambar thumbnail tiap produk
  const items = await db
    .select({
      id:           schema.orderItems.id,
      productId:    schema.orderItems.productId,
      productName:  schema.orderItems.productName,
      skuAtOrder:   schema.orderItems.skuAtOrder,
      qty:          schema.orderItems.qty,
      priceAtOrder: schema.orderItems.priceAtOrder,
      subtotal:     schema.orderItems.subtotal,
      images:       schema.products.images,
    })
    .from(schema.orderItems)
    .leftJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
    .where(eq(schema.orderItems.orderId, orderId));

  // Payment terkait
  const [payment] = await db
    .select({
      id:     schema.payments.id,
      status: schema.payments.status,
      method: schema.payments.method,
      amount: schema.payments.amount,
      number: schema.payments.number,
      payerBank: schema.payments.payerBank,
      confirmedAt: schema.payments.confirmedAt,
    })
    .from(schema.payments)
    .where(and(
      eq(schema.payments.sourceType, "order"),
      eq(schema.payments.sourceId, orderId)
    ))
    .limit(1);

  const subtotal = parseFloat(String(order.subtotal));
  const discount = parseFloat(String(order.discount));
  const total    = parseFloat(String(order.total));

  function getThumb(images: unknown): string | null {
    if (!Array.isArray(images) || images.length === 0) return null;
    return (images[0] as { url?: string })?.url ?? null;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${slug}/toko/pesanan`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Pesanan
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[order.status] ?? "bg-zinc-100"}`}>
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      <div>
        <p className="font-mono text-xs text-muted-foreground">{order.orderNumber}</p>
        <h1 className="text-xl font-semibold mt-1">{order.customerName}</h1>
        <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
      </div>

      {/* Info pelanggan */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {[
          ["Email",           order.customerEmail    ?? "—"],
          ["Telepon",         order.customerPhone    ?? "—"],
          ["Alamat Kirim",    order.shippingAddress  ?? "—"],
          ["Catatan",         order.notes            ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground shrink-0 w-28">{label}</span>
            <span className="text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* Items */}
      <div>
        <h2 className="font-medium text-sm mb-2">Item Pesanan</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Produk</th>
                <th className="px-4 py-2 text-center font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Harga</th>
                <th className="px-4 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const thumb = getThumb(item.images);
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={item.productName} className="w-10 h-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          {item.skuAtOrder && (
                            <p className="text-xs text-muted-foreground font-mono">{item.skuAtOrder}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{item.qty}</td>
                    <td className="px-4 py-3 text-right">{formatRupiah(item.priceAtOrder)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatRupiah(item.subtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-muted/10 text-sm">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                <td className="px-4 py-2 text-right">{formatRupiah(subtotal)}</td>
              </tr>
              {discount > 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Diskon</td>
                  <td className="px-4 py-2 text-right text-red-600">- {formatRupiah(discount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right font-semibold">Total</td>
                <td className="px-4 py-2 text-right font-semibold text-lg">{formatRupiah(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pembayaran */}
      {payment && (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Pembayaran</p>
            <p className="font-mono text-sm mt-0.5">{payment.number}</p>
          </div>
          {[
            ["Metode",  METHOD_LABEL[payment.method]  ?? payment.method],
            ["Jumlah",  formatRupiah(payment.amount)],
            ["Bank",    payment.payerBank    ?? "—"],
            ["Status",  PAYMENT_STATUS_LABEL[payment.status] ?? payment.status],
            ...(payment.confirmedAt ? [["Dikonfirmasi", formatDate(payment.confirmedAt)]] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Aksi */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium text-sm">Tindakan</h2>
        <OrderActions
          slug={slug}
          orderId={order.id}
          status={order.status}
          total={total}
          payment={payment ? { id: payment.id, status: payment.status, method: payment.method } : null}
        />
      </div>
    </div>
  );
}
