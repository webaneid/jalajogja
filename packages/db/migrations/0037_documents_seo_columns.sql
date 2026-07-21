-- Migration: tambah kolom SEO ke documents untuk semua tenant existing
-- Fase 1, docs/arsitektur-seo.md § 3.1 — modul Dokumen sebelumnya nol kolom SEO
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0037_documents_seo_columns.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS meta_title TEXT',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS meta_desc TEXT',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS og_title TEXT',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS og_description TEXT',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS og_image_id UUID REFERENCES %I.media(id) ON DELETE SET NULL',
      'tenant_' || r.slug, 'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS twitter_card TEXT DEFAULT ''summary_large_image''',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents DROP CONSTRAINT IF EXISTS documents_twitter_card_check',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD CONSTRAINT documents_twitter_card_check CHECK (twitter_card IN (''summary'',''summary_large_image''))',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS focus_keyword TEXT',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS canonical_url TEXT',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS robots TEXT NOT NULL DEFAULT ''index,follow''',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents DROP CONSTRAINT IF EXISTS documents_robots_check',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD CONSTRAINT documents_robots_check CHECK (robots IN (''index,follow'',''noindex'',''noindex,nofollow''))',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS schema_type TEXT NOT NULL DEFAULT ''WebPage''',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS structured_data JSONB',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
