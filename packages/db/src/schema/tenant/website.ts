import {
  pgSchema,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export type ContentStatus = typeof CONTENT_STATUSES[number];

// Halaman statis — Tentang Kami, Kontak, dll
export function createPagesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("pages", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    content: text("content"),
    metaTitle: text("meta_title"),
    metaDesc: text("meta_desc"),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    order: integer("order").notNull().default(0), // urutan di navigasi
    authorId: uuid("author_id"), // FK → users.id via SQL migration
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Kategori post — hierarkis (Berita > Berita Daerah, dll)
export function createPostCategoriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("post_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"), // self-referential, FK via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Artikel/berita/pengumuman
export function createPostsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("posts", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    content: text("content"),
    coverUrl: text("cover_url"),
    metaTitle: text("meta_title"),
    metaDesc: text("meta_desc"),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    authorId: uuid("author_id"),    // FK → users.id via SQL migration
    categoryId: uuid("category_id"), // FK → post_categories.id via SQL migration
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Tag untuk post
export function createPostTagsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("post_tags", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Pivot post ↔ tag
export function createPostTagPivotTable(s: ReturnType<typeof pgSchema>) {
  return s.table("post_tag_pivot", {
    postId: uuid("post_id").notNull(),  // FK → posts.id via SQL migration
    tagId: uuid("tag_id").notNull(),    // FK → post_tags.id via SQL migration
  }, (t) => ({
    pk: primaryKey({ columns: [t.postId, t.tagId] }),
  }));
}

// Modul asal file yang diupload
export const MEDIA_MODULES = ["website", "members", "letters", "shop", "general"] as const;
export type MediaModule = typeof MEDIA_MODULES[number];

// Metadata file yang diupload ke MinIO
// URL adalah path di MinIO — presigned URL di-generate di app layer
export function createMediaTable(s: ReturnType<typeof pgSchema>) {
  return s.table("media", {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),     // bytes
    path: text("path").notNull(),         // path di MinIO bucket
    altText: text("alt_text"),
    // Modul asal upload: website/members/letters/shop/general
    module: text("module", { enum: MEDIA_MODULES }).notNull().default("general"),
    // false = file ter-upload tapi belum dipakai di konten (orphan candidate)
    isUsed: boolean("is_used").notNull().default(false),
    uploadedBy: uuid("uploaded_by"),      // FK → users.id via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type PostsTable = ReturnType<typeof createPostsTable>;
export type PagesTable = ReturnType<typeof createPagesTable>;
export type MediaTable = ReturnType<typeof createMediaTable>;
