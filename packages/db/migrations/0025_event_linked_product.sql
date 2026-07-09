-- Migration: tambah linked_product_id ke events semua tenant existing
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0025_event_linked_product.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.events ADD COLUMN IF NOT EXISTS linked_product_id UUID',
      'tenant_' || r.slug
    );

    -- FK setelah kolom ada
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.events
           ADD CONSTRAINT events_linked_product_id_fk
           FOREIGN KEY (linked_product_id) REFERENCES %I.products(id) ON DELETE SET NULL',
        'tenant_' || r.slug,
        'tenant_' || r.slug
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- constraint sudah ada, skip
    END;
  END LOOP;
END;
$$;
