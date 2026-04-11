import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── Katalog Modul (dikelola jalajogja platform) ──────────────────────────────
// Modul = fitur utama aplikasi. Dimasukkan ke package yang dijual ke tenant.
// Berbeda dengan Add-on yang bersifat ekstensi opsional.
//
// Slug modul yang direncanakan:
//   settings   → Pengaturan tenant (wajib di semua package)
//   anggota    → Manajemen anggota + wizard
//   website    → Pages, posts, media, block editor
//   surat      → Surat menyurat (in/out/internal)
//   keuangan   → Jurnal akuntansi, anggaran, laporan
//   toko       → Produk, order, checkout
//   donasi     → Campaign donasi/infaq

export const MODULE_STATUSES = [
  "active",       // tersedia di package
  "coming_soon",  // diumumkan, belum release
  "inactive",     // platform nonaktifkan
] as const;
export type ModuleStatus = typeof MODULE_STATUSES[number];

export const modules = pgTable("modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // "anggota", "website", "keuangan", dll.
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  status: text("status", { enum: MODULE_STATUSES }).notNull().default("active"),
  version: text("version").notNull().default("1.0.0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;
