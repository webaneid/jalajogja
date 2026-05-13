import { pgTable, integer, text, index } from "drizzle-orm/pg-core";

// Daftar kota RajaOngkir — di-cache di DB, di-sync dari API platform
// Disimpan di public schema — shared semua tenant
export const refRajaongkirCities = pgTable("ref_rajaongkir_cities", {
  cityId:     integer("city_id").primaryKey(),
  provinceId: integer("province_id").notNull(),
  cityName:   text("city_name").notNull(),
  postalCode: text("postal_code"),
  type:       text("type").notNull(),  // 'Kabupaten' | 'Kota'
}, (t) => ({
  provinceIdx: index("ref_rajaongkir_cities_province_idx").on(t.provinceId),
  nameIdx:     index("ref_rajaongkir_cities_name_idx").on(t.cityName),
}));

export type RefRajaongkirCitiesTable = typeof refRajaongkirCities;
