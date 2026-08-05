-- Migration: opsi COD (Bayar di Tempat) & Ambil Sendiri, per penjual (tenant + mitra).
-- Lihat docs/arsitektur-billing.md § COD & Ambil Sendiri (rencana:
-- /Users/webane/.claude/plans/binary-questing-river.md).
--
-- mitras: 5 kolom baru (cod_enabled, pickup_enabled, pickup_location_name/address/maps_url) —
-- sejajar rajaongkir_city_id/name yang sudah ada, diedit self-service oleh mitra.
--
-- invoice_shipping_lines: 9 kolom baru (delivery_method, payment_method, pickup snapshot ×3,
-- cod_confirmed_at, cod_payment_id) + 5 kolom courier-only (origin_city_id/name, courier,
-- service, weight_gram) dilonggarkan jadi nullable — tidak relevan untuk baris
-- delivery_method='pickup'.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0058_shipping_cod_pickup.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;

    -- mitras
    EXECUTE format('ALTER TABLE %I.mitras ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN NOT NULL DEFAULT false', t);
    EXECUTE format('ALTER TABLE %I.mitras ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN NOT NULL DEFAULT false', t);
    EXECUTE format('ALTER TABLE %I.mitras ADD COLUMN IF NOT EXISTS pickup_location_name TEXT', t);
    EXECUTE format('ALTER TABLE %I.mitras ADD COLUMN IF NOT EXISTS pickup_address TEXT', t);
    EXECUTE format('ALTER TABLE %I.mitras ADD COLUMN IF NOT EXISTS pickup_maps_url TEXT', t);

    -- invoice_shipping_lines — kolom baru
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT ''courier''', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT ''prepaid''', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS pickup_location_name TEXT', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS pickup_address TEXT', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS pickup_maps_url TEXT', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS cod_confirmed_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS cod_payment_id UUID', t);

    -- invoice_shipping_lines — CHECK constraint untuk 2 kolom enum baru
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines DROP CONSTRAINT IF EXISTS invoice_shipping_lines_delivery_method_check', t);
    EXECUTE format(
      'ALTER TABLE %I.invoice_shipping_lines ADD CONSTRAINT invoice_shipping_lines_delivery_method_check CHECK (delivery_method IN (''courier'',''pickup''))',
      t
    );
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines DROP CONSTRAINT IF EXISTS invoice_shipping_lines_payment_method_check', t);
    EXECUTE format(
      'ALTER TABLE %I.invoice_shipping_lines ADD CONSTRAINT invoice_shipping_lines_payment_method_check CHECK (payment_method IN (''prepaid'',''cod''))',
      t
    );

    -- invoice_shipping_lines — kolom courier-only jadi nullable (baris pickup tidak butuh ini)
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ALTER COLUMN origin_city_id DROP NOT NULL', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ALTER COLUMN origin_city_name DROP NOT NULL', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ALTER COLUMN courier DROP NOT NULL', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ALTER COLUMN service DROP NOT NULL', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ALTER COLUMN weight_gram DROP NOT NULL', t);
  END LOOP;
END;
$$;
