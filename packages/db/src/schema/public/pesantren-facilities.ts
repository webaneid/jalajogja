import {
  pgTable,
  uuid,
  smallint,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { pesantren }              from "./pesantren";
import { pesantrenFacilityTypes } from "./pesantren-facility-types";

// ─── Fasilitas per pesantren (many-to-many dengan keterangan bebas) ─────────────
export const pesantrenFacilities = pgTable("pesantren_facilities", {
  id:             uuid("id").primaryKey().defaultRandom(),
  pesantrenId:    uuid("pesantren_id").notNull()
                    .references(() => pesantren.id, { onDelete: "cascade" }),
  facilityTypeId: smallint("facility_type_id").notNull()
                    .references(() => pesantrenFacilityTypes.id, { onDelete: "restrict" }),
  keterangan:     text("keterangan"), // "2 unit", "kapasitas 500 orang", "dalam renovasi"
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pesantrenIdIdx:    index("idx_pesantren_facilities_pesantren_id").on(t.pesantrenId),
  facilityTypeIdIdx: index("idx_pesantren_facilities_type_id").on(t.facilityTypeId),
  uniqFasilitas:     unique("uq_pesantren_facility").on(t.pesantrenId, t.facilityTypeId),
}));

export type PesantrenFacility    = typeof pesantrenFacilities.$inferSelect;
export type NewPesantrenFacility = typeof pesantrenFacilities.$inferInsert;
