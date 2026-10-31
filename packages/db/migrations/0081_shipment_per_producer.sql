-- Migration F1: pengiriman per produsen (ADR-0005, docs/arsitektur-portal-produsen.md § 24).
--   * invoice_items.producer_id           — SNAPSHOT produsen pemilik barang (diisi checkout mulai F2; pesanan lama di-backfill dari produk SAAT INI)
--   * invoice_shipping_lines.producer_id  — produsen yang MENGIRIM paket (NULL = toko/internal atau pengiriman lama yang ambigu)
--   * producer_shipment_invoices.shipping_line_id — pengiriman yang masuk batch (UNIQUE parsial). UNIQUE(invoice_id) SENGAJA belum dilepas
--     (kode lama memakainya sebagai pengaman; dilepas di migration F3 setelah kode beralih).
-- Idempotent (IF NOT EXISTS + UPDATE hanya baris yang masih NULL; aman dijalankan ulang, juga ulang SEBELUM migration F3 untuk menyusul
-- tautan batch yang dibuat kode lama). Aditif: tidak mengubah/menghapus data. WAJIB jalan SEBELUM kode yang memuat Drizzle terbaru
-- (select() penuh akan meminta kolom-kolom ini).
-- Tenant tanpa tabel producers/invoice_items/invoice_shipping_lines/producer_shipment_invoices DILEWATI (NOTICE).
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0081_shipment_per_producer.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
  n_items INT;
  n_lines INT;
  n_links INT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;

    IF to_regclass(format('%I.producers', t)) IS NULL
       OR to_regclass(format('%I.invoice_items', t)) IS NULL
       OR to_regclass(format('%I.invoice_shipping_lines', t)) IS NULL
       OR to_regclass(format('%I.producer_shipment_invoices', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel prasyarat belum ada', t;
      CONTINUE;
    END IF;

    -- 1) Kolom + indeks
    EXECUTE format('ALTER TABLE %1$I.invoice_items ADD COLUMN IF NOT EXISTS producer_id UUID REFERENCES %1$I.producers(id) ON DELETE RESTRICT', t);
    EXECUTE format('ALTER TABLE %1$I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS producer_id UUID REFERENCES %1$I.producers(id) ON DELETE RESTRICT', t);
    EXECUTE format('ALTER TABLE %1$I.producer_shipment_invoices ADD COLUMN IF NOT EXISTS shipping_line_id UUID REFERENCES %1$I.invoice_shipping_lines(id) ON DELETE RESTRICT', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invoice_items_producer ON %I.invoice_items(producer_id) WHERE producer_id IS NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invoice_shipping_producer ON %I.invoice_shipping_lines(producer_id) WHERE producer_id IS NOT NULL', t);

    -- 2) Backfill invoice_items.producer_id — hanya item produk penjual tenant; produk simple (item_id = produk) lalu variasi (item_id = variasi)
    EXECUTE format($f$
      UPDATE %1$I.invoice_items ii SET producer_id = p.producer_id
      FROM %1$I.products p
      WHERE ii.item_type = 'product' AND ii.seller_type = 'tenant' AND ii.producer_id IS NULL
        AND p.producer_id IS NOT NULL AND ii.item_id = p.id
    $f$, t);
    GET DIAGNOSTICS n_items = ROW_COUNT;
    EXECUTE format($f$
      UPDATE %1$I.invoice_items ii SET producer_id = p.producer_id
      FROM %1$I.product_variations v JOIN %1$I.products p ON p.id = v.product_id
      WHERE ii.item_type = 'product' AND ii.seller_type = 'tenant' AND ii.producer_id IS NULL
        AND p.producer_id IS NOT NULL AND ii.item_id = v.id
    $f$, t);

    -- 3) Backfill invoice_shipping_lines.producer_id — HANYA bila tepat SATU baris tenant di invoice itu DAN semua item produk
    --    penjual tenant di invoice itu milik satu produsen yang sama (tak satu pun tanpa produsen). Selainnya dibiarkan NULL (ambigu → campuran).
    EXECUTE format($f$
      UPDATE %1$I.invoice_shipping_lines l SET producer_id = x.pid
      FROM (
        SELECT ii.invoice_id, min(ii.producer_id::text)::uuid AS pid
        FROM %1$I.invoice_items ii
        WHERE ii.item_type = 'product' AND ii.seller_type = 'tenant'
        GROUP BY ii.invoice_id
        HAVING count(*) = count(ii.producer_id) AND count(DISTINCT ii.producer_id) = 1
      ) x
      WHERE l.invoice_id = x.invoice_id AND l.seller_type = 'tenant' AND l.producer_id IS NULL
        AND (SELECT count(*) FROM %1$I.invoice_shipping_lines z WHERE z.invoice_id = l.invoice_id AND z.seller_type = 'tenant') = 1
    $f$, t);
    GET DIAGNOSTICS n_lines = ROW_COUNT;

    -- 4) Backfill tautan batch → pengiriman (invoice dengan tepat satu baris tenant)
    EXECUTE format($f$
      UPDATE %1$I.producer_shipment_invoices psi SET shipping_line_id = l.id
      FROM %1$I.invoice_shipping_lines l
      WHERE l.invoice_id = psi.invoice_id AND l.seller_type = 'tenant' AND psi.shipping_line_id IS NULL
        AND (SELECT count(*) FROM %1$I.invoice_shipping_lines z WHERE z.invoice_id = psi.invoice_id AND z.seller_type = 'tenant') = 1
    $f$, t);
    GET DIAGNOSTICS n_links = ROW_COUNT;

    -- 5) UNIQUE parsial (setelah backfill; satu pengiriman paling banyak di satu batch)
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS producer_shipment_invoices_line_uniq ON %I.producer_shipment_invoices(shipping_line_id) WHERE shipping_line_id IS NOT NULL', t);

    RAISE NOTICE 'OK % : item terisi %, pengiriman terisi %, tautan batch terisi %', t, n_items, n_lines, n_links;
  END LOOP;
END $$;
