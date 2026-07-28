import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

// Audit trail + draft-preview storage untuk fitur Import/Export Post WordPress
// (docs/arsitektur-import-export-post-wordpress.md § 14.2) — TABEL PARALEL, bukan reuse
// `import_batches`/`import_batch_rows` milik Importer Anggota (skema itu spesifik kolom
// member_name/member_id, tanpa diskriminator tipe konten). Pola sama (draft-store,
// preview-then-commit, klaim atomic), tapi content-type-agnostic (Post + Page).
export const contentImportBatches = pgTable("content_import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  source: text("source", { enum: ["wxr_upload", "rest_api_pull"] }).notNull(),
  sourceUrl: text("source_url"), // URL situs WP lama, kalau source='rest_api_pull'
  fileName: text("file_name"),   // nama file WXR, kalau source='wxr_upload'

  // Nanoid Better Auth user yang menjalankan — bukan UUID, lihat lesson CLAUDE.md
  // "UUID vs nanoid" — kolom ini TEXT, bukan uuid().
  importedByUserId: text("imported_by_user_id").notNull(),

  status: text("status", { enum: ["draft", "committing", "committed"] }).notNull().default("draft"),

  totalRows:     integer("total_rows").notNull().default(0),
  processedRows: integer("processed_rows").notNull().default(0), // progress bar chunked commit (§ 13)
  insertedRows:  integer("inserted_rows").notNull().default(0),
  skippedRows:   integer("skipped_rows").notNull().default(0),
  errorRows:     integer("error_rows").notNull().default(0),

  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  committedAt: timestamp("committed_at", { withTimezone: true }),

  // Rollback via soft bulk-archive (§ 14.1) — nullable, terisi saat archiveImportBatchAction
  // dijalankan. TIDAK ada nilai 'archived' baru di enum `status` di atas — batch tetap
  // 'committed', archivedAt cukup jadi penanda "kapan rollback ini terakhir dijalankan"
  // (pola sama committedAt). Konten yang benar-benar berubah statusnya adalah posts/pages
  // (via import_batch_id), bukan batch record ini.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

// Detail per-baris — satu baris di sini per <item> WXR/REST yang diproses (post ATAU page).
// Dipakai baik untuk menyimpan hasil parsing sementara (draft, sebelum commit) maupun laporan
// akhir (setelah commit).
export const contentImportBatchRows = pgTable("content_import_batch_rows", {
  id: uuid("id").primaryKey().defaultRandom(),

  batchId: uuid("batch_id")
    .notNull()
    .references(() => contentImportBatches.id, { onDelete: "cascade" }),

  rowNumber: integer("row_number").notNull(), // urutan di dalam file/halaman sumber

  contentType: text("content_type", { enum: ["post", "page"] }).notNull(),

  title: text("title"),
  wpPostId: integer("wp_post_id"), // ID asli WordPress, untuk traceability/debug

  // Siklus: ready/review_needed/duplicate/error (draft, sebelum commit) → processing (klaim
  // atomic sementara, § 13) → inserted/skipped (final, setelah commit).
  status: text("status", {
    enum: ["ready", "review_needed", "duplicate", "error", "processing", "inserted", "skipped"],
  }).notNull(),

  // Diisi setelah insert sukses (posts.id / pages.id) — TANPA FK (cross-schema ke
  // tenant_{slug}.posts/pages, pola sama cross-reference longgar lain di project ini).
  createdContentId: uuid("created_content_id"),

  // Payload lengkap hasil parse (dipakai commit + retry) — bentuk ParsedWordPressItem dari
  // apps/web/lib/wordpress-import-mapping.ts (dihasilkan wordpress-xml-parser.server.ts /
  // wordpress-api-fetcher.server.ts).
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),

  errorMessage: text("error_message"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContentImportBatch    = typeof contentImportBatches.$inferSelect;
export type NewContentImportBatch = typeof contentImportBatches.$inferInsert;
export type ContentImportBatchRow    = typeof contentImportBatchRows.$inferSelect;
export type NewContentImportBatchRow = typeof contentImportBatchRows.$inferInsert;
