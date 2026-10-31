// Pesanan untuk Portal Produsen (menu "Pesanan") — SATU baris = SATU invoice LUNAS yang memuat produk milik produsen
// dari SESI. Doc: docs/arsitektur-portal-produsen.md § 19.
//
// Aturan keamanan (fail-closed):
//  - producerId HARUS dari getProducerAccess() (sesi), bukan dari URL/body.
//  - Hanya invoice status "paid". Hanya item produk milik produsen ini yang DITAMPILKAN; item lain di invoice yang sama
//    tidak pernah dikembalikan — hanya ditandai `isMixed` (invoice campuran: tidak bisa masuk batch, keputusan user 2026-11-01).
//  - Tidak ada data uang yang dikembalikan (tidak diminta di menu Pesanan).
import "server-only";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { TenantDb, ShippingStatus } from "@jalajogja/db";
import { escapeLike } from "@/lib/escape-like";
import { formatShippingMethod } from "@/lib/format-shipping-method";

export type ProducerOrderItem = { name: string; variantLabel: string; quantity: number };

export type ProducerOrderRow = {
  invoiceId:     string;
  invoiceNumber: string;
  createdAt:     Date;
  customerName:  string;
  customerPhone: string | null;
  items:         ProducerOrderItem[];   // HANYA item milik produsen ini
  totalQty:      number;
  courierLabel:  string;
  status:        ShippingStatus | null; // status pengiriman (invoice_shipping_lines.status), null = tak ada baris
  isMixed:       boolean;               // ada item selain milik produsen ini di invoice yang sama
};

export type ProducerOrderDetail = ProducerOrderRow & {
  checkoutAddress: string;
  trackingNumber:  string | null;
  shippedAt:       Date | null;
};

/** id produk + id variasi milik produsen (invoice_items.itemId = id produk untuk simple, id variasi untuk variable). */
async function producerItemIds(tenantClient: TenantDb, producerId: string) {
  const { db, schema } = tenantClient;
  const products = await db.select({ id: schema.products.id }).from(schema.products)
    .where(and(eq(schema.products.producerId, producerId), isNull(schema.products.mitraId)));
  const productIds = products.map((p) => p.id);
  if (productIds.length === 0) return { ids: new Set<string>(), variationCombo: new Map<string, Record<string, string>>() };
  const variations = await db.select({ id: schema.productVariations.id, combo: schema.productVariations.attributeCombo })
    .from(schema.productVariations).where(inArray(schema.productVariations.productId, productIds));
  const variationCombo = new Map(variations.map((v) => [v.id, (v.combo ?? {}) as Record<string, string>]));
  return { ids: new Set<string>([...productIds, ...variations.map((v) => v.id)]), variationCombo };
}

async function buildRows(
  tenantClient: TenantDb,
  invoices: { id: string; invoiceNumber: string; createdAt: Date; customerName: string; customerPhone: string | null }[],
  owned: Awaited<ReturnType<typeof producerItemIds>>,
): Promise<ProducerOrderRow[]> {
  if (invoices.length === 0) return [];
  const { db, schema } = tenantClient;
  const invoiceIds = invoices.map((i) => i.id);

  const [allItems, lines] = await Promise.all([
    db.select({
      invoiceId: schema.invoiceItems.invoiceId, itemType: schema.invoiceItems.itemType, itemId: schema.invoiceItems.itemId,
      name: schema.invoiceItems.name, quantity: schema.invoiceItems.quantity, sortOrder: schema.invoiceItems.sortOrder,
    }).from(schema.invoiceItems).where(inArray(schema.invoiceItems.invoiceId, invoiceIds)),
    db.select({
      invoiceId: schema.invoiceShippingLines.invoiceId, sellerType: schema.invoiceShippingLines.sellerType,
      deliveryMethod: schema.invoiceShippingLines.deliveryMethod, courier: schema.invoiceShippingLines.courier,
      service: schema.invoiceShippingLines.service, paymentMethod: schema.invoiceShippingLines.paymentMethod,
      status: schema.invoiceShippingLines.status, createdAt: schema.invoiceShippingLines.createdAt,
    }).from(schema.invoiceShippingLines).where(inArray(schema.invoiceShippingLines.invoiceId, invoiceIds))
      .orderBy(schema.invoiceShippingLines.createdAt),
  ]);

  return invoices.map((inv) => {
    const its = allItems.filter((i) => i.invoiceId === inv.id).sort((a, b) => a.sortOrder - b.sortOrder);
    const mine = its.filter((i) => i.itemType === "product" && i.itemId && owned.ids.has(i.itemId));
    const line = lines.find((l) => l.invoiceId === inv.id && l.sellerType === "tenant") ?? lines.find((l) => l.invoiceId === inv.id);
    const items = mine.map((i) => {
      const combo = i.itemId ? owned.variationCombo.get(i.itemId) : undefined;
      return {
        name: i.name,
        variantLabel: combo ? Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(", ") : "",
        quantity: i.quantity,
      };
    });
    return {
      invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, createdAt: inv.createdAt,
      customerName: inv.customerName, customerPhone: inv.customerPhone,
      items, totalQty: items.reduce((a, i) => a + i.quantity, 0),
      courierLabel: formatShippingMethod(line),
      status: (line?.status ?? null) as ShippingStatus | null,
      isMixed: mine.length !== its.length,
    };
  });
}

export async function listProducerOrders(
  tenantClient: TenantDb,
  producerId: string,
  opts: { q?: string; page: number; pageSize: number },
): Promise<{ rows: ProducerOrderRow[]; total: number }> {
  const { db, schema } = tenantClient;
  const owned = await producerItemIds(tenantClient, producerId);
  if (owned.ids.size === 0) return { rows: [], total: 0 };

  // Invoice yang memuat item produsen ini (subquery — tanpa menarik semua id ke memori)
  const mineInvoiceIds = db.select({ id: schema.invoiceItems.invoiceId }).from(schema.invoiceItems)
    .where(and(eq(schema.invoiceItems.itemType, "product"), inArray(schema.invoiceItems.itemId, [...owned.ids])));

  const q = (opts.q ?? "").trim().slice(0, 80);
  const where = and(
    eq(schema.invoices.status, "paid"),
    inArray(schema.invoices.id, mineInvoiceIds),
    q ? or(
      ilike(schema.invoices.invoiceNumber, `%${escapeLike(q)}%`),
      ilike(schema.invoices.customerName, `%${escapeLike(q)}%`),
    ) : undefined,
  );

  const [invoices, [{ total }]] = await Promise.all([
    db.select({
      id: schema.invoices.id, invoiceNumber: schema.invoices.invoiceNumber, createdAt: schema.invoices.createdAt,
      customerName: schema.invoices.customerName, customerPhone: schema.invoices.customerPhone,
    }).from(schema.invoices).where(where).orderBy(desc(schema.invoices.createdAt))
      .limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.invoices).where(where),
  ]);

  return { rows: await buildRows(tenantClient, invoices, owned), total: Number(total) };
}

/** Satu invoice — null bila tidak lunas ATAU tidak memuat item produsen ini (kepemilikan dibuktikan di sini). */
export async function getProducerOrder(
  tenantClient: TenantDb,
  producerId: string,
  invoiceId: string,
): Promise<ProducerOrderDetail | null> {
  const { db, schema } = tenantClient;
  const owned = await producerItemIds(tenantClient, producerId);
  if (owned.ids.size === 0) return null;

  const [inv] = await db.select({
    id: schema.invoices.id, invoiceNumber: schema.invoices.invoiceNumber, createdAt: schema.invoices.createdAt,
    customerName: schema.invoices.customerName, customerPhone: schema.invoices.customerPhone,
    shippingAddress: schema.invoices.shippingAddress, shippingCityName: schema.invoices.shippingCityName,
  }).from(schema.invoices)
    .where(and(eq(schema.invoices.id, invoiceId), eq(schema.invoices.status, "paid")))
    .limit(1);
  if (!inv) return null;

  const [row] = await buildRows(tenantClient, [inv], owned);
  if (!row || row.items.length === 0) return null; // bukan invoice milik produsen ini

  const [line] = await db.select({
    trackingNumber: schema.invoiceShippingLines.trackingNumber, shippedAt: schema.invoiceShippingLines.shippedAt,
  }).from(schema.invoiceShippingLines)
    .where(and(eq(schema.invoiceShippingLines.invoiceId, inv.id), eq(schema.invoiceShippingLines.sellerType, "tenant")))
    .limit(1);

  return {
    ...row,
    checkoutAddress: [inv.shippingAddress, inv.shippingCityName].filter((p): p is string => !!p?.trim()).join(", "),
    trackingNumber: line?.trackingNumber ?? null,
    shippedAt: line?.shippedAt ?? null,
  };
}
