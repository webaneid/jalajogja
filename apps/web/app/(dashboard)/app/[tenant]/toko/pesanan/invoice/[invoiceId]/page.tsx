import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, desc, inArray } from "drizzle-orm";
import { OrderDetailView, type OrderDetailVM } from "@/components/orders/order-detail-view";
import { mapTenantLines, firstProductImage } from "@/lib/order-detail.server";
import { displayPhone } from "@/lib/phone";
import { OrderDetailActions } from "@/components/orders/order-detail-actions";
import { getInvoiceBatch } from "@/lib/producer-orders.server";
import { hasFullAccess } from "@/lib/permissions";
import { isValidUuid } from "@/lib/is-uuid";

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
  if (!access) redirect("/app/login");
  if (!isValidUuid(invoiceId)) notFound(); // segmen URL mentah ke kolom UUID → 404 bersih, bukan 500 (lessons-learned 2026-09-18)

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
    redirect(`/app/${slug}/finance/billing/invoice/${invoiceId}`);
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

  // Baris pengiriman penjual tenant → kartu fulfillment
  const tenantLines = mapTenantLines(shippingRows, slug);

  // Batch pengiriman (bila pesanan ada di batch produsen) — menentukan apakah aksi Input/Ubah Resi tampil
  const batchRef = await getInvoiceBatch(createTenantDb(slug), invoiceId);
  const mainLine = tenantLines[0];

  // Tampilan SAMA PERSIS dengan halaman detail produsen (komponen bersama OrderDetailView, § 23.4)
  const vm: OrderDetailVM = {
    slug,
    backHref: `/app/${slug}/toko/pesanan`, backLabel: "Pesanan",
    statusBadge: invStatus,
    invoiceNumber: inv.invoiceNumber, customerName: inv.customerName, createdAt: inv.createdAt,
    actions: inv.status === "paid" ? (
      <OrderDetailActions
        slug={slug} invoiceId={invoiceId} status={mainLine?.status ?? null}
        batch={batchRef ? { id: batchRef.id, name: batchRef.name } : null}
        trackingNumber={mainLine?.trackingNumber ?? null} proofUrl={mainLine?.trackingProofUrl ?? null}
        canChangePhoto={!mainLine?.shippedAt || Date.now() - new Date(mainLine.shippedAt).getTime() <= 30 * 86_400_000}
        canPrint
        canResi={hasFullAccess(access.tenantUser, "toko")}
      />
    ) : null,
    info: [
      ["Telepon",       displayPhone(inv.customerPhone)],
      ["Email",         inv.customerEmail ?? "—"],
      ["Alamat Kirim",  [inv.shippingAddress, inv.shippingCityName].filter(Boolean).join(", ") || "—"],
      ...(inv.notes ? [["Catatan", inv.notes] as [string, string]] : []),
      ...(batchRef ? [["Batch Pengiriman", batchRef.name] as [string, string]] : []),
    ],
    items: items.map((item) => ({
      id: item.id, name: item.name, description: item.description,
      thumb: item.itemId ? firstProductImage(productImages[item.itemId]) : null,
      unitPrice: parseFloat(String(item.unitPrice)), quantity: item.quantity, total: parseFloat(String(item.total)),
    })),
    breakdown: {
      subtotal: parseFloat(String(inv.subtotal)), shipping: parseFloat(String(inv.shippingTotal)),
      discount: parseFloat(String(inv.discount)), total, paid: paidAmount,
    },
    lines: tenantLines, invoicePaid, readOnlyFulfillment: false,
    billingHref: `/app/${slug}/finance/billing/invoice/${inv.id}`,
  };

  return <OrderDetailView vm={vm} />;
}
