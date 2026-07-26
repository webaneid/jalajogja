import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

// Audit trail + draft-preview storage untuk fitur Import Anggota
// (docs/arsitektur-import-anggota.md) — reusable lintas tenant, bukan khusus satu forum.
// Satu baris = satu kali admin upload file. status="draft" saat baru diparse (belum ada
// tulis ke members/contacts/dst), "committed" setelah admin konfirmasi dan data ditulis.
export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  fileName: text("file_name").notNull(),

  // Nanoid Better Auth user yang menjalankan — bukan UUID, lihat lesson CLAUDE.md
  // "UUID vs nanoid" — kolom ini TEXT, bukan uuid().
  importedByUserId: text("imported_by_user_id").notNull(),

  status: text("status", { enum: ["draft", "committed"] }).notNull().default("draft"),

  totalRows:      integer("total_rows").notNull(),
  insertedRows:   integer("inserted_rows").notNull().default(0),
  skippedRows:    integer("skipped_rows").notNull().default(0),
  reviewFlagRows: integer("review_flag_rows").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Detail per-baris — satu baris di sini per baris Excel yang diproses. Dipakai baik untuk
// menyimpan hasil parsing sementara (draft, sebelum commit) maupun laporan akhir (setelah
// commit) — supaya admin bisa lihat lagi nanti, bukan cuma tampil sekali lalu hilang.
export const importBatchRows = pgTable("import_batch_rows", {
  id: uuid("id").primaryKey().defaultRandom(),

  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" }),

  rowNumber: integer("row_number").notNull(), // nomor baris di file sumber (untuk ditelusuri balik)

  // Siklus: ready/review_needed/duplicate/error (draft, sebelum commit) →
  // inserted/skipped (final, setelah commit).
  status: text("status", {
    enum: ["ready", "review_needed", "duplicate", "error", "inserted", "skipped"],
  }).notNull(),

  memberName: text("member_name"), // untuk tampilan laporan
  memberId:   uuid("member_id"),   // diisi setelah insert berhasil — TANPA FK (member bisa dihapus, laporan tetap harus utuh)

  // Seluruh data baris: nilai mentah dari Excel + hasil mapping/matching + daftar catatan
  // (field mana yang di-default, alasan skip, dll). JSONB bebas bentuk — lihat
  // lib/import-anggota.server.ts untuk shape persisnya (ImportRowPreview).
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ImportBatch    = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
export type ImportBatchRow    = typeof importBatchRows.$inferSelect;
export type NewImportBatchRow = typeof importBatchRows.$inferInsert;
