-- Migration C1a: saldo produsen (ledger) + penyelesaian pengiriman + riwayat persentase bagi hasil.
-- docs/arsitektur-pencairan-produsen.md § 12. Aditif + idempoten. Tenant tanpa tabel dasar DILEWATI (NOTICE).
--  (a) invoice_shipping_lines : buyer_confirmed_at, completed_at, completion_source
--  (b) producer_ledger_entries : buku besar saldo produsen (append-only; unik per item/pengiriman → tak mungkin kredit ganda)
--  (c) producer_percent_history: riwayat perubahan persentase (K20)
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0095_producer_ledger.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;

    IF to_regclass(format('%I.producers', t)) IS NULL OR to_regclass(format('%I.invoices', t)) IS NULL
       OR to_regclass(format('%I.invoice_items', t)) IS NULL OR to_regclass(format('%I.invoice_shipping_lines', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel producers/invoices/invoice_items/invoice_shipping_lines belum lengkap', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS completion_source TEXT', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines DROP CONSTRAINT IF EXISTS invoice_shipping_lines_completion_source_chk', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD CONSTRAINT invoice_shipping_lines_completion_source_chk CHECK (completion_source IS NULL OR completion_source IN (''buyer'',''auto''))', t);
    -- Sapuan harian: pengiriman produsen yang belum selesai
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invoice_shipping_open_producer ON %I.invoice_shipping_lines(shipped_at) WHERE producer_id IS NOT NULL AND completed_at IS NULL', t);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.producer_ledger_entries (
        id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        producer_id      UUID          NOT NULL REFERENCES %I.producers(id) ON DELETE RESTRICT,
        kind             TEXT          NOT NULL CHECK (kind IN ('sale','shipping','refund_debt','transfer_fee','payout','adjustment')),
        amount           NUMERIC(15,2) NOT NULL,
        invoice_id       UUID          REFERENCES %I.invoices(id) ON DELETE RESTRICT,
        invoice_item_id  UUID          REFERENCES %I.invoice_items(id) ON DELETE RESTRICT,
        shipping_line_id UUID          REFERENCES %I.invoice_shipping_lines(id) ON DELETE RESTRICT,
        status           TEXT          NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','paid','void')),
        payout_id        UUID,
        meta             JSONB,
        note             TEXT,
        available_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )$f$, t, t, t, t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_ledger_producer_idx ON %I.producer_ledger_entries(producer_id, status)', t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS producer_ledger_sale_uniq ON %I.producer_ledger_entries(kind, invoice_item_id) WHERE invoice_item_id IS NOT NULL', t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS producer_ledger_ship_uniq ON %I.producer_ledger_entries(kind, shipping_line_id) WHERE shipping_line_id IS NOT NULL AND invoice_item_id IS NULL', t);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.producer_percent_history (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        producer_id UUID         NOT NULL REFERENCES %I.producers(id) ON DELETE CASCADE,
        old_percent NUMERIC(5,2),
        new_percent NUMERIC(5,2) NOT NULL,
        changed_by  UUID,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )$f$, t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_percent_history_producer_idx ON %I.producer_percent_history(producer_id, created_at)', t);

    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
