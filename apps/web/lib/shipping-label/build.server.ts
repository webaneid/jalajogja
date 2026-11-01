// Menyusun LabelData[] dari database untuk daftar invoice — SATU-SATUNYA pintu data label. Doc: arsitektur-portal-produsen.md § 21.
// Pemanggil (route /api/labels) sudah memverifikasi sesi + peran; di sini kepemilikan/kelayakan TIAP invoice diperiksa lagi:
//  - scope "producer": invoice lunas, memuat item produsen sesi, BUKAN campuran, bukan ambil-sendiri (loader produsen).
//  - scope "admin": invoice lunas dengan baris pengiriman penjual tenant bermetode kurir.
// Mengembalikan error (bukan sebagian hasil) bila ada invoice tak layak — cetak masal tidak diam-diam melewatkan pesanan.
import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getSettings, roDestinations, type TenantDb } from "@jalajogja/db";
import { getProducerOrdersByIds } from "@/lib/producer-orders.server";
import { resolveInternalProducer, resolveProducers } from "@/lib/producer.server";
import { getTenantTimezone, formatInTz } from "@/lib/tenant-timezone.server";
import { RAJAONGKIR_COURIER_OPTIONS } from "@/lib/rajaongkir-couriers";
import { displayPhone } from "@/lib/phone";
import { imageToDataUri } from "./images.server";
import type { LabelData, LabelParty } from "./types";

export type LabelScope = { kind: "admin" } | { kind: "producer"; producerId: string };
type TenantRef = { id: string; name: string; tenantType: string | null; slug: string };

export type BuildResult =
  | { ok: true; labels: LabelData[]; shipmentIds: string[] }
  | { ok: false; error: string };

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const num = (v: unknown) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : 0; };
const weightLabel = (g: number | null) => (g && g > 0 ? `${(Math.max(g, 100) / 1000).toFixed(1).replace(".", ",").replace(/,0$/, "")} Kg` : "—");
const courierLabel = (code: string | null) => RAJAONGKIR_COURIER_OPTIONS.find((c) => c.value === code)?.label ?? (code ? code.toUpperCase() : "Kurir");

export async function buildLabelData(
  tenantClient: TenantDb,
  tenant: TenantRef,
  shipmentIds: string[],
  scope: LabelScope,
): Promise<BuildResult> {
  const { db, schema } = tenantClient;
  const L = schema.invoiceShippingLines;

  // 1) Pengiriman (baris penjual tenant) dari invoice LUNAS yang diminta — satuan label = satu pengiriman (ADR-0005)
  const lines = await db.select({
    line: L, invoiceNumber: schema.invoices.invoiceNumber,
    customerName: sql<string>`COALESCE(${schema.invoices.shippingRecipientName}, ${schema.invoices.customerName})`,   // penerima paket (snapshot buku alamat) ?? pembeli
    customerPhone: sql<string | null>`COALESCE(${schema.invoices.shippingRecipientPhone}, ${schema.invoices.customerPhone})`,
    shippingAddress: schema.invoices.shippingAddress, shippingCityName: schema.invoices.shippingCityName, notes: schema.invoices.notes,
  }).from(L).innerJoin(schema.invoices, eq(schema.invoices.id, L.invoiceId))
    .where(and(inArray(L.id, shipmentIds), eq(L.sellerType, "tenant"), eq(schema.invoices.status, "paid")));
  if (lines.length !== shipmentIds.length) return { ok: false, error: "Sebagian pesanan tidak ditemukan atau tidak bisa dicetak." };

  // 2) Kelayakan per scope
  if (scope.kind === "producer") {
    // Kepemilikan: producer_id pengiriman = produsen sesi (loader); cetak ulang boleh di status apa pun, ambil-sendiri tidak
    const rows = await getProducerOrdersByIds(tenantClient, scope.producerId, shipmentIds);
    if (rows.length !== shipmentIds.length) return { ok: false, error: "Sebagian pesanan tidak ditemukan atau tidak bisa dicetak." };
    if (rows.some((r) => r.deliveryMethod === "pickup" || r.items.length === 0)) {
      return { ok: false, error: "Sebagian pesanan tidak dikirim oleh produsen (ambil sendiri) dan tidak bisa dicetak." };
    }
  }
  for (const { line } of lines) {
    if (line.deliveryMethod !== "courier") return { ok: false, error: "Sebagian pesanan tidak memakai pengiriman kurir (ambil sendiri / tanpa pengiriman)." };
  }
  const invoiceIds = [...new Set(lines.map((x) => x.line.invoiceId))];
  const lineById = new Map(lines.map((x) => [x.line.id, x]));
  // Jumlah baris tenant per invoice: baris tanpa produsen pada invoice BERBARIS-TUNGGAL = pengiriman lama/bersama (semua item tenant)
  const tenantLineCounts = await db.select({ invoiceId: L.invoiceId, n: sql<number>`count(*)::int` }).from(L)
    .where(and(inArray(L.invoiceId, invoiceIds), eq(L.sellerType, "tenant"))).groupBy(L.invoiceId);
  const lineCountOf = new Map(tenantLineCounts.map((x) => [x.invoiceId, x.n]));

  // 4) Item produk penjual tenant + varian + produk induk (untuk menentukan pengirim)
  const items = await db.select({
    invoiceId: schema.invoiceItems.invoiceId, itemId: schema.invoiceItems.itemId, name: schema.invoiceItems.name,
    quantity: schema.invoiceItems.quantity, total: schema.invoiceItems.total, sortOrder: schema.invoiceItems.sortOrder,
    producerId: schema.invoiceItems.producerId,
  }).from(schema.invoiceItems)
    .where(and(inArray(schema.invoiceItems.invoiceId, invoiceIds), eq(schema.invoiceItems.itemType, "product"), eq(schema.invoiceItems.sellerType, "tenant")));
  const itemIds = [...new Set(items.map((i) => i.itemId).filter((x): x is string => !!x))];
  const variations = itemIds.length
    ? await db.select({ id: schema.productVariations.id, productId: schema.productVariations.productId, combo: schema.productVariations.attributeCombo })
        .from(schema.productVariations).where(inArray(schema.productVariations.id, itemIds))
    : [];
  const varOf = new Map(variations.map((v) => [v.id, v]));
  const productIds = [...new Set(itemIds.map((id) => varOf.get(id)?.productId ?? id))];
  const products = productIds.length
    ? await db.select({ id: schema.products.id, producerId: schema.products.producerId }).from(schema.products).where(inArray(schema.products.id, productIds))
    : [];
  const producerOfProduct = new Map(products.map((p) => [p.id, p.producerId]));

  // 5) Pengirim: semua item satu produsen → gudang produsen; selain itu → tenant (kontak organisasi)
  const senderCache = new Map<string, LabelParty>();
  const tenantRef = { id: tenant.id, name: tenant.name, tenantType: tenant.tenantType };
  async function tenantSender(): Promise<LabelParty> {
    const hit = senderCache.get("tenant");
    if (hit) return hit;
    const v = await resolveInternalProducer(tenantClient, tenantRef);
    const p = { name: v.name, phone: v.phone ? displayPhone(v.phone.value) : "—", address: v.address?.text ?? "—" };
    senderCache.set("tenant", p);
    return p;
  }
  async function producerSender(producerId: string): Promise<LabelParty> {
    const hit = senderCache.get(producerId);
    if (hit) return hit;
    const [views, [wh]] = await Promise.all([
      resolveProducers(tenantClient, tenantRef, [producerId]),
      // Alamat pengirim = asal kirim UTAMA produsen (shipping_origins, § 20): detail + label wilayah dari tujuan RajaOngkir
      db.select({ detail: schema.shippingOrigins.detail, label: roDestinations.label })
        .from(schema.shippingOrigins).innerJoin(roDestinations, eq(roDestinations.id, schema.shippingOrigins.destinationId))
        .where(and(eq(schema.shippingOrigins.producerId, producerId), eq(schema.shippingOrigins.isDefault, true))).limit(1),
    ]);
    const v = views.get(producerId);
    if (!v) return tenantSender();
    const p = {
      name: v.name,
      phone: v.phone ? displayPhone(v.phone.value) : "—",
      address: wh ? `${wh.detail}, ${wh.label}` : (v.address?.text ?? "—"),
    };
    senderCache.set(producerId, p);
    return p;
  }

  // 6) Batch, logo, zona waktu, nama tenant
  const batchRows = await db.select({ lineId: schema.producerShipmentInvoices.shippingLineId, name: schema.producerShipmentBatches.name })
    .from(schema.producerShipmentInvoices)
    .innerJoin(schema.producerShipmentBatches, eq(schema.producerShipmentBatches.id, schema.producerShipmentInvoices.batchId))
    .where(inArray(schema.producerShipmentInvoices.shippingLineId, shipmentIds));
  const batchOf = new Map(batchRows.filter((b) => b.lineId).map((b) => [b.lineId as string, b.name]));

  const [general, toko, tz] = await Promise.all([getSettings(tenantClient, "general"), getSettings(tenantClient, "toko"), getTenantTimezone(tenantClient)]);
  const tenantName = (general["site_name"] as string | undefined)?.trim() || tenant.name;
  const courierLogoUrls = (toko["courier_logos"] as Record<string, string> | undefined) ?? {};
  const usedCouriers = [...new Set(lines.map((x) => x.line.courier).filter((c): c is string => !!c))];
  const [tenantLogo, ...courierLogos] = await Promise.all([
    imageToDataUri(general["logo_url"] as string | undefined),
    ...usedCouriers.map((c) => imageToDataUri(courierLogoUrls[c])),
  ]);
  const courierLogoOf = new Map(usedCouriers.map((c, i) => [c, courierLogos[i]]));

  const createdAtLabel = formatInTz(new Date(), tz, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(", ", " ").replace(/(\d{2})\.(\d{2})$/, "$1:$2");

  // 7) Rakit label sesuai urutan permintaan — satu label per PENGIRIMAN
  const labels: LabelData[] = [];
  for (const id of shipmentIds) {
    const { line, invoiceNumber, customerName, customerPhone, shippingAddress, shippingCityName, notes } = lineById.get(id)!;
    // Item pengiriman ini: produk tenant invoice dengan produsen yang sama dengan pengiriman (snapshot). Pengiriman tanpa produsen pada
    // invoice berbaris-tunggal = pengiriman lama/bersama → semua item tenant invoice itu.
    const shared = !line.producerId && (lineCountOf.get(line.invoiceId) ?? 1) <= 1;
    const its = items
      .filter((i) => i.invoiceId === line.invoiceId && (shared || i.producerId === (line.producerId ?? null)))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // Pengirim: produsen pengiriman; pengiriman lama/bersama → produsen tunggal pemilik semua item (bila ada), selain itu tenant
    let senderProducer: string | null = line.producerId ?? null;
    if (!senderProducer && shared) {
      const ps = new Set(its.map((i) => i.producerId ?? producerOfProduct.get(varOf.get(i.itemId ?? "")?.productId ?? i.itemId ?? "") ?? null)); // snapshot item dulu, produk saat ini sebagai cadangan
      senderProducer = ps.size === 1 ? [...ps][0] : null;
    }
    const sender = senderProducer ? await producerSender(senderProducer) : await tenantSender();

    const isCod = line.paymentMethod === "cod" && !line.codConfirmedAt;
    const codTotal = its.reduce((a, i) => a + num(i.total), 0) + num(line.cost);

    labels.push({
      tenantName, tenantLogo,
      courierName: courierLabel(line.courier), courierLogo: (line.courier && courierLogoOf.get(line.courier)) || null,
      service: line.service ?? "", weightLabel: weightLabel(line.weightGram),
      invoiceNumber,
      sender,
      receiver: {
        name: customerName,
        phone: customerPhone ? displayPhone(customerPhone) : "—",
        address: [shippingAddress, shippingCityName].filter((p): p is string => !!p?.trim()).join(", ") || "—",
      },
      isCod, codAmountLabel: isCod ? rupiah(codTotal) : null,
      items: its.map((i) => {
        const combo = varOf.get(i.itemId ?? "")?.combo as Record<string, string> | undefined;
        return { name: i.name, variant: combo ? Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(", ") : "", qty: i.quantity };
      }),
      note: notes ?? null,
      batchName: batchOf.get(id) ?? null,
      createdAtLabel,
    });
  }
  return { ok: true, labels, shipmentIds };
}

/**
 * Setelah PDF berhasil dibuat: pengiriman berstatus Diproses → Dikemas (mencetak label = tahap mengemas; keputusan user 2026-11-01).
 * Satu langkah saja, compare-and-set per id pengiriman + cek lunas di UPDATE yang sama; status lain tidak berubah (cetak ulang aman).
 * Mengembalikan jumlah pengiriman yang berubah.
 */
export async function markPackedAfterPrint(tenantClient: TenantDb, shipmentIds: string[]): Promise<number> {
  const { db, schema } = tenantClient;
  const L = schema.invoiceShippingLines;
  const upd = await db.update(L).set({ status: "packed", updatedAt: new Date() })
    .where(and(
      inArray(L.id, shipmentIds), eq(L.sellerType, "tenant"), eq(L.status, "processing"),
      inArray(L.invoiceId, db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.status, "paid"))),
    ))
    .returning({ id: L.id });
  return upd.length;
}
