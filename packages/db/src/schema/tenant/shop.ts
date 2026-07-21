import {
  pgSchema,
  text,
  uuid,
  timestamp,
  integer,
  numeric,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const PRODUCT_STATUSES   = ["active", "draft", "archived"] as const;
export const PRODUCT_TYPES      = ["simple", "variable"] as const;
export type  ProductType        = typeof PRODUCT_TYPES[number];

export type AttributeGroup = {
  name:   string;
  values: string[];
};
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

// Kategori produk — hierarkis
export function createProductCategoriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("product_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"), // self-referential, FK via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // SEO ringan (Fase 2, docs/arsitektur-seo.md § 3.2) — dipakai di /produk/kategori/[slug]
    metaTitle: text("meta_title"),
    metaDesc:  text("meta_desc"),
  });
}

export const PRODUCT_TWITTER_CARDS = ["summary", "summary_large_image"] as const;
export const PRODUCT_ROBOTS_VALUES = ["index,follow", "noindex", "noindex,nofollow"] as const;

export function createProductsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("products", {
    id:    uuid("id").primaryKey().defaultRandom(),
    sku:   text("sku").unique(),
    slug:  text("slug").notNull().unique(),
    name:  text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 15, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    // Array objek: [{ url, alt, order }] — path MinIO
    images: jsonb("images").notNull().default([]),
    // SEO dasar (tidak ada di schema awal, ditambah sekarang)
    metaTitle: text("meta_title"),
    metaDesc:  text("meta_desc"),
    // Open Graph
    ogTitle:       text("og_title"),
    ogDescription: text("og_description"),
    ogImageId:     uuid("og_image_id"),     // FK → media.id via SQL migration
    // Social / Advanced
    twitterCard:    text("twitter_card", { enum: PRODUCT_TWITTER_CARDS }).default("summary_large_image"),
    focusKeyword:   text("focus_keyword"),
    canonicalUrl:   text("canonical_url"),
    robots:         text("robots",       { enum: PRODUCT_ROBOTS_VALUES }).notNull().default("index,follow"),
    // schema_type untuk produk — default 'Product', bisa override (misal: SoftwareApplication)
    schemaType:     text("schema_type").notNull().default("Product"),
    structuredData: jsonb("structured_data"),
    status: text("status", { enum: PRODUCT_STATUSES }).notNull().default("draft"),
    categoryId: uuid("category_id"),        // FK → product_categories.id via SQL migration
    viewCount: integer("view_count").notNull().default(0),
    // Harga berlapis — berlaku untuk tenant dan mitra (untuk simple product)
    publicPrice: numeric("public_price", { precision: 15, scale: 2 }),
    memberPrice: numeric("member_price", { precision: 15, scale: 2 }),
    // Variasi produk
    productType:     text("product_type",     { enum: PRODUCT_TYPES }).notNull().default("simple"),
    attributeGroups: jsonb("attribute_groups").$type<AttributeGroup[]>(),  // null jika simple
    // Pengiriman
    weightGram: integer("weight_gram"),    // berat produk (gram), wajib untuk produk mitra
    // Mitra fields
    sellerType:  text("seller_type", { enum: ["tenant", "mitra"] as const }).notNull().default("tenant"),
    mitraId:     uuid("mitra_id"),
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
    profileId:  uuid("profile_id"),         // FK → public.profiles.id via SQL migration
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
    subtotal:     numeric("subtotal",       { precision: 15, scale: 2 }).notNull(),
    // Snapshot komisi mitra saat order — null untuk produk tenant
    commissionRateSnapshot: numeric("commission_rate_snapshot", { precision: 5,  scale: 2 }),
    ikpmCommissionAmount:   numeric("ikpm_commission_amount",   { precision: 15, scale: 2 }),
  }, (t) => ({
    orderIdx: index("order_items_order_id_idx").on(t.orderId),
  }));
}

// Catatan: pembayaran order ditangani oleh finance.payments (source_type='order')
// Tidak ada tabel order_payments di sini — semua uang masuk terpusat

export function createProductVariationsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("product_variations", {
    id:             uuid("id").primaryKey().defaultRandom(),
    productId:      uuid("product_id").notNull(),   // FK → products.id via DDL
    sku:            text("sku"),
    price:          numeric("price",        { precision: 15, scale: 2 }).notNull(),
    publicPrice:    numeric("public_price", { precision: 15, scale: 2 }),
    memberPrice:    numeric("member_price", { precision: 15, scale: 2 }),
    stock:          integer("stock").notNull().default(0),
    weightGram:     integer("weight_gram"),   // override berat per variasi (gram)
    images:         jsonb("images").notNull().default([]),
    attributeCombo: jsonb("attribute_combo").notNull().$type<Record<string, string>>(),
    isActive:       boolean("is_active").notNull().default(true),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    productIdx: index("product_variations_product_id_idx").on(t.productId),
  }));
}

export type ProductsTable           = ReturnType<typeof createProductsTable>;
export type OrdersTable             = ReturnType<typeof createOrdersTable>;
export type OrderItemsTable         = ReturnType<typeof createOrderItemsTable>;
export type ProductVariationsTable  = ReturnType<typeof createProductVariationsTable>;

export type ProductTwitterCard = typeof PRODUCT_TWITTER_CARDS[number];
export type ProductRobots      = typeof PRODUCT_ROBOTS_VALUES[number];
