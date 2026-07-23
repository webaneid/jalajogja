-- Backfill: normalisasi nomor telepon/WhatsApp lama ke format E.164 (+62xxx)
-- Menutup celah data historis dari sebelum audit konsistensi phone/WA (lihat
-- docs/arsitektur-kontak.md) — sejumlah form (akun publik, invoice manual, payment
-- manual, kontak surat, form kontak publik, settings kontak organisasi & toko)
-- sempat menyimpan nomor tanpa normalisasi. Kode aplikasi sudah diperbaiki; migration
-- ini menormalisasi data yang SUDAH tersimpan sebelum perbaikan.
--
-- Idempotent & aman dijalankan berkali-kali — hanya menyentuh baris yang belum
-- diawali "+". COALESCE(..., col) memastikan tidak pernah menulis NULL ke kolom
-- settings.value JSONB NOT NULL — kalau normalize_phone_backfill() balikin NULL
-- (input kosong/tidak valid), nilai asli dipertahankan apa adanya, bukan diganti NULL.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0041_backfill_phone_normalization.sql

-- ─── Helper sementara: replikasi persis logic normalizePhone() (lib/phone.ts) ──────
CREATE OR REPLACE FUNCTION pg_temp.normalize_phone_backfill(raw TEXT)
RETURNS TEXT AS $$
DECLARE
  s TEXT;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := regexp_replace(trim(raw), '[\s\-().]', '', 'g');
  IF s = '' THEN RETURN NULL; END IF;
  IF left(s, 1) = '+'  THEN RETURN s; END IF;
  IF left(s, 1) = '0'  THEN RETURN '+62' || substring(s FROM 2); END IF;
  IF left(s, 2) = '62' THEN RETURN '+' || s; END IF;
  RETURN '+62' || s;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── public.profiles (schema tunggal, bukan per-tenant) ────────────────────────
UPDATE public.profiles
SET    phone = COALESCE(pg_temp.normalize_phone_backfill(phone), phone)
WHERE  phone IS NOT NULL AND phone NOT LIKE '+%';

UPDATE public.profiles
SET    whatsapp = COALESCE(pg_temp.normalize_phone_backfill(whatsapp), whatsapp)
WHERE  whatsapp IS NOT NULL AND whatsapp NOT LIKE '+%';

-- ─── Per-tenant: kolom TEXT langsung ────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  s TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants LOOP
    s := 'tenant_' || r.slug;

    EXECUTE format(
      'UPDATE %I.donations SET donor_phone = COALESCE(pg_temp.normalize_phone_backfill(donor_phone), donor_phone) WHERE donor_phone IS NOT NULL AND donor_phone NOT LIKE ''+%%''',
      s
    );
    EXECUTE format(
      'UPDATE %I.payments SET payer_phone = COALESCE(pg_temp.normalize_phone_backfill(payer_phone), payer_phone) WHERE payer_phone IS NOT NULL AND payer_phone NOT LIKE ''+%%''',
      s
    );
    EXECUTE format(
      'UPDATE %I.invoices SET customer_phone = COALESCE(pg_temp.normalize_phone_backfill(customer_phone), customer_phone) WHERE customer_phone IS NOT NULL AND customer_phone NOT LIKE ''+%%''',
      s
    );
    EXECUTE format(
      'UPDATE %I.event_registrations SET attendee_phone = COALESCE(pg_temp.normalize_phone_backfill(attendee_phone), attendee_phone) WHERE attendee_phone IS NOT NULL AND attendee_phone NOT LIKE ''+%%''',
      s
    );
    EXECUTE format(
      'UPDATE %I.contact_submissions SET phone = COALESCE(pg_temp.normalize_phone_backfill(phone), phone) WHERE phone IS NOT NULL AND phone NOT LIKE ''+%%''',
      s
    );
    EXECUTE format(
      'UPDATE %I.letter_contacts SET phone = COALESCE(pg_temp.normalize_phone_backfill(phone), phone) WHERE phone IS NOT NULL AND phone NOT LIKE ''+%%''',
      s
    );

    -- ─── Per-tenant: settings JSONB (value = JSON string scalar, bukan object) ──
    EXECUTE format(
      'UPDATE %I.settings SET value = to_jsonb(COALESCE(pg_temp.normalize_phone_backfill(value #>> ''{}''), value #>> ''{}'')) ' ||
      'WHERE key = ''contact_phone'' AND "group" = ''contact'' ' ||
      'AND (value #>> ''{}'') IS NOT NULL AND (value #>> ''{}'') NOT LIKE ''+%%''',
      s
    );
    EXECUTE format(
      'UPDATE %I.settings SET value = to_jsonb(COALESCE(pg_temp.normalize_phone_backfill(value #>> ''{}''), value #>> ''{}'')) ' ||
      'WHERE key = ''contact_whatsapp'' AND "group" = ''contact'' ' ||
      'AND (value #>> ''{}'') IS NOT NULL AND (value #>> ''{}'') NOT LIKE ''+%%''',
      s
    );
    EXECUTE format(
      'UPDATE %I.settings SET value = to_jsonb(COALESCE(pg_temp.normalize_phone_backfill(value #>> ''{}''), value #>> ''{}'')) ' ||
      'WHERE key = ''toko_whatsapp'' AND "group" = ''toko'' ' ||
      'AND (value #>> ''{}'') IS NOT NULL AND (value #>> ''{}'') NOT LIKE ''+%%''',
      s
    );
  END LOOP;
END;
$$;

-- pg_temp otomatis hilang di akhir sesi psql — tidak perlu DROP FUNCTION manual.
