-- Migration: tambah show_donation_prompt + linked_campaign_id ke events semua tenant existing
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0024_event_donation_prompt.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.events
         ADD COLUMN IF NOT EXISTS show_donation_prompt BOOLEAN NOT NULL DEFAULT false,
         ADD COLUMN IF NOT EXISTS linked_campaign_id   UUID',
      'tenant_' || r.slug
    );

    -- FK setelah kolom ada
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.events
           ADD CONSTRAINT events_linked_campaign_id_fk
           FOREIGN KEY (linked_campaign_id) REFERENCES %I.campaigns(id) ON DELETE SET NULL',
        'tenant_' || r.slug,
        'tenant_' || r.slug
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- constraint sudah ada, skip
    END;
  END LOOP;
END;
$$;
