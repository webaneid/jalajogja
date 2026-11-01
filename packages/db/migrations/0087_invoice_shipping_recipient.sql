-- Migration P3: snapshot penerima paket di invoice — docs/arsitektur-alamat.md § 18.
-- NULL = penerima sama dengan pembeli (perilaku lama; invoice lama TIDAK berubah). Aditif + idempotent.
-- Tenant tanpa tabel invoices DILEWATI (NOTICE). WAJIB jalan SEBELUM deploy kode yang memuat Drizzle terbaru.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0087_invoice_shipping_recipient.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;
    IF to_regclass(format('%I.invoices', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel invoices belum ada', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS shipping_recipient_name TEXT', t);
    EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS shipping_recipient_phone TEXT', t);
    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
