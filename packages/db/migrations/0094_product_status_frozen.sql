-- Migration 0094: status produk baru 'frozen' (dibekukan admin) — docs/arsitektur-produk-produsen.md § 14 (K30).
-- CHECK inline pada products.status (tanpa nama eksplisit) diganti dengan versi yang menerima 'frozen'.
-- Idempotent. Tenant tanpa tabel products DILEWATI. Data lama tidak berubah.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0094_product_status_frozen.sql

DO $$
DECLARE
  r RECORD;
  c RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;

    IF to_regclass(format('%I.products', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel products belum ada', t;
      CONTINUE;
    END IF;

    -- Buang CHECK lama yang membatasi status produk (nama bawaan products_status_check, atau apa pun yang memuat 'archived' & 'draft').
    FOR c IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = to_regclass(format('%I.products', t)) AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%' AND pg_get_constraintdef(oid) ILIKE '%archived%'
        AND pg_get_constraintdef(oid) NOT ILIKE '%published%'
    LOOP
      EXECUTE format('ALTER TABLE %I.products DROP CONSTRAINT %I', t, c.conname);
    END LOOP;

    EXECUTE format('ALTER TABLE %I.products ADD CONSTRAINT products_status_check CHECK (status IN (''active'',''draft'',''archived'',''frozen''))', t);
    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
