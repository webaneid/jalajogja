-- Migration: tambah checkin_token ke event_registrations semua tenant existing
-- Token terpisah dari `id` untuk QR check-in — bisa di-regenerate (invalidate QR lama) tanpa
-- mengganti identitas baris registrasi. Lihat docs/arsitektur-event.md § "RENCANA — Check-in via
-- Scan Kamera (QR)".
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0063_event_checkin_token.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.event_registrations ADD COLUMN IF NOT EXISTS checkin_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
