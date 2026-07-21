-- Migration: tambah meta_title + meta_desc ke 6 tabel taksonomi/kategori untuk semua tenant existing
-- Fase 2, docs/arsitektur-seo.md § 3.2 — SEO ringan (bukan 11-field penuh) untuk kategori/tag
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0038_taxonomy_seo_columns.sql

DO $$
DECLARE
  r RECORD;
  tbl TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    FOREACH tbl IN ARRAY ARRAY[
      'post_categories', 'post_tags', 'product_categories',
      'event_categories', 'campaign_categories', 'document_categories'
    ]
    LOOP
      EXECUTE format(
        'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS meta_title TEXT',
        'tenant_' || r.slug, tbl
      );
      EXECUTE format(
        'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS meta_desc TEXT',
        'tenant_' || r.slug, tbl
      );
    END LOOP;
  END LOOP;
END;
$$;
