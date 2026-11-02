-- Migration T1: Syarat & Ketentuan Produsen + persetujuan tanda tangan digital — docs/arsitektur-portal-produsen.md § 28.
-- Dua tabel per tenant: producer_terms (versi syarat) + producer_term_acceptances (bukti tanda tangan produsen).
-- Aditif + idempotent. Tenant tanpa tabel producers DILEWATI (NOTICE) karena acceptances merujuknya.
-- Tidak mengubah perilaku apa pun sampai ada versi syarat TERBIT (tanpa syarat terbit = tidak ada penguncian).
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0090_producer_terms.sql

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
      CREATE TABLE IF NOT EXISTS %I.producer_terms (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        version      INTEGER,
        title        TEXT        NOT NULL,
        body         TEXT        NOT NULL,
        status       TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
        published_at TIMESTAMPTZ,
        published_by UUID,
        created_by   UUID,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )$f$, t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS producer_terms_version_uniq ON %I.producer_terms(version)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_terms_status_idx ON %I.producer_terms(status)', t);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.producer_term_acceptances (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        term_id           UUID        NOT NULL REFERENCES %I.producer_terms(id) ON DELETE RESTRICT,
        producer_id       UUID        NOT NULL REFERENCES %I.producers(id) ON DELETE CASCADE,
        user_id           TEXT        NOT NULL,
        signed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        body_sha256       TEXT        NOT NULL,
        verification_hash TEXT        NOT NULL,
        ip                TEXT,
        user_agent        TEXT
      )$f$, t, t, t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS producer_term_acceptances_uniq ON %I.producer_term_acceptances(term_id, producer_id)', t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS producer_term_acceptances_hash_uniq ON %I.producer_term_acceptances(verification_hash)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_term_acceptances_producer_idx ON %I.producer_term_acceptances(producer_id)', t);

    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
