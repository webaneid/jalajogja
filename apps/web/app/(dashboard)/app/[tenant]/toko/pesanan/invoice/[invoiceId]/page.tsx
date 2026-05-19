import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, ExternalLink, Package } from "lucide-react";
import { FulfillmentCard } from "@/components/toko/fulfillment-client";
import type { FulfillmentShippingLine } from "@/components/toko/fulfillment-client";

function fmt(n: number | string) {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(v || 0);
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  pending:              { label: "Menunggu Bayar",    cls: "bg-yellow-100 text-yellow-700" },
  waiting_verification: { label: "Menunggu Verifikasi", cls: "bg-blue-100 text-blue-700" },
  partial:              { label: "Terbayar Sebagian", cls: "bg-orange-100 text-orange-700" },
  paid:                 { label: "Lunas",             cls: "bg-green-100 text-green-700" },
  cancelled:            { label: "Dibatalkan",        cls: "bg-zinc-100 text-zinc-500" },
};

export default async function FulfillmentPage({
  params,
}: {
  params: Promise<{ tenant: string; invoiceId: string }>;
}) {
  const { tenant: slug, invoiceId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  // Fetch invoice
  const [inv] = await db
    .select({
      id:            schema.invoices.id,
      invoiceNumber: schema.invoices.invoiceNumber,
      sourceType:    schema.invoices.sourceType,
      customerName:  schema.invoices.customerName,
      customerPhone: schema.invoices.customerPhone,
      customerEmail: schema.invoices.customerEmail,
      subtotal:      schema.invoices.subtotal,
      shippingTotal: schema.invoices.shippingTotal,
      discount:      schema.invoices.discount,
      total:         schema.invoices.total,
      paidAmount:    schema.invoices.paidAmount,
      status:        schema.invoices.status,
      shippingAddress:  schema.invoices.shippingAddress,
      shippingCityName: schema.invoices.shippingCityName,
      notes:         schema.invoices.notes,
      createdAt:     schema.invoices.createdAt,
    })
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) notFound();

  // Hanya untuk pesanan via keranjang (sourceType='cart')
  if (inv.sourceType !== "cart") {
    redirect(`/${slug}/finance/billing/invoice/${invoiceId}`);
  }

  const [items, shippingRows] = await Promise.all([
    db
      .select({
        id:          schema.invoiceItems.id,
        itemType:    schema.invoiceItems.itemType,
        name:        schema.invoiceItems.name,
        description: schema.invoiceItems.description,
        unitPrice:   schema.invoiceItems.unitPrice,
        quantity:    schema.invoiceItems.quantity,
        total:       schema.invoiceItems.total,
        itemId:      schema.invoiceItems.itemId,
      })
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, invoiceId))
      .orderBy(schema.invoiceItems.sortOrder),

    db
      .select()
      .from(schema.invoiceShippingLines)
      .where(eq(schema.invoiceShippingLines.invoiceId, invoiceId))
      .orderBy(schema.invoiceShippingLines.createdAt),
  ]);

  // Ambil gambar produk dari tabel products (opsional — hanya untuk product items)
  const productItemIds = items.filter(i => i.itemType === "product" && i.itemId).map(i => i.itemId!);
  let productImages: Record<string, unknown> = {};
  if (productItemIds.length) {
    const prods = await db
      .select({ id: schema.products.id, images: schema.products.images })
      .from(schema.products)
      .where(inArray(schema.products.id, productItemIds));
    productImages = Object.fromEntries(prods.map(p => [p.id, p.images]));
  }

  const total      = parseFloat(String(inv.total));
  const paidAmount = parseFloat(String(inv.paidAmount));
  const invoicePaid = inv.status === "paid";
  const invStatus   = INV_STATUS[inv.status] ?? { label: inv.status, cls: "bg-zinc-100 text-zinc-500" };

  // Tenant shipping lines → fulfillment cards
  const tenantLines: FulfillmentShippingLine[] = shippingRows
    .filter(sl => sl.sellerType === "tenant")
    .map(sl => ({
      id:             sl.id,
      sellerType:     sl.sellerType as "tenant" | "mitra",
      sellerName:     sl.sellerName,
      courier:        sl.courier,
      service:        sl.service,
      etd:            sl.etd ?? null,
      cost:           parseFloat(String(sl.cost)),
      trackingNumber: sl.trackingNumber ?? null,
      shippedAt:      sl.shippedAt?.toISOString() ?? null,
      status:         sl.status as FulfillmentShippingLine["status"],
    }));

  function getThumb(images: unknown): string | null {
    if (!Array.isArray(images) || images.length === 0) return null;
    const img = images[0] as { variants?: Record<string, string>; url?: string };
    return img.variants?.square ?? img.url ?? null;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${slug}/toko/pesanan`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Pesanan
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${invStatus.cls}`}>
          {invStatus.label}
        </span>
      </div>

      {/* Header invoice */}
      <div>
        <p className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</p>
        <h1 className="text-xl font-semibold mt-1">{inv.customerName}</h1>
        <p className="text-sm text-muted-foreground">{fmtDate(inv.createdAt)}</p>
      </div>

      {/* Info pelanggan */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border text-sm">
        {[
          ["Telepon",       inv.customerPhone ?? "—"],
          ["Email",         inv.customerEmail ?? "—"],
          ["Alamat Kirim",  [inv.shippingAddress, inv.shippingCityName].filter(Boolean).join(", ") || "—"],
          ...(inv.notes ? [["Catatan", inv.notes]] : []),
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 gap-3">
            <span className="text-muted-foreground shrink-0 w-28">{label}</span>
            <span className="text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* Item pesanan */}
      <div>
        <h2 className="font-semibold text-sm mb-2">Item Pesanan</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Produk</th>
                <th className="px-4 py-2 text-center font-medium w-12">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const thumb = item.itemId
                  ? getThumb(productImages[item.itemId])
                  : null;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={item.name} className="w-9 h-9 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded bg-muted shrink-0 flex items-center justify-center">
                            <Package size={14} className="text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium leading-snug">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{fmt(parseFloat(String(item.unitPrice)))} / item</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(parseFloat(String(item.total)))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-muted/10 text-sm">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                <td className="px-4 py-2 text-right">{fmt(parseFloat(String(inv.subtotal)))}</td>
              </tr>
              {parseFloat(String(inv.shippingTotal)) > 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-muted-foreground">Ongkos Kirim</td>
                  <td className="px-4 py-2 text-right">{fmt(parseFloat(String(inv.shippingTotal)))}</td>
                </tr>
              )}
              {parseFloat(String(inv.discount)) > 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-muted-foreground">Diskon</td>
                  <td className="px-4 py-2 text-right text-red-600">-{fmt(parseFloat(String(inv.discount)))}</td>
                </tr>
              )}
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right font-semibold">Total</td>
                <td className="px-4 py-2 text-right font-semibold text-base">{fmt(total)}</td>
              </tr>
              {paidAmount < total && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-muted-foreground">Terbayar</td>
                  <td className="px-4 py-2 text-right text-green-600">{fmt(paidAmount)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Fulfillment cards */}
      {tenantLines.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-sm">Pengiriman &amp; Fulfillment</h2>
          {tenantLines.map(line => (
            <FulfillmentCard
              key={line.id}
              slug={slug}
              line={line}
              invoicePaid={invoicePaid}
            />
          ))}
        </div>
      )}

      {/* Link ke detail billing (pembayaran) */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Detail Pembayaran</p>
          <p className="text-xs text-muted-foreground">Verifikasi bukti transfer, konfirmasi manual</p>
        </div>
        <Link
          href={`/${slug}/finance/billing/invoice/${inv.id}`}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
        >
          Buka Invoice
          <ExternalLink size={12} />
        </Link>
      </div>
    </div>
  );
}
