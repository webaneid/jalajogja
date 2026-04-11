import {
  pgSchema,
  text,
  uuid,
  timestamp,
  date,
  numeric,
  boolean,
  unique,
} from "drizzle-orm/pg-core";

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const ENTRY_TYPES = ["debit", "credit"] as const;
export type EntryType = typeof ENTRY_TYPES[number];

export const PAYMENT_METHODS = ["cash", "transfer", "qris", "midtrans", "xendit", "ipaymu"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const CONFIRMATION_STATUSES = ["pending", "confirmed", "rejected"] as const;
export type ConfirmationStatus = typeof CONFIRMATION_STATUSES[number];

// Chart of Accounts — hierarkis, ikuti standar akuntansi
// Kode: 1xxx=Aset, 2xxx=Kewajiban, 3xxx=Ekuitas, 4xxx=Pendapatan, 5xxx=Beban
export function createAccountsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(), // misal: 1101, 4001
    name: text("name").notNull(),
    type: text("type", { enum: ACCOUNT_TYPES }).notNull(),
    parentId: uuid("parent_id"), // self-referential, FK via SQL migration
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Header transaksi — satu transaksi punya banyak entries (double-entry)
export function createTransactionsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    description: text("description").notNull(),
    referenceNumber: text("reference_number").unique(), // nomor bukti transaksi
    // FK → users.id via SQL migration
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Baris jurnal — total debit HARUS = total kredit per transaction_id
// Validasi dilakukan di helper function recordExpense/recordIncome/recordTransfer
export function createTransactionEntriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("transaction_entries", {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").notNull(), // FK → transactions.id via SQL migration
    accountId: uuid("account_id").notNull(),          // FK → accounts.id via SQL migration
    type: text("type", { enum: ENTRY_TYPES }).notNull(),
    // numeric(15,2) — JANGAN pakai float untuk uang, ada floating point error
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    note: text("note"), // catatan opsional per baris
  });
}

// Anggaran per periode
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

// Item anggaran — mapping akun ke nominal yang dianggarkan
// Unique per budget+account — satu akun hanya boleh satu baris per anggaran
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

// Bukti pembayaran fisik yang perlu konfirmasi manual sebelum dicatat di jurnal
// Berlaku untuk semua metode: cash, transfer, QRIS, maupun payment gateway
export function createPaymentConfirmationsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("payment_confirmations", {
    id: uuid("id").primaryKey().defaultRandom(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    proofUrl: text("proof_url"), // path MinIO — foto bukti transfer/QRIS
    senderName: text("sender_name"),
    senderBank: text("sender_bank"),
    note: text("note"),
    status: text("status", { enum: CONFIRMATION_STATUSES }).notNull().default("pending"),
    // FK → users.id via SQL migration
    submittedBy: uuid("submitted_by").notNull(),
    confirmedBy: uuid("confirmed_by"), // nullable — diisi saat dikonfirmasi
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    // Setelah dikonfirmasi, journal entry dibuat dan di-link ke sini
    transactionId: uuid("transaction_id"), // FK → transactions.id via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type AccountsTable = ReturnType<typeof createAccountsTable>;
export type TransactionsTable = ReturnType<typeof createTransactionsTable>;
export type TransactionEntriesTable = ReturnType<typeof createTransactionEntriesTable>;
export type PaymentConfirmationsTable = ReturnType<typeof createPaymentConfirmationsTable>;
