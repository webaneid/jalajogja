import {
  pgSchema,
  uuid,
  text,
  integer,
  timestamp,
  index,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const DOCUMENT_VISIBILITY = ["internal", "public"] as const;
export type DocumentVisibility = typeof DOCUMENT_VISIBILITY[number];

export const DOCUMENT_TWITTER_CARDS = ["summary", "summary_large_image"] as const;
export const DOCUMENT_ROBOTS_VALUES  = ["index,follow", "noindex", "noindex,nofollow"] as const;

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

    // ── SEO (Fase 1, docs/arsitektur-seo.md § 3.1) — hanya relevan untuk
    //    dokumen visibility="public", tapi kolom tetap ada untuk semua ──
    metaTitle:      text("meta_title"),
    metaDesc:       text("meta_desc"),
    ogTitle:        text("og_title"),
    ogDescription:  text("og_description"),
    ogImageId:      uuid("og_image_id"),    // FK → media.id via SQL
    twitterCard:    text("twitter_card",    { enum: DOCUMENT_TWITTER_CARDS }).default("summary_large_image"),
    focusKeyword:   text("focus_keyword"),
    canonicalUrl:   text("canonical_url"),
    robots:         text("robots",          { enum: DOCUMENT_ROBOTS_VALUES }).notNull().default("index,follow"),
    schemaType:     text("schema_type").notNull().default("WebPage"),
    structuredData: jsonb("structured_data"),
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
