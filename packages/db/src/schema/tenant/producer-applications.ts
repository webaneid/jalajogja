import { pgSchema, uuid, text, integer, boolean, jsonb, numeric, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Pengajuan menjadi Produsen ──────────────────────────────────────────────────────────────────
// Anggota tenant mengisi form → pengurus (anggota:full) menyetujui/menolak → saat disetujui dibuat baris
// `producers` + akses login. Doc: docs/arsitektur-pengajuan-produsen.md (§ 5 alur, § 8.1 model data).
//
//  draft     form sedang diisi / berkas sedang diunggah (dihapus otomatis setelah 7 hari — cron pembersihan = fase P7, BELUM ada)
//  pending   terkirim, menunggu tinjauan
//  approved  disetujui → producer_id terisi            (final)
//  rejected  ditolak, rejection_reason terlihat pemohon (final)
//  cancelled dibatalkan pemohon selagi pending          (final)
//
// SATU pengajuan terbuka (draft|pending) per anggota — ditegakkan UNIQUE INDEX parsial, bukan hanya cek aplikasi.
// Berkas (foto contoh/proses, dokumen) = bucket MinIO PRIVAT `private-{slug}` (BUKAN Media Library anggota, BUKAN bucket publik);
// di sini hanya rujukan {id,key,mime}. Disajikan lewat route berotorisasi. Doc § 13.

export const PRODUCER_APPLICATION_STATUSES = ["draft", "pending", "approved", "rejected", "cancelled"] as const;
export type ProducerApplicationStatus = typeof PRODUCER_APPLICATION_STATUSES[number];

export const PRODUCER_APPLICATION_SOURCE_TYPES = ["usaha", "pesantren", "profesional"] as const;
export type ProducerApplicationSourceType = typeof PRODUCER_APPLICATION_SOURCE_TYPES[number];

/** Jenis produk yang diterima. Tahap ini hanya fisik; digital/jasa = tahap tersendiri (K9). */
export const PRODUCER_APPLICATION_PRODUCT_KINDS = ["physical"] as const;

/** Statuses yang dihitung "pengajuan terbuka" untuk aturan satu-per-anggota. */
export const PRODUCER_APPLICATION_OPEN_STATUSES = ["draft", "pending"] as const;

/** Satu berkas di bucket PRIVAT tenant. `key` TIDAK pernah dikirim ke klien; klien hanya memakai `id` lewat route berotorisasi. */
export type ProducerApplicationFile = {
  id:   string;                                   // uuid — rujukan publik-ke-pemilik/peninjau
  key:  string;                                   // pengajuan-produsen/{applicationId}/{id}.webp|pdf
  mime: "image/webp" | "application/pdf";
};
export type ProducerApplicationSample = {
  id:              string;
  name:            string;
  estPriceUmum:    number | null;                 // harga jual umum perkiraan
  estPriceAnggota: number | null;                 // harga jual anggota perkiraan
  file:            ProducerApplicationFile | null; // foto contoh (null selama belum diunggah)
};
export type ProducerApplicationDocument = {
  id:   string;
  kind: string;                                   // PIRT | BPOM | Halal | NIB | Lainnya
  note: string | null;                            // keterangan opsional
  file: ProducerApplicationFile;
};

export function createProducerApplicationsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_applications", {
    id:       uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").notNull(),               // FK → public.members via aplikasi (lintas schema); dari SESI, bukan input
    status:   text("status", { enum: PRODUCER_APPLICATION_STATUSES }).notNull().default("draft"),

    // Identitas: SATU sumber milik pemohon (usaha utama / pesantren / profesional)
    sourceType: text("source_type", { enum: PRODUCER_APPLICATION_SOURCE_TYPES }),
    sourceId:   uuid("source_id"),

    brandName:         text("brand_name"),
    productKind:       text("product_kind", { enum: PRODUCER_APPLICATION_PRODUCT_KINDS }).notNull().default("physical"),
    productCategories: text("product_categories"),       // teks bebas ≤200
    description:       text("description"),              // 20–1000 karakter
    ownProductDeclared: boolean("own_product_declared").notNull().default(false),

    // Penawaran bagi hasil ke tenant (K17) — bahan penilaian kurasi. 0 < p < 100
    offeredSharePercent: numeric("offered_share_percent", { precision: 5, scale: 2 }),

    // Operasional
    opsName:       text("ops_name"),
    opsWhatsapp:   text("ops_whatsapp"),                 // E.164
    teamSize:      integer("team_size"),                 // 1..999
    processDays:   integer("process_days"),              // 1..3 (×24 jam)
    originRegencyId: integer("origin_regency_id"),       // ref_regencies

    // Bukti (rujukan berkas di bucket privat)
    sampleProducts: jsonb("sample_products").$type<ProducerApplicationSample[]>().notNull().default(sql`'[]'::jsonb`),
    processMedia:   jsonb("process_media").$type<ProducerApplicationFile[]>().notNull().default(sql`'[]'::jsonb`),
    documentMedia:  jsonb("document_media").$type<ProducerApplicationDocument[]>().notNull().default(sql`'[]'::jsonb`),
    links:          jsonb("links").$type<string[]>().notNull().default(sql`'[]'::jsonb`),   // https saja, ≤3

    // Keputusan
    submittedAt:     timestamp("submitted_at", { withTimezone: true }),
    reviewedAt:      timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy:      uuid("reviewed_by"),                // tenant.users.id — tanpa FK (audit ringan)
    rejectionReason: text("rejection_reason"),           // terlihat pemohon
    reviewNote:      text("review_note"),                // internal pengurus
    producerId:      uuid("producer_id"),                // FK → producers.id SET NULL via DDL (hasil persetujuan)

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    // Satu pengajuan terbuka (draft|pending) per anggota
    openUniq:  uniqueIndex("producer_applications_open_uniq").on(t.memberId).where(sql`${t.status} IN ('draft','pending')`),
    statusIdx: index("producer_applications_status_idx").on(t.status),
    memberIdx: index("producer_applications_member_idx").on(t.memberId),
  }));
}

export type ProducerApplicationsTable = ReturnType<typeof createProducerApplicationsTable>;
export type ProducerApplication       = ProducerApplicationsTable["$inferSelect"];
export type NewProducerApplication    = ProducerApplicationsTable["$inferInsert"];
