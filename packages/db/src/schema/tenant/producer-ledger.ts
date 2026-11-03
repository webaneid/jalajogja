import { pgSchema, uuid, text, numeric, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Buku besar saldo produsen (docs/arsitektur-pencairan-produsen.md § 5, § 12) ─────────────────────────────
// Append-only. Satu baris per HAK produsen: `sale` (bagian produk per baris invoice_items) dan `shipping`
// (ongkir yang dibayar pembeli, diteruskan penuh — D13). Dibuat HANYA saat pengiriman SELESAI (completeProducerShipment),
// tidak pernah dari input klien. Unik per (kind, invoice_item_id) / (kind, shipping_line_id) → tak mungkin ganda.
// Fase berikut menambah kind: refund_debt | transfer_fee | payout | adjustment (amount bertanda negatif).

export const PRODUCER_LEDGER_KINDS    = ["sale", "shipping", "refund_debt", "transfer_fee", "payout", "adjustment"] as const;
export const PRODUCER_LEDGER_STATUSES = ["available", "reserved", "paid", "void"] as const;
export type ProducerLedgerKind   = typeof PRODUCER_LEDGER_KINDS[number];
export type ProducerLedgerStatus = typeof PRODUCER_LEDGER_STATUSES[number];

export function createProducerLedgerEntriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_ledger_entries", {
    id:             uuid("id").primaryKey().defaultRandom(),
    producerId:     uuid("producer_id").notNull(),          // FK → producers.id RESTRICT via DDL
    kind:           text("kind", { enum: PRODUCER_LEDGER_KINDS }).notNull(),
    amount:         numeric("amount", { precision: 15, scale: 2 }).notNull(),   // bertanda: kredit +, potongan −
    invoiceId:      uuid("invoice_id"),                     // FK → invoices.id RESTRICT via DDL
    invoiceItemId:  uuid("invoice_item_id"),                // FK → invoice_items.id RESTRICT via DDL (kind=sale)
    shippingLineId: uuid("shipping_line_id"),               // FK → invoice_shipping_lines.id RESTRICT via DDL
    status:         text("status", { enum: PRODUCER_LEDGER_STATUSES }).notNull().default("available"),
    payoutId:       uuid("payout_id"),                      // diisi fase pencairan (C3); belum ada FK
    // Bahan audit: dasar harga, persen tenant, penanggung voucher, diskon — supaya angka bisa diperiksa ulang tanpa menebak.
    meta:           jsonb("meta").$type<Record<string, unknown>>(),
    note:           text("note"),
    availableAt:    timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    producerIdx: index("producer_ledger_producer_idx").on(t.producerId, t.status),
    saleUniq:    uniqueIndex("producer_ledger_sale_uniq").on(t.kind, t.invoiceItemId).where(sql`${t.invoiceItemId} IS NOT NULL`),
    shipUniq:    uniqueIndex("producer_ledger_ship_uniq").on(t.kind, t.shippingLineId).where(sql`${t.shippingLineId} IS NOT NULL AND ${t.invoiceItemId} IS NULL`),
  }));
}

// ─── Riwayat perubahan persentase bagi hasil (K20) ──────────────────────────────────────────────────────────────
export function createProducerPercentHistoryTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_percent_history", {
    id:          uuid("id").primaryKey().defaultRandom(),
    producerId:  uuid("producer_id").notNull(),             // FK → producers.id CASCADE via DDL
    oldPercent:  numeric("old_percent", { precision: 5, scale: 2 }),   // NULL = belum pernah ditetapkan
    newPercent:  numeric("new_percent", { precision: 5, scale: 2 }).notNull(),
    changedBy:   uuid("changed_by"),                        // tenant.users.id (audit ringan, tanpa FK)
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    producerIdx: index("producer_percent_history_producer_idx").on(t.producerId, t.createdAt),
  }));
}

export type ProducerLedgerEntriesTable   = ReturnType<typeof createProducerLedgerEntriesTable>;
export type ProducerPercentHistoryTable  = ReturnType<typeof createProducerPercentHistoryTable>;
