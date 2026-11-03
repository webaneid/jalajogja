-- Migration V1: Voucher dua jenis + snapshot bagi hasil — docs/arsitektur-produk-produsen.md § 4, K23–K25.
--  (a) vouchers.owner_producer_id  : NULL = Promo Tenant (admin); terisi = Promo Produsen (dibuat & ditanggung produsen itu)
--  (b) invoice_items.producer_share_percent / discount_funded_by : SNAPSHOT saat checkout untuk bagi hasil & pencairan nanti
-- Aditif + idempotent. Baris/voucher LAMA tidak berubah perilaku (semua NULL = Promo Tenant, tanpa snapshot).
-- Tenant tanpa tabel vouchers/producers DILEWATI (NOTICE).
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0093_voucher_owner_and_share_snapshot.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;

    IF to_regclass(format('%I.vouchers', t)) IS NULL OR to_regclass(format('%I.producers', t)) IS NULL
       OR to_regclass(format('%I.invoice_items', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel vouchers/producers/invoice_items belum lengkap', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.vouchers ADD COLUMN IF NOT EXISTS owner_producer_id UUID', t);
    -- FK RESTRICT: produsen yang masih memiliki voucher tidak bisa terhapus diam-diam. Idempotent: DROP lalu ADD.
    EXECUTE format('ALTER TABLE %I.vouchers DROP CONSTRAINT IF EXISTS vouchers_owner_producer_id_fkey', t);
    EXECUTE format('ALTER TABLE %I.vouchers ADD CONSTRAINT vouchers_owner_producer_id_fkey FOREIGN KEY (owner_producer_id) REFERENCES %I.producers(id) ON DELETE RESTRICT', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_vouchers_owner_producer ON %I.vouchers(owner_producer_id) WHERE owner_producer_id IS NOT NULL', t);

    EXECUTE format('ALTER TABLE %I.invoice_items ADD COLUMN IF NOT EXISTS producer_share_percent NUMERIC(5,2)', t);
    EXECUTE format('ALTER TABLE %I.invoice_items ADD COLUMN IF NOT EXISTS discount_funded_by TEXT', t);
    EXECUTE format('ALTER TABLE %I.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_discount_funded_by_chk', t);
    EXECUTE format('ALTER TABLE %I.invoice_items ADD CONSTRAINT invoice_items_discount_funded_by_chk CHECK (discount_funded_by IS NULL OR discount_funded_by IN (''tenant'',''producer''))', t);

    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
