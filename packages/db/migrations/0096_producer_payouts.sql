-- Migration C1b–C3: akun Hutang Produsen, TAHAN pencairan, rekening produsen, pengajuan pencairan.
-- docs/arsitektur-pencairan-produsen.md § 13. Aditif + idempoten. Tenant tanpa tabel dasar DILEWATI (NOTICE).
--  (a) accounts: '2300 Hutang Produsen' (kewajiban) bila belum ada
--  (b) invoice_shipping_lines: payout_hold_at/reason/by (TAHAN pencairan)
--  (c) producer_bank_accounts, producer_payouts, producer_payout_lines
-- WAJIB sesudah 0095.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0096_producer_payouts.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;

    IF to_regclass(format('%I.producers', t)) IS NULL OR to_regclass(format('%I.invoice_shipping_lines', t)) IS NULL
       OR to_regclass(format('%I.producer_ledger_entries', t)) IS NULL OR to_regclass(format('%I.accounts', t)) IS NULL
       OR to_regclass(format('%I.transactions', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel dasar / 0095 belum lengkap', t;
      CONTINUE;
    END IF;

    EXECUTE format($f$INSERT INTO %I.accounts (code, name, type) VALUES ('2300', 'Hutang Produsen', 'liability') ON CONFLICT (code) DO NOTHING$f$, t);

    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS payout_hold_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS payout_hold_reason TEXT', t);
    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS payout_hold_by UUID', t);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.producer_bank_accounts (
        id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        producer_id        UUID        NOT NULL REFERENCES %I.producers(id) ON DELETE RESTRICT,
        bank_code          TEXT        NOT NULL,
        bank_name          TEXT        NOT NULL,
        account_number_enc TEXT        NOT NULL,
        account_last4      TEXT        NOT NULL,
        account_holder     TEXT        NOT NULL,
        effective_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        replaced_at        TIMESTAMPTZ,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )$f$, t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_bank_accounts_producer_idx ON %I.producer_bank_accounts(producer_id, effective_at)', t);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.producer_payouts (
        id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        number             TEXT          NOT NULL UNIQUE,
        producer_id        UUID          NOT NULL REFERENCES %I.producers(id) ON DELETE RESTRICT,
        status             TEXT          NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','paid','rejected','cancelled')),
        credits_total      NUMERIC(15,2) NOT NULL,
        debt_total         NUMERIC(15,2) NOT NULL DEFAULT 0,
        adjustment_total   NUMERIC(15,2) NOT NULL DEFAULT 0,
        subtotal           NUMERIC(15,2) NOT NULL,
        transfer_fee       NUMERIC(15,2) NOT NULL DEFAULT 0,
        net_amount         NUMERIC(15,2),
        bank_code          TEXT          NOT NULL,
        bank_name          TEXT          NOT NULL,
        account_number_enc TEXT          NOT NULL,
        account_last4      TEXT          NOT NULL,
        account_holder     TEXT          NOT NULL,
        requested_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        approved_by        UUID,
        approved_at        TIMESTAMPTZ,
        rejected_reason    TEXT,
        paid_by            UUID,
        paid_at            TIMESTAMPTZ,
        source_bank_label  TEXT,
        proof_media_id     UUID,
        proof_url          TEXT,
        transaction_id     UUID          REFERENCES %I.transactions(id) ON DELETE SET NULL,
        note               TEXT,
        created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )$f$, t, t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_payouts_producer_idx ON %I.producer_payouts(producer_id, requested_at)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_payouts_status_idx ON %I.producer_payouts(status)', t);
    EXECUTE format($f$CREATE UNIQUE INDEX IF NOT EXISTS producer_payouts_active_uniq ON %I.producer_payouts(producer_id) WHERE status IN ('requested','approved')$f$, t);

    -- Pengaman DB lapis kedua untuk invarian uang (selain kode aplikasi)
    EXECUTE format('ALTER TABLE %I.producer_payouts DROP CONSTRAINT IF EXISTS producer_payouts_money_chk', t);
    EXECUTE format($f$ALTER TABLE %I.producer_payouts ADD CONSTRAINT producer_payouts_money_chk CHECK (
      subtotal > 0 AND transfer_fee >= 0 AND (status <> 'paid' OR (proof_url IS NOT NULL AND proof_media_id IS NOT NULL AND transaction_id IS NOT NULL AND net_amount IS NOT NULL AND transfer_fee < subtotal AND net_amount = subtotal - transfer_fee))
    )$f$, t);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.producer_payout_lines (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        payout_id         UUID          NOT NULL REFERENCES %I.producer_payouts(id) ON DELETE CASCADE,
        shipping_line_id  UUID,
        label             TEXT          NOT NULL,
        product_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
        shipping_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
        adjustment_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        total             NUMERIC(15,2) NOT NULL,
        sort_order        INTEGER       NOT NULL DEFAULT 0
      )$f$, t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_payout_lines_payout_idx ON %I.producer_payout_lines(payout_id)', t);

    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
