import { pgSchema, uuid, text, numeric, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Rekening produsen, pengajuan pencairan, dan baris rincinya (docs/arsitektur-pencairan-produsen.md § 13) ──────────
// Nomor rekening disimpan TERENKRIPSI (encryptPii) + 4 digit terakhir untuk tampilan; tidak pernah dikirim ke klien utuh kecuali
// ke pengurus keuangan yang memproses transfer.

export const PAYOUT_STATUSES = ["requested", "approved", "paid", "rejected", "cancelled"] as const;
export type PayoutStatus = typeof PAYOUT_STATUSES[number];

export function createProducerBankAccountsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_bank_accounts", {
    id:               uuid("id").primaryKey().defaultRandom(),
    producerId:       uuid("producer_id").notNull(),            // FK → producers.id RESTRICT via DDL
    bankCode:         text("bank_code").notNull(),
    bankName:         text("bank_name").notNull(),
    accountNumberEnc: text("account_number_enc").notNull(),
    accountLast4:     text("account_last4").notNull(),
    accountHolder:    text("account_holder").notNull(),
    // Aktif bila effective_at <= now() dan (replaced_at IS NULL atau > now()). Rekening BARU berlaku setelah jeda (anti-pembajakan).
    effectiveAt:      timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
    replacedAt:       timestamp("replaced_at", { withTimezone: true }),
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    producerIdx: index("producer_bank_accounts_producer_idx").on(t.producerId, t.effectiveAt),
  }));
}

export function createProducerPayoutsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_payouts", {
    id:              uuid("id").primaryKey().defaultRandom(),
    number:          text("number").notNull().unique(),          // PRC-YYYYMM-NNNN
    producerId:      uuid("producer_id").notNull(),              // FK → producers.id RESTRICT via DDL
    status:          text("status", { enum: PAYOUT_STATUSES }).notNull().default("requested"),
    creditsTotal:    numeric("credits_total", { precision: 15, scale: 2 }).notNull(),   // jumlah hak (produk + ongkir)
    debtTotal:       numeric("debt_total",    { precision: 15, scale: 2 }).notNull().default("0"),   // potongan hutang refund (positif)
    adjustmentTotal: numeric("adjustment_total", { precision: 15, scale: 2 }).notNull().default("0"), // pelunasan hutang via transfer (positif)
    subtotal:        numeric("subtotal", { precision: 15, scale: 2 }).notNull(),        // credits − debt + adjustment
    transferFee:     numeric("transfer_fee", { precision: 15, scale: 2 }).notNull().default("0"),   // ditanggung produsen (D4)
    netAmount:       numeric("net_amount", { precision: 15, scale: 2 }),                 // yang benar-benar ditransfer (diisi saat dibayar)
    // Snapshot rekening tujuan saat diajukan
    bankCode:         text("bank_code").notNull(),
    bankName:         text("bank_name").notNull(),
    accountNumberEnc: text("account_number_enc").notNull(),
    accountLast4:     text("account_last4").notNull(),
    accountHolder:    text("account_holder").notNull(),
    requestedAt:     timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    approvedBy:      uuid("approved_by"),
    approvedAt:      timestamp("approved_at", { withTimezone: true }),
    rejectedReason:  text("rejected_reason"),
    paidBy:          uuid("paid_by"),
    paidAt:          timestamp("paid_at", { withTimezone: true }),
    sourceBankLabel: text("source_bank_label"),                   // rekening tenant yang dipakai mentransfer (untuk pembukuan)
    proofMediaId:    uuid("proof_media_id"),                      // bukti transfer WAJIB (media library tenant)
    proofUrl:        text("proof_url"),
    transactionId:   uuid("transaction_id"),                      // jurnal pembukuan
    note:            text("note"),
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    producerIdx: index("producer_payouts_producer_idx").on(t.producerId, t.requestedAt),
    statusIdx:   index("producer_payouts_status_idx").on(t.status),
    // Satu pengajuan AKTIF per produsen (diajukan/disetujui)
    activeUniq:  uniqueIndex("producer_payouts_active_uniq").on(t.producerId).where(sql`status IN ('requested','approved')`),
  }));
}

export function createProducerPayoutLinesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_payout_lines", {
    id:               uuid("id").primaryKey().defaultRandom(),
    payoutId:         uuid("payout_id").notNull(),                 // FK → producer_payouts.id CASCADE via DDL
    shippingLineId:   uuid("shipping_line_id"),                    // NULL = baris penyesuaian (hutang/pelunasan)
    label:            text("label").notNull(),                     // nomor invoice atau keterangan
    productAmount:    numeric("product_amount",    { precision: 15, scale: 2 }).notNull().default("0"),
    shippingAmount:   numeric("shipping_amount",   { precision: 15, scale: 2 }).notNull().default("0"),
    adjustmentAmount: numeric("adjustment_amount", { precision: 15, scale: 2 }).notNull().default("0"),   // bertanda
    total:            numeric("total",             { precision: 15, scale: 2 }).notNull(),
    sortOrder:        integer("sort_order").notNull().default(0),
  }, (t) => ({
    payoutIdx: index("producer_payout_lines_payout_idx").on(t.payoutId),
  }));
}

export type ProducerBankAccountsTable = ReturnType<typeof createProducerBankAccountsTable>;
export type ProducerPayoutsTable      = ReturnType<typeof createProducerPayoutsTable>;
export type ProducerPayoutLinesTable  = ReturnType<typeof createProducerPayoutLinesTable>;
