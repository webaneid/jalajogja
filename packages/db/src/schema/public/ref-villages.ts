import { pgTable, bigint, integer, text, boolean, index } from "drizzle-orm/pg-core";
import { refDistricts } from "./ref-districts";

// Kode Kemendagri 10 digit (1101010001–9471050999)
// Max ~9.4 miliar > 2.1 miliar (int32 overflow) — wajib bigint
// mode: "number" aman karena 10 digit < Number.MAX_SAFE_INTEGER (2^53)
// Index districtId untuk cascading select: GET /api/ref/villages?district_id=
export const refVillages = pgTable("ref_villages", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  districtId: integer("district_id").notNull().references(() => refDistricts.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["desa", "kelurahan"] }).notNull(),
  postalCode: text("postal_code"), // Sering tidak tersedia di dataset → nullable
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  districtIdIdx: index("idx_ref_villages_district_id").on(t.districtId),
}));

export type RefVillage = typeof refVillages.$inferSelect;
