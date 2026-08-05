-- Migration: product_variations.price jadi nullable — kosong berarti "pakai harga produk
-- induk" (fallback resolve-time), bukan lagi wajib diisi per variasi. Selaras dengan
-- weight_gram yang memang sudah lama nullable dengan semantik override yang sama.
-- Lihat docs/arsitektur-billing.md § "Fallback Harga/Berat/SKU per Variasi".
--
-- saveVariationsAction juga direstrukturisasi jadi diff-based upsert (bukan delete-all+
-- insert-all lagi) supaya UUID variasi existing dipertahankan lintas save — mencegah
-- cart_items.item_id (product_variations.id) jadi orphan setiap kali admin resave produk.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0059_product_variation_price_nullable.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;
    EXECUTE format('ALTER TABLE %I.product_variations ALTER COLUMN price DROP NOT NULL', t);
  END LOOP;
END;
$$;
