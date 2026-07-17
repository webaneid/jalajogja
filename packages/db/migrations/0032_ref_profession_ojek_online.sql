-- Migration: tambah "Ojek Online / Driver Online" ke ref_professions (kategori Wirausaha)
-- ref_professions di-seed manual (bukan serial PK) — hitung id & order berikutnya secara dinamis
-- supaya tidak bentrok dengan data yang sudah ada. Idempotent — aman dijalankan ulang.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0032_ref_profession_ojek_online.sql

INSERT INTO public.ref_professions (id, category, name, "order")
SELECT
  (SELECT MAX(id) + 1 FROM public.ref_professions),
  'Wirausaha',
  'Ojek Online / Driver Online',
  (SELECT COALESCE(MAX("order"), 0) + 1 FROM public.ref_professions WHERE category = 'Wirausaha')
WHERE NOT EXISTS (
  SELECT 1 FROM public.ref_professions WHERE name = 'Ojek Online / Driver Online'
);
