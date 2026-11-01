import { pgSchema, uuid, text, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Asal kirim (gudang / pabrik / toko) ─────────────────────────────────────────────────────────
// SATU struktur untuk semua pemilik asal kirim tenant: produsen (producer_id terisi) atau toko/internal (producer_id NULL).
// Lokasi = tujuan RajaOngkir lokal (public.ro_destinations; FK via DDL) + alamat lengkap. Nama wilayah diambil lewat JOIN, bukan disalin.
// Menggantikan producer_warehouses, products.origin_city_* dan origin_city_* di config add-on RajaOngkir. Doc: docs/arsitektur-alamat.md § 20.
export function createShippingOriginsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("shipping_origins", {
    id:            uuid("id").primaryKey().defaultRandom(),
    producerId:    uuid("producer_id"),                         // NULL = milik toko/internal; FK → producers.id RESTRICT via DDL
    label:         text("label").notNull(),                     // "Gudang Utama", "Pabrik Sleman"
    detail:        text("detail").notNull(),                    // alamat lengkap: jalan / RT / RW / patokan
    destinationId: integer("destination_id").notNull(),         // FK → public.ro_destinations.id via DDL
    isDefault:     boolean("is_default").notNull().default(false),
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    producerIdx:        index("shipping_origins_producer_idx").on(t.producerId),
    // Satu asal utama per produsen — dijaga database
    producerDefaultUniq: uniqueIndex("shipping_origins_producer_default_uniq").on(t.producerId).where(sql`${t.isDefault} AND ${t.producerId} IS NOT NULL`),
    // …dan satu untuk toko/internal (producer_id NULL)
    tenantDefaultUniq:   uniqueIndex("shipping_origins_tenant_default_uniq").on(t.isDefault).where(sql`${t.isDefault} AND ${t.producerId} IS NULL`),
  }));
}

export type ShippingOriginsTable = ReturnType<typeof createShippingOriginsTable>;
