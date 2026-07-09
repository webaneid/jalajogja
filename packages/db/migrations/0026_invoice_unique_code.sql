-- Migration: tambah unique_code ke invoices semua tenant existing
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0026_invoice_unique_code.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS unique_code INTEGER NOT NULL DEFAULT 0',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
