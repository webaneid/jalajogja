-- Migration: tabel baru post_authors + kolom display_author_id/editor_id di posts
-- untuk semua tenant existing. docs/arsitektur-penulis-post.md
-- Tenant baru sudah otomatis dapat ini via create-tenant-schema.ts.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0049_post_authors.sql

DO $$
DECLARE
  r RECORD;
  s TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    s := 'tenant_' || r.slug;

    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.post_authors (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id   UUID,
        name        TEXT        NOT NULL,
        bio         TEXT,
        avatar_url  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )', s);

    EXECUTE format('ALTER TABLE %I.posts ADD COLUMN IF NOT EXISTS display_author_id UUID REFERENCES %I.post_authors(id) ON DELETE SET NULL', s, s);
    EXECUTE format('ALTER TABLE %I.posts ADD COLUMN IF NOT EXISTS editor_id          UUID REFERENCES %I.post_authors(id) ON DELETE SET NULL', s, s);
  END LOOP;
END;
$$;
