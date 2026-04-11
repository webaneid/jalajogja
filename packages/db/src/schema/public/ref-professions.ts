import { pgTable, smallint, text } from "drizzle-orm/pg-core";

// Disederhanakan dari BPS KBJI 2014 — disesuaikan konteks alumni IKPM Gontor
// Seed data di-insert manual (25 entri), bukan dari dataset eksternal
export const refProfessions = pgTable("ref_professions", {
  id: smallint("id").primaryKey(),      // Manual ID, diurutkan per kategori
  category: text("category").notNull(), // Grup besar untuk grouping di dropdown
  name: text("name").notNull(),         // Label yang tampil di form
  order: smallint("order").notNull().default(0),
});

export type RefProfession = typeof refProfessions.$inferSelect;
