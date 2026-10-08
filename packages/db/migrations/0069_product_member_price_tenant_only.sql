-- Migration: flag "Harga Anggota khusus anggota tenant ini" per produk (model harga baru:
-- Dasar/Publik/Anggota). false (default) = Harga Anggota berlaku untuk semua anggota IKPM
-- terdaftar; true = hanya anggota tenant ini. Lihat docs/arsitektur-product.md
-- § "Model Harga Baru". Produk lama TIDAK diubah datanya (keputusan user 2026-10-09).
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0069_product_member_price_tenant_only.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS member_price_tenant_only BOOLEAN NOT NULL DEFAULT FALSE', t);
  END LOOP;
END;
$$;
