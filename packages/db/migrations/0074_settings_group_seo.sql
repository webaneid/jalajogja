-- Migration: tambah 'seo' ke CHECK constraint settings.group untuk semua tenant existing
-- Dibutuhkan oleh tab "Integrasi & Pelacakan" di /app/{slug}/settings/seo — key seo_gtm_id,
-- seo_ga4_id, seo_meta_pixel_id, seo_google_verification, seo_bing_verification disimpan di
-- group "seo". Lihat docs/arsitektur-seo.md § 3.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0074_settings_group_seo.sql

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
      'ALTER TABLE %I.settings ADD CONSTRAINT settings_group_check CHECK ("group" IN (''general'',''contact'',''payment'',''display'',''mail'',''notif'',''website'',''keuangan'',''toko'',''donasi'',''event'',''forum'',''ekosistem'',''seo''))',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
