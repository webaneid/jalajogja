import { pgSchema, uuid, text, timestamp } from "drizzle-orm/pg-core";

// Fase 3 (Prinsip C), docs/arsitektur-seo.md § 3.3 — override SEO untuk halaman publik yang
// TIDAK PUNYA "rumah" tabel (login, register, arsip statis, dll). pageKey adalah identifier
// stabil yang hidup di kode (lib/seo-page-keys.ts) — BUKAN URL, supaya tidak rusak kalau URL
// berubah (custom domain, path mode, dll).

export const SEO_OVERRIDE_ROBOTS_VALUES = ["index,follow", "noindex", "noindex,nofollow"] as const;
export type SeoOverrideRobots = typeof SEO_OVERRIDE_ROBOTS_VALUES[number];

export function createSeoPageOverridesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("seo_page_overrides", {
    id:            uuid("id").primaryKey().defaultRandom(),
    pageKey:       text("page_key").notNull().unique(),
    metaTitle:     text("meta_title"),
    metaDesc:      text("meta_desc"),
    ogTitle:       text("og_title"),
    ogDescription: text("og_description"),
    ogImageId:     uuid("og_image_id"),      // FK → media.id via SQL DDL
    robots:        text("robots", { enum: SEO_OVERRIDE_ROBOTS_VALUES }),
    updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}
