-- Migration: batch pengiriman produsen (Portal Produsen S3) — docs/arsitektur-portal-produsen.md § 19.8.
-- Dua tabel baru per tenant + kolom invoice_shipping_lines.processing_notified_at (cegah spam notifikasi 'Diproses'). Idempotent (IF NOT EXISTS). Tenant tanpa tabel `producers`/`invoices` DILEWATI (NOTICE).
-- Tidak mengubah data yang ada.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0077_producer_shipment_batches.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;

    IF to_regclass(format('%I.producers', t)) IS NULL OR to_regclass(format('%I.invoices', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel producers/invoices belum ada', t;
      CONTINUE;
    END IF;

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %1$I.producer_shipment_batches (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        producer_id   UUID        NOT NULL REFERENCES %1$I.producers(id) ON DELETE RESTRICT,
        name          TEXT        NOT NULL,
        shipping_date DATE        NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT producer_shipment_batches_name_uniq UNIQUE (producer_id, name)
      )
    $f$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_shipment_batches_producer_idx ON %I.producer_shipment_batches(producer_id)', t);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %1$I.producer_shipment_invoices (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id   UUID        NOT NULL REFERENCES %1$I.producer_shipment_batches(id) ON DELETE RESTRICT,
        invoice_id UUID        NOT NULL REFERENCES %1$I.invoices(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT producer_shipment_invoices_invoice_uniq UNIQUE (invoice_id)
      )
    $f$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_shipment_invoices_batch_idx ON %I.producer_shipment_invoices(batch_id)', t);

    IF to_regclass(format('%I.invoice_shipping_lines', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS processing_notified_at TIMESTAMPTZ', t);
    END IF;

    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
