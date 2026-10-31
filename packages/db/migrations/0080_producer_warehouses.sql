-- Migration: gudang pengiriman produsen (format RajaOngkir) — Portal Produsen, docs/arsitektur-portal-produsen.md § 20.
-- Satu tabel baru per tenant. Idempotent (IF NOT EXISTS). Tenant tanpa tabel `producers` DILEWATI (NOTICE).
-- Tidak mengubah data yang ada: produsen tanpa gudang = perilaku kota asal lama persis.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0080_producer_warehouses.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;

    IF to_regclass(format('%I.producers', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel producers belum ada', t;
      CONTINUE;
    END IF;

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %1$I.producer_warehouses (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        producer_id           UUID        NOT NULL REFERENCES %1$I.producers(id) ON DELETE RESTRICT,
        label                 TEXT        NOT NULL,
        address_detail        TEXT        NOT NULL,
        rajaongkir_city_id    INTEGER     NOT NULL,
        rajaongkir_city_label TEXT        NOT NULL,
        postal_code           TEXT,
        is_default            BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $f$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_warehouses_producer_idx ON %I.producer_warehouses(producer_id)', t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS producer_warehouses_default_uniq ON %I.producer_warehouses(producer_id) WHERE is_default', t);

    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
