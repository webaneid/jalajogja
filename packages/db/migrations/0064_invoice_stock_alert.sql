-- Migration: tambah stock_alert_sent_at ke invoices semua tenant existing
-- Cap kirim notifikasi "stok habis" sekali per invoice (bukan tiap cron jalan). Lihat
-- docs/arsitektur-stok.md.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0064_invoice_stock_alert.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS stock_alert_sent_at TIMESTAMPTZ',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
