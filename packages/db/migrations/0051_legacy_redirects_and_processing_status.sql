-- Migration: tabel baru legacy_url_redirects (per-tenant) + tambah status 'processing' ke
-- content_import_batch_rows (public schema, sekali jalan) untuk klaim atomic chunked commit.
-- docs/arsitektur-import-export-post-wordpress.md § 5.5, § 13
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0051_legacy_redirects_and_processing_status.sql

-- ── 1. Tambah 'processing' ke CHECK constraint status (public.content_import_batch_rows) ──
ALTER TABLE public.content_import_batch_rows DROP CONSTRAINT content_import_batch_rows_status_check;
ALTER TABLE public.content_import_batch_rows ADD CONSTRAINT content_import_batch_rows_status_check
  CHECK (status IN ('ready', 'review_needed', 'duplicate', 'error', 'processing', 'inserted', 'skipped'));

-- ── 2. Tabel legacy_url_redirects untuk semua tenant existing ─────────────────────────────
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
      CREATE TABLE IF NOT EXISTS %I.legacy_url_redirects (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        old_path    TEXT        NOT NULL UNIQUE,
        redirect_to TEXT        NOT NULL,
        post_id     UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ', s);
  END LOOP;
END;
$$;
