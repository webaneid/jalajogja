-- ─── Migration 0007: Modul Pesantren ─────────────────────────────────────────
-- Tabel baru: pesantren_facility_types, pesantren, member_pesantren,
--             pesantren_facilities
-- ALTER: member_educations tambah pesantren_id

-- ─── 0. Extension untuk similarity search (autocomplete cegah duplikat) ───────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── 1. pesantren_facility_types (lookup + seed) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.pesantren_facility_types (
  id         SMALLSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL
             CHECK (category IN ('ibadah','pendidikan','olahraga','kesehatan','penunjang')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesantren_facility_types_category
  ON public.pesantren_facility_types(category);

INSERT INTO public.pesantren_facility_types (name, category, sort_order) VALUES
  ('Masjid Jami',           'ibadah',     1),
  ('Mushola/Langgar',       'ibadah',     2),
  ('Lab Komputer',          'pendidikan', 1),
  ('Lab Bahasa',            'pendidikan', 2),
  ('Perpustakaan',          'pendidikan', 3),
  ('Aula/Gedung Serbaguna', 'pendidikan', 4),
  ('Lapangan Futsal',       'olahraga',   1),
  ('Lapangan Basket',       'olahraga',   2),
  ('Kolam Renang',          'olahraga',   3),
  ('Lapangan Badminton',    'olahraga',   4),
  ('Lapangan Voli',         'olahraga',   5),
  ('Klinik/UKS',            'kesehatan',  1),
  ('Apotek/Koperasi Obat',  'kesehatan',  2),
  ('Asrama Putra',          'penunjang',  1),
  ('Asrama Putri',          'penunjang',  2),
  ('Kantin',                'penunjang',  3),
  ('Koperasi Santri',       'penunjang',  4),
  ('Dapur Umum',            'penunjang',  5),
  ('Laundry',               'penunjang',  6),
  ('Area Parkir',           'penunjang',  7),
  ('CCTV',                  'penunjang',  8);

-- ─── 2. pesantren ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pesantren (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identitas
  name             TEXT NOT NULL,
  popular_name     TEXT,
  slug             TEXT UNIQUE NOT NULL,
  foto_urls        TEXT[] NOT NULL DEFAULT '{}',

  -- Pendidikan
  jenjang          TEXT[] NOT NULL DEFAULT '{}',
  -- nilai: tsanawiyah | aliyah | perguruan_tinggi
  sistem           TEXT CHECK (sistem IN ('salafi','modern','semi_modern','tahfidz')),
  kurikulum        TEXT[] NOT NULL DEFAULT '{}',
  -- nilai: kmi | diknas | kemenag | lainnya
  bahasa_pengantar TEXT[] NOT NULL DEFAULT '{}',

  -- Demografi
  jenis_kelamin    TEXT CHECK (jenis_kelamin IN ('putra','putri','keduanya')),
  jumlah_santri    INTEGER CHECK (jumlah_santri >= 0),
  tahun_berdiri    INTEGER CHECK (tahun_berdiri BETWEEN 1800 AND 2100),
  luas_area        TEXT,
  jenis_pondok     TEXT CHECK (jenis_pondok IN ('wakaf','keluarga','yayasan','pemerintah')),

  -- Pendiri (historis — bisa bukan anggota IKPM)
  pendiri_nama       TEXT,
  pendiri_member_id  UUID REFERENCES public.members(id) ON DELETE SET NULL,

  -- Pengasuh aktif saat ini
  pengasuh_nama      TEXT,
  pengasuh_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,

  -- Helper tables (reuse pola member_businesses)
  address_id      UUID REFERENCES public.addresses(id)     ON DELETE SET NULL,
  contact_id      UUID REFERENCES public.contacts(id)      ON DELETE SET NULL,
  social_media_id UUID REFERENCES public.social_medias(id) ON DELETE SET NULL,

  -- Verifikasi & workflow community-driven
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','aktif','nonaktif')),
  is_verified  BOOLEAN NOT NULL DEFAULT false,
  verified_at  TIMESTAMP WITH TIME ZONE,
  submitted_by UUID REFERENCES public.members(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesantren_status
  ON public.pesantren(status);
CREATE INDEX IF NOT EXISTS idx_pesantren_sistem
  ON public.pesantren(sistem);
CREATE INDEX IF NOT EXISTS idx_pesantren_pengasuh
  ON public.pesantren(pengasuh_member_id);
CREATE INDEX IF NOT EXISTS idx_pesantren_pendiri
  ON public.pesantren(pendiri_member_id);
CREATE INDEX IF NOT EXISTS idx_pesantren_submitted_by
  ON public.pesantren(submitted_by);
CREATE INDEX IF NOT EXISTS idx_pesantren_is_verified
  ON public.pesantren(is_verified);
CREATE INDEX IF NOT EXISTS idx_pesantren_name_trgm
  ON public.pesantren USING gin(name gin_trgm_ops);

-- ─── 3. member_pesantren (pivot) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_pesantren (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID NOT NULL REFERENCES public.members(id)   ON DELETE CASCADE,
  pesantren_id  UUID NOT NULL REFERENCES public.pesantren(id) ON DELETE CASCADE,
  peran         TEXT NOT NULL
                CHECK (peran IN ('alumni','pengasuh','pendiri','pengajar','pengurus','lainnya')),
  posisi        TEXT,       -- jabatan spesifik: "Direktur KMI", "Musyrif", dll
  tahun_mulai   SMALLINT,
  tahun_selesai SMALLINT,   -- NULL = masih aktif
  is_active     BOOLEAN NOT NULL DEFAULT true,
  catatan       TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  UNIQUE (member_id, pesantren_id, peran, tahun_mulai)
);

CREATE INDEX IF NOT EXISTS idx_member_pesantren_member_id
  ON public.member_pesantren(member_id);
CREATE INDEX IF NOT EXISTS idx_member_pesantren_pesantren_id
  ON public.member_pesantren(pesantren_id);
CREATE INDEX IF NOT EXISTS idx_member_pesantren_peran
  ON public.member_pesantren(peran);

-- ─── 4. pesantren_facilities (per-pesantren) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pesantren_facilities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesantren_id     UUID     NOT NULL
                   REFERENCES public.pesantren(id)               ON DELETE CASCADE,
  facility_type_id SMALLINT NOT NULL
                   REFERENCES public.pesantren_facility_types(id) ON DELETE RESTRICT,
  keterangan       TEXT,    -- "2 unit", "kapasitas 500 orang", "dalam renovasi", dll
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  UNIQUE (pesantren_id, facility_type_id)
);

CREATE INDEX IF NOT EXISTS idx_pesantren_facilities_pesantren_id
  ON public.pesantren_facilities(pesantren_id);
CREATE INDEX IF NOT EXISTS idx_pesantren_facilities_type_id
  ON public.pesantren_facilities(facility_type_id);

-- ─── 5. ALTER member_educations — tambah pesantren_id nullable ────────────────
ALTER TABLE public.member_educations
  ADD COLUMN IF NOT EXISTS pesantren_id UUID
  REFERENCES public.pesantren(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_member_educations_pesantren_id
  ON public.member_educations(pesantren_id)
  WHERE pesantren_id IS NOT NULL;
