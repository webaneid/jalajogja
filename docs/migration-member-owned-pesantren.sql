-- Migration: member_owned_pesantren
-- Pesantren yang dimiliki/dikelola anggota IKPM (bukan pivot ke direktori)
-- Jalankan: psql $DATABASE_URL -f docs/migration-member-owned-pesantren.sql

CREATE TABLE IF NOT EXISTS public.member_owned_pesantren (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  -- Identitas
  name            TEXT NOT NULL,
  tahun_berdiri   INTEGER,
  luas_area       TEXT,
  nama_pimpinan   TEXT,
  hp_pimpinan     TEXT,   -- E.164 (+628...)

  -- Klasifikasi
  kurikulum        TEXT CHECK (kurikulum IN ('KMI Gontor','DIKNAS','KEMENAG','Salafiah','Lainnya')),
  jenis_pondok     TEXT CHECK (jenis_pondok IN ('Wakaf','Milik Keluarga')),
  model_pendidikan TEXT CHECK (model_pendidikan IN (
    'Murni KMI Gontor','KMI dan Tahfidz','KMI dan Kewirausahaan',
    'Pesantren Salafiah','Pesantren Tahfidz','Sekolah Umum',
    'DIKNAS dan Tahfidz','KEMENAG dan Tahfidz','Sekolah Kejuruan'
  )),
  kategori_santri  TEXT CHECK (kategori_santri IN ('Putra','Putra dan Putri','Putri')),

  -- Statistik
  santri_putra    INTEGER CHECK (santri_putra >= 0),
  santri_putri    INTEGER CHECK (santri_putri >= 0),
  asatidz         INTEGER CHECK (asatidz >= 0),
  asatidzah       INTEGER CHECK (asatidzah >= 0),

  -- Helper FKs (opsional)
  contact_id      UUID REFERENCES public.contacts(id)      ON DELETE SET NULL,
  address_id      UUID REFERENCES public.addresses(id)     ON DELETE SET NULL,
  social_media_id UUID REFERENCES public.social_medias(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_owned_pesantren_member_id
  ON public.member_owned_pesantren(member_id);
