-- Migration: tabel baru seo_page_overrides untuk semua tenant existing
-- Fase 3, docs/arsitektur-seo.md § 3.3 — override SEO untuk halaman publik tanpa "rumah" tabel
-- (login, register, arsip statis, dll). Tenant baru sudah otomatis dapat ini via create-tenant-schema.ts.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0039_seo_page_overrides.sql

DO $$
DECLARE
  r RECORD;
  s TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    s := 'tenant_' || r.slug;

    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.seo_page_overrides (
        id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        page_key        TEXT           NOT NULL UNIQUE,
        meta_title      TEXT,
        meta_desc       TEXT,
        og_title        TEXT,
        og_description  TEXT,
        og_image_id     UUID           REFERENCES %I.media(id) ON DELETE SET NULL,
        robots          TEXT           CHECK (robots IN (''index,follow'',''noindex'',''noindex,nofollow'')),
        updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )', s, s);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_seo_page_overrides_page_key ON %I.seo_page_overrides(page_key)', s);
  END LOOP;
END;
$$;
