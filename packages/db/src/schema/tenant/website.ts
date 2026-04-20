import {
  pgSchema,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";

export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export type ContentStatus = typeof CONTENT_STATUSES[number];

export const PAGE_TEMPLATES = ["default", "landing", "contact", "about", "linktree"] as const;
export type PageTemplate = typeof PAGE_TEMPLATES[number];

export const PAGE_TWITTER_CARDS = ["summary", "summary_large_image"] as const;
export const PAGE_ROBOTS_VALUES = ["index,follow", "noindex", "noindex,nofollow"] as const;
export const PAGE_SCHEMA_TYPES  = ["WebPage", "AboutPage", "ContactPage", "FAQPage"] as const;

// Halaman statis — Tentang Kami, Kontak, dll
export function createPagesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("pages", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    content: text("content"),
    // Cover gambar (FK → media)
    coverId: uuid("cover_id"),              // FK → media.id via SQL migration
    // SEO dasar
    metaTitle: text("meta_title"),
    metaDesc:  text("meta_desc"),
    // Open Graph
    ogTitle:       text("og_title"),
    ogDescription: text("og_description"),
    ogImageId:     uuid("og_image_id"),     // FK → media.id via SQL migration
    // Social / Advanced
    twitterCard:    text("twitter_card",  { enum: PAGE_TWITTER_CARDS }).default("summary"),
    focusKeyword:   text("focus_keyword"),
    canonicalUrl:   text("canonical_url"),
    robots:         text("robots",        { enum: PAGE_ROBOTS_VALUES }).notNull().default("index,follow"),
    schemaType:     text("schema_type",   { enum: PAGE_SCHEMA_TYPES  }).notNull().default("WebPage"),
    structuredData: jsonb("structured_data"),
    template: text("template", { enum: PAGE_TEMPLATES }).notNull().default("default"),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    order:  integer("order").notNull().default(0),  // urutan di navigasi
    authorId: uuid("author_id"),            // FK → users.id via SQL migration
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt:   timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at",   { withTimezone: true }).notNull().defaultNow(),
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

export const POST_TWITTER_CARDS   = ["summary", "summary_large_image"] as const;
export const POST_ROBOTS_VALUES   = ["index,follow", "noindex", "noindex,nofollow"] as const;
export const POST_SCHEMA_TYPES    = ["Article", "NewsArticle", "BlogPosting"] as const;

// Artikel/berita/pengumuman
export function createPostsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("posts", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    content: text("content"),
    // cover_url (text) digantikan cover_id (FK → media)
    coverId: uuid("cover_id"),              // FK → media.id via SQL migration
    // SEO dasar
    metaTitle: text("meta_title"),
    metaDesc:  text("meta_desc"),
    // Open Graph
    ogTitle:       text("og_title"),
    ogDescription: text("og_description"),
    ogImageId:     uuid("og_image_id"),     // FK → media.id via SQL migration
    // Social / Advanced
    twitterCard:    text("twitter_card",  { enum: POST_TWITTER_CARDS  }).default("summary_large_image"),
    focusKeyword:   text("focus_keyword"),
    canonicalUrl:   text("canonical_url"),
    robots:         text("robots",        { enum: POST_ROBOTS_VALUES  }).notNull().default("index,follow"),
    schemaType:     text("schema_type",   { enum: POST_SCHEMA_TYPES   }).notNull().default("Article"),
    structuredData: jsonb("structured_data"),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    authorId:   uuid("author_id"),          // FK → users.id via SQL migration
    categoryId: uuid("category_id"),        // FK → post_categories.id via SQL migration
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt:   timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at",   { withTimezone: true }).notNull().defaultNow(),
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
    title: text("title"),                // judul gambar (hover tooltip)
    caption: text("caption"),            // keterangan di bawah gambar dalam artikel
    description: text("description"),    // deskripsi panjang untuk SEO / schema.org
    // Modul asal upload: website/members/letters/shop/general
    module: text("module", { enum: MEDIA_MODULES }).notNull().default("general"),
    // false = file ter-upload tapi belum dipakai di konten (orphan candidate)
    isUsed: boolean("is_used").notNull().default(false),
    uploadedBy: uuid("uploaded_by"),      // FK → users.id via SQL migration
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Pesan masuk dari Contact Page — inbox di dashboard
export function createContactSubmissionsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("contact_submissions", {
    id:        uuid("id").primaryKey().defaultRandom(),
    pageId:    uuid("page_id").notNull(),  // FK → pages.id via SQL migration
    name:      text("name").notNull(),
    email:     text("email"),
    phone:     text("phone"),
    message:   text("message").notNull(),
    isRead:    boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type PostsTable               = ReturnType<typeof createPostsTable>;
export type PagesTable               = ReturnType<typeof createPagesTable>;
export type MediaTable               = ReturnType<typeof createMediaTable>;
export type ContactSubmissionsTable  = ReturnType<typeof createContactSubmissionsTable>;

export type PostTwitterCard = typeof POST_TWITTER_CARDS[number];
export type PostRobots      = typeof POST_ROBOTS_VALUES[number];
export type PostSchemaType  = typeof POST_SCHEMA_TYPES[number];
export type PageSchemaType  = typeof PAGE_SCHEMA_TYPES[number];
