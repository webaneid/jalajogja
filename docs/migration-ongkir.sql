-- Migration: Add ongkir columns ke tenant yang sudah ada
-- Jalankan per tenant: ganti {slug} dengan slug tenant (misal: pc-ikpm-jogjakarta)

-- 1. Tabel ref_rajaongkir_cities (public schema)
CREATE TABLE IF NOT EXISTS public.ref_rajaongkir_cities (
  city_id     INTEGER  PRIMARY KEY,
  province_id INTEGER  NOT NULL,
  city_name   TEXT     NOT NULL,
  postal_code TEXT,
  type        TEXT     NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ref_rajaongkir_cities_province ON public.ref_rajaongkir_cities(province_id);
CREATE INDEX IF NOT EXISTS idx_ref_rajaongkir_cities_name     ON public.ref_rajaongkir_cities(city_name);

-- 2. Tambah kolom ke mitras
ALTER TABLE "tenant_{slug}".mitras
  ADD COLUMN IF NOT EXISTS rajaongkir_city_id   INTEGER,
  ADD COLUMN IF NOT EXISTS rajaongkir_city_name TEXT;

-- 3. Tambah weight_gram ke products
ALTER TABLE "tenant_{slug}".products
  ADD COLUMN IF NOT EXISTS weight_gram INTEGER;

-- 4. Tambah weight_gram ke product_variations
ALTER TABLE "tenant_{slug}".product_variations
  ADD COLUMN IF NOT EXISTS weight_gram INTEGER;

-- 5. Tambah kolom shipping ke invoices
ALTER TABLE "tenant_{slug}".invoices
  ADD COLUMN IF NOT EXISTS shipping_total    NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_address  TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city_id  INTEGER,
  ADD COLUMN IF NOT EXISTS shipping_city_name TEXT;

-- 6. Tambah seller_type + seller_id ke invoice_items
ALTER TABLE "tenant_{slug}".invoice_items
  ADD COLUMN IF NOT EXISTS seller_type TEXT NOT NULL DEFAULT 'tenant'
    CHECK (seller_type IN ('tenant','mitra')),
  ADD COLUMN IF NOT EXISTS seller_id UUID;

-- 7. Buat tabel invoice_shipping_lines
CREATE TABLE IF NOT EXISTS "tenant_{slug}".invoice_shipping_lines (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID           NOT NULL REFERENCES "tenant_{slug}".invoices(id) ON DELETE CASCADE,
  seller_type      TEXT           NOT NULL CHECK (seller_type IN ('tenant','mitra')),
  seller_id        UUID,
  seller_name      TEXT           NOT NULL,
  origin_city_id   INTEGER        NOT NULL,
  origin_city_name TEXT           NOT NULL,
  courier          TEXT           NOT NULL,
  service          TEXT           NOT NULL,
  service_desc     TEXT,
  etd              TEXT,
  weight_gram      INTEGER        NOT NULL,
  cost             NUMERIC(15,2)  NOT NULL,
  tracking_number  TEXT,
  shipped_at       TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  status           TEXT           NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','shipped','delivered')),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_shipping_invoice_id ON "tenant_{slug}".invoice_shipping_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_shipping_seller     ON "tenant_{slug}".invoice_shipping_lines(seller_type, seller_id);
