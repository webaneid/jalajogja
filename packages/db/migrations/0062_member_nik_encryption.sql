-- Enkripsi at-rest untuk public.members.nik.
--
-- PENTING — urutan eksekusi WAJIB diikuti persis, migration SQL ini SAJA
-- TIDAK CUKUP untuk mengenkripsi data lama:
--   1. Set MEMBER_PII_ENCRYPTION_KEY di .env.local (generate sekali, jangan
--      dipakai ulang antar environment) — lihat apps/web/.env.example.
--   2. Jalankan migration ini (bikin kolom nik_hash + ganti unique index).
--   3. Jalankan packages/db/scripts/encrypt-existing-nik.ts (Node/Bun script,
--      BUKAN SQL — butuh crypto untuk enkripsi tiap baris nik yang masih
--      plaintext) untuk mengisi nik (jadi ciphertext) + nik_hash pada baris
--      lama. WAJIB dry-run dulu, backup DB dulu sebelum --commit.
--
-- Baris BARU yang ditulis SETELAH kode aplikasi ter-deploy sudah otomatis
-- terenkripsi lewat encryptPii()/hashPiiForLookup() di titik tulisnya —
-- script di langkah 3 HANYA untuk data historis yang sudah ada.

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nik_hash text;

-- Index lama di atas nik PLAINTEXT sudah tidak berguna begitu kolom nik
-- berisi ciphertext acak (nilai sama tidak lagi hasilkan teks sama, jadi
-- tidak pernah collide walau NIK-nya sama persis — unique constraint diam-diam
-- berhenti bekerja tanpa index baru ini).
DROP INDEX IF EXISTS members_nik_not_null_unique;

CREATE UNIQUE INDEX IF NOT EXISTS members_nik_hash_not_null_unique
  ON public.members (nik_hash) WHERE nik_hash IS NOT NULL;
