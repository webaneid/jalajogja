-- Migration K1: kurir per produsen — docs/arsitektur-portal-produsen.md § 25.
-- Kolom producers.couriers JSONB NULL = daftar kode kurir RajaOngkir pilihan produsen (mis. ["jne","jnt"]).
-- NULL = belum diatur → ikut daftar kurir admin (tenant_addon_installations.config.couriers); perilaku produsen lama TIDAK berubah.
-- Aditif + idempotent. Tenant tanpa tabel producers DILEWATI (NOTICE).
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0083_producer_couriers.sql

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

    EXECUTE format('ALTER TABLE %I.producers ADD COLUMN IF NOT EXISTS couriers JSONB', t);
    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
