import { pgTable, uuid, text, integer, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { refProvinces } from "./ref-provinces";
import { refRegencies } from "./ref-regencies";
import { refDistricts } from "./ref-districts";
import { refVillages } from "./ref-villages";

// Helper table reusable — dipakai oleh members (rumah) dan member_businesses (usaha)
// Semua kolom wilayah nullable: user mungkin hanya tahu sampai kabupaten/kota
export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label", { enum: ["rumah", "kantor", "usaha"] }),
  detail: text("detail"),          // Nama jalan, nomor, RT/RW, gedung, lantai, dll
  provinceId: integer("province_id").references(() => refProvinces.id),
  regencyId: integer("regency_id").references(() => refRegencies.id),
  districtId: integer("district_id").references(() => refDistricts.id),
  villageId: bigint("village_id", { mode: "number" }).references(() => refVillages.id),
  postalCode: text("postal_code"), // Override manual jika berbeda dari data village
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Index untuk reverse lookup: "siapa saja yang tinggal di Kab. Sleman?"
  provinceIdx: index("idx_addresses_province_id").on(t.provinceId),
  regencyIdx:  index("idx_addresses_regency_id").on(t.regencyId),
}));

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
