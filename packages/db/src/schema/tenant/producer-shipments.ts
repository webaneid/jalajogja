import { pgSchema, uuid, text, date, timestamp, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Batch pengiriman produsen (Portal Produsen) ──────────────────────────────────────────────
// Mengelompokkan invoice lunas milik produsen yang akan dikirim pada satu waktu. Status pengiriman TIDAK
// disimpan di sini — tetap di invoice_shipping_lines.status (satu sumber). Batch tidak pernah dihapus (FK RESTRICT).
// Doc: docs/arsitektur-portal-produsen.md § 19.

export function createProducerShipmentBatchesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_shipment_batches", {
    id:           uuid("id").primaryKey().defaultRandom(),
    producerId:   uuid("producer_id").notNull(),   // FK → producers.id RESTRICT via DDL
    name:         text("name").notNull(),          // mis. 011120260001 (DDMMYYYY + urutan 4 digit)
    shippingDate: date("shipping_date").notNull(),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    producerIdx: index("producer_shipment_batches_producer_idx").on(t.producerId),
    nameUniq:    unique("producer_shipment_batches_name_uniq").on(t.producerId, t.name),
  }));
}

export function createProducerShipmentInvoicesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_shipment_invoices", {
    id:        uuid("id").primaryKey().defaultRandom(),
    batchId:   uuid("batch_id").notNull(),     // FK → producer_shipment_batches.id RESTRICT via DDL
    invoiceId: uuid("invoice_id").notNull(),   // FK → invoices.id via DDL; UNIQUE = satu invoice paling banyak satu batch (dilepas di F3)
    // Pengiriman yang masuk batch (ADR-0005); UNIQUE parsial. Nullable selama transisi — kode lama belum mengisinya (F3).
    shippingLineId: uuid("shipping_line_id"),  // FK → invoice_shipping_lines.id RESTRICT via DDL
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    batchIdx:    index("producer_shipment_invoices_batch_idx").on(t.batchId),
    invoiceUniq: unique("producer_shipment_invoices_invoice_uniq").on(t.invoiceId),
    lineUniq:    uniqueIndex("producer_shipment_invoices_line_uniq").on(t.shippingLineId).where(sql`${t.shippingLineId} IS NOT NULL`),
  }));
}

export type ProducerShipmentBatchesTable  = ReturnType<typeof createProducerShipmentBatchesTable>;
export type ProducerShipmentInvoicesTable = ReturnType<typeof createProducerShipmentInvoicesTable>;
