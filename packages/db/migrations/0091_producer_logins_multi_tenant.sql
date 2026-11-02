-- Migration P1: produsen boleh ada di BANYAK tenant — docs/arsitektur-pengajuan-produsen.md § 8.3 & § 9.
-- Sebelumnya UNIQUE(user_id) memaksa satu akun = satu tenant (keputusan D2, 2026-10-31). Keputusan user 2026-11-03: seorang
-- produsen di tenant A boleh juga jadi produsen di tenant B (pengajuan + persetujuan terpisah per tenant).
--  - HAPUS  UNIQUE(user_id)               (producer_logins_user_uniq)
--  - TAMBAH UNIQUE(user_id, tenant_id)    (satu akun paling banyak SATU baris per tenant)
--  - UNIQUE(tenant_id, producer_id) tetap (satu produsen = satu akun)
-- Pelonggaran murni: tidak ada data yang ditolak oleh indeks baru (indeks lama lebih ketat). Idempotent.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0091_producer_logins_multi_tenant.sql

CREATE UNIQUE INDEX IF NOT EXISTS producer_logins_user_tenant_uniq ON public.producer_logins (user_id, tenant_id);
DROP INDEX IF EXISTS public.producer_logins_user_uniq;
