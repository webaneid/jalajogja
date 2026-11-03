-- Migration: tandai pesanan produsen MODEL LAMA (sebelum sistem bagi hasil) agar tidak pernah dikreditkan/dicairkan lewat sistem baru.
-- Konteks: sapuan pertama di server melaporkan ratusan pengiriman "persentase_tidak_tercatat" — ternyata penjualan nyata Agustus–Oktober 2026
-- saat "produsen" hanya label pemasok (harga dasar/modal), tanpa persentase bagi hasil. docs/arsitektur-pencairan-produsen.md § 13.8.
-- Aditif + idempoten. Hanya menyentuh kolom baru payout_legacy. Aturan: pengiriman produsen BELUM selesai dan memuat item produsen tanpa persentase
-- pada invoice yang dibuat SEBELUM 2026-11-03 (sistem snapshot persentase berjalan sejak migration 0093).
-- Bisa dibatalkan per pengiriman: UPDATE ... SET payout_legacy = false.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0097_producer_payout_legacy.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
  n INT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;
    IF to_regclass(format('%I.invoice_shipping_lines', t)) IS NULL OR to_regclass(format('%I.invoice_items', t)) IS NULL
       OR to_regclass(format('%I.invoices', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel dasar belum lengkap', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.invoice_shipping_lines ADD COLUMN IF NOT EXISTS payout_legacy BOOLEAN NOT NULL DEFAULT FALSE', t);

    EXECUTE format($f$
      UPDATE %I.invoice_shipping_lines sl SET payout_legacy = TRUE
      FROM %I.invoices i
      WHERE i.id = sl.invoice_id AND sl.producer_id IS NOT NULL AND sl.completed_at IS NULL AND sl.payout_legacy = FALSE
        AND i.created_at < TIMESTAMPTZ '2026-11-03 00:00:00+07'
        AND EXISTS (SELECT 1 FROM %I.invoice_items ii WHERE ii.invoice_id = sl.invoice_id AND ii.producer_id = sl.producer_id
                    AND ii.item_type = 'product' AND ii.producer_share_percent IS NULL)$f$, t, t, t);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'OK % : % pengiriman ditandai model lama', t, n;
  END LOOP;
END $$;
