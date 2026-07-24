-- Migration: nomor keanggotaan lokal forum (opsional, khusus tenant_type='forum')
-- Lihat docs/arsitektur-backbone-ikpm.md § "Nomor Keanggotaan Lokal Forum".
-- Berbeda dari public.members.member_number (global lintas IKPM) — ini penomoran per forum,
-- dikonfigurasi admin di /app/{slug}/settings/keanggotaan, disimpan sebagai string hasil jadi
-- (mis. "2017.00001"), tidak reset per tahun.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0045_forum_membership_number.sql

ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS membership_number TEXT;

CREATE TABLE IF NOT EXISTS public.forum_membership_sequences (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID           NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_number INTEGER        NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT forum_membership_sequences_tenant_unique UNIQUE (tenant_id)
);
