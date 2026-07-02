-- Migration: tambah type "login" ke CHECK constraint otp_tokens
-- Diperlukan untuk fitur Login via WhatsApp OTP

ALTER TABLE public.otp_tokens
  DROP CONSTRAINT IF EXISTS otp_tokens_type_check;

ALTER TABLE public.otp_tokens
  ADD CONSTRAINT otp_tokens_type_check
  CHECK (type IN ('register', 'reset_password', 'login'));
