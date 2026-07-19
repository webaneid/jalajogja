-- Migration: Diskon & Voucher — Fase 1 (berkode, target tenant-only, lihat docs/arsitektur-voucher.md)
-- Menambah tabel vouchers + voucher_redemptions, dan kolom baru di invoices/invoice_items,
-- untuk semua tenant existing. Tenant baru sudah otomatis dapat ini via create-tenant-schema.ts.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0034_vouchers.sql

DO $$
DECLARE
  r RECORD;
  s TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    s := 'tenant_' || r.slug;

    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.vouchers (
        id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        code                     TEXT           NOT NULL UNIQUE,
        name                     TEXT           NOT NULL,
        description              TEXT,
        discount_type            TEXT           NOT NULL
                                                 CHECK (discount_type IN (''percentage'',''fixed'')),
        discount_value           NUMERIC(15,2)  NOT NULL,
        target_type              TEXT           NOT NULL
                                                 CHECK (target_type IN (''product'',''ticket'',''donation'')),
        target_item_ids          JSONB          NOT NULL DEFAULT ''[]'',
        usage_limit              INTEGER,
        usage_limit_per_customer INTEGER,
        used_count               INTEGER        NOT NULL DEFAULT 0,
        restrict_phone           TEXT,
        restrict_email           TEXT,
        valid_from               TIMESTAMPTZ,
        valid_until              TIMESTAMPTZ,
        is_active                BOOLEAN        NOT NULL DEFAULT TRUE,
        created_by               UUID           REFERENCES %I.users(id) ON DELETE SET NULL,
        created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )', s, s);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_vouchers_code ON %I.vouchers(code)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_vouchers_is_active ON %I.vouchers(is_active)', s);

    EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES %I.vouchers(id) ON DELETE SET NULL', s, s);
    EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS voucher_code TEXT', s);
    EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS voucher_discount_total NUMERIC(15,2) NOT NULL DEFAULT 0', s);

    EXECUTE format('ALTER TABLE %I.invoice_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0', s);
    EXECUTE format('ALTER TABLE %I.invoice_items ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES %I.vouchers(id) ON DELETE SET NULL', s, s);

    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.voucher_redemptions (
        id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_id     UUID           NOT NULL REFERENCES %I.vouchers(id) ON DELETE CASCADE,
        invoice_id     UUID           NOT NULL REFERENCES %I.invoices(id) ON DELETE CASCADE,
        customer_phone TEXT,
        customer_email TEXT,
        discount_total NUMERIC(15,2)  NOT NULL,
        cancelled_at   TIMESTAMPTZ,
        created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )', s, s, s);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher ON %I.voucher_redemptions(voucher_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_invoice ON %I.voucher_redemptions(invoice_id)', s);
  END LOOP;
END;
$$;
