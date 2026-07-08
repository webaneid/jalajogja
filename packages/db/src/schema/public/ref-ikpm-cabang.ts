import { pgTable, text, boolean, uuid, timestamp } from "drizzle-orm/pg-core";

export const refIkpmCabang = pgTable("ref_ikpm_cabang", {
  id:         uuid("id").primaryKey().defaultRandom(),
  kode:       text("kode").unique(),
  nama:       text("nama").notNull(),
  namaPendek: text("nama_pendek"),
  kota:       text("kota"),
  provinsi:   text("provinsi"),
  isActive:   boolean("is_active").notNull().default(true),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RefIkpmCabang        = typeof refIkpmCabang.$inferSelect;
export type InsertRefIkpmCabang  = typeof refIkpmCabang.$inferInsert;
