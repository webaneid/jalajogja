-- Migration: tambah unique_code ke installment_schedules semua tenant existing
-- Kode unik PER TERMIN (beda dari invoices.unique_code yang cuma sekali per invoice) —
-- alat bantu identifikasi manual admin di mutasi rekening untuk transfer cicilan bertahap.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0033_installment_schedule_unique_code.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.installment_schedules ADD COLUMN IF NOT EXISTS unique_code INTEGER',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
