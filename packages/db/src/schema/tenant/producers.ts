import { pgSchema, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

// ─── Produsen produk (ADMIN-ONLY) ─────────────────────────────────────────────────────────────
// Siapa produsen/pemasok barang tiap produk TENANT. Internal (tenant sendiri) = TANPA baris:
// products.producer_id NULL berarti internal. Doc: docs/arsitektur-produsen.md.
//
//   member → merujuk baris di schema public (usaha/pesantren milik anggota/profesional) yang
//            pemiliknya anggota tenant ini. Data nama/WA/alamat DIBACA LANGSUNG dari sumber
//            (referensi hidup); name_cache hanya cadangan kalau baris sumber kelak dihapus.
//   custom → produsen bukan anggota; data diketik admin (kolom custom_*). Alamat custom TIDAK
//            dimasukkan ke public.addresses (tabel shared lintas tenant) — disimpan di sini,
//            merujuk tabel referensi wilayah public.ref_* (read-only).
//
// Tabel ini hanya dibaca dashboard admin (hasFullAccess toko) — JANGAN pernah ikut payload publik.

export const PRODUCER_TYPES = ["member", "custom"] as const;
export type ProducerType = typeof PRODUCER_TYPES[number];

export const PRODUCER_SOURCE_TYPES = ["usaha", "pesantren", "profesional"] as const;
export type ProducerSourceType = typeof PRODUCER_SOURCE_TYPES[number];

export function createProducersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producers", {
    id:          uuid("id").primaryKey().defaultRandom(),
    type:        text("type", { enum: PRODUCER_TYPES }).notNull(),

    // ── type = member ────────────────────────────────────────────────────────────────────────
    sourceType:  text("source_type", { enum: PRODUCER_SOURCE_TYPES }),
    sourceId:    uuid("source_id"),   // id baris di public.member_businesses / member_owned_pesantren / member_professionals
    memberId:    uuid("member_id"),   // pemilik (FK public.members via DDL) — cek keanggotaan + fallback kontak
    nameCache:   text("name_cache"),  // cadangan nama kalau sumber hilang

    // ── type = custom ────────────────────────────────────────────────────────────────────────
    customName:          text("custom_name"),
    customWhatsapp:      text("custom_whatsapp"),   // E.164 (normalizePhone saat simpan)
    customAddressDetail: text("custom_address_detail"),
    customProvinceId:    integer("custom_province_id"),
    customRegencyId:     integer("custom_regency_id"),
    customDistrictId:    integer("custom_district_id"),
    customVillageId:     text("custom_village_id"),  // bigint di ref_villages — disimpan sebagai teks (angka besar)
    customPostalCode:    text("custom_postal_code"),

    notes:       text("notes"),
    isActive:    boolean("is_active").notNull().default(true),
    createdBy:   uuid("created_by"),                // tenant.users.id — tanpa FK (audit ringan)
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    memberIdx: index("producers_member_idx").on(t.memberId),
    typeIdx:   index("producers_type_idx").on(t.type),
  }));
}

export type ProducersTable = ReturnType<typeof createProducersTable>;
