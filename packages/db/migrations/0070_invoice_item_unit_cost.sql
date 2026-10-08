-- Migration: snapshot modal per unit di invoice_items (dasar Laporan Produk: keuntungan = pendapatan -
-- modal x qty). Dibekukan saat invoice dibuat supaya edit Harga Dasar kemudian tidak mengubah laba
-- transaksi lama. NULL = tidak diketahui (invoice lama, item non-produk, produk mitra) — laporan
-- memakai modal produk saat ini dan menandainya "estimasi". Lihat docs/arsitektur-product.md
-- § "Laporan Produk".
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0070_invoice_item_unit_cost.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;
    EXECUTE format('ALTER TABLE %I.invoice_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(15,2)', t);
  END LOOP;
END;
$$;
