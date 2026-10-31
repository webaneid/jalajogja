-- Migration: foto/bukti resi pengiriman (Portal Produsen S4) — docs/arsitektur-portal-produsen.md § 19.10.
-- Kolom invoice_shipping_lines.tracking_proof_path (nullable). Idempotent; tidak mengubah data.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0078_tracking_proof_path.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;
    IF to_regclass(format('%I.invoice_shipping_lines', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : invoice_shipping_lines belum ada', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS tracking_proof_path TEXT', t);
    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
