-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnosa + template perbaikan: invoice ter-double-konfirmasi
-- (klik "Konfirmasi Pembayaran" 2x → 2 baris payment untuk 1 pembayaran nyata)
--
-- Dibuat: 2026-07-12.
-- BAGIAN 1 (SELECT) — aman dijalankan kapan saja, tidak mengubah data.
-- BAGIAN 2 (UPDATE/DELETE) — JANGAN dijalankan sebelum kamu yakin ID-nya benar.
--   Isi placeholder <INVOICE_ID>, <DUPLICATE_PAYMENT_ID>, <DUPLICATE_TXN_ID>
--   dulu dari hasil BAGIAN 1, baru jalankan satu per satu.
--
-- Cara pakai — jalankan per tenant (ganti tenant_pc_ikpm_jogjakarta):
--   docker compose exec -T postgres psql -U jalakarta -d jalakarta \
--     -v schema=tenant_pc_ikpm_jogjakarta -f docs/diagnostik/diagnosa-double-payment.sql
-- ═══════════════════════════════════════════════════════════════════════════

\set schema_name :schema

-- ═══════════════════════ BAGIAN 1 — DIAGNOSA (SELECT saja) ══════════════════

-- ── 1a. Invoice yang paid_amount-nya MELEBIHI total+kode unik ──────────────
-- Ini sinyal paling kuat: kalau ada, hampir pasti double-konfirmasi.
SELECT
  i.id,
  i.invoice_number,
  i.customer_name,
  i.total,
  i.unique_code,
  (i.total + i.unique_code)              AS amount_due,
  i.paid_amount,
  (i.paid_amount - (i.total + i.unique_code)) AS kelebihan_bayar,
  i.status,
  i.updated_at
FROM :"schema_name".invoices i
WHERE i.paid_amount::numeric > (i.total::numeric + i.unique_code)
ORDER BY i.updated_at DESC;

-- ── 1b. Detail payment per invoice yang muncul di 1a ────────────────────────
-- Ganti <INVOICE_ID> dengan id dari hasil 1a, lalu jalankan baris ini sendiri.
-- Kalau ada 2 baris dengan amount + method + waktu berdekatan (hitungan detik)
-- → itu duplikatnya. Catat id payment yang HENDAK DIHAPUS (sisakan salah satu).
SELECT
  p.id,
  p.number,
  p.amount,
  p.method,
  p.status,
  p.confirmed_by,
  p.confirmed_at,
  p.created_at
FROM :"schema_name".payments p
JOIN :"schema_name".invoice_payments ip ON ip.payment_id = p.id
WHERE ip.invoice_id = '<INVOICE_ID>'
ORDER BY p.created_at ASC;

-- ── 1c. Jurnal (transactions) "Pelunasan invoice ..." yang mungkin dobel ───
-- Kalau invoice sempat sukses jadi "paid" 2x dalam race condition, jurnalnya
-- ikut dobel juga (masing-masing sebesar invoice.total penuh, bukan cuma
-- selisihnya) — cek di sini.
SELECT
  t.id,
  t.date,
  t.description,
  t.reference_number,
  t.created_at,
  te.type,
  te.amount,
  a.name AS account_name
FROM :"schema_name".transactions t
JOIN :"schema_name".transaction_entries te ON te.transaction_id = t.id
JOIN :"schema_name".accounts a ON a.id = te.account_id
WHERE t.description ILIKE '%<INVOICE_NUMBER>%'
ORDER BY t.created_at ASC;

-- ═══════════════ BAGIAN 2 — PERBAIKAN (jalankan SATU PER SATU) ══════════════
-- Jangan jalankan blok ini sebagai satu file utuh. Isi placeholder dulu,
-- jalankan baris per baris, cek hasilnya sebelum lanjut ke baris berikutnya.

-- 2a. Hapus payment duplikat (invoice_payments ikut terhapus otomatis via CASCADE)
-- DELETE FROM :"schema_name".payments WHERE id = '<DUPLICATE_PAYMENT_ID>';

-- 2b. Hapus jurnal duplikat JIKA memang ada 2 entri "Pelunasan invoice X" di 1c
--     (transaction_entries ikut terhapus otomatis via CASCADE)
-- DELETE FROM :"schema_name".transactions WHERE id = '<DUPLICATE_TXN_ID>';

-- 2c. Recompute paid_amount + status invoice dari payment yang TERSISA
-- UPDATE :"schema_name".invoices i
-- SET paid_amount = sub.new_paid,
--     status = CASE
--       WHEN sub.new_paid >= (i.total + i.unique_code) THEN 'paid'
--       WHEN sub.new_paid > 0 THEN 'partial'
--       ELSE 'pending'
--     END,
--     updated_at = NOW()
-- FROM (
--   SELECT COALESCE(SUM(amount), 0) AS new_paid
--   FROM :"schema_name".invoice_payments
--   WHERE invoice_id = '<INVOICE_ID>'
-- ) sub
-- WHERE i.id = '<INVOICE_ID>';

-- 2d. Verifikasi hasil akhir
-- SELECT id, invoice_number, total, unique_code, paid_amount, status FROM :"schema_name".invoices WHERE id = '<INVOICE_ID>';
