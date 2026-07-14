-- Migration: tabel baru public.member_media (Media Library Global Cross-Tenant)
-- Schema public (bukan tenant schema) — jalankan sekali, tidak perlu loop tenant untuk CREATE TABLE.
-- Backfill (bagian 2) WAJIB loop semua tenant aktif — sesuaikan daftar slug di bawah.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0028_member_media_global.sql
-- Arsitektur lengkap: docs/arsitektur-medialibrary.md § 3

-- ── 1. Schema ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.member_media (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  -- Bucket MinIO tempat file fisik berada: "tenant-{source_tenant_slug}"
  -- File TIDAK dipindah dari bucket asalnya — hanya metadata yang global.
  source_tenant_slug  TEXT NOT NULL,

  filename            TEXT NOT NULL,
  original_name       TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  size                INTEGER NOT NULL,
  path                TEXT NOT NULL,

  variants            JSONB,
  processing_status   TEXT NOT NULL DEFAULT 'done',
  original_mime       TEXT,
  original_expires_at TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_media_member_id ON public.member_media(member_id);

-- ── 2. Backfill dari tenant_{slug}.media WHERE module='akun' ───────────────────
-- Hanya migrasi METADATA — row lama di tenant.media TIDAK dihapus (arsip/rollback
-- safety net, lihat docs/arsitektur-medialibrary.md § 3 "Keputusan Final" poin 3).
-- Loop otomatis semua tenant aktif via DO block.

DO $$
DECLARE
  tenant_row RECORD;
  schema_name TEXT;
BEGIN
  FOR tenant_row IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    schema_name := 'tenant_' || tenant_row.slug;

    -- Skip kalau tenant belum punya kolom member_id di media (tenant sangat lama / belum migrasi 0009)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = schema_name AND table_name = 'media' AND column_name = 'member_id'
    ) THEN
      EXECUTE format(
        'INSERT INTO public.member_media
           (member_id, source_tenant_slug, filename, original_name, mime_type, size, path,
            variants, processing_status, original_mime, original_expires_at, created_at)
         SELECT member_id::uuid, %L, filename, original_name, mime_type, size, path,
                variants, processing_status, original_mime, original_expires_at, created_at
         FROM %I.media
         WHERE module = ''akun'' AND member_id IS NOT NULL',
        tenant_row.slug, schema_name
      );
    END IF;
  END LOOP;
END $$;
