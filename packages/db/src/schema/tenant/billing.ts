import {
  pgSchema,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const CART_ITEM_TYPES = ["product", "ticket", "donation", "custom"] as const;
export type CartItemType = typeof CART_ITEM_TYPES[number];

export const INVOICE_SOURCE_TYPES = ["cart", "order", "donation", "event_registration", "manual"] as const;
export type InvoiceSourceType = typeof INVOICE_SOURCE_TYPES[number];

export const INVOICE_STATUSES = [
  "draft",
  "pending",
  "waiting_verification",
  "partial",
  "paid",
  "cancelled",
  "overdue",
] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];

export const INSTALLMENT_SCHEDULE_STATUSES = ["pending", "paid", "overdue"] as const;
export type InstallmentScheduleStatus = typeof INSTALLMENT_SCHEDULE_STATUSES[number];

// ─── carts ────────────────────────────────────────────────────────────────────
// Keranjang belanja sementara (TTL 24 jam). Guest via session_token cookie httpOnly.

export function createCartsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("carts", {
    id:           uuid("id").primaryKey().defaultRandom(),
    sessionToken: text("session_token").notNull().unique(), // httpOnly cookie
    memberId:     uuid("member_id"),                        // FK → public.members.id via SQL
    expiresAt:    timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    sessionIdx: index("carts_session_token_idx").on(t.sessionToken),
    memberIdx:  index("carts_member_id_idx").on(t.memberId),
  }));
}

// ─── cart_items ───────────────────────────────────────────────────────────────
// Item dalam keranjang. Harga adalah snapshot — tidak berubah meski admin edit produk.

export function createCartItemsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("cart_items", {
    id:        uuid("id").primaryKey().defaultRandom(),
    cartId:    uuid("cart_id").notNull(),               // FK → carts.id CASCADE via SQL
    itemType:  text("item_type", { enum: CART_ITEM_TYPES }).notNull(),
    itemId:    uuid("item_id"),                         // FK polymorphic ke product/ticket/campaign
    name:      text("name").notNull(),                  // snapshot nama saat ditambah
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    quantity:  integer("quantity").notNull().default(1),
    notes:     text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    cartIdx: index("cart_items_cart_id_idx").on(t.cartId),
  }));
}

// ─── invoices ─────────────────────────────────────────────────────────────────
// Header universal tagihan. Bisa dari cart checkout, admin manual, atau modul lain.

export function createInvoicesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("invoices", {
    id:            uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: text("invoice_number").notNull().unique(), // INV-YYYYMM-NNNNN
    sourceType:    text("source_type", { enum: INVOICE_SOURCE_TYPES }).notNull(),
    sourceId:      uuid("source_id"),

    // Customer info (snapshot — tidak berubah meski data member diupdate)
    customerName:  text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    customerEmail: text("customer_email"),
    memberId:      uuid("member_id"),   // FK → public.members.id via SQL (hasil lookup HP/email)
    profileId:     uuid("profile_id"), // FK → public.profiles.id via SQL (nullable)

    // Nilai
    subtotal:   numeric("subtotal",    { precision: 15, scale: 2 }).notNull(),
    discount:   numeric("discount",    { precision: 15, scale: 2 }).notNull().default("0"),
    total:      numeric("total",       { precision: 15, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull().default("0"),

    // Status & tanggal
    status:  text("status", { enum: INVOICE_STATUSES }).notNull().default("pending"),
    dueDate: date("due_date"),          // batas bayar (default +3 hari dari created_at)

    notes:  text("notes"),
    pdfUrl: text("pdf_url"),

    // Program cicilan (optional)
    installmentPlanId: uuid("installment_plan_id"), // FK → installment_plans.id via SQL

    createdBy: uuid("created_by"),  // FK → users.id via SQL (null = dari front-end/guest)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    statusIdx: index("invoices_status_idx").on(t.status),
    memberIdx: index("invoices_member_id_idx").on(t.memberId),
    sourceIdx: index("invoices_source_idx").on(t.sourceType, t.sourceId),
  }));
}

// ─── invoice_items ────────────────────────────────────────────────────────────
// Line items tagihan. Snapshot nama & harga saat invoice dibuat.

export function createInvoiceItemsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("invoice_items", {
    id:          uuid("id").primaryKey().defaultRandom(),
    invoiceId:   uuid("invoice_id").notNull(), // FK → invoices.id CASCADE via SQL
    itemType:    text("item_type", { enum: CART_ITEM_TYPES }).notNull(),
    itemId:      uuid("item_id"),
    name:        text("name").notNull(),
    description: text("description"),
    unitPrice:   numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    quantity:    integer("quantity").notNull().default(1),
    total:       numeric("total",      { precision: 15, scale: 2 }).notNull(),
    sortOrder:   integer("sort_order").notNull().default(0),
  }, (t) => ({
    invoiceIdx: index("invoice_items_invoice_id_idx").on(t.invoiceId),
  }));
}

// ─── invoice_payments ─────────────────────────────────────────────────────────
// Junction: satu invoice bisa dilunasi dengan banyak payment (cicilan / partial).

export function createInvoicePaymentsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("invoice_payments", {
    id:        uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull(), // FK → invoices.id via SQL
    paymentId: uuid("payment_id").notNull(), // FK → payments.id via SQL
    amount:    numeric("amount", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    invoiceIdx: index("invoice_payments_invoice_id_idx").on(t.invoiceId),
    paymentIdx: index("invoice_payments_payment_id_idx").on(t.paymentId),
    uniq:       unique().on(t.invoiceId, t.paymentId),
  }));
}

// ─── installment_plans ────────────────────────────────────────────────────────
// Program cicilan khusus (mis. Nabung Qurban). Default hidden — admin aktifkan manual.

export function createInstallmentPlansTable(s: ReturnType<typeof pgSchema>) {
  return s.table("installment_plans", {
    id:               uuid("id").primaryKey().defaultRandom(),
    name:             text("name").notNull(),
    description:      text("description"),
    sourceType:       text("source_type"), // 'campaign' | 'event' | null (umum)
    sourceId:         uuid("source_id"),   // FK polymorphic
    totalAmount:      numeric("total_amount", { precision: 15, scale: 2 }),
    installmentCount: integer("installment_count").notNull(),
    intervalDays:     integer("interval_days").notNull(),
    isActive:         boolean("is_active").notNull().default(false),
    isPublished:      boolean("is_published").notNull().default(false),
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── installment_schedules ────────────────────────────────────────────────────
// Jadwal cicilan per invoice. Dibuat otomatis saat invoice ikut program cicilan.

export function createInstallmentSchedulesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("installment_schedules", {
    id:                 uuid("id").primaryKey().defaultRandom(),
    invoiceId:          uuid("invoice_id").notNull(),           // FK → invoices.id via SQL
    installmentPlanId:  uuid("installment_plan_id").notNull(),  // FK → installment_plans.id via SQL
    termNumber:         integer("term_number").notNull(),
    dueDate:            date("due_date").notNull(),
    amount:             numeric("amount", { precision: 15, scale: 2 }).notNull(),
    paymentId:          uuid("payment_id"),  // diisi saat termin ini dibayar
    paidAt:             timestamp("paid_at", { withTimezone: true }),
    status:             text("status", { enum: INSTALLMENT_SCHEDULE_STATUSES }).notNull().default("pending"),
  }, (t) => ({
    invoiceIdx: index("installment_schedules_invoice_id_idx").on(t.invoiceId),
    dueDateIdx: index("installment_schedules_due_date_idx").on(t.dueDate, t.status),
  }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CartsTable               = ReturnType<typeof createCartsTable>;
export type CartItemsTable           = ReturnType<typeof createCartItemsTable>;
export type InvoicesTable            = ReturnType<typeof createInvoicesTable>;
export type InvoiceItemsTable        = ReturnType<typeof createInvoiceItemsTable>;
export type InvoicePaymentsTable     = ReturnType<typeof createInvoicePaymentsTable>;
export type InstallmentPlansTable    = ReturnType<typeof createInstallmentPlansTable>;
export type InstallmentSchedulesTable = ReturnType<typeof createInstallmentSchedulesTable>;
