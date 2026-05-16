-- Tambah kolom untuk tracking status cek DNS domain terakhir
-- Dipakai oleh cron verify-domains dan saveDomainSettingsAction (Phase A2)

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS domain_last_check_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_last_check_error TEXT;
