import {
  pgTable,
  smallserial,
  integer,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ─── Lookup table — fasilitas pesantren (global seed, tidak per-tenant) ────────
// Seed: 21 jenis fasilitas dalam 5 kategori
// Admin platform bisa tambah jenis baru tanpa migration schema
export const pesantrenFacilityTypes = pgTable("pesantren_facility_types", {
  id:        smallserial("id").primaryKey(),
  name:      text("name").notNull(),
  category:  text("category", {
               enum: ["ibadah","pendidikan","olahraga","kesehatan","penunjang"],
             }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  categoryIdx: index("idx_pesantren_facility_types_category").on(t.category),
}));

export type PesantrenFacilityType = typeof pesantrenFacilityTypes.$inferSelect;
