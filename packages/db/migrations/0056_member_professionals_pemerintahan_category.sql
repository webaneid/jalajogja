-- Migration: tambah 'Pemerintahan, Keamanan & Militer' ke CHECK constraint
-- public.member_professionals.profession_category
-- Kategori baru untuk TNI/Polri/ASN/kepala desa/dst — lihat apps/web/lib/professional-types.ts
-- PROFESSION_CATEGORIES + PROFESSION_TYPES_BY_CATEGORY.
-- public.member_professionals TIDAK per-tenant (schema public tunggal) — jalankan SEKALI saja,
-- bukan loop per tenant seperti migration settings.group.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0056_member_professionals_pemerintahan_category.sql

ALTER TABLE public.member_professionals
  DROP CONSTRAINT IF EXISTS member_professionals_profession_category_check;

ALTER TABLE public.member_professionals
  ADD CONSTRAINT member_professionals_profession_category_check
  CHECK (profession_category IN (
    'Sains, Teknik & Rekayasa', 'Kesehatan', 'Pendidikan & Akademik',
    'Bisnis, Keuangan & Manajemen', 'Teknologi Informasi', 'Hukum, Sosial & Budaya',
    'Kreatif', 'Pemerintahan, Keamanan & Militer', 'Lainnya'
  ));
