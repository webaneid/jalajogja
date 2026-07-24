-- Migration: tambah kolom business_fields ke public.member_businesses
-- Facet independen dari `sector` (bukan sub-sector/hierarki) — multi-select tag bebas untuk
-- bidang usaha spesifik (Kaligrafi, Desain Komunikasi Visual, dst). Lihat docs/arsitektur-usaha.md.
-- public.member_businesses TIDAK per-tenant (schema public tunggal) — jalankan SEKALI saja.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0044_member_business_fields.sql

ALTER TABLE public.member_businesses
  ADD COLUMN IF NOT EXISTS business_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
