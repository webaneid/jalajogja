-- Migration: tambah type "checkout_verify" ke CHECK constraint otp_tokens
-- Diperlukan untuk fitur auto-isi Nama/Email/Alamat di checkout via nomor HP terverifikasi.
-- Lihat docs/arsitektur-billing.md § 16. Pola sama 0017_otp_login_type.sql.
-- public schema — SATU statement, bukan loop per-tenant (otp_tokens bukan tabel tenant).

ALTER TABLE public.otp_tokens
  DROP CONSTRAINT IF EXISTS otp_tokens_type_check;

ALTER TABLE public.otp_tokens
  ADD CONSTRAINT otp_tokens_type_check
  CHECK (type IN ('register', 'reset_password', 'login', 'checkout_verify'));
