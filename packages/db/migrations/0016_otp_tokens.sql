-- Tabel OTP untuk verifikasi nomor HP via WhatsApp
-- Dipakai di: registrasi (verifikasi phone) + lupa password (alternatif email)
-- TTL 5 menit, rate limit 3x per jam per nomor, auto-cleanup via used_at

CREATE TABLE IF NOT EXISTS public.otp_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT        NOT NULL,
  code       TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('register', 'reset_password')),
  slug       TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_type
  ON public.otp_tokens (phone, type, expires_at);
