"use server";

// Server Action PERTAMA Portal Produsen — batch pengiriman. Doc: docs/arsitektur-portal-produsen.md § 19.8.
// Setiap aksi: getProducerAccess (sesi) → validasi input → kepemilikan lewat loader (lunas + memuat item produsen dari SESI)
// → transaksi dengan compare-and-set pada status (UPDATE … WHERE status = <status awal>), jumlah baris terubah dicek.
// Status pengiriman tetap satu sumber: invoice_shipping_lines.status (sama dengan yang dilihat admin & pelanggan).
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
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
  input: { name: string; shippingDate: string; invoiceIds: string[] },
): Promise<Result<{ batchId: string; name: string; count: number }>> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  // producerId dari SESI; seluruh validasi + transaksi di inti bersama (lib/producer-batch.server.ts)
  const res = await createBatchCore(createTenantDb(access.tenant.slug), access.tenant.slug, access.producer.id, input);
  if (res.success) refresh(slug, res.data.batchId);
  return res;
}

export async function addInvoicesToBatchAction(slug: string, batchId: string, invoiceIds: string[]): Promise<Result> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(batchId)) return { success: false, error: "Batch tidak valid." };
  const ids = cleanIds(invoiceIds);
  if (!ids) return { success: false, error: `Pilih 1–${MAX_INVOICES} pesanan.` };

  const tenantDb = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantDb;

  const [batch] = await db.select({ id: schema.producerShipmentBatches.id }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, access.producer.id))).limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };

  // Batch yang sudah selesai (semua invoice Dikirim/Diterima) tidak menerima tambahan
  const inBatch = await db.select({ invoiceId: schema.producerShipmentInvoices.invoiceId }).from(schema.producerShipmentInvoices)
    .where(eq(schema.producerShipmentInvoices.batchId, batchId));
  if (inBatch.length > 0) {
    const lines = await db.select({ status: schema.invoiceShippingLines.status }).from(schema.invoiceShippingLines)
      .where(and(inArray(schema.invoiceShippingLines.invoiceId, inBatch.map((i) => i.invoiceId)), eq(schema.invoiceShippingLines.sellerType, "tenant")));
    if (lines.length > 0 && lines.every((l) => l.status === "shipped" || l.status === "delivered")) {
      return { success: false, error: "Batch ini sudah selesai." };
    }
  }

  const orders = await getProducerOrdersByIds(tenantDb, access.producer.id, ids);
  if (orders.length !== ids.length) return { success: false, error: "Sebagian pesanan tidak ditemukan atau belum lunas." };
  if (!orders.every(isBatchable)) return { success: false, error: "Sebagian pesanan tidak bisa dimasukkan ke batch." };

  try {
    const toNotify = await db.transaction(async (tx) => {
      await tx.insert(schema.producerShipmentInvoices).values(ids.map((invoiceId) => ({ batchId, invoiceId })));
      const n = await toProcessing(tx, schema, ids);
      await tx.update(schema.producerShipmentBatches).set({ updatedAt: new Date() }).where(eq(schema.producerShipmentBatches.id, batchId));
      return n;
    });
    notifyProcessing(access.tenant.slug, tenantDb, orders.filter((o) => toNotify.includes(o.invoiceId)));
    refresh(slug, batchId);
    return { success: true, data: undefined };
  } catch (e) {
    if (isUniqueViolation(e)) return { success: false, error: "Ada pesanan yang sudah masuk batch lain." };
    if (e instanceof Error && e.message === "STATUS_BERUBAH") return { success: false, error: "Status sebagian pesanan berubah. Muat ulang halaman lalu coba lagi." };
    console.error("[producer-batch] addInvoicesToBatchAction:", e);
    return { success: false, error: "Gagal menambahkan pesanan." };
  }
}

/** Keluarkan satu invoice dari batch — hanya selama BELUM ada resi (Diproses/Dikemas); status kembali Menunggu. */
export async function removeInvoiceFromBatchAction(slug: string, batchId: string, invoiceId: string): Promise<Result> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(batchId) || !isValidUuid(invoiceId)) return { success: false, error: "Data tidak valid." };

  const tenantDb = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantDb;

  const [batch] = await db.select({ id: schema.producerShipmentBatches.id }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, access.producer.id))).limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };
  const [link] = await db.select({ id: schema.producerShipmentInvoices.id }).from(schema.producerShipmentInvoices)
    .where(and(eq(schema.producerShipmentInvoices.batchId, batchId), eq(schema.producerShipmentInvoices.invoiceId, invoiceId))).limit(1);
  if (!link) return { success: false, error: "Pesanan tidak ada di batch ini." };
  // Kepemilikan invoice itu sendiri (bukan hanya batch) — tidak boleh menyentuh invoice produsen lain
  const [order] = await getProducerOrdersByIds(tenantDb, access.producer.id, [invoiceId], { requirePaid: false });
  if (!order) return { success: false, error: "Pesanan tidak ditemukan." };

  try {
    await db.transaction(async (tx) => {
      const upd = await tx.update(schema.invoiceShippingLines)
        .set({ status: "pending", updatedAt: new Date() })
        .where(and(
          eq(schema.invoiceShippingLines.invoiceId, invoiceId),
          eq(schema.invoiceShippingLines.sellerType, "tenant"),
          inArray(schema.invoiceShippingLines.status, ["processing", "packed"]),
        ))
        .returning({ id: schema.invoiceShippingLines.id });
      if (upd.length === 0) throw new Error("SUDAH_RESI");
      await tx.delete(schema.producerShipmentInvoices).where(eq(schema.producerShipmentInvoices.id, link.id));
      await tx.update(schema.producerShipmentBatches).set({ updatedAt: new Date() }).where(eq(schema.producerShipmentBatches.id, batchId));
    });
    refresh(slug, batchId);
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "SUDAH_RESI") return { success: false, error: "Pesanan sudah dikirim (ada resi) — tidak bisa dikeluarkan dari batch." };
    console.error("[producer-batch] removeInvoiceFromBatchAction:", e);
    return { success: false, error: "Gagal mengeluarkan pesanan." };
  }
}

/** Tombol manual sementara (sampai mesin printing ada): Diproses → Dikemas, untuk satu invoice atau seluruh batch. */
export async function markPackedAction(slug: string, batchId: string, invoiceId?: string): Promise<Result<{ count: number }>> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(batchId) || (invoiceId !== undefined && !isValidUuid(invoiceId))) return { success: false, error: "Data tidak valid." };

  const { db, schema } = createTenantDb(access.tenant.slug);
  const [batch] = await db.select({ id: schema.producerShipmentBatches.id }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, access.producer.id))).limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };

  const links = await db.select({ invoiceId: schema.producerShipmentInvoices.invoiceId }).from(schema.producerShipmentInvoices)
    .where(eq(schema.producerShipmentInvoices.batchId, batchId));
  const targets = links.map((l) => l.invoiceId).filter((id) => !invoiceId || id === invoiceId);
  if (targets.length === 0) return { success: false, error: "Tidak ada pesanan di batch ini." };

  try {
    const upd = await db.update(schema.invoiceShippingLines)
      .set({ status: "packed", updatedAt: new Date() })
      .where(and(
        inArray(schema.invoiceShippingLines.invoiceId, targets),
        eq(schema.invoiceShippingLines.sellerType, "tenant"),
        eq(schema.invoiceShippingLines.status, "processing"),
      ))
      .returning({ id: schema.invoiceShippingLines.id });
    if (upd.length === 0) return { success: false, error: "Tidak ada pesanan berstatus Diproses." };
    refresh(slug, batchId);
    return { success: true, data: { count: upd.length } };
  } catch (e) {
    console.error("[producer-batch] markPackedAction:", e);
    return { success: false, error: "Gagal menandai dikemas." };
  }
}
