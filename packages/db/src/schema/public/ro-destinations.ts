import { pgTable, integer, text, boolean, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

// Salinan lokal data tujuan RajaOngkir (Komerce) — PUBLIK, dibagi semua tenant (seperti ref_*). Terisi HANYA dari permintaan
// pengunjung (read-through), TIDAK ada crawl massal (kuota gratis 100/hari). Doc: docs/arsitektur-alamat.md § 11.
export const roDestinations = pgTable("ro_destinations", {
  id:              integer("id").primaryKey(),               // ID tujuan RajaOngkir (dipakai langsung oleh API ongkir)
  label:           text("label").notNull(),                  // "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243"
  provinceName:    text("province_name").notNull(),
  cityName:        text("city_name").notNull(),
  districtName:    text("district_name").notNull(),
  subdistrictName: text("subdistrict_name").notNull(),
  zipCode:         text("zip_code").notNull().default(""),
  searchText:      text("search_text").notNull(),            // label huruf kecil, hanya [a-z0-9 ] — untuk pencarian
  syncedAt:        timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

// Jejak pencarian yang SUDAH diambil dari API — dasar memutuskan "cukup dijawab lokal" (hasil sebagian ≠ lengkap).
export const roSearchLog = pgTable("ro_search_log", {
  queryNorm:   text("query_norm").primaryKey(),               // query ternormalisasi (huruf kecil, [a-z0-9 ])
  resultCount: integer("result_count").notNull(),
  truncated:   boolean("truncated").notNull(),                // true = hasil memenuhi batas halaman (mungkin ada lagi)
  fetchedAt:   timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

// Penghitung panggilan API per hari (WIB) per jenis ('search' | 'cost') — anggaran harian kuota gratis.
export const roApiUsage = pgTable("ro_api_usage", {
  day:   text("day").notNull(),                               // 'YYYY-MM-DD' (WIB)
  kind:  text("kind").notNull(),
  count: integer("count").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.day, t.kind] }),
}));

export type RoDestination = typeof roDestinations.$inferSelect;
