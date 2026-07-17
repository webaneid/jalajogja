-- Migration: tambah 'event' ke CHECK constraint settings.group untuk semua tenant existing
-- Dibutuhkan oleh fitur Registry Desain Kartu Arsip Event (docs/arsitektur-event.md)
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0031_settings_group_event.sql

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
      'ALTER TABLE %I.settings ADD CONSTRAINT settings_group_check CHECK ("group" IN (''general'',''contact'',''payment'',''display'',''mail'',''notif'',''website'',''keuangan'',''toko'',''donasi'',''event''))',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
