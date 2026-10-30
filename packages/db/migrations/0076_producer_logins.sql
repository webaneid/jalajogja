-- Migration: status "produsen" pada akun (Portal Produsen) — docs/arsitektur-portal-produsen.md § 3.
-- Produsen = status pada akun anggota (BUKAN role pengurus di tenant.users).
--  - UNIQUE(user_id)            : satu akun hanya bisa jadi produsen di SATU tenant (aturan lintas-tenant → harus di tabel public)
--  - UNIQUE(tenant_id, producer_id): satu produsen = satu akun
--  - producer_id merujuk tenant_{slug}.producers.id tanpa FK (lintas-schema); dibersihkan oleh aplikasi
-- Tidak mengubah data/tabel yang ada. Jalankan di VPS SEBELUM deploy kode P2+.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0076_producer_logins.sql

CREATE TABLE IF NOT EXISTS public.producer_logins (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  producer_id UUID        NOT NULL,
  granted_by  UUID,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS producer_logins_user_uniq     ON public.producer_logins (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS producer_logins_producer_uniq ON public.producer_logins (tenant_id, producer_id);
CREATE INDEX        IF NOT EXISTS producer_logins_tenant_idx    ON public.producer_logins (tenant_id);
