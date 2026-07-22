-- Migration: tambah payer_phone + payer_email ke payments semua tenant existing
-- Mendukung fitur autocomplete anggota di /finance/pemasukan/new — saat admin pilih
-- nama dari anggota, telepon+email ikut terisi otomatis dan tersimpan di sini.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0040_payment_payer_contact.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.payments ADD COLUMN IF NOT EXISTS payer_phone TEXT',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.payments ADD COLUMN IF NOT EXISTS payer_email TEXT',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
