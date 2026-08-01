-- Migration: tambah requires_registration ke event_tickets semua tenant existing
-- Toggle B "Wajib Terdaftar (Umum)" — independen dari requires_membership (Toggle A).
-- Lihat docs/arsitektur-event.md § "Wajib Terdaftar (Umum)".
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0057_event_ticket_requires_registration.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.event_tickets ADD COLUMN IF NOT EXISTS requires_registration BOOLEAN NOT NULL DEFAULT false',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
