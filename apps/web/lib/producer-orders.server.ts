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
  deliveryMethod: string | null;        // 'courier' | 'pickup' (ambil sendiri tidak dikirim kurir → tak bisa di batch)
  trackingNumber: string | null;        // resi (diisi saat Dikirim)
  trackingProofPath: string | null;     // path foto resi di bucket tenant (URL dibentuk di halaman)
  shippedAt:     Date | null;           // tanggal kirim (dasar masa simpan foto resi 30 hari)
  isMixed:       boolean;               // ada item selain milik produsen ini di invoice yang sama
};

export type ProducerOrderDetail = ProducerOrderRow & {
  checkoutAddress: string;
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
      trackingNumber: schema.invoiceShippingLines.trackingNumber, trackingProofPath: schema.invoiceShippingLines.trackingProofPath, shippedAt: schema.invoiceShippingLines.shippedAt,
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
      deliveryMethod: line?.deliveryMethod ?? null,
      trackingNumber: line?.trackingNumber ?? null,
      trackingProofPath: line?.trackingProofPath ?? null,
      shippedAt: line?.shippedAt ?? null,
      isMixed: mine.length !== its.length,
    };
  });
}

async function listByOwned(
  tenantClient: TenantDb,
  owned: Awaited<ReturnType<typeof producerItemIds>>,
  opts: { q?: string; page: number; pageSize: number },
): Promise<{ rows: ProducerOrderRow[]; total: number }> {
  const { db, schema } = tenantClient;
  if (owned.ids.size === 0) return { rows: [], total: 0 };

  // Invoice yang memuat item-item ini (subquery — tanpa menarik semua id ke memori)
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

/** Menu Pesanan: semua produk milik produsen (producerId WAJIB dari sesi). */
export async function listProducerOrders(
  tenantClient: TenantDb,
  producerId: string,
  opts: { q?: string; page: number; pageSize: number },
): Promise<{ rows: ProducerOrderRow[]; total: number }> {
  return listByOwned(tenantClient, await producerItemIds(tenantClient, producerId), opts);
}

/**
 * Tab "Pesanan Masuk" di halaman produk tunggal: pesanan lunas yang memuat SATU produk (+ variasinya).
 * Tampilan sama dengan menu Pesanan. productId WAJIB sudah terbukti boleh diakses pemanggil (admin: getTenantAccess +
 * loadProductDetail; produsen: loadProductDetail dengan ownerProducerId) — fungsi ini TIDAK memeriksa kepemilikan sendiri.
 * Item yang tampil hanya milik produk ini; `isMixed` di sini berarti "invoice juga memuat barang lain" (tab tidak menampilkannya).
 */
export async function listProductOrders(
  tenantClient: TenantDb,
  productId: string,
  opts: { q?: string; page: number; pageSize: number },
): Promise<{ rows: ProducerOrderRow[]; total: number }> {
  const { db, schema } = tenantClient;
  const variations = await db.select({ id: schema.productVariations.id, combo: schema.productVariations.attributeCombo })
    .from(schema.productVariations).where(eq(schema.productVariations.productId, productId));
  const owned = {
    ids: new Set<string>([productId, ...variations.map((v) => v.id)]),
    variationCombo: new Map(variations.map((v) => [v.id, (v.combo ?? {}) as Record<string, string>])),
  };
  return listByOwned(tenantClient, owned, opts);
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

  return {
    ...row,
    checkoutAddress: [inv.shippingAddress, inv.shippingCityName].filter((p): p is string => !!p?.trim()).join(", "),
  };
}

// ─── Batch pengiriman (S3) ──────────────────────────────────────────────────────────────────────────────

/** Layak masuk batch: tidak campuran, status Menunggu, dikirim kurir (bukan ambil sendiri), ada item produsen. */
export function isBatchable(o: ProducerOrderRow): boolean {
  return o.items.length > 0 && !o.isMixed && o.status === "pending" && o.deliveryMethod !== "pickup";
}

/** Invoice-invoice tertentu — hanya yang LUNAS dan memuat item produsen ini (id lain diabaikan diam-diam → pemanggil cek jumlah). */
export async function getProducerOrdersByIds(tenantClient: TenantDb, producerId: string, invoiceIds: string[], opts: { requirePaid?: boolean } = {}): Promise<ProducerOrderRow[]> {
  if (invoiceIds.length === 0) return [];
  const { db, schema } = tenantClient;
  const owned = await producerItemIds(tenantClient, producerId);
  if (owned.ids.size === 0) return [];
  const invs = await db.select({
    id: schema.invoices.id, invoiceNumber: schema.invoices.invoiceNumber, createdAt: schema.invoices.createdAt,
    customerName: schema.invoices.customerName, customerPhone: schema.invoices.customerPhone,
  }).from(schema.invoices)
    .where(and(inArray(schema.invoices.id, invoiceIds), opts.requirePaid === false ? undefined : eq(schema.invoices.status, "paid")));
  return (await buildRows(tenantClient, invs, owned)).filter((r) => r.items.length > 0);
}

/** Pesanan yang bisa dipilih untuk batch baru: lunas, milik produsen, belum di batch mana pun, layak (isBatchable). */
export async function listBatchableOrders(tenantClient: TenantDb, producerId: string): Promise<ProducerOrderRow[]> {
  const { db, schema } = tenantClient;
  const owned = await producerItemIds(tenantClient, producerId);
  if (owned.ids.size === 0) return [];
  const mine = db.select({ id: schema.invoiceItems.invoiceId }).from(schema.invoiceItems)
    .where(and(eq(schema.invoiceItems.itemType, "product"), inArray(schema.invoiceItems.itemId, [...owned.ids])));
  const batched = db.select({ id: schema.producerShipmentInvoices.invoiceId }).from(schema.producerShipmentInvoices);
  const invs = await db.select({
    id: schema.invoices.id, invoiceNumber: schema.invoices.invoiceNumber, createdAt: schema.invoices.createdAt,
    customerName: schema.invoices.customerName, customerPhone: schema.invoices.customerPhone,
  }).from(schema.invoices)
    .where(and(eq(schema.invoices.status, "paid"), inArray(schema.invoices.id, mine), sql`${schema.invoices.id} NOT IN (${batched})`))
    .orderBy(desc(schema.invoices.createdAt)).limit(100); // = MAX_INVOICES aksi batch
  return (await buildRows(tenantClient, invs, owned)).filter(isBatchable);
}

export type ProducerBatchSummary = {
  id: string; name: string; shippingDate: string; createdAt: Date;
  total: number; byStatus: Partial<Record<ShippingStatus, number>>; finished: boolean;
};

async function summarize(tenantClient: TenantDb, batches: { id: string; name: string; shippingDate: string; createdAt: Date }[]): Promise<ProducerBatchSummary[]> {
  if (batches.length === 0) return [];
  const { db, schema } = tenantClient;
  const links = await db.select({ batchId: schema.producerShipmentInvoices.batchId, invoiceId: schema.producerShipmentInvoices.invoiceId })
    .from(schema.producerShipmentInvoices).where(inArray(schema.producerShipmentInvoices.batchId, batches.map((b) => b.id)));
  const invIds = links.map((l) => l.invoiceId);
  const lines = invIds.length ? await db.select({ invoiceId: schema.invoiceShippingLines.invoiceId, status: schema.invoiceShippingLines.status, sellerType: schema.invoiceShippingLines.sellerType })
    .from(schema.invoiceShippingLines).where(and(inArray(schema.invoiceShippingLines.invoiceId, invIds), eq(schema.invoiceShippingLines.sellerType, "tenant"))) : [];
  return batches.map((b) => {
    const ids = links.filter((l) => l.batchId === b.id).map((l) => l.invoiceId);
    const byStatus: Partial<Record<ShippingStatus, number>> = {};
    for (const id of ids) {
      const st = (lines.find((l) => l.invoiceId === id)?.status ?? "pending") as ShippingStatus;
      byStatus[st] = (byStatus[st] ?? 0) + 1;
    }
    const done = (byStatus.shipped ?? 0) + (byStatus.delivered ?? 0);
    return { ...b, total: ids.length, byStatus, finished: ids.length > 0 && done === ids.length };
  });
}

export async function listProducerBatches(tenantClient: TenantDb, producerId: string): Promise<ProducerBatchSummary[]> {
  const { db, schema } = tenantClient;
  const batches = await db.select({
    id: schema.producerShipmentBatches.id, name: schema.producerShipmentBatches.name,
    shippingDate: schema.producerShipmentBatches.shippingDate, createdAt: schema.producerShipmentBatches.createdAt,
  }).from(schema.producerShipmentBatches)
    .where(eq(schema.producerShipmentBatches.producerId, producerId))
    .orderBy(desc(schema.producerShipmentBatches.createdAt)).limit(200);
  return summarize(tenantClient, batches);
}

/** Satu batch milik produsen ini (null bila bukan miliknya) + pesanan di dalamnya. */
export async function getProducerBatch(tenantClient: TenantDb, producerId: string, batchId: string) {
  const { db, schema } = tenantClient;
  const [b] = await db.select({
    id: schema.producerShipmentBatches.id, name: schema.producerShipmentBatches.name,
    shippingDate: schema.producerShipmentBatches.shippingDate, createdAt: schema.producerShipmentBatches.createdAt,
  }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, producerId)))
    .limit(1);
  if (!b) return null;
  const [summary] = await summarize(tenantClient, [b]);
  const links = await db.select({ invoiceId: schema.producerShipmentInvoices.invoiceId })
    .from(schema.producerShipmentInvoices).where(eq(schema.producerShipmentInvoices.batchId, b.id));
  const owned = await producerItemIds(tenantClient, producerId);
  const invs = links.length ? await db.select({
    id: schema.invoices.id, invoiceNumber: schema.invoices.invoiceNumber, createdAt: schema.invoices.createdAt,
    customerName: schema.invoices.customerName, customerPhone: schema.invoices.customerPhone,
  }).from(schema.invoices).where(inArray(schema.invoices.id, links.map((l) => l.invoiceId))).orderBy(desc(schema.invoices.createdAt)) : [];
  const rows = await buildRows(tenantClient, invs, owned);
  return { batch: summary, rows };
}

/** Nama bawaan batch: DDMMYYYY (tanggal hari ini, WIB) + urutan 4 digit berikutnya untuk produsen ini. */
export async function suggestBatchName(tenantClient: TenantDb, producerId: string): Promise<string> {
  const { db, schema } = tenantClient;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const prefix = `${get("day")}${get("month")}${get("year")}`;
  const existing = await db.select({ name: schema.producerShipmentBatches.name }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.producerId, producerId), ilike(schema.producerShipmentBatches.name, `${prefix}%`)));
  let max = 0;
  for (const e of existing) {
    const m = new RegExp(`^${prefix}(\\d{4})$`).exec(e.name);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
