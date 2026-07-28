-- Migration: tabel baru content_import_batches/content_import_batch_rows (public schema,
-- sekali jalan) + kolom import_batch_id di posts/pages/media untuk semua tenant existing.
-- docs/arsitektur-import-export-post-wordpress.md § 14.1, § 14.2
-- Tenant baru sudah otomatis dapat kolom import_batch_id via create-tenant-schema.ts.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0050_content_import_wordpress.sql

-- ── 1. Tabel public (sekali jalan, bukan per-tenant) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_import_batches (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source              TEXT        NOT NULL CHECK (source IN ('wxr_upload', 'rest_api_pull')),
  source_url          TEXT,
  file_name           TEXT,
  imported_by_user_id TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'committing', 'committed')),
  total_rows          INTEGER     NOT NULL DEFAULT 0,
  processed_rows      INTEGER     NOT NULL DEFAULT 0,
  inserted_rows       INTEGER     NOT NULL DEFAULT 0,
  skipped_rows        INTEGER     NOT NULL DEFAULT 0,
  error_rows          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.content_import_batch_rows (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            UUID        NOT NULL REFERENCES public.content_import_batches(id) ON DELETE CASCADE,
  row_number          INTEGER     NOT NULL,
  content_type        TEXT        NOT NULL CHECK (content_type IN ('post', 'page')),
  title               TEXT,
  wp_post_id          INTEGER,
  status              TEXT        NOT NULL
                                  CHECK (status IN ('ready', 'review_needed', 'duplicate', 'error', 'inserted', 'skipped')),
  created_content_id  UUID,
  data                JSONB       NOT NULL,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Kolom import_batch_id di posts/pages/media untuk semua tenant existing ─────────────
DO $$
DECLARE
  r RECORD;
  s TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    s := 'tenant_' || r.slug;

    EXECUTE format('ALTER TABLE %I.posts ADD COLUMN IF NOT EXISTS import_batch_id UUID', s);
    EXECUTE format('ALTER TABLE %I.pages ADD COLUMN IF NOT EXISTS import_batch_id UUID', s);
    EXECUTE format('ALTER TABLE %I.media ADD COLUMN IF NOT EXISTS import_batch_id UUID', s);
  END LOOP;
END;
$$;
