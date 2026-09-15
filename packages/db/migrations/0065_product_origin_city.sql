-- Migration: kota asal pengiriman override per-produk (khusus produk tenant sendiri, bukan
-- mitra). Lihat docs/arsitektur-addon-ongkir.md § "RENCANA — Kota Asal Pengiriman per Produk
-- Tenant". Pola sama 0058_shipping_cod_pickup.sql.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0065_product_origin_city.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS origin_city_id INTEGER', t);
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS origin_city_name TEXT', t);
  END LOOP;
END;
$$;
