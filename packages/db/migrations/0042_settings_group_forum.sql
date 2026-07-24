-- Migration: tambah 'forum' ke CHECK constraint settings.group untuk semua tenant existing
-- Dibutuhkan oleh Alur Pendaftaran Forum v2 (docs/arsitektur-backbone-ikpm.md § "Alur
-- Pendaftaran Forum v2") — key `membership_config` group `forum` menyimpan produk/campaign
-- syarat iuran forum (khusus tenant tenant_type='forum').
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0042_settings_group_forum.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.settings DROP CONSTRAINT IF EXISTS settings_group_check',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.settings ADD CONSTRAINT settings_group_check CHECK ("group" IN (''general'',''contact'',''payment'',''display'',''mail'',''notif'',''website'',''keuangan'',''toko'',''donasi'',''event'',''forum''))',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
