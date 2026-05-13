-- Migration: Billing tables untuk tenant existing
-- Jalankan: psql $DATABASE_URL -f docs/migration-billing-existing-tenant.sql
-- Ganti "pc-ikpm-jogjakarta" dengan slug tenant jika berbeda.

DO $$
DECLARE
  s TEXT := 'tenant_pc-ikpm-jogjakarta';
BEGIN

  -- 1. Perbaiki CHECK constraint financial_sequences agar termasuk 'invoice'
  --    (DROP + re-ADD agar idempotent)
  EXECUTE format('
    ALTER TABLE %I.financial_sequences
      DROP CONSTRAINT IF EXISTS financial_sequences_type_check
  ', s);
  EXECUTE format('
    ALTER TABLE %I.financial_sequences
      ADD CONSTRAINT financial_sequences_type_check
      CHECK (type IN (''payment'',''disbursement'',''journal'',''invoice''))
  ', s);

  -- 2. installment_plans
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.installment_plans (
      id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      name              TEXT           NOT NULL,
      description       TEXT,
      source_type       TEXT,
      source_id         UUID,
      total_amount      NUMERIC(15,2),
      installment_count INTEGER        NOT NULL,
      interval_days     INTEGER        NOT NULL,
      is_active         BOOLEAN        NOT NULL DEFAULT FALSE,
      is_published      BOOLEAN        NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  ', s);

  -- 3. carts
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.carts (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      session_token  TEXT        NOT NULL UNIQUE,
      member_id      UUID        REFERENCES public.members(id) ON DELETE SET NULL,
      expires_at     TIMESTAMPTZ NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  ', s);

  -- 4. cart_items
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.cart_items (
      id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id    UUID           NOT NULL REFERENCES %I.carts(id) ON DELETE CASCADE,
      item_type  TEXT           NOT NULL
                                CHECK (item_type IN (''product'',''ticket'',''donation'',''custom'')),
      item_id    UUID,
      name       TEXT           NOT NULL,
      unit_price NUMERIC(15,2)  NOT NULL,
      quantity   INTEGER        NOT NULL DEFAULT 1 CHECK (quantity >= 1),
      notes      TEXT,
      sort_order INTEGER        NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  ', s, s);

  -- 5. invoices
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.invoices (
      id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number  TEXT           NOT NULL UNIQUE,
      source_type     TEXT           NOT NULL
                                     CHECK (source_type IN (''cart'',''order'',''donation'',''event_registration'',''manual'')),
      source_id       UUID,
      customer_name   TEXT           NOT NULL,
      customer_phone  TEXT,
      customer_email  TEXT,
      member_id       UUID           REFERENCES public.members(id) ON DELETE SET NULL,
      profile_id      UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
      subtotal        NUMERIC(15,2)  NOT NULL,
      discount        NUMERIC(15,2)  NOT NULL DEFAULT 0,
      total           NUMERIC(15,2)  NOT NULL,
      paid_amount     NUMERIC(15,2)  NOT NULL DEFAULT 0,
      status          TEXT           NOT NULL DEFAULT ''pending''
                                     CHECK (status IN (''draft'',''pending'',''waiting_verification'',''partial'',''paid'',''cancelled'',''overdue'')),
      due_date        DATE,
      notes           TEXT,
      pdf_url         TEXT,
      installment_plan_id UUID       REFERENCES %I.installment_plans(id) ON DELETE SET NULL,
      created_by      UUID           REFERENCES %I.users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  ', s, s, s);

  -- 6. invoice_items
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.invoice_items (
      id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id  UUID           NOT NULL REFERENCES %I.invoices(id) ON DELETE CASCADE,
      item_type   TEXT           NOT NULL
                                 CHECK (item_type IN (''product'',''ticket'',''donation'',''custom'')),
      item_id     UUID,
      name        TEXT           NOT NULL,
      description TEXT,
      unit_price  NUMERIC(15,2)  NOT NULL,
      quantity    INTEGER        NOT NULL DEFAULT 1,
      total       NUMERIC(15,2)  NOT NULL,
      sort_order  INTEGER        NOT NULL DEFAULT 0
    )
  ', s, s);

  -- 7. invoice_payments (junction invoices ↔ payments)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.invoice_payments (
      id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID           NOT NULL REFERENCES %I.invoices(id) ON DELETE CASCADE,
      payment_id UUID           NOT NULL REFERENCES %I.payments(id) ON DELETE CASCADE,
      amount     NUMERIC(15,2)  NOT NULL,
      created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      UNIQUE (invoice_id, payment_id)
    )
  ', s, s, s);

  -- 8. installment_schedules
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.installment_schedules (
      id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id          UUID           NOT NULL REFERENCES %I.invoices(id) ON DELETE CASCADE,
      installment_plan_id UUID           NOT NULL REFERENCES %I.installment_plans(id) ON DELETE RESTRICT,
      term_number         INTEGER        NOT NULL,
      due_date            DATE           NOT NULL,
      amount              NUMERIC(15,2)  NOT NULL,
      payment_id          UUID           REFERENCES %I.payments(id) ON DELETE SET NULL,
      paid_at             TIMESTAMPTZ,
      status              TEXT           NOT NULL DEFAULT ''pending''
                                         CHECK (status IN (''pending'',''paid'',''overdue'')),
      UNIQUE (invoice_id, term_number)
    )
  ', s, s, s, s);

  -- 8b. Tambah installment_plan_id jika invoices sudah ada tapi kolom ini belum
  EXECUTE format('
    ALTER TABLE %I.invoices
      ADD COLUMN IF NOT EXISTS installment_plan_id UUID
        REFERENCES %I.installment_plans(id) ON DELETE SET NULL
  ', s, s);

  -- 9. Indexes
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_carts_session_token           ON %I.carts(session_token)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_carts_member_id               ON %I.carts(member_id)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id            ON %I.cart_items(cart_id)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invoices_status               ON %I.invoices(status)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invoices_member_id            ON %I.invoices(member_id)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invoices_source               ON %I.invoices(source_type, source_id)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id      ON %I.invoice_items(invoice_id)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id   ON %I.invoice_payments(invoice_id)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_installment_schedules_invoice ON %I.installment_schedules(invoice_id)', s);

  RAISE NOTICE 'Migration billing selesai untuk schema: %', s;
END $$;
