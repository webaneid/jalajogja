-- Migration F3: batch memuat PENGIRIMAN (ADR-0005, docs/arsitektur-portal-produsen.md § 24.7).
--   * Isi ulang producer_shipment_invoices.shipping_line_id yang masih NULL (tautan yang dibuat kode LAMA setelah migration 0081):
--     hanya bila invoice punya tepat SATU baris pengiriman tenant (tak ambigu).
--   * Lepas UNIQUE(invoice_id): satu invoice kini bisa masuk lebih dari satu batch (satu per pengiriman/produsen).
--     Pengaman penggantinya: UNIQUE parsial pada shipping_line_id (dibuat di 0081).
--   * Indeks biasa pada invoice_id (pencarian).
--   * shipping_line_id TETAP nullable di DB (kode lama yang masih berjalan sebentar tidak mengisinya); kode F3 selalu mengisinya.
-- Idempotent. Aman dijalankan SEBELUM kode F3 (kode lama tetap jalan: hanya kehilangan pengaman UNIQUE(invoice_id), yang masih
-- dijaga compare-and-set status pending→processing). Jalankan ULANG sekali setelah restart kode F3 untuk menyusul tautan yang
-- sempat dibuat kode lama di sela-sela (aman, idempotent).
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0082_batch_per_shipment.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
  n_links INT;
  n_null INT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;

    IF to_regclass(format('%I.producer_shipment_invoices', t)) IS NULL
       OR to_regclass(format('%I.invoice_shipping_lines', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel prasyarat belum ada', t;
      CONTINUE;
    END IF;

    -- shipping_line_id harus ada (migration 0081)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = t AND table_name = 'producer_shipment_invoices' AND column_name = 'shipping_line_id') THEN
      RAISE NOTICE 'LEWATI % : kolom shipping_line_id belum ada — jalankan 0081 dulu', t;
      CONTINUE;
    END IF;

    EXECUTE format($f$
      UPDATE %1$I.producer_shipment_invoices psi SET shipping_line_id = l.id
      FROM %1$I.invoice_shipping_lines l, %1$I.producer_shipment_batches b
      WHERE b.id = psi.batch_id AND l.producer_id = b.producer_id  -- produsen pengiriman HARUS = produsen batch (audit F3 L1/L2)
        AND l.invoice_id = psi.invoice_id AND l.seller_type = 'tenant' AND psi.shipping_line_id IS NULL
        AND (SELECT count(*) FROM %1$I.invoice_shipping_lines z WHERE z.invoice_id = psi.invoice_id AND z.seller_type = 'tenant') = 1
    $f$, t);
    GET DIAGNOSTICS n_links = ROW_COUNT;

    EXECUTE format('ALTER TABLE %I.producer_shipment_invoices DROP CONSTRAINT IF EXISTS producer_shipment_invoices_invoice_uniq', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_shipment_invoices_invoice_idx ON %I.producer_shipment_invoices(invoice_id)', t);

    EXECUTE format('SELECT count(*) FROM %I.producer_shipment_invoices WHERE shipping_line_id IS NULL', t) INTO n_null;
    RAISE NOTICE 'OK % : tautan terisi %, masih tanpa pengiriman % (ambigu/akan diabaikan kode F3)', t, n_links, n_null;
  END LOOP;
END $$;
