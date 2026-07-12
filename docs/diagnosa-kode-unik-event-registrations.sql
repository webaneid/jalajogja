-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnosa: dampak bug kode unik hilang + duplikat event_registrations
-- Dibuat: 2026-07-12. READ-ONLY — tidak ada UPDATE/DELETE di file ini.
--
-- Latar belakang bug (lihat CLAUDE.md § lessons event/billing untuk detail):
-- 1. submitPaymentProofAction tidak menyertakan uniqueCode saat menghitung
--    nominal payment yang dicatat → invoice yang dibayar via upload bukti
--    (bukan konfirmasi manual admin) selalu kurang persis sejumlah kode unik
--    → status nyangkut "partial" alih-alih "paid".
-- 2. Karena auto-create event_registrations dari tiket cart hanya jalan saat
--    status jadi "paid", peserta yang beli tiket via cart tidak pernah
--    tercatat di event_registrations selama invoice masih "partial".
-- 3. Loop auto-create tiket sempat jalan tanpa guard sourceType → invoice
--    dari alur lama (registerForEventAction, sourceType='event_registration')
--    yang sempat lunas via jalur ini bisa punya entri DUPLIKAT dengan nama
--    = nama tiket (bukan nama peserta asli).
--
-- Cara pakai — jalankan per tenant (ganti tenant_pc_ikpm_jogjakarta):
--   docker compose exec -T postgres psql -U jalakarta -d jalakarta \
--     -v schema=tenant_pc_ikpm_jogjakarta -f docs/diagnosa-kode-unik-event-registrations.sql
-- ═══════════════════════════════════════════════════════════════════════════

\set schema_name :schema

-- ── 1. Invoice event/cart yang nyangkut "partial" TEPAT sejumlah kode unik ──
-- Ciri khas bug: paid_amount == total persis (kode unik tidak ikut kebayar),
-- unique_code > 0, status masih partial/waiting_verification.
SELECT
  i.id,
  i.invoice_number,
  i.source_type,
  i.customer_name,
  i.customer_phone,
  i.total,
  i.unique_code,
  i.paid_amount,
  (i.total + i.unique_code - i.paid_amount) AS kurang,
  i.status,
  i.created_at
FROM :"schema_name".invoices i
WHERE i.source_type IN ('cart', 'event_registration')
  AND i.unique_code > 0
  AND i.status IN ('partial', 'waiting_verification')
  AND i.paid_amount::numeric = i.total::numeric   -- persis kurang kode unik
ORDER BY i.created_at DESC;

-- ── 2. Ringkasan jumlah invoice terdampak + total kode unik yang "hilang" ──
SELECT
  count(*)                                         AS jumlah_invoice_terdampak,
  sum(i.unique_code)                               AS total_kode_unik_belum_masuk
FROM :"schema_name".invoices i
WHERE i.source_type IN ('cart', 'event_registration')
  AND i.unique_code > 0
  AND i.status IN ('partial', 'waiting_verification')
  AND i.paid_amount::numeric = i.total::numeric;

-- ── 3. event_registrations duplikat dari bug loop tanpa guard ──────────────
-- Duplikat = registrasi yang dibuat oleh auto-create loop (customFields
-- punya sourceInvoiceId) TAPI invoice sumbernya sourceType = 'event_registration'
-- (alur lama yang sudah insert registrasi sendiri sebelum invoice ada).
-- Nama pada baris ini kemungkinan = nama tiket, bukan nama peserta asli.
SELECT
  er.id                                    AS registration_id_duplikat,
  er.registration_number,
  er.event_id,
  er.ticket_id,
  er.attendee_name                         AS nama_tercatat_di_duplikat,
  er.status,
  er.created_at,
  i.id                                     AS invoice_id,
  i.invoice_number,
  i.customer_name                          AS nama_asli_di_invoice
FROM :"schema_name".event_registrations er
JOIN :"schema_name".invoices i
  ON i.id = (er.custom_fields->>'sourceInvoiceId')::uuid
WHERE er.custom_fields ? 'sourceInvoiceId'
  AND i.source_type = 'event_registration'
ORDER BY er.created_at DESC;
