import {
  pgSchema,
  text,
  uuid,
  timestamp,
  integer,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export type ProductStatus = typeof PRODUCT_STATUSES[number];

export const ORDER_STATUSES = [
  "pending",    // menunggu pembayaran
  "paid",       // pembayaran dikonfirmasi
  "processing", // sedang diproses
  "shipped",    // sudah dikirim
  "done",       // selesai/diterima
  "cancelled",  // dibatalkan
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const SHOP_PAYMENT_METHODS = [
  "cash", "transfer", "qris", "midtrans", "xendit", "ipaymu",
] as const;

// Kategori produk — hierarkis
export function createProductCategoriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("product_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"), // self-referential, FK via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export function createProductsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("products", {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").unique(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 15, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    // Array objek: [{ url, alt, order }] — path MinIO
    images: jsonb("images").notNull().default([]),
    status: text("status", { enum: PRODUCT_STATUSES }).notNull().default("draft"),
    categoryId: uuid("category_id"), // FK → product_categories.id via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export function createOrdersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull().unique(), // misal: ORD-20250411-001
    // Nullable — untuk donasi/pembelian dari luar yang tidak punya akun
    customerId: uuid("customer_id"),        // FK → members.id via SQL migration
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    shippingAddress: text("shipping_address"),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export function createOrderItemsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("order_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull(),     // FK → orders.id via SQL migration
    productId: uuid("product_id").notNull(), // FK → products.id via SQL migration
    productName: text("product_name").notNull(), // snapshot nama saat order
    skuAtOrder: text("sku_at_order"),            // snapshot SKU saat order
    qty: integer("qty").notNull(),
    // Harga disimpan saat order — tidak terpengaruh perubahan harga produk di masa depan
    priceAtOrder: numeric("price_at_order", { precision: 15, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  }, (t) => ({
    orderIdx: index("order_items_order_id_idx").on(t.orderId),
  }));
}

// Satu order bisa punya beberapa percobaan pembayaran
export function createOrderPaymentsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("order_payments", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull(), // FK → orders.id via SQL migration
    method: text("method", { enum: SHOP_PAYMENT_METHODS }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
    // ID transaksi dari payment gateway (Midtrans/Xendit/iPaymu)
    gatewayRef: text("gateway_ref"),
    // Untuk pembayaran manual — link ke payment_confirmations
    confirmationId: uuid("confirmation_id"), // FK → payment_confirmations.id via SQL migration
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type ProductsTable = ReturnType<typeof createProductsTable>;
export type OrdersTable = ReturnType<typeof createOrdersTable>;
export type OrderItemsTable = ReturnType<typeof createOrderItemsTable>;
export type OrderPaymentsTable = ReturnType<typeof createOrderPaymentsTable>;
