-- Migration: tautan verifikasi pembayaran untuk penanggung jawab (bendahara) + audit.
-- Tautan di WA/email memuat token acak (hanya HASH-nya disimpan). Halaman publik
-- /{slug}/verifikasi/{token} dilindungi 4 digit terakhir HP penerima; 5x salah → terkunci.
-- Lihat docs/arsitektur-notifikasi-pengurus.md § 8.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0073_pj_verification.sql

CREATE TABLE IF NOT EXISTS public.pj_verification_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_hash       TEXT NOT NULL UNIQUE,
  module           TEXT NOT NULL CHECK (module IN ('keuangan')),
  recipient_name   TEXT NOT NULL,
  recipient_phone  TEXT NOT NULL,            -- E.164; 4 digit terakhir = kata sandi halaman
  payment_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- snapshot id pembayaran di digest
  expires_at       TIMESTAMPTZ NOT NULL,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pj_links_tenant ON public.pj_verification_links (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS public.pj_verification_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  link_id     UUID REFERENCES public.pj_verification_links(id) ON DELETE SET NULL,
  payment_id  UUID NOT NULL,                 -- id di tenant_{slug}.payments (lintas schema, tanpa FK)
  action      TEXT NOT NULL CHECK (action IN ('confirm','confirm_different','not_found')),
  amount      NUMERIC(15,2),
  actor_name  TEXT NOT NULL,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pj_events_payment ON public.pj_verification_events (tenant_id, payment_id, created_at);
