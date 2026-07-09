-- Migration 0023: Tambah kolom statistik peserta ke tabel events per tenant
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0023_event_attendee_stats.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE "tenant_%s".events
         ADD COLUMN IF NOT EXISTS show_attendee_stats BOOLEAN NOT NULL DEFAULT false,
         ADD COLUMN IF NOT EXISTS attendee_stats_by   JSONB DEFAULT ''[]''',
      r.slug
    );
  END LOOP;
END
$$;
