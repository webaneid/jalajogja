"use server";

// Server Action batch pengiriman Portal Produsen — satuan = PENGIRIMAN (invoice_shipping_lines.id), ADR-0005.
// Doc: docs/arsitektur-portal-produsen.md § 19.8 & 24.7. Setiap aksi: getProducerAccess (sesi) → validasi input → kepemilikan lewat loader
// (pengiriman dengan producer_id = produsen SESI, invoice lunas) → transaksi dengan compare-and-set pada status
// (UPDATE … WHERE id = <pengiriman> AND status = <awal>), jumlah baris terubah dicek. Status tetap satu sumber:
// invoice_shipping_lines.status (sama dengan yang dilihat admin & pelanggan).
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { getProducerOrdersByIds, isBatchable } from "@/lib/producer-orders.server";
import { createBatchCore, cleanIds, isUniqueViolation, notifyProcessing, toProcessing, MAX_INVOICES, type Result } from "@/lib/producer-batch.server";
import { isValidUuid } from "@/lib/is-uuid";

function refresh(slug: string, batchId?: string) {
  const base = `/app/${slug}/portal-produsen`;
  revalidatePath(`${base}/pengiriman`);
  revalidatePath(`${base}/pesanan`);
  if (batchId) revalidatePath(`${base}/pengiriman/${batchId}`);
}

export async function createBatchAction(
  slug: string,
  input: { name: string; shippingDate: string; shipmentIds: string[] },
): Promise<Result<{ batchId: string; name: string; count: number }>> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  // producerId dari SESI; seluruh validasi + transaksi di inti bersama (lib/producer-batch.server.ts)
  const res = await createBatchCore(createTenantDb(access.tenant.slug), access.tenant.slug, access.producer.id, input);
  if (res.success) refresh(slug, res.data.batchId);
  return res;
}

export async function addShipmentsToBatchAction(slug: string, batchId: string, shipmentIds: string[]): Promise<Result> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(batchId)) return { success: false, error: "Batch tidak valid." };
  const ids = cleanIds(shipmentIds);
  if (!ids) return { success: false, error: `Pilih 1–${MAX_INVOICES} pesanan.` };

  const tenantDb = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantDb;
  const PSI = schema.producerShipmentInvoices, L = schema.invoiceShippingLines;

  const [batch] = await db.select({ id: schema.producerShipmentBatches.id }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, access.producer.id))).limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };

  // Batch yang sudah selesai (semua pengiriman Dikirim/Diterima) tidak menerima tambahan
  const inBatch = await db.select({ lineId: PSI.shippingLineId }).from(PSI).where(and(eq(PSI.batchId, batchId), isNotNull(PSI.shippingLineId)));
  if (inBatch.length > 0) {
    const lines = await db.select({ status: L.status }).from(L).where(inArray(L.id, inBatch.map((i) => i.lineId!)));
    if (lines.length > 0 && lines.every((l) => l.status === "shipped" || l.status === "delivered")) {
      return { success: false, error: "Batch ini sudah selesai." };
    }
  }

  const orders = await getProducerOrdersByIds(tenantDb, access.producer.id, ids);
  if (orders.length !== ids.length) return { success: false, error: "Sebagian pesanan tidak ditemukan atau belum lunas." };
  if (!orders.every(isBatchable)) return { success: false, error: "Sebagian pesanan tidak bisa dimasukkan ke batch." };
  const invoiceOf = new Map(orders.map((o) => [o.lineId, o.invoiceId]));

  try {
    const toNotify = await db.transaction(async (tx) => {
      await tx.insert(PSI).values(ids.map((lineId) => ({ batchId, invoiceId: invoiceOf.get(lineId)!, shippingLineId: lineId })));
      const n = await toProcessing(tx, schema, ids);
      await tx.update(schema.producerShipmentBatches).set({ updatedAt: new Date() }).where(eq(schema.producerShipmentBatches.id, batchId));
      return n;
    });
    notifyProcessing(access.tenant.slug, tenantDb, orders.filter((o) => toNotify.includes(o.lineId)));
    refresh(slug, batchId);
    return { success: true, data: undefined };
  } catch (e) {
    if (isUniqueViolation(e)) return { success: false, error: "Ada pesanan yang sudah masuk batch lain." };
    if (e instanceof Error && e.message === "STATUS_BERUBAH") return { success: false, error: "Status sebagian pesanan berubah. Muat ulang halaman lalu coba lagi." };
    console.error("[producer-batch] addShipmentsToBatchAction:", e);
    return { success: false, error: "Gagal menambahkan pesanan." };
  }
}

/** Keluarkan satu pengiriman dari batch — hanya selama BELUM ada resi (Diproses/Dikemas); status kembali Menunggu. */
export async function removeShipmentFromBatchAction(slug: string, batchId: string, shipmentId: string): Promise<Result> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(batchId) || !isValidUuid(shipmentId)) return { success: false, error: "Data tidak valid." };

  const tenantDb = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantDb;
  const PSI = schema.producerShipmentInvoices, L = schema.invoiceShippingLines;

  const [batch] = await db.select({ id: schema.producerShipmentBatches.id }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, access.producer.id))).limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };
  const [link] = await db.select({ id: PSI.id }).from(PSI)
    .where(and(eq(PSI.batchId, batchId), eq(PSI.shippingLineId, shipmentId))).limit(1);
  if (!link) return { success: false, error: "Pesanan tidak ada di batch ini." };
  // Kepemilikan pengiriman itu sendiri (bukan hanya batch) — tidak boleh menyentuh pengiriman produsen lain
  const [order] = await getProducerOrdersByIds(tenantDb, access.producer.id, [shipmentId], { requirePaid: false });
  if (!order) return { success: false, error: "Pesanan tidak ditemukan." };

  try {
    await db.transaction(async (tx) => {
      const upd = await tx.update(L)
        .set({ status: "pending", updatedAt: new Date() })
        .where(and(eq(L.id, shipmentId), eq(L.sellerType, "tenant"), inArray(L.status, ["processing", "packed"])))
        .returning({ id: L.id });
      if (upd.length === 0) throw new Error("SUDAH_RESI");
      await tx.delete(PSI).where(eq(PSI.id, link.id));
      await tx.update(schema.producerShipmentBatches).set({ updatedAt: new Date() }).where(eq(schema.producerShipmentBatches.id, batchId));
    });
    refresh(slug, batchId);
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "SUDAH_RESI") return { success: false, error: "Pesanan sudah dikirim (ada resi) — tidak bisa dikeluarkan dari batch." };
    console.error("[producer-batch] removeShipmentFromBatchAction:", e);
    return { success: false, error: "Gagal mengeluarkan pesanan." };
  }
}

/** Tombol manual (alternatif cetak label): Diproses → Dikemas, untuk satu pengiriman atau seluruh batch. */
export async function markPackedAction(slug: string, batchId: string, shipmentId?: string): Promise<Result<{ count: number }>> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(batchId) || (shipmentId !== undefined && !isValidUuid(shipmentId))) return { success: false, error: "Data tidak valid." };

  const { db, schema } = createTenantDb(access.tenant.slug);
  const PSI = schema.producerShipmentInvoices, L = schema.invoiceShippingLines;
  const [batch] = await db.select({ id: schema.producerShipmentBatches.id }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, access.producer.id))).limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };

  const links = await db.select({ lineId: PSI.shippingLineId }).from(PSI).where(and(eq(PSI.batchId, batchId), isNotNull(PSI.shippingLineId)));
  const targets = links.map((l) => l.lineId!).filter((id) => !shipmentId || id === shipmentId);
  if (targets.length === 0) return { success: false, error: "Tidak ada pesanan di batch ini." };

  try {
    const upd = await db.update(L)
      .set({ status: "packed", updatedAt: new Date() })
      .where(and(
        inArray(L.id, targets), eq(L.sellerType, "tenant"), eq(L.status, "processing"),
        eq(L.producerId, access.producer.id), // kepemilikan per pengiriman (bukan hanya lewat tautan batch) — audit F3 L1
        inArray(L.invoiceId, db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.status, "paid"))),
      ))
      .returning({ id: L.id });
    if (upd.length === 0) return { success: false, error: "Tidak ada pesanan berstatus Diproses." };
    refresh(slug, batchId);
    return { success: true, data: { count: upd.length } };
  } catch (e) {
    console.error("[producer-batch] markPackedAction:", e);
    return { success: false, error: "Gagal menandai dikemas." };
  }
}
