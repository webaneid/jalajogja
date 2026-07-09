-- Migration: tambah enable_custom_form ke events semua tenant existing
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0021_event_custom_form.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.events ADD COLUMN IF NOT EXISTS enable_custom_form BOOLEAN NOT NULL DEFAULT false',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
