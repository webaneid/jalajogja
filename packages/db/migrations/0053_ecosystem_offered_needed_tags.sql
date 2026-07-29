-- Migration: tambah kolom offered_tags/needed_tags ke 3 tabel public (Usaha, Profesional, Pesantren)
-- Facet BARU "apa yang ditawarkan/dibutuhkan", terpisah dari klasifikasi masing-masing modul
-- (businessFields/professionType/kurikulum dkk) — vocabulary suggestion dipusatkan di
-- lib/ecosystem-tags.ts. Lihat docs/arsitektur-ekosistem.md § 6 Fase 1.
-- Ketiga tabel ini TIDAK per-tenant (schema public tunggal) — jalankan SEKALI saja.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0053_ecosystem_offered_needed_tags.sql

ALTER TABLE public.member_businesses
  ADD COLUMN IF NOT EXISTS offered_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needed_tags  JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.member_professionals
  ADD COLUMN IF NOT EXISTS offered_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needed_tags  JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.member_owned_pesantren
  ADD COLUMN IF NOT EXISTS offered_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needed_tags  JSONB NOT NULL DEFAULT '[]'::jsonb;
