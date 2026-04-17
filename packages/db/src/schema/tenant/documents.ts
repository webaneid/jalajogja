import {
  pgSchema,
  uuid,
  text,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const DOCUMENT_VISIBILITY = ["internal", "public"] as const;
export type DocumentVisibility = typeof DOCUMENT_VISIBILITY[number];

// ─── document_categories ──────────────────────────────────────────────────────
// Kategori hierarkis (self-referential). FK ke diri sendiri via SQL DDL.

export function createDocumentCategoriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("document_categories", {
    id:        uuid("id").primaryKey().defaultRandom(),
    name:      text("name").notNull(),
    slug:      text("slug").notNull().unique(),
    parentId:  uuid("parent_id"),           // FK → self via SQL DDL (nullable)
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── documents ────────────────────────────────────────────────────────────────
// Satu record = satu dokumen. Riwayat versi file ada di document_versions.
// current_version_id: plain UUID tanpa FK constraint (circular ref) — dijaga di app layer.

export function createDocumentsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("documents", {
    id:               uuid("id").primaryKey().defaultRandom(),
    title:            text("title").notNull(),
    description:      text("description"),
    categoryId:       uuid("category_id"),          // FK → document_categories via SQL
    currentVersionId: uuid("current_version_id"),   // plain UUID — no DDL FK (circular)
    visibility:       text("visibility", { enum: DOCUMENT_VISIBILITY })
                        .notNull().default("internal"),
    tags:             text("tags").array().notNull().default([]),
    createdBy:        uuid("created_by"),            // FK → users via SQL
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── document_versions ───────────────────────────────────────────────────────
// Riwayat versi per dokumen. Versi lama tidak dihapus saat upload baru.
// UNIQUE(document_id, version_number) — nomor versi unik per dokumen.

export function createDocumentVersionsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("document_versions", {
    id:            uuid("id").primaryKey().defaultRandom(),
    documentId:    uuid("document_id").notNull(),   // FK → documents CASCADE via SQL
    versionNumber: integer("version_number").notNull().default(1),
    fileId:        uuid("file_id"),                 // FK → media via SQL
    fileName:      text("file_name").notNull(),
    fileSize:      integer("file_size"),
    mimeType:      text("mime_type"),
    notes:         text("notes"),
    uploadedBy:    uuid("uploaded_by"),             // FK → users via SQL
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => [
    unique().on(t.documentId, t.versionNumber),
    index("idx_document_versions_document_id").on(t.documentId),
  ]);
}
