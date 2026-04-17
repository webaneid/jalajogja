-- Migration: Arsitektur TTD Baru (Slot-based Signatures)
-- Jalankan untuk setiap tenant existing yang sudah dibuat sebelum fitur ini
-- Ganti {slug} dengan slug tenant yang sebenarnya, mis: pc-ikpm-jogjakarta
--
-- Cara jalankan:
--   psql DATABASE_URL -v slug=pc-ikpm-jogjakarta -f migration-tandatangan.sql
--
-- Atau jalankan manual di psql:
--   \set slug pc-ikpm-jogjakarta
--   lalu paste blok di bawah

DO $$
DECLARE
  s TEXT := :'slug';   -- ganti :'slug' dengan nama schema jika tidak pakai psql variable
BEGIN

  -- ── 1. Tabel letters: tambah signature_layout + signature_show_date ──────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ('tenant_' || s)
      AND table_name   = 'letters'
      AND column_name  = 'signature_layout'
  ) THEN
    EXECUTE format(
      'ALTER TABLE tenant_%I.letters
         ADD COLUMN signature_layout    TEXT    NOT NULL DEFAULT ''double''
                                                CHECK (signature_layout IN (
                                                  ''single-center'',''single-left'',''single-right'',
                                                  ''double'',''triple-row'',''triple-pyramid'',
                                                  ''double-with-witnesses''
                                                )),
         ADD COLUMN signature_show_date BOOLEAN NOT NULL DEFAULT true',
      s
    );
    RAISE NOTICE 'letters: ditambah signature_layout + signature_show_date untuk tenant %', s;
  ELSE
    RAISE NOTICE 'letters: kolom signature_layout sudah ada, skip untuk tenant %', s;
  END IF;

  -- ── 2. Tabel letter_signatures: tambah kolom baru ──────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ('tenant_' || s)
      AND table_name   = 'letter_signatures'
      AND column_name  = 'slot_order'
  ) THEN
    EXECUTE format(
      'ALTER TABLE tenant_%I.letter_signatures
         ADD COLUMN slot_order                INTEGER     NOT NULL DEFAULT 1,
         ADD COLUMN slot_section              TEXT        NOT NULL DEFAULT ''main''
                                                          CHECK (slot_section IN (''main'',''witnesses'')),
         ADD COLUMN signing_token             TEXT        UNIQUE,
         ADD COLUMN signing_token_expires_at  TIMESTAMPTZ',
      s
    );
    RAISE NOTICE 'letter_signatures: ditambah slot_order, slot_section, signing_token, signing_token_expires_at untuk tenant %', s;
  ELSE
    RAISE NOTICE 'letter_signatures: kolom slot_order sudah ada, skip untuk tenant %', s;
  END IF;

  -- ── 3. Jadikan signed_at + verification_hash nullable (jika belum) ──────
  -- PostgreSQL: DROP NOT NULL aman dijalankan ulang karena idempotent kalau sudah nullable
  EXECUTE format(
    'ALTER TABLE tenant_%I.letter_signatures
       ALTER COLUMN signed_at         DROP NOT NULL,
       ALTER COLUMN verification_hash DROP NOT NULL',
    s
  );
  RAISE NOTICE 'letter_signatures: signed_at + verification_hash dibuat nullable untuk tenant %', s;

END $$;
