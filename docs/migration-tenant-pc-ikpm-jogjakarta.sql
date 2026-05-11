-- Migration manual untuk tenant pc-ikpm-jogjakarta
-- Tambah tabel dan kolom baru yang dibuat setelah tenant ini di-provisioning
-- Jalankan: psql $DATABASE_URL -f migration-tenant-pc-ikpm-jogjakarta.sql

-- ── Produk: kolom baru ────────────────────────────────────────────────────────

ALTER TABLE "tenant_pc-ikpm-jogjakarta".products
  ADD COLUMN IF NOT EXISTS public_price       NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS member_price       NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS product_type       TEXT NOT NULL DEFAULT 'simple'
                                               CHECK (product_type IN ('simple','variable')),
  ADD COLUMN IF NOT EXISTS attribute_groups   JSONB,
  ADD COLUMN IF NOT EXISTS seller_type        TEXT NOT NULL DEFAULT 'tenant'
                                               CHECK (seller_type IN ('tenant','mitra')),
  ADD COLUMN IF NOT EXISTS mitra_id           UUID;

-- ── Order Items: kolom komisi mitra ──────────────────────────────────────────

ALTER TABLE "tenant_pc-ikpm-jogjakarta".order_items
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ikpm_commission_amount   NUMERIC(15,2);

-- ── Product Variations ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tenant_pc-ikpm-jogjakarta".product_variations (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID          NOT NULL REFERENCES "tenant_pc-ikpm-jogjakarta".products(id) ON DELETE CASCADE,
  sku             TEXT,
  price           NUMERIC(15,2) NOT NULL,
  public_price    NUMERIC(15,2),
  member_price    NUMERIC(15,2),
  stock           INTEGER       NOT NULL DEFAULT 0,
  images          JSONB         NOT NULL DEFAULT '[]',
  attribute_combo JSONB         NOT NULL DEFAULT '{}',
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_variations_product_id_idx
  ON "tenant_pc-ikpm-jogjakarta".product_variations (product_id);

-- ── Media: crop_data ─────────────────────────────────────────────────────────

ALTER TABLE "tenant_pc-ikpm-jogjakarta".media
  ADD COLUMN IF NOT EXISTS crop_data JSONB;

-- ── Mitra Applications ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tenant_pc-ikpm-jogjakarta".mitra_applications (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID         NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  business_id      UUID         NOT NULL REFERENCES public.member_businesses(id) ON DELETE CASCADE,
  motivation       TEXT,
  status           TEXT         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','cancelled')),
  rejection_reason TEXT,
  applied_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID         REFERENCES "tenant_pc-ikpm-jogjakarta".officers(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mitra_applications_member_idx
  ON "tenant_pc-ikpm-jogjakarta".mitra_applications (member_id);

CREATE INDEX IF NOT EXISTS mitra_applications_status_idx
  ON "tenant_pc-ikpm-jogjakarta".mitra_applications (status);

-- ── Mitras ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tenant_pc-ikpm-jogjakarta".mitras (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         UUID         NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  business_id       UUID         NOT NULL REFERENCES public.member_businesses(id) ON DELETE CASCADE,
  application_id    UUID         REFERENCES "tenant_pc-ikpm-jogjakarta".mitra_applications(id) ON DELETE SET NULL,
  status            TEXT         NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active','suspended')),
  suspension_reason TEXT,
  approved_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  approved_by       UUID         REFERENCES "tenant_pc-ikpm-jogjakarta".officers(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mitras_status_idx
  ON "tenant_pc-ikpm-jogjakarta".mitras (status);

-- ── Settings: tambah 'toko' ke CHECK constraint group ────────────────────────

ALTER TABLE "tenant_pc-ikpm-jogjakarta".settings
  DROP CONSTRAINT IF EXISTS settings_group_check;

ALTER TABLE "tenant_pc-ikpm-jogjakarta".settings
  ADD CONSTRAINT settings_group_check
  CHECK ("group" IN ('general','contact','payment','display','mail','notif','website','keuangan','toko'));

-- ── Campaigns: kolom default_amount ──────────────────────────────────────────

ALTER TABLE "tenant_pc-ikpm-jogjakarta".campaigns
  ADD COLUMN IF NOT EXISTS default_amount NUMERIC(15,2);

-- ── Settings: tambah 'donasi' ke CHECK constraint group ──────────────────────

ALTER TABLE "tenant_pc-ikpm-jogjakarta".settings
  DROP CONSTRAINT IF EXISTS settings_group_check;

ALTER TABLE "tenant_pc-ikpm-jogjakarta".settings
  ADD CONSTRAINT settings_group_check
  CHECK ("group" IN ('general','contact','payment','display','mail','notif','website','keuangan','toko','donasi'));

-- ── Campaigns: kolom gallery + view_count (ditambahkan setelah provisioning awal) ──

ALTER TABLE "tenant_pc-ikpm-jogjakarta".campaigns
  ADD COLUMN IF NOT EXISTS gallery    JSONB,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- ── Qurban Tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tenant_pc-ikpm-jogjakarta".qurban_animals (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID          NOT NULL REFERENCES "tenant_pc-ikpm-jogjakarta".campaigns(id) ON DELETE CASCADE,
  animal_type TEXT          NOT NULL CHECK (animal_type IN ('domba','kambing','sapi')),
  price       NUMERIC(15,2) NOT NULL,
  stock       INTEGER       NOT NULL DEFAULT 0,
  booked      INTEGER       NOT NULL DEFAULT 0,
  split       INTEGER,
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "tenant_pc-ikpm-jogjakarta".qurban_sapi_groups (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id    UUID        NOT NULL REFERENCES "tenant_pc-ikpm-jogjakarta".qurban_animals(id) ON DELETE CASCADE,
  group_number INTEGER     NOT NULL,
  total_slots  INTEGER     NOT NULL,
  filled_slots INTEGER     NOT NULL DEFAULT 0,
  is_complete  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "tenant_pc-ikpm-jogjakarta".qurban_participants (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id    UUID        NOT NULL REFERENCES "tenant_pc-ikpm-jogjakarta".donations(id) ON DELETE CASCADE,
  animal_id      UUID        NOT NULL REFERENCES "tenant_pc-ikpm-jogjakarta".qurban_animals(id),
  sapi_group_id  UUID        REFERENCES "tenant_pc-ikpm-jogjakarta".qurban_sapi_groups(id),
  slot_number    INTEGER,
  atas_nama      TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qurban_animals_campaign     ON "tenant_pc-ikpm-jogjakarta".qurban_animals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qurban_participants_donation ON "tenant_pc-ikpm-jogjakarta".qurban_participants(donation_id);
CREATE INDEX IF NOT EXISTS idx_qurban_participants_animal   ON "tenant_pc-ikpm-jogjakarta".qurban_participants(animal_id);
