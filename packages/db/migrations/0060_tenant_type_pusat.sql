-- ==========================================================================
-- Migration 0060: Tenant tipe "pusat" — IKPM Pusat, keanggotaan tanpa batas
-- Lihat docs/arsitektur-backbone-ikpm.md § "Tenant Khusus: IKPM Pusat —
-- Keanggotaan Tanpa Batas" untuk desain lengkap.
--
-- Jalankan via:
--   docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0060_tenant_type_pusat.sql
-- ==========================================================================

-- ── 1. Tambah nilai 'pusat' ke CHECK constraint tenants.tenant_type ────────
-- Nama constraint dikonfirmasi via \d public.tenants: tenants_tenant_type_check

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_tenant_type_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_tenant_type_check
  CHECK (tenant_type IN ('cabang', 'marhalah', 'forum', 'pusat'));

-- ── 2. Tambah nilai 'pusat' ke CHECK constraint tenant_memberships.membership_type ──
-- Nama constraint dikonfirmasi via \d public.tenant_memberships:
-- tenant_memberships_membership_type_check

ALTER TABLE public.tenant_memberships
  DROP CONSTRAINT IF EXISTS tenant_memberships_membership_type_check;

ALTER TABLE public.tenant_memberships
  ADD CONSTRAINT tenant_memberships_membership_type_check
  CHECK (membership_type IN ('cabang', 'marhalah', 'forum', 'pusat'));

-- registered_via TIDAK punya CHECK constraint DB sama sekali (murni text, validasi di
-- application layer sejak migration 0018) — nilai baru "auto_pusat" nol migrasi diperlukan.

-- ── 3. "The one and only" — maksimal SATU tenant tenant_type='pusat' ───────
-- Trik partial unique index Postgres: index pada ekspresi konstan (true) yang di-filter
-- WHERE tenant_type='pusat' — begitu ada 1 baris, baris kedua dengan tipe yang sama akan
-- menabrak unique constraint pada nilai (true) yang identik.

CREATE UNIQUE INDEX IF NOT EXISTS tenants_pusat_singleton
  ON public.tenants ((true))
  WHERE tenant_type = 'pusat';

-- ── 4. Verifikasi ──────────────────────────────────────────────────────────
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('tenants_tenant_type_check', 'tenant_memberships_membership_type_check');

SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname = 'tenants_pusat_singleton';
