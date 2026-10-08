-- Migration: produsen produk (ADMIN-ONLY) — tabel `producers` per tenant + products.producer_id.
-- Internal (tenant sendiri) = TANPA baris: producer_id NULL. Semua produk existing otomatis internal
-- (tidak ada data yang diubah). Lihat docs/arsitektur-produsen.md.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0070_producers.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.producers (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        type        TEXT        NOT NULL CHECK (type IN ('member','custom')),
        source_type TEXT        CHECK (source_type IN ('usaha','pesantren','profesional')),
        source_id   UUID,
        member_id   UUID,
        name_cache  TEXT,
        custom_name            TEXT,
        custom_whatsapp        TEXT,
        custom_address_detail  TEXT,
        custom_province_id     INTEGER,
        custom_regency_id      INTEGER,
        custom_district_id     INTEGER,
        custom_village_id      TEXT,
        custom_postal_code     TEXT,
        notes       TEXT,
        is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $f$, t);

    EXECUTE format('CREATE INDEX IF NOT EXISTS producers_member_idx ON %I.producers(member_id)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producers_type_idx ON %I.producers(type)', t);

    EXECUTE format(
      'ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS producer_id UUID REFERENCES %I.producers(id) ON DELETE SET NULL',
      t, t
    );
  END LOOP;
END;
$$;
