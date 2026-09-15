-- Migration: lokasi Ambil Sendiri override per-produk (khusus produk tenant sendiri, bukan
-- mitra). Fallback ke default toko (/toko/pengaturan) kalau kosong. Lihat
-- docs/arsitektur-billing.md § 14.5. Pola sama 0065_product_origin_city.sql /
-- 0066_product_free_shipping.sql.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0067_product_pickup_location.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS pickup_location_name TEXT', t);
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS pickup_address TEXT', t);
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS pickup_maps_url TEXT', t);
  END LOOP;
END;
$$;
