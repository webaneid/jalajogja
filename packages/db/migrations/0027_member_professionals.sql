-- Migration: tabel baru public.member_professionals (Direktori Profesional)
-- Schema public (bukan tenant schema) — jalankan sekali, tidak perlu loop tenant.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0027_member_professionals.sql
-- Arsitektur lengkap: docs/arsitektur-profesional.md

CREATE TABLE IF NOT EXISTS public.member_professionals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  -- Identitas profesional
  title                TEXT,
  profession_category  TEXT NOT NULL CHECK (profession_category IN (
    'Sains, Teknik & Rekayasa', 'Kesehatan', 'Pendidikan & Akademik',
    'Bisnis, Keuangan & Manajemen', 'Teknologi Informasi', 'Hukum, Sosial & Budaya', 'Lainnya'
  )),
  profession_type      TEXT NOT NULL,
  specialization        TEXT,
  description           TEXT,

  -- Kredensial (opsional, publik by default)
  license_type      TEXT,
  license_number    TEXT,

  -- Konteks kerja
  employment_type   TEXT CHECK (employment_type IN (
    'Praktik Mandiri', 'Karyawan/Pegawai', 'Pemilik Firma/Klinik/Kantor', 'Freelance/Konsultan Lepas'
  )),
  institution       TEXT,
  start_year        INTEGER,

  -- Foto (member media library — URL langsung, bukan FK)
  cover_url         TEXT,

  -- Helper FKs (kondisional, null jika kosong)
  contact_id      UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  address_id      UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  social_media_id UUID REFERENCES public.social_medias(id) ON DELETE SET NULL,

  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_professionals_member_id ON public.member_professionals(member_id);
CREATE INDEX IF NOT EXISTS idx_member_professionals_category ON public.member_professionals(profession_category);
CREATE INDEX IF NOT EXISTS idx_member_professionals_type ON public.member_professionals(profession_type);
