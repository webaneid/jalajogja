-- Migration: tambah requires_membership ke event_tickets semua tenant existing
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0020_event_ticket_requires_membership.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.event_tickets ADD COLUMN IF NOT EXISTS requires_membership BOOLEAN NOT NULL DEFAULT false',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
