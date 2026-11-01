-- Migration P1: data tujuan RajaOngkir lokal (read-through) — docs/arsitektur-alamat.md § 11.
-- Tabel PUBLIK (bukan per-tenant); idempotent. Jalankan SEKALI sebelum deploy kode yang memakainya.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0084_ro_destinations.sql

CREATE TABLE IF NOT EXISTS public.ro_destinations (
  id               INTEGER     PRIMARY KEY,
  label            TEXT        NOT NULL,
  province_name    TEXT        NOT NULL,
  city_name        TEXT        NOT NULL,
  district_name    TEXT        NOT NULL,
  subdistrict_name TEXT        NOT NULL,
  zip_code         TEXT        NOT NULL DEFAULT '',
  search_text      TEXT        NOT NULL,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ro_search_log (
  query_norm   TEXT        PRIMARY KEY,
  result_count INTEGER     NOT NULL,
  truncated    BOOLEAN     NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ro_api_usage (
  day   TEXT    NOT NULL,
  kind  TEXT    NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);

-- Indeks pencarian: pg_trgm bila tersedia (butuh hak membuat ekstensi); tanpa itu pencarian tetap jalan (seq scan, tabel ≤ ~80 ribu baris)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS ro_destinations_search_trgm ON public.ro_destinations USING gin (search_text gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm tidak tersedia (%): pencarian memakai scan biasa', SQLERRM;
END $$;
