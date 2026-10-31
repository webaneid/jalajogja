// Inti pembuatan batch pengiriman produsen — dipakai DUA pintu akses yang masing-masing mengotorisasi sendiri:
//   - produsen: createBatchAction (portal-produsen/pengiriman/actions.ts) — producerId dari sesi (getProducerAccess)
//   - admin:    createBatchAsAdminAction (toko/produk/[id]/batch-actions.ts) — producerId diverifikasi ke tabel produsen tenant
// Fungsi di sini TIDAK memeriksa siapa pemanggilnya — pemanggil WAJIB sudah mengotorisasi dan menyerahkan producerId yang tepercaya.
// Jaminan: kepemilikan tiap invoice dibuktikan lagi terhadap producerId itu (getProducerOrdersByIds), semua-atau-tidak-sama-sekali,
// transaksi + compare-and-set pending→processing (cek lunas di UPDATE), notifikasi "Diproses" sekali per invoice.
// Doc: docs/arsitektur-portal-produsen.md § 19.8 & 22.
import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { getProducerOrdersByIds, isBatchable } from "@/lib/producer-orders.server";
import { isValidUuid } from "@/lib/is-uuid";
import { notifyWa, waAppUrl } from "@/lib/wa-notify";

export type Result<T = void> = { success: true; data: T } | { success: false; error: string };

export const MAX_INVOICES = 100;
export const NAME_RE = /^[A-Za-z0-9._-]{1,40}$/;

export function cleanIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;
  const out = [...new Set(ids.map((x) => String(x)))];
  if (out.length === 0 || out.length > MAX_INVOICES || !out.every(isValidUuid)) return null;
  return out;
}

export function isUniqueViolation(e: unknown): boolean {
  const any = e as { code?: string; cause?: { code?: string } };
  return any?.code === "23505" || any?.cause?.code === "23505";
}


/** Notifikasi "Diproses" ke pelanggan — sama dengan jalur admin (order_processing; mengikuti pengaturan notifikasi tenant). */
export function notifyProcessing(slug: string, tenantDb: TenantDb, rows: { invoiceId: string; invoiceNumber: string; customerName: string; customerPhone: string | null }[]) {
  void (async () => {
    try {
      // Email pelanggan hanya dibaca di server untuk notifikasi (tidak masuk ProducerOrderRow / tidak ke klien)
      const { db, schema } = tenantDb;
      const emails = await db.select({ id: schema.invoices.id, email: schema.invoices.customerEmail }).from(schema.invoices)
        .where(inArray(schema.invoices.id, rows.map((r) => r.invoiceId)));
      const emailOf = new Map(emails.map((e) => [e.id, e.email]));
      for (const r of rows) {
        try {
          const trackingUrl = await waAppUrl(slug, `/invoice/${r.invoiceId}`);
          void notifyWa({
            slug, tenantDb, event: "order_processing", phone: r.customerPhone, email: emailOf.get(r.invoiceId) ?? null,
            vars: { name: r.customerName, orderNumber: r.invoiceNumber, courier: "", trackingNumber: "", trackingUrl },
          });
        } catch { /* notifikasi tak boleh menggagalkan aksi */ }
      }
    } catch { /* idem */ }
  })();
}

type Tdb = TenantDb;

/**
 * Maju pending → processing untuk PENGIRIMAN-pengiriman ini (id = invoice_shipping_lines.id) DI DALAM transaksi; batalkan semuanya bila ada yang gagal.
 * Syarat invoice LUNAS ikut dicek di dalam UPDATE yang sama (bukan hanya snapshot sebelum transaksi — cegah TOCTOU).
 * Mengembalikan id pengiriman yang BELUM pernah diberi notifikasi "Diproses" (penanda processing_notified_at per baris) —
 * supaya siklus Keluarkan → Masukkan lagi tidak mengirim pesan berulang ke pelanggan.
 */
export async function toProcessing(tx: Parameters<Parameters<Tdb["db"]["transaction"]>[0]>[0], schema: Tdb["schema"], lineIds: string[]): Promise<string[]> {
  const L = schema.invoiceShippingLines;
  const toNotify: string[] = [];
  for (const lineId of lineIds) {
    const upd = await tx.update(L)
      .set({ status: "processing", updatedAt: new Date() })
      .where(and(
        eq(L.id, lineId),
        eq(L.sellerType, "tenant"),
        eq(L.status, "pending"),
        inArray(L.invoiceId, tx.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.status, "paid"))),
      ))
      .returning({ id: L.id });
    if (upd.length === 0) throw new Error("STATUS_BERUBAH");
    const first = await tx.update(L)
      .set({ processingNotifiedAt: new Date() })
      .where(and(eq(L.id, lineId), isNull(L.processingNotifiedAt)))
      .returning({ id: L.id });
    if (first.length > 0) toNotify.push(lineId);
  }
  return toNotify;
}


/** shipmentIds = id PENGIRIMAN (invoice_shipping_lines.id), bukan id invoice (ADR-0005). */
export type BatchInput = { name: string; shippingDate: string; shipmentIds: string[] };

/** Validasi input batch (nama, tanggal pengiriman, daftar pengiriman) → nilai bersih atau pesan error. */
export function validateBatchInput(input: BatchInput): { ok: true; name: string; date: string; ids: string[] } | { ok: false; error: string } {
  const name = String(input?.name ?? "").trim();
  if (!NAME_RE.test(name)) return { ok: false, error: "Nama batch 1–40 karakter (huruf, angka, titik, strip, garis bawah)." };
  const date = String(input?.shippingDate ?? "");
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return { ok: false, error: "Tanggal pengiriman tidak valid." };
  const dayMs = 86_400_000;
  if (parsed.getTime() < Date.now() - 31 * dayMs || parsed.getTime() > Date.now() + 366 * dayMs) return { ok: false, error: "Tanggal pengiriman di luar rentang (30 hari lalu s/d 1 tahun ke depan)." };
  const ids = cleanIds(input?.shipmentIds);
  if (!ids) return { ok: false, error: `Pilih 1–${MAX_INVOICES} pesanan.` };
  return { ok: true, name, date, ids };
}

/** Buat batch untuk `producerId` (TERPERCAYA — pemanggil yang mengotorisasi). */
export async function createBatchCore(
  tenantDb: TenantDb,
  tenantSlug: string,
  producerId: string,
  input: BatchInput,
): Promise<Result<{ batchId: string; name: string; count: number }>> {
  const v = validateBatchInput(input);
  if (!v.ok) return { success: false, error: v.error };
  const { db, schema } = tenantDb;

  const orders = await getProducerOrdersByIds(tenantDb, producerId, v.ids);
  if (orders.length !== v.ids.length) return { success: false, error: "Sebagian pesanan tidak ditemukan atau belum lunas." };
  if (!orders.every(isBatchable)) return { success: false, error: "Sebagian pesanan tidak bisa dimasukkan ke batch (ambil sendiri atau sudah diproses)." };
  const invoiceOf = new Map(orders.map((o) => [o.lineId, o.invoiceId]));

  try {
    const { batchId, toNotify } = await db.transaction(async (tx) => {
      const [b] = await tx.insert(schema.producerShipmentBatches)
        .values({ producerId, name: v.name, shippingDate: v.date })
        .returning({ id: schema.producerShipmentBatches.id });
      await tx.insert(schema.producerShipmentInvoices).values(v.ids.map((lineId) => ({ batchId: b.id, invoiceId: invoiceOf.get(lineId)!, shippingLineId: lineId })));
      return { batchId: b.id, toNotify: await toProcessing(tx, schema, v.ids) };
    });
    notifyProcessing(tenantSlug, tenantDb, orders.filter((o) => toNotify.includes(o.lineId)));
    return { success: true, data: { batchId, name: v.name, count: v.ids.length } };
  } catch (e) {
    if (isUniqueViolation(e)) return { success: false, error: "Nama batch sudah dipakai, atau ada pesanan yang sudah masuk batch lain." };
    if (e instanceof Error && e.message === "STATUS_BERUBAH") return { success: false, error: "Status sebagian pesanan berubah. Muat ulang halaman lalu coba lagi." };
    console.error("[producer-batch] createBatchCore:", e);
    return { success: false, error: "Gagal membuat batch." };
  }
}

/** Tanggal hari ini (WIB) sebagai YYYY-MM-DD — nilai awal tanggal pengiriman di popup Buat Batch. */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}
