import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ADDON_CATEGORIES = [
  "communication", // WhatsApp, Email kustom
  "payment",       // Midtrans, Xendit, iPaymu, QRIS Dynamic
  "analytics",     // Google Analytics, Meta Pixel
  "integration",   // Webhook out, n8n
] as const;
export type AddonCategory = typeof ADDON_CATEGORIES[number];

export const ADDON_STATUSES = [
  "active",       // tersedia untuk diinstall
  "inactive",     // platform disable sementara
  "coming_soon",  // diumumkan tapi belum bisa diinstall
] as const;
export type AddonStatus = typeof ADDON_STATUSES[number];

// ─── Katalog Add-on (dikelola jalajogja platform) ─────────────────────────────
// Seed data: lihat migration 0003 — daftar add-on awal sudah di-insert otomatis
// Add-on baru: tambah row di tabel ini via platform admin atau migration

export const addons = pgTable("addons", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // "whatsapp-gateway", "midtrans", dll.
  name: text("name").notNull(),
  description: text("description"),
  category: text("category", { enum: ADDON_CATEGORIES }).notNull(),
  iconUrl: text("icon_url"),

  // Harga — null jika gratis
  isFree: boolean("is_free").notNull().default(true),
  priceMonthly: integer("price_monthly"), // IDR, null jika free
  priceYearly: integer("price_yearly"),   // IDR, null jika free (diskon ~20%)

  // Quota per bulan — null = unlimited
  // Untuk WhatsApp: jumlah pesan/bulan. Untuk gateway: null (tidak relevan)
  quotaMonthly: integer("quota_monthly"),

  status: text("status", { enum: ADDON_STATUSES }).notNull().default("active"),
  version: text("version").notNull().default("1.0.0"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Addon = typeof addons.$inferSelect;
export type NewAddon = typeof addons.$inferInsert;
