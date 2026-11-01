-- Migration P5: cache tarif ongkir RajaOngkir (publik, dibagi semua tenant) — docs/arsitektur-alamat.md § 14.
-- Idempotent. Jalankan SEBELUM deploy kode yang memakainya.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0085_ro_cost_cache.sql

CREATE TABLE IF NOT EXISTS public.ro_cost_cache (
  origin_id      INTEGER     NOT NULL,
  destination_id INTEGER     NOT NULL,
  weight         INTEGER     NOT NULL,
  courier        TEXT        NOT NULL,
  payload        JSONB       NOT NULL,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (origin_id, destination_id, weight, courier)
);
CREATE INDEX IF NOT EXISTS ro_cost_cache_fetched_idx ON public.ro_cost_cache (fetched_at);
