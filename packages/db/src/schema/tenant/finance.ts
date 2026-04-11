import {
  pgSchema,
  text,
  uuid,
  timestamp,
  date,
  numeric,
  smallint,
  integer,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const ENTRY_TYPES = ["debit", "credit"] as const;
export type EntryType = typeof ENTRY_TYPES[number];

export const PAYMENT_METHODS = ["cash", "transfer", "qris", "midtrans", "xendit", "ipaymu"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

// Sumber uang masuk — semua melalui tabel payments yang sama
export const PAYMENT_SOURCE_TYPES = ["order", "donation", "invoice", "manual"] as const;
export type PaymentSourceType = typeof PAYMENT_SOURCE_TYPES[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

// Tujuan uang keluar — semua melalui tabel disbursements yang sama
export const DISBURSEMENT_PURPOSE_TYPES = ["refund", "expense", "grant", "transfer", "manual"] as const;
export type DisbursementPurposeType = typeof DISBURSEMENT_PURPOSE_TYPES[number];

// 2-level approval: draft → approved (bendahara) → paid
export const DISBURSEMENT_STATUSES = ["draft", "approved", "paid", "cancelled"] as const;
export type DisbursementStatus = typeof DISBURSEMENT_STATUSES[number];

// Tipe dokumen keuangan — untuk generate nomor 620-* per bulan
export const FINANCIAL_DOC_TYPES = ["payment", "disbursement", "journal"] as const;
export type FinancialDocType = typeof FINANCIAL_DOC_TYPES[number];

// ─── Chart of Accounts ────────────────────────────────────────────────────────

export function createAccountsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(), // 1xxx=Aset, 2xxx=Kewajiban, 3xxx=Ekuitas, 4xxx=Pendapatan, 5xxx=Beban
    name: text("name").notNull(),
    type: text("type", { enum: ACCOUNT_TYPES }).notNull(),
    parentId: uuid("parent_id"), // self-referential, FK via SQL migration
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── Jurnal Akuntansi (Double-Entry) ─────────────────────────────────────────

// Header transaksi — nomor referensi format: 620-JNL-YYYYMM-NNNNN
export function createTransactionsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    description: text("description").notNull(),
    referenceNumber: text("reference_number").unique(), // 620-JNL-YYYYMM-NNNNN
    createdBy: uuid("created_by").notNull(), // FK → users.id via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Baris jurnal — total debit HARUS = total kredit per transaction_id
export function createTransactionEntriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("transaction_entries", {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").notNull(), // FK → transactions.id via SQL migration
    accountId: uuid("account_id").notNull(),          // FK → accounts.id via SQL migration
    type: text("type", { enum: ENTRY_TYPES }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    note: text("note"),
  });
}

// ─── Universal Payments (Uang Masuk) ─────────────────────────────────────────
// Menggantikan: shop.order_payments + finance.payment_confirmations
// Semua sumber pembayaran melalui satu tabel ini.
// Nomor format: 620-PAY-YYYYMM-NNNNN

export function createPaymentsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("payments", {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(), // 620-PAY-202504-00001

    // Polymorphic source — dari modul mana uang ini berasal
    sourceType: text("source_type", { enum: PAYMENT_SOURCE_TYPES }).notNull(),
    sourceId: uuid("source_id").notNull(), // FK ke orders.id / donations.id / dll.

    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    // Kode unik 3 digit — ditambahkan ke nominal transfer agar bisa diidentifikasi
    // Contoh: total Rp 150.000 + kode 234 → customer transfer Rp 150.234
    uniqueCode: smallint("unique_code").notNull().default(0),

    method: text("method", { enum: PAYMENT_METHODS }).notNull(),
    // Referensi ID rekening/QRIS dari settings JSONB (bukan FK ke DB)
    bankAccountRef: text("bank_account_ref"), // ID dari settings.bank_accounts[].id
    qrisAccountRef: text("qris_account_ref"), // ID dari settings.qris_accounts[].id

    status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
    gatewayRef: text("gateway_ref"), // ID transaksi dari Midtrans/Xendit/iPaymu

    // Bukti pembayaran (upload manual)
    proofUrl: text("proof_url"), // MinIO path

    // Info pengirim — bisa member (login) atau anonim
    memberId: uuid("member_id"),       // FK → public.members.id via SQL (nullable)
    payerName: text("payer_name"),
    payerBank: text("payer_bank"),
    payerNote: text("payer_note"),

    // Konfirmasi oleh admin (bendahara/admin)
    confirmedBy: uuid("confirmed_by"), // FK → users.id via SQL (nullable)
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    // Diisi setelah dikonfirmasi — jurnal otomatis dibuat
    transactionId: uuid("transaction_id"), // FK → transactions.id via SQL (nullable)

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    sourceIdx:    index("payments_source_idx").on(t.sourceType, t.sourceId),
    statusIdx:    index("payments_status_idx").on(t.status),
    memberIdx:    index("payments_member_id_idx").on(t.memberId),
  }));
}

// ─── Universal Disbursements (Uang Keluar) ────────────────────────────────────
// Semua pengeluaran melalui satu tabel ini.
// 2-level approval: pengaju (requester) → bendahara (approver) → eksekusi (paid)
// Nomor format: 620-DIS-YYYYMM-NNNNN

export function createDisbursementsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("disbursements", {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(), // 620-DIS-202504-00001

    // Polymorphic purpose — tujuan pengeluaran
    purposeType: text("purpose_type", { enum: DISBURSEMENT_PURPOSE_TYPES }).notNull(),
    purposeId: uuid("purpose_id"), // nullable — misal: payments.id untuk refund

    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    method: text("method", { enum: ["cash", "transfer"] }).notNull().default("transfer"),

    // Info penerima
    recipientName: text("recipient_name").notNull(),
    recipientBank: text("recipient_bank"),
    recipientAccount: text("recipient_account"),

    note: text("note"),
    proofUrl: text("proof_url"), // bukti transfer keluar (MinIO path)

    // 2-level approval flow
    status: text("status", { enum: DISBURSEMENT_STATUSES }).notNull().default("draft"),
    requestedBy: uuid("requested_by").notNull(), // FK → users.id via SQL
    approvedBy: uuid("approved_by"),             // FK → users.id via SQL (nullable)
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    // Diisi setelah status paid — jurnal otomatis dibuat
    transactionId: uuid("transaction_id"), // FK → transactions.id via SQL (nullable)

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    statusIdx:      index("disbursements_status_idx").on(t.status),
    purposeIdx:     index("disbursements_purpose_idx").on(t.purposeType, t.purposeId),
    requestedByIdx: index("disbursements_requested_by_idx").on(t.requestedBy),
  }));
}

// ─── Financial Sequences ──────────────────────────────────────────────────────
// Untuk generate nomor 620-PAY/DIS/JNL-YYYYMM-NNNNN secara atomic
// Sama persis dengan pola letter_number_sequences

export function createFinancialSequencesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("financial_sequences", {
    id: uuid("id").primaryKey().defaultRandom(),
    year: smallint("year").notNull(),
    month: smallint("month").notNull(), // 1-12
    type: text("type", { enum: FINANCIAL_DOC_TYPES }).notNull(),
    lastNumber: integer("last_number").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    uniq: unique().on(t.year, t.month, t.type),
  }));
}

// ─── Anggaran ─────────────────────────────────────────────────────────────────

export function createBudgetsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("budgets", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // misal: "RAPB 2025"
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdBy: uuid("created_by").notNull(), // FK → users.id via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export function createBudgetItemsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("budget_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id").notNull(),   // FK → budgets.id via SQL migration
    accountId: uuid("account_id").notNull(), // FK → accounts.id via SQL migration
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    note: text("note"),
  }, (t) => ({
    uniq: unique().on(t.budgetId, t.accountId),
  }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountsTable          = ReturnType<typeof createAccountsTable>;
export type TransactionsTable      = ReturnType<typeof createTransactionsTable>;
export type TransactionEntriesTable = ReturnType<typeof createTransactionEntriesTable>;
export type PaymentsTable          = ReturnType<typeof createPaymentsTable>;
export type DisbursementsTable     = ReturnType<typeof createDisbursementsTable>;
export type FinancialSequencesTable = ReturnType<typeof createFinancialSequencesTable>;
export type BudgetsTable           = ReturnType<typeof createBudgetsTable>;
export type BudgetItemsTable       = ReturnType<typeof createBudgetItemsTable>;
