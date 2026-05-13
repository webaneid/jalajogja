-- Migration: Member Media Library — tambah member_id + update module constraint
-- Jalankan per tenant existing:
-- psql $DATABASE_URL -f docs/migration-member-media.sql
-- Ganti {slug} dengan slug tenant aktual (contoh: pc-ikpm-jogjakarta)

-- Contoh untuk tenant pc-ikpm-jogjakarta:
-- \set s 'tenant_pc-ikpm-jogjakarta'

-- 1. Tambah kolom member_id (TEXT, nullable)
ALTER TABLE "tenant_pc-ikpm-jogjakarta".media
  ADD COLUMN IF NOT EXISTS member_id TEXT;

-- 2. Drop constraint module lama + buat ulang dengan 'akun'
ALTER TABLE "tenant_pc-ikpm-jogjakarta".media
  DROP CONSTRAINT IF EXISTS media_module_check;

ALTER TABLE "tenant_pc-ikpm-jogjakarta".media
  ADD CONSTRAINT media_module_check
  CHECK (module IN ('website','members','letters','shop','general','akun'));

-- 3. Index partial untuk query per member (O(1) lookup)
CREATE INDEX IF NOT EXISTS idx_media_member_id
  ON "tenant_pc-ikpm-jogjakarta".media(member_id)
  WHERE member_id IS NOT NULL;
