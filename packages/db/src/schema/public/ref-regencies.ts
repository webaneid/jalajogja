import { pgTable, integer, text, boolean, index } from "drizzle-orm/pg-core";
import { refProvinces } from "./ref-provinces";

// Kode Kemendagri 4 digit (1101–9471) — max 9471 fits in integer
// Index provinceId untuk cascading select: GET /api/ref/regencies?province_id=
export const refRegencies = pgTable("ref_regencies", {
  id: integer("id").primaryKey(),
  provinceId: integer("province_id").notNull().references(() => refProvinces.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["kabupaten", "kota"] }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  provinceIdIdx: index("idx_ref_regencies_province_id").on(t.provinceId),
}));

export type RefRegency = typeof refRegencies.$inferSelect;
