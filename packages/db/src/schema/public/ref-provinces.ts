import { pgTable, integer, text, boolean } from "drizzle-orm/pg-core";

// Sumber: Kemendagri — kode provinsi 2 digit (11 Aceh s/d 94 Papua Pegunungan)
// is_active = false untuk provinsi lama yang kodenya diganti setelah pemekaran
export const refProvinces = pgTable("ref_provinces", {
  id: integer("id").primaryKey(), // Kode Kemendagri, bukan auto-increment
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export type RefProvince = typeof refProvinces.$inferSelect;
