-- Migration P3: Pengajuan Produsen — docs/arsitektur-pengajuan-produsen.md § 8.1–8.2.
--  (a) tabel producer_applications per tenant (+ unique index parsial: satu pengajuan terbuka per anggota)
--  (b) kolom tambahan di producers: brand_name, product_limit, revenue_share_percent, application_id (semua NULLABLE)
-- Aditif + idempotent. Produsen LAMA tidak berubah perilaku (product_limit NULL = tanpa batas).
-- Tenant tanpa tabel producers DILEWATI (NOTICE) karena producer_applications merujuknya.
-- Tidak mengaktifkan fitur apa pun: pengajuan baru bisa dibuka hanya setelah saklar di Pengaturan Toko dihidupkan (P2) dan kode P4+ ada.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0092_producer_applications.sql

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

    EXECUTE format('ALTER TABLE %I.producers ADD COLUMN IF NOT EXISTS brand_name TEXT', t);
    EXECUTE format('ALTER TABLE %I.producers ADD COLUMN IF NOT EXISTS product_limit INTEGER', t);
    EXECUTE format('ALTER TABLE %I.producers ADD COLUMN IF NOT EXISTS revenue_share_percent NUMERIC(5,2)', t);
    -- Bagi hasil yang disepakati: 0 < p < 100 (ditegakkan juga di DB, bukan hanya di kode). Idempotent: DROP lalu ADD.
    EXECUTE format('ALTER TABLE %I.producers DROP CONSTRAINT IF EXISTS producers_revenue_share_chk', t);
    EXECUTE format('ALTER TABLE %I.producers ADD CONSTRAINT producers_revenue_share_chk CHECK (revenue_share_percent IS NULL OR (revenue_share_percent > 0 AND revenue_share_percent < 100))', t);
    EXECUTE format('ALTER TABLE %I.producers ADD COLUMN IF NOT EXISTS application_id UUID', t);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.producer_applications (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id             UUID        NOT NULL,
        status                TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','cancelled')),
        source_type           TEXT        CHECK (source_type IN ('usaha','pesantren','profesional')),
        source_id             UUID,
        brand_name            TEXT,
        product_kind          TEXT        NOT NULL DEFAULT 'physical' CHECK (product_kind IN ('physical')),
        product_categories    TEXT,
        description           TEXT,
        own_product_declared  BOOLEAN     NOT NULL DEFAULT FALSE,
        offered_share_percent NUMERIC(5,2) CHECK (offered_share_percent IS NULL OR (offered_share_percent > 0 AND offered_share_percent < 100)),
        ops_name              TEXT,
        ops_whatsapp          TEXT,
        team_size             INTEGER     CHECK (team_size IS NULL OR (team_size >= 1 AND team_size <= 999)),
        process_days          INTEGER     CHECK (process_days IS NULL OR (process_days >= 1 AND process_days <= 3)),
        origin_regency_id     INTEGER,
        sample_products       JSONB       NOT NULL DEFAULT '[]'::jsonb,
        process_media         JSONB       NOT NULL DEFAULT '[]'::jsonb,
        document_media        JSONB       NOT NULL DEFAULT '[]'::jsonb,
        links                 JSONB       NOT NULL DEFAULT '[]'::jsonb,
        submitted_at          TIMESTAMPTZ,
        reviewed_at           TIMESTAMPTZ,
        reviewed_by           UUID,
        rejection_reason      TEXT,
        review_note           TEXT,
        producer_id           UUID        REFERENCES %I.producers(id) ON DELETE SET NULL,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )$f$, t, t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS producer_applications_open_uniq ON %I.producer_applications(member_id) WHERE status IN (''draft'',''pending'')', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_applications_status_idx ON %I.producer_applications(status)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS producer_applications_member_idx ON %I.producer_applications(member_id)', t);

    RAISE NOTICE 'OK %', t;
  END LOOP;
END $$;
