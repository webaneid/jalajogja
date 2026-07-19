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
  jsonb,
} from "drizzle-orm/pg-core";

export const SHIPPING_STATUSES = ["pending", "processing", "packed", "shipped", "delivered"] as const;
export type ShippingStatus = typeof SHIPPING_STATUSES[number];

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

// Diskon & Voucher — Fase 1 (berkode, target tenant-only). Lihat docs/arsitektur-voucher.md.
export const VOUCHER_DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type VoucherDiscountType = typeof VOUCHER_DISCOUNT_TYPES[number];

export const VOUCHER_TARGET_TYPES = ["product", "ticket", "donation"] as const;
export type VoucherTargetType = typeof VOUCHER_TARGET_TYPES[number];

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
    subtotal:      numeric("subtotal",       { precision: 15, scale: 2 }).notNull(),
    shippingTotal: numeric("shipping_total", { precision: 15, scale: 2 }).notNull().default("0"),
    discount:      numeric("discount",       { precision: 15, scale: 2 }).notNull().default("0"),
    total:         numeric("total",          { precision: 15, scale: 2 }).notNull(),
    paidAmount:    numeric("paid_amount",    { precision: 15, scale: 2 }).notNull().default("0"),
    uniqueCode:    integer("unique_code").notNull().default(0),

    // Alamat pengiriman (snapshot saat checkout)
    shippingAddress:    text("shipping_address"),
    shippingCityId:     integer("shipping_city_id"),
    shippingCityName:   text("shipping_city_name"),

    // Status & tanggal
    status:  text("status", { enum: INVOICE_STATUSES }).notNull().default("pending"),
    dueDate: date("due_date"),          // batas bayar (default +3 hari dari created_at)

    notes:  text("notes"),
    pdfUrl: text("pdf_url"),

    // Program cicilan (optional)
    installmentPlanId: uuid("installment_plan_id"), // FK → installment_plans.id via SQL

    // Voucher (optional) — lihat docs/arsitektur-voucher.md. Snapshot code dipertahankan
    // meski voucher dihapus nanti (voucherId null tapi voucherCode tetap kebaca di invoice lama).
    voucherId:            uuid("voucher_id"), // FK → vouchers.id via SQL
    voucherCode:           text("voucher_code"),
    voucherDiscountTotal:  numeric("voucher_discount_total", { precision: 15, scale: 2 }).notNull().default("0"),

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
    // Seller info (untuk grouping per penjual di ongkir)
    sellerType: text("seller_type", { enum: ["tenant", "mitra"] as const }).notNull().default("tenant"),
    sellerId:   uuid("seller_id"),          // null jika tenant, mitra.id jika mitra
    // Diskon/voucher per baris — TIDAK PERNAH memotong invoice secara keseluruhan, lihat
    // docs/arsitektur-voucher.md. total = (unitPrice*quantity) - discountAmount, di-clamp >= 0.
    discountAmount: numeric("discount_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    voucherId:      uuid("voucher_id"), // FK → vouchers.id via SQL
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

// ─── vouchers ─────────────────────────────────────────────────────────────────
// Diskon & Voucher Fase 1 — berkode, target tenant-only. Memotong harga PER ITEM
// (invoice_items.total), TIDAK PERNAH invoice secara keseluruhan. targetItemIds kosong =
// berlaku untuk semua item bertipe targetType (difilter tenant-only di resolver, lihat
// packages/db/src/helpers/voucher.ts). Lihat docs/arsitektur-voucher.md.

export function createVouchersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("vouchers", {
    id:          uuid("id").primaryKey().defaultRandom(),
    code:        text("code").notNull().unique(),   // disimpan UPPERCASE, dibandingkan case-insensitive
    name:        text("name").notNull(),            // label internal admin, bukan ditampilkan ke customer
    description: text("description"),

    discountType:  text("discount_type", { enum: VOUCHER_DISCOUNT_TYPES }).notNull(),
    discountValue: numeric("discount_value", { precision: 15, scale: 2 }).notNull(),

    targetType:    text("target_type", { enum: VOUCHER_TARGET_TYPES }).notNull(),
    targetItemIds: jsonb("target_item_ids").$type<string[]>().notNull().default([]),

    usageLimit:             integer("usage_limit"),
    usageLimitPerCustomer:  integer("usage_limit_per_customer"),
    usedCount:              integer("used_count").notNull().default(0),

    restrictPhone: text("restrict_phone"), // E.164, voucher personal (mis. hadiah lomba)
    restrictEmail: text("restrict_email"),

    validFrom:  timestamp("valid_from",  { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    isActive:   boolean("is_active").notNull().default(true),

    createdBy: uuid("created_by"), // FK → users.id via SQL
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    codeIdx:     index("vouchers_code_idx").on(t.code),
    isActiveIdx: index("vouchers_is_active_idx").on(t.isActive),
  }));
}

// ─── voucher_redemptions ────────────────────────────────────────────────────────
// Audit trail pemakaian voucher — satu row per invoice yang memakai voucher. WAJIB ada
// (bukan cukup usedCount counter) karena usageLimitPerCustomer butuh hitung per nomor HP/email,
// dan cancelInvoiceAction butuh row spesifik untuk "dikembalikan" (cancelledAt, bukan hapus).

export function createVoucherRedemptionsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("voucher_redemptions", {
    id:            uuid("id").primaryKey().defaultRandom(),
    voucherId:     uuid("voucher_id").notNull(), // FK → vouchers.id CASCADE via SQL
    invoiceId:     uuid("invoice_id").notNull(), // FK → invoices.id CASCADE via SQL
    customerPhone: text("customer_phone"),
    customerEmail: text("customer_email"),
    discountTotal: numeric("discount_total", { precision: 15, scale: 2 }).notNull(),
    cancelledAt:   timestamp("cancelled_at", { withTimezone: true }), // diisi saat invoice dibatalkan
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    voucherIdx: index("voucher_redemptions_voucher_id_idx").on(t.voucherId),
    invoiceIdx: index("voucher_redemptions_invoice_id_idx").on(t.invoiceId),
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
    // Kode unik Rp 100-999 KHUSUS untuk termin ini — murni alat bantu identifikasi manual
    // admin di mutasi rekening (satu invoice cicilan menerima banyak transfer terpisah dari
    // waktu ke waktu, beda dari invoices.uniqueCode yang cuma sekali untuk bayar lunas
    // sekaligus). TIDAK PERNAH dihitung sebagai bagian dari nominal cicilan — `amount` di atas
    // selalu angka bersih. Null kalau unique_code_enabled dimatikan admin.
    uniqueCode:         integer("unique_code"),
  }, (t) => ({
    invoiceIdx: index("installment_schedules_invoice_id_idx").on(t.invoiceId),
    dueDateIdx: index("installment_schedules_due_date_idx").on(t.dueDate, t.status),
  }));
}

// ─── invoice_shipping_lines ───────────────────────────────────────────────────
// Ongkir per seller group. Dibuat saat checkout, satu row per seller.

export function createInvoiceShippingLinesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("invoice_shipping_lines", {
    id:              uuid("id").primaryKey().defaultRandom(),
    invoiceId:       uuid("invoice_id").notNull(),       // FK → invoices.id CASCADE
    sellerType:      text("seller_type", { enum: ["tenant", "mitra"] as const }).notNull(),
    sellerId:        uuid("seller_id"),                  // null jika tenant
    sellerName:      text("seller_name").notNull(),      // snapshot
    originCityId:    integer("origin_city_id").notNull(),
    originCityName:  text("origin_city_name").notNull(),
    courier:         text("courier").notNull(),           // 'jne' | 'pos' | 'tiki' | 'sicepat' dll
    service:         text("service").notNull(),           // 'REG' | 'YES' | 'OKE' dll
    serviceDesc:     text("service_desc"),
    etd:             text("etd"),                        // estimasi tiba, mis '1-2 hari'
    weightGram:      integer("weight_gram").notNull(),
    cost:            numeric("cost", { precision: 15, scale: 2 }).notNull(),
    trackingNumber:  text("tracking_number"),            // resi, diisi mitra setelah kirim
    shippedAt:       timestamp("shipped_at",   { withTimezone: true }),
    deliveredAt:     timestamp("delivered_at", { withTimezone: true }),
    status:          text("status", { enum: SHIPPING_STATUSES }).notNull().default("pending"),
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    invoiceIdx: index("invoice_shipping_invoice_id_idx").on(t.invoiceId),
    sellerIdx:  index("invoice_shipping_seller_idx").on(t.sellerType, t.sellerId),
  }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CartsTable                    = ReturnType<typeof createCartsTable>;
export type CartItemsTable                = ReturnType<typeof createCartItemsTable>;
export type InvoicesTable                 = ReturnType<typeof createInvoicesTable>;
export type InvoiceItemsTable             = ReturnType<typeof createInvoiceItemsTable>;
export type InvoicePaymentsTable          = ReturnType<typeof createInvoicePaymentsTable>;
export type VouchersTable                 = ReturnType<typeof createVouchersTable>;
export type VoucherRedemptionsTable       = ReturnType<typeof createVoucherRedemptionsTable>;
export type InstallmentPlansTable         = ReturnType<typeof createInstallmentPlansTable>;
export type InstallmentSchedulesTable     = ReturnType<typeof createInstallmentSchedulesTable>;
export type InvoiceShippingLinesTable     = ReturnType<typeof createInvoiceShippingLinesTable>;
