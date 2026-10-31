// Pesanan untuk Portal Produsen & tab "Pesanan Masuk" — SATU baris = SATU PENGIRIMAN (baris invoice_shipping_lines penjual tenant)
// dari invoice LUNAS. ADR-0005 (pengiriman per produsen), docs/arsitektur-portal-produsen.md § 19 & 24.
//
// Kepemilikan (fail-closed):
//  - lingkup "producer": pengiriman dengan `invoice_shipping_lines.producer_id` = produsen dari SESI (getProducerAccess, bukan URL/body);
//    item pengiriman = item produk tenant invoice itu dengan `invoice_items.producer_id` yang sama (snapshot checkout).
//    Pesanan lama yang ambigu (satu baris bersama beberapa produsen → producer_id NULL) TIDAK tampil di sini — ditangani admin.
//  - lingkup "product" (tab produk): pengiriman milik produsen pemilik produk itu (atau baris toko bila produk internal) yang memuat produk tsb.
//    Pemanggil WAJIB sudah membuktikan akses ke produk (fungsi ini tidak memeriksa sendiri).
//  - Hanya invoice status "paid" (kecuali requirePaid:false untuk operasi koreksi).
//  - Tidak ada data uang yang dikembalikan oleh daftar (hanya detail yang memuat harga).
import "server-only";
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { TenantDb, ShippingStatus } from "@jalajogja/db";
import { escapeLike } from "@/lib/escape-like";
import { formatShippingMethod } from "@/lib/format-shipping-method";

const num = (v: unknown) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : 0; };

export type ProducerOrderItem = { name: string; variantLabel: string; quantity: number };

export type ProducerOrderRow = {
  lineId:        string;                // KUNCI: id pengiriman (invoice_shipping_lines.id) — dipakai semua aksi (batch/label/resi)
  invoiceId:     string;
  invoiceNumber: string;
  createdAt:     Date;
  customerName:  string;
  customerPhone: string | null;
  items:         ProducerOrderItem[];   // HANYA item milik pengiriman/produsen ini
  totalQty:      number;
  courierLabel:  string;
  status:        ShippingStatus | null; // status pengiriman (satu sumber dengan admin & pelanggan)
  deliveryMethod: string | null;        // 'courier' | 'pickup' (ambil sendiri tidak dikirim kurir → tak bisa di batch)
  trackingNumber: string | null;        // resi (diisi saat Dikirim)
  trackingProofPath: string | null;     // path foto resi di bucket tenant (URL dibentuk di halaman)
  shippedAt:     Date | null;           // tanggal kirim (dasar masa simpan foto resi 30 hari)
  /** Selalu false di lingkup produsen (pengiriman per produsen; ADR-0005). Dipertahankan agar komponen tabel lama tetap kompatibel. */
  isMixed:       boolean;
};

export type InvoiceBatchRef = { id: string; name: string; producerId: string };

export const ORDER_STATUS_FILTERS = ["pending", "processing", "packed", "shipped", "delivered"] as const;
export type OrderStatusFilter = typeof ORDER_STATUS_FILTERS[number];
/** Nilai ?status= dari URL → filter valid atau null (= Semua). */
export const parseStatusFilter = (v: unknown): OrderStatusFilter | null =>
  ORDER_STATUS_FILTERS.find((s) => s === v) ?? null;
export type StatusCounts = Record<OrderStatusFilter, number> & { all: number };
const EMPTY_COUNTS: StatusCounts = { all: 0, pending: 0, processing: 0, packed: 0, shipped: 0, delivered: 0 };

// ─── Lingkup & pembentuk baris ─────────────────────────────────────────────────────────────────────────

type Scope =
  | { kind: "producer"; producerId: string }
  | { kind: "product"; productId: string; producerId: string | null; itemIds: Set<string> };

type LineRecord = {
  lineId: string; invoiceId: string; invoiceNumber: string; createdAt: Date; customerName: string; customerPhone: string | null;
  lineProducerId: string | null; deliveryMethod: string; courier: string | null; service: string | null; paymentMethod: string;
  status: string; trackingNumber: string | null; trackingProofPath: string | null; shippedAt: Date | null;
};

function lineSelect(schema: TenantDb["schema"]) {
  const L = schema.invoiceShippingLines, I = schema.invoices;
  return {
    lineId: L.id, invoiceId: I.id, invoiceNumber: I.invoiceNumber, createdAt: I.createdAt,
    customerName: I.customerName, customerPhone: I.customerPhone,
    lineProducerId: L.producerId, deliveryMethod: L.deliveryMethod, courier: L.courier, service: L.service, paymentMethod: L.paymentMethod,
    status: L.status, trackingNumber: L.trackingNumber, trackingProofPath: L.trackingProofPath, shippedAt: L.shippedAt,
  };
}

/** Item produk penjual tenant untuk tiap pengiriman + label varian. */
async function buildRows(tenantClient: TenantDb, lines: LineRecord[], scope: Scope): Promise<ProducerOrderRow[]> {
  if (lines.length === 0) return [];
  const { db, schema } = tenantClient;
  const II = schema.invoiceItems;
  const invoiceIds = [...new Set(lines.map((l) => l.invoiceId))];

  const items = await db.select({
    invoiceId: II.invoiceId, itemId: II.itemId, producerId: II.producerId, name: II.name, quantity: II.quantity, sortOrder: II.sortOrder,
  }).from(II).where(and(inArray(II.invoiceId, invoiceIds), eq(II.itemType, "product"), eq(II.sellerType, "tenant")));

  const varIds = [...new Set(items.map((i) => i.itemId).filter((x): x is string => !!x))];
  const variations = varIds.length
    ? await db.select({ id: schema.productVariations.id, combo: schema.productVariations.attributeCombo })
        .from(schema.productVariations).where(inArray(schema.productVariations.id, varIds))
    : [];
  const comboOf = new Map(variations.map((v) => [v.id, (v.combo ?? {}) as Record<string, string>]));

  return lines.map((l) => {
    const mine = items
      .filter((i) => i.invoiceId === l.invoiceId && (scope.kind === "producer" ? i.producerId === l.lineProducerId : !!i.itemId && scope.itemIds.has(i.itemId) && (l.lineProducerId === null || i.producerId === l.lineProducerId)))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => {
        const combo = i.itemId ? comboOf.get(i.itemId) : undefined;
        return {
          name: i.name,
          variantLabel: combo ? Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(", ") : "",
          quantity: i.quantity,
        };
      });
    return {
      lineId: l.lineId, invoiceId: l.invoiceId, invoiceNumber: l.invoiceNumber, createdAt: l.createdAt,
      customerName: l.customerName, customerPhone: l.customerPhone,
      items: mine, totalQty: mine.reduce((a, i) => a + i.quantity, 0),
      courierLabel: formatShippingMethod({ deliveryMethod: l.deliveryMethod, courier: l.courier, service: l.service, paymentMethod: l.paymentMethod }),
      status: l.status as ShippingStatus,
      deliveryMethod: l.deliveryMethod,
      trackingNumber: l.trackingNumber, trackingProofPath: l.trackingProofPath, shippedAt: l.shippedAt,
      isMixed: false,
    };
  });
}

/** Predikat dasar: pengiriman tenant + invoice lunas + kepemilikan lingkup. */
function baseWhere(tenantClient: TenantDb, scope: Scope, requirePaid = true): SQL | undefined {
  const { db, schema } = tenantClient;
  const L = schema.invoiceShippingLines, I = schema.invoices, II = schema.invoiceItems;
  const paid = requirePaid ? eq(I.status, "paid") : undefined;
  if (scope.kind === "producer") return and(eq(L.sellerType, "tenant"), eq(L.producerId, scope.producerId), paid);
  const containing = db.select({ id: II.invoiceId }).from(II)
    .where(and(eq(II.itemType, "product"), eq(II.sellerType, "tenant"), inArray(II.itemId, [...scope.itemIds])));
  return and(
    eq(L.sellerType, "tenant"),
    scope.producerId ? eq(L.producerId, scope.producerId) : isNull(L.producerId),
    paid,
    inArray(L.invoiceId, containing),
  );
}

async function listByScope(
  tenantClient: TenantDb,
  scope: Scope,
  opts: { q?: string; page: number; pageSize: number; status?: OrderStatusFilter | null },
): Promise<{ rows: ProducerOrderRow[]; total: number; statusCounts: StatusCounts }> {
  const { db, schema } = tenantClient;
  const L = schema.invoiceShippingLines, I = schema.invoices;
  const base = baseWhere(tenantClient, scope);

  const q = (opts.q ?? "").trim().slice(0, 80);
  const where = and(
    base,
    opts.status ? eq(L.status, opts.status) : undefined,
    q ? or(ilike(I.invoiceNumber, `%${escapeLike(q)}%`), ilike(I.customerName, `%${escapeLike(q)}%`)) : undefined,
  );

  const [lines, [{ total }], countRows, allRow] = await Promise.all([
    db.select(lineSelect(schema)).from(L).innerJoin(I, eq(I.id, L.invoiceId)).where(where)
      .orderBy(desc(I.createdAt), L.createdAt).limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(L).innerJoin(I, eq(I.id, L.invoiceId)).where(where),
    // Jumlah per status untuk chip filter — himpunan pengiriman lunas yang sama, MENGABAIKAN pencarian & filter (angka stabil)
    db.select({ status: L.status, n: sql<number>`count(*)::int` }).from(L).innerJoin(I, eq(I.id, L.invoiceId)).where(base).groupBy(L.status),
    db.select({ n: sql<number>`count(*)::int` }).from(L).innerJoin(I, eq(I.id, L.invoiceId)).where(base),
  ]);

  const statusCounts: StatusCounts = { ...EMPTY_COUNTS, all: Number(allRow[0]?.n ?? 0) };
  for (const r of countRows) {
    if ((ORDER_STATUS_FILTERS as readonly string[]).includes(r.status)) statusCounts[r.status as OrderStatusFilter] = r.n;
  }
  return { rows: await buildRows(tenantClient, lines, scope), total: Number(total), statusCounts };
}

/** Menu Pesanan: semua pengiriman milik produsen (producerId WAJIB dari sesi). */
export async function listProducerOrders(
  tenantClient: TenantDb,
  producerId: string,
  opts: { q?: string; page: number; pageSize: number; status?: OrderStatusFilter | null },
): Promise<{ rows: ProducerOrderRow[]; total: number; statusCounts: StatusCounts }> {
  return listByScope(tenantClient, { kind: "producer", producerId }, opts);
}

/**
 * Tab "Pesanan Masuk" di halaman produk tunggal: pengiriman lunas milik produsen pemilik produk (atau baris toko bila produk internal)
 * yang memuat SATU produk (+ variasinya); item yang tampil hanya produk itu. productId WAJIB sudah terbukti boleh diakses pemanggil
 * (admin: getTenantAccess + loadProductDetail; produsen: loadProductDetail dengan ownerProducerId) — fungsi ini TIDAK memeriksa sendiri.
 */
export async function listProductOrders(
  tenantClient: TenantDb,
  productId: string,
  opts: { q?: string; page: number; pageSize: number; status?: OrderStatusFilter | null },
): Promise<{ rows: ProducerOrderRow[]; total: number; statusCounts: StatusCounts }> {
  const scope = await productScope(tenantClient, productId);
  if (!scope) return { rows: [], total: 0, statusCounts: { ...EMPTY_COUNTS } };
  return listByScope(tenantClient, scope, opts);
}

async function productScope(tenantClient: TenantDb, productId: string): Promise<Scope | null> {
  const { db, schema } = tenantClient;
  const [p] = await db.select({ producerId: schema.products.producerId, mitraId: schema.products.mitraId })
    .from(schema.products).where(eq(schema.products.id, productId)).limit(1);
  if (!p || p.mitraId) return null; // produk mitra tak punya pengiriman tenant
  const variations = await db.select({ id: schema.productVariations.id }).from(schema.productVariations)
    .where(eq(schema.productVariations.productId, productId));
  return { kind: "product", productId, producerId: p.producerId ?? null, itemIds: new Set<string>([productId, ...variations.map((v) => v.id)]) };
}

// ─── Batch ─────────────────────────────────────────────────────────────────────────────────────────────

/** Layak masuk batch: status Menunggu, dikirim kurir (bukan ambil-sendiri), ada item. (Kepemilikan sudah dijamin pemuat.) */
export function isBatchable(o: ProducerOrderRow): boolean {
  return o.items.length > 0 && !o.isMixed && o.status === "pending" && o.deliveryMethod !== "pickup";
}

/**
 * Pengiriman-pengiriman tertentu milik produsen — hanya yang lunas (kecuali requirePaid:false untuk koreksi). id yang bukan milik
 * produsen / bukan pengiriman tenant / invoice belum lunas DIABAIKAN diam-diam → pemanggil membandingkan jumlah hasil dengan jumlah id.
 */
export async function getProducerOrdersByIds(
  tenantClient: TenantDb,
  producerId: string,
  lineIds: string[],
  opts: { requirePaid?: boolean } = {},
): Promise<ProducerOrderRow[]> {
  if (lineIds.length === 0) return [];
  const { db, schema } = tenantClient;
  const L = schema.invoiceShippingLines, I = schema.invoices;
  const scope: Scope = { kind: "producer", producerId };
  const lines = await db.select(lineSelect(schema)).from(L).innerJoin(I, eq(I.id, L.invoiceId))
    .where(and(baseWhere(tenantClient, scope, opts.requirePaid !== false), inArray(L.id, lineIds)));
  return (await buildRows(tenantClient, lines, scope)).filter((r) => r.items.length > 0);
}

/** Pengiriman yang bisa dipilih untuk batch baru: lunas, milik produsen, belum di batch mana pun, layak (isBatchable). */
export async function listBatchableOrders(tenantClient: TenantDb, producerId: string): Promise<ProducerOrderRow[]> {
  const { db, schema } = tenantClient;
  const L = schema.invoiceShippingLines, I = schema.invoices, PSI = schema.producerShipmentInvoices;
  const scope: Scope = { kind: "producer", producerId };
  const batched = db.select({ id: PSI.shippingLineId }).from(PSI).where(isNotNull(PSI.shippingLineId));
  const lines = await db.select(lineSelect(schema)).from(L).innerJoin(I, eq(I.id, L.invoiceId))
    .where(and(baseWhere(tenantClient, scope), eq(L.status, "pending"), eq(L.deliveryMethod, "courier"), sql`${L.id} NOT IN (${batched})`))
    .orderBy(desc(I.createdAt)).limit(100); // = MAX_INVOICES aksi batch
  return (await buildRows(tenantClient, lines, scope)).filter(isBatchable);
}

export type ProducerBatchSummary = {
  id: string; name: string; shippingDate: string; createdAt: Date;
  total: number; byStatus: Partial<Record<ShippingStatus, number>>; finished: boolean;
};

async function summarize(tenantClient: TenantDb, batches: { id: string; name: string; shippingDate: string; createdAt: Date }[]): Promise<ProducerBatchSummary[]> {
  if (batches.length === 0) return [];
  const { db, schema } = tenantClient;
  const PSI = schema.producerShipmentInvoices, L = schema.invoiceShippingLines;
  const links = await db.select({ batchId: PSI.batchId, lineId: PSI.shippingLineId }).from(PSI)
    .where(and(inArray(PSI.batchId, batches.map((b) => b.id)), isNotNull(PSI.shippingLineId)));
  const lineIds = links.map((l) => l.lineId!).filter(Boolean);
  const lines = lineIds.length ? await db.select({ id: L.id, status: L.status }).from(L).where(inArray(L.id, lineIds)) : [];
  const statusOf = new Map(lines.map((l) => [l.id, l.status]));
  return batches.map((b) => {
    const ids = links.filter((l) => l.batchId === b.id).map((l) => l.lineId!);
    const byStatus: Partial<Record<ShippingStatus, number>> = {};
    for (const id of ids) {
      const st = (statusOf.get(id) ?? "pending") as ShippingStatus;
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

/** Satu batch milik produsen ini (null bila bukan miliknya) + pengiriman di dalamnya. */
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
  const links = await db.select({ lineId: schema.producerShipmentInvoices.shippingLineId }).from(schema.producerShipmentInvoices)
    .where(and(eq(schema.producerShipmentInvoices.batchId, b.id), isNotNull(schema.producerShipmentInvoices.shippingLineId)));
  const rows = await getProducerOrdersByIds(tenantClient, producerId, links.map((l) => l.lineId!), { requirePaid: false });
  return { batch: summary, rows };
}

/** Batch yang memuat tiap pengiriman (satu pengiriman paling banyak satu batch). TIDAK memeriksa pemanggil — pemanggil sudah mengotorisasi. */
export async function getLineBatches(tenantClient: TenantDb, lineIds: string[]): Promise<Map<string, InvoiceBatchRef>> {
  const out = new Map<string, InvoiceBatchRef>();
  if (lineIds.length === 0) return out;
  const { db, schema } = tenantClient;
  const rows = await db.select({
    lineId: schema.producerShipmentInvoices.shippingLineId, id: schema.producerShipmentBatches.id,
    name: schema.producerShipmentBatches.name, producerId: schema.producerShipmentBatches.producerId,
  }).from(schema.producerShipmentInvoices)
    .innerJoin(schema.producerShipmentBatches, eq(schema.producerShipmentBatches.id, schema.producerShipmentInvoices.batchId))
    .where(inArray(schema.producerShipmentInvoices.shippingLineId, lineIds));
  for (const r of rows) if (r.lineId) out.set(r.lineId, { id: r.id, name: r.name, producerId: r.producerId });
  return out;
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

// ─── Detail satu invoice untuk produsen ────────────────────────────────────────────────────────────────

export type ProducerOrderDetail = {
  invoiceId: string; invoiceNumber: string; createdAt: Date; customerName: string; customerPhone: string | null;
  checkoutAddress: string; notes: string | null;
  /** Pengiriman milik produsen ini di invoice tsb (≥1), terurut. */
  rows: ProducerOrderRow[];
  /** Batch tiap pengiriman (kunci = lineId). */
  batches: Map<string, InvoiceBatchRef>;
  /** Angka tingkat invoice — dipakai UTUH hanya bila `singleProducer` (invoice hanya berisi barang & pengiriman produsen ini). */
  invoiceAmounts: { subtotal: number; shipping: number; discount: number; total: number; paid: number };
  singleProducer: boolean;
  /** Item MILIK produsen ini (dengan harga) — tampilan detail sama dengan admin. images = gambar produk (simple) untuk foto. */
  itemsDetail: { id: string; name: string; description: string | null; itemId: string | null; unitPrice: number; quantity: number; total: number; images: unknown }[];
  /** Baris pengiriman produsen ini (mentah; dipetakan ke kartu fulfillment di halaman). */
  shippingRows: { id: string; sellerType: string; sellerName: string; courier: string | null; service: string | null; etd: string | null; cost: string; trackingNumber: string | null; trackingProofPath: string | null; shippedAt: Date | null; status: string }[];
};

export async function getProducerOrder(
  tenantClient: TenantDb,
  producerId: string,
  invoiceId: string,
): Promise<ProducerOrderDetail | null> {
  const { db, schema } = tenantClient;
  const L = schema.invoiceShippingLines, I = schema.invoices, II = schema.invoiceItems;
  const scope: Scope = { kind: "producer", producerId };

  // Pengiriman milik produsen di invoice ini (bukti kepemilikan: producer_id baris = sesi) — lunas
  const lines = await db.select(lineSelect(schema)).from(L).innerJoin(I, eq(I.id, L.invoiceId))
    .where(and(baseWhere(tenantClient, scope), eq(I.id, invoiceId))).orderBy(L.createdAt);
  if (lines.length === 0) return null;
  const rows = (await buildRows(tenantClient, lines, scope)).filter((r) => r.items.length > 0);
  if (rows.length === 0) return null;

  const [inv] = await db.select({
    shippingAddress: I.shippingAddress, shippingCityName: I.shippingCityName, notes: I.notes,
    subtotal: I.subtotal, shippingTotal: I.shippingTotal, discount: I.discount, total: I.total, paidAmount: I.paidAmount,
  }).from(I).where(eq(I.id, invoiceId)).limit(1);

  // Kepemilikan terbukti → muat item MILIK produsen (dengan harga), gambar produk, baris pengiriman, dan hitung "invoice hanya milik produsen ini?"
  const [itemRows, shippingRows, [{ allItems }], [{ allLines }]] = await Promise.all([
    db.select({
      id: II.id, name: II.name, description: II.description, itemId: II.itemId,
      unitPrice: II.unitPrice, quantity: II.quantity, total: II.total,
    }).from(II)
      .where(and(eq(II.invoiceId, invoiceId), eq(II.itemType, "product"), eq(II.sellerType, "tenant"), eq(II.producerId, producerId)))
      .orderBy(II.sortOrder),
    db.select().from(L).where(and(eq(L.invoiceId, invoiceId), eq(L.sellerType, "tenant"), eq(L.producerId, producerId))).orderBy(L.createdAt),
    db.select({ allItems: sql<number>`count(*)::int` }).from(II).where(eq(II.invoiceId, invoiceId)),
    db.select({ allLines: sql<number>`count(*)::int` }).from(L).where(eq(L.invoiceId, invoiceId)),
  ]);
  const productIds = [...new Set(itemRows.map((i) => i.itemId).filter((x): x is string => !!x))];
  const imgs = productIds.length
    ? await db.select({ id: schema.products.id, images: schema.products.images }).from(schema.products).where(inArray(schema.products.id, productIds))
    : [];
  const imgOf = new Map(imgs.map((p) => [p.id, p.images]));

  const first = lines[0];
  return {
    invoiceId, invoiceNumber: first.invoiceNumber, createdAt: first.createdAt, customerName: first.customerName, customerPhone: first.customerPhone,
    checkoutAddress: [inv?.shippingAddress, inv?.shippingCityName].filter((p): p is string => !!p?.trim()).join(", "),
    notes: inv?.notes ?? null,
    rows,
    batches: await getLineBatches(tenantClient, rows.map((r) => r.lineId)),
    invoiceAmounts: {
      subtotal: num(inv?.subtotal), shipping: num(inv?.shippingTotal), discount: num(inv?.discount), total: num(inv?.total), paid: num(inv?.paidAmount),
    },
    singleProducer: Number(allItems) === itemRows.length && Number(allLines) === shippingRows.length,
    itemsDetail: itemRows.map((i) => ({
      id: i.id, name: i.name, description: i.description, itemId: i.itemId,
      unitPrice: num(i.unitPrice), quantity: i.quantity, total: num(i.total), images: i.itemId ? imgOf.get(i.itemId) : undefined,
    })),
    shippingRows: shippingRows.map((l) => ({
      id: l.id, sellerType: l.sellerType, sellerName: l.sellerName, courier: l.courier, service: l.service, etd: l.etd,
      cost: String(l.cost), trackingNumber: l.trackingNumber, trackingProofPath: l.trackingProofPath, shippedAt: l.shippedAt, status: l.status,
    })),
  };
}
