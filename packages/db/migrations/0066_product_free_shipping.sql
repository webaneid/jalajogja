-- Migration: gratis ongkir per produk (khusus produk tenant sendiri, bukan mitra) + kolom
-- diskon-tersimpan di invoice_shipping_lines. Lihat docs/arsitektur-addon-ongkir.md §
-- "RENCANA — Gratis Ongkir per Produk". Pola sama 0065_product_origin_city.sql.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0066_product_free_shipping.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;

    -- products
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS free_shipping_mode TEXT NOT NULL DEFAULT ''none''', t);
    EXECUTE format('ALTER TABLE %I.products DROP CONSTRAINT IF EXISTS products_free_shipping_mode_check', t);
    EXECUTE format(
      'ALTER TABLE %I.products ADD CONSTRAINT products_free_shipping_mode_check CHECK (free_shipping_mode IN (''none'',''all'',''regions''))',
      t
    );
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS free_shipping_provinces JSONB', t);
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS free_shipping_cities JSONB', t);

    -- invoice_shipping_lines
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS free_shipping_discount NUMERIC(15,2)', t);
  END LOOP;
END;
$$;
