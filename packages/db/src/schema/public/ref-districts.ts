import { pgTable, integer, text, boolean, index } from "drizzle-orm/pg-core";
import { refRegencies } from "./ref-regencies";

// Kode Kemendagri 7 digit (1101010–9471050) — max ~9.4 juta fits in integer
// Index regencyId untuk cascading select: GET /api/ref/districts?regency_id=
export const refDistricts = pgTable("ref_districts", {
  id: integer("id").primaryKey(),
  regencyId: integer("regency_id").notNull().references(() => refRegencies.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  regencyIdIdx: index("idx_ref_districts_regency_id").on(t.regencyId),
}));

export type RefDistrict = typeof refDistricts.$inferSelect;
