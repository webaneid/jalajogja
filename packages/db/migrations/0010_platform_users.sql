-- ── Migration 0010: platform_users ──────────────────────────────────────────
-- Tabel untuk admin internal jalakarta (terpisah dari public.user / Better Auth)

CREATE TABLE IF NOT EXISTS public.platform_users (
  id            TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT         NOT NULL,
  email         TEXT         NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          TEXT         NOT NULL DEFAULT 'staff'
                             CHECK (role IN ('owner', 'admin', 'staff')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_users_email ON public.platform_users(email);
