-- Migration: penanda tujuan media anggota (public.member_media.purpose) — Portal Produsen S4b, docs/arsitektur-portal-produsen.md § 19.12.
-- null = media umum; 'resi' = bukti pengiriman produsen. Idempotent; tidak mengubah data yang ada.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0079_member_media_purpose.sql

ALTER TABLE public.member_media ADD COLUMN IF NOT EXISTS purpose TEXT;
CREATE INDEX IF NOT EXISTS idx_member_media_purpose ON public.member_media(purpose) WHERE purpose IS NOT NULL;
