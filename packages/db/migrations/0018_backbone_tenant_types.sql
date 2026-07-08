-- ==========================================================================
-- Migration 0018: Backbone IKPM — tenant types + membership types
-- Jalankan via:
--   docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0018_backbone_tenant_types.sql
-- ==========================================================================

-- ── 1. Tambah kolom backbone ke public.tenants ─────────────────────────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tenant_type      TEXT NOT NULL DEFAULT 'cabang'
    CHECK (tenant_type IN ('cabang', 'marhalah', 'forum')),
  ADD COLUMN IF NOT EXISTS marhalah_year    INTEGER,
  ADD COLUMN IF NOT EXISTS marhalah_period  TEXT
    CHECK (marhalah_period IN ('awal', 'akhir')),
  ADD COLUMN IF NOT EXISTS parent_tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Constraint: marhalah wajib punya tahun
-- (Diterapkan via application logic, bukan DB constraint, karena ADD CONSTRAINT
--  tidak bisa referensikan kolom lain di CHECK yang sama di ALTER TABLE)

-- ── 2. Tambah primary_cabang_id ke public.members ──────────────────────────
-- Cabang "rumah" anggota — biasanya cabang tempat dia pertama kali mendaftar
-- atau yang secara geografis paling dekat.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS primary_cabang_id UUID
    REFERENCES public.tenants(id) ON DELETE SET NULL;

-- ── 3. Tambah kolom backbone ke public.tenant_memberships ─────────────────

ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS membership_type  TEXT NOT NULL DEFAULT 'cabang'
    CHECK (membership_type IN ('cabang', 'marhalah', 'forum')),
  -- Forum-specific: status keanggotaan forum (null untuk cabang + marhalah)
  ADD COLUMN IF NOT EXISTS forum_status     TEXT
    CHECK (forum_status IN ('pending', 'active', 'suspended', 'rejected')),
  -- Referensi ke invoice jika ada biaya pendaftaran forum
  ADD COLUMN IF NOT EXISTS forum_invoice_id UUID,
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at       TIMESTAMPTZ;

-- Update registered_via — tambah nilai backbone ke enum baru
-- (kolom sudah ada sebagai text biasa, cukup update nilai yang ada)
-- Nilai lama: 'admin', 'self', 'import', 'invite'
-- Nilai baru: + 'auto_marhalah', 'auto_cabang'
-- Tidak ada perubahan DDL — kolom tetap text, nilai di-validate di application layer.

-- ── 4. Index untuk query backbone ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tenants_tenant_type
  ON public.tenants (tenant_type);

CREATE INDEX IF NOT EXISTS idx_tenants_parent_tenant_id
  ON public.tenants (parent_tenant_id)
  WHERE parent_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_primary_cabang_id
  ON public.members (primary_cabang_id)
  WHERE primary_cabang_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_membership_type
  ON public.tenant_memberships (membership_type);

-- ── 5. Backfill: semua tenant existing = 'cabang' (sudah default) ──────────
-- Tidak perlu UPDATE — DEFAULT 'cabang' sudah cover semua row existing.

-- ── 6. Backfill: semua membership existing = 'cabang' (sudah default) ──────
-- Tidak perlu UPDATE — DEFAULT 'cabang' sudah cover semua row existing.

-- ── 7. Verifikasi ──────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants'
  AND column_name IN ('tenant_type', 'marhalah_year', 'marhalah_period', 'parent_tenant_id')
ORDER BY column_name;
