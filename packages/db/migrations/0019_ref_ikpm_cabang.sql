-- Migration 0019: Tabel referensi PC IKPM resmi
-- ref_ikpm_cabang = master list cabang IKPM dari PP IKPM
-- Terpisah dari public.tenants — cabang bisa ada tanpa punya tenant aktif

-- 1. Buat tabel referensi PC IKPM
CREATE TABLE IF NOT EXISTS public.ref_ikpm_cabang (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kode        TEXT        UNIQUE,                      -- kode resmi cabang (misal: PC-DIY, PC-JKT)
  nama        TEXT        NOT NULL,                    -- nama lengkap (PC IKPM Daerah Istimewa Yogyakarta)
  nama_pendek TEXT,                                    -- nama singkat (IKPM Yogyakarta)
  kota        TEXT,                                    -- kota/kabupaten pusat cabang
  provinsi    TEXT,                                    -- provinsi
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_ikpm_cabang_provinsi ON public.ref_ikpm_cabang (provinsi);

-- 2. Tambah ref_cabang_id di tenants — link tenant ke cabang resminya
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ref_cabang_id UUID REFERENCES public.ref_ikpm_cabang(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_ref_cabang_id ON public.tenants (ref_cabang_id)
  WHERE ref_cabang_id IS NOT NULL;

-- 3. Ganti primary_cabang_id di members (FK ke tenants)
--    menjadi primary_cabang_ref_id (FK ke ref_ikpm_cabang)
--    Cabang selalu bisa dicatat meski tenantnya belum ada
ALTER TABLE public.members
  DROP COLUMN IF EXISTS primary_cabang_id,
  ADD COLUMN IF NOT EXISTS primary_cabang_ref_id UUID REFERENCES public.ref_ikpm_cabang(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_primary_cabang_ref_id ON public.members (primary_cabang_ref_id)
  WHERE primary_cabang_ref_id IS NOT NULL;

-- Seed data resmi PC/I IKPM Gontor (136 cabang, sumber: DATA PC IKPM.xlsx dari PP IKPM)
-- Hanya nama cabang — tanpa kode/kota/provinsi (diisi platform admin bila perlu)
INSERT INTO public.ref_ikpm_cabang (nama) VALUES
  ('ABATA (Asahan, Batubara, Tanjung Pinang)'),
  ('Aceh'),
  ('Australia'),
  ('Bali'),
  ('Balikpapan'),
  ('Bandung Raya'),
  ('Bangka Belitung'),
  ('Banjarnegara'),
  ('Banten'),
  ('Banyumas'),
  ('Banyuwangi'),
  ('Barabai'),
  ('Batam'),
  ('Bekasi'),
  ('Bengkalis'),
  ('Bengkulu'),
  ('Berau'),
  ('Blitar'),
  ('Bogor'),
  ('Bojonegoro'),
  ('Bondowoso'),
  ('Bontang'),
  ('Brebes'),
  ('Brunei Darussalam'),
  ('Bumiayu'),
  ('Buton Raya'),
  ('Cianjur'),
  ('Cilacap'),
  ('Cirebon'),
  ('Damaskus'),
  ('Demak'),
  ('Depok'),
  ('Dumai'),
  ('Eks Karesidenan Pati (Jepara, Kudus, Pati, Rembang, Blora)'),
  ('Eropa'),
  ('Garut'),
  ('Gresik'),
  ('Grobogan'),
  ('Hadromaut'),
  ('Indragiri Hilir Riau'),
  ('Indramayu'),
  ('Inggris'),
  ('Jakarta'),
  ('Jambi'),
  ('Jember'),
  ('Jombang'),
  ('Kabupaten Bekasi'),
  ('Kairo'),
  ('Kalimantan Barat'),
  ('Kalimantan Selatan'),
  ('Kalimantan Tengah'),
  ('Kampar'),
  ('Kandangan'),
  ('Karawang'),
  ('Karimun'),
  ('Kebumen'),
  ('Kediri'),
  ('Kendal'),
  ('Kendari'),
  ('Kotawaringin Timur'),
  ('Kuningan'),
  ('Kutai Kartanegara'),
  ('Kutai Timur'),
  ('Labuhanbatu Raya'),
  ('Lamongan'),
  ('Lampung'),
  ('Lombok'),
  ('Lubuklinggau'),
  ('Lumajang'),
  ('Madinah'),
  ('Madiun'),
  ('Madura'),
  ('Magelang'),
  ('Magetan'),
  ('Majalengka'),
  ('Malang'),
  ('Malaysia'),
  ('Maluku'),
  ('Maluku Utara'),
  ('Medan'),
  ('Mojokerto'),
  ('Muara Enim'),
  ('Nganjuk'),
  ('Ngawi'),
  ('Nusa Tenggara Timur'),
  ('Ogan Ilir'),
  ('Ogan Komering Ilir'),
  ('Oku Raya'),
  ('Pacitan'),
  ('Pagar Alam'),
  ('Pakistan'),
  ('Palembang'),
  ('Palu'),
  ('Papua Barat'),
  ('Paser dan PPU'),
  ('Pasuruan'),
  ('Pekalongan'),
  ('Pekanbaru Riau'),
  ('Pemalang'),
  ('Ponorogo'),
  ('Poso'),
  ('Probolinggo'),
  ('Purwakarta'),
  ('Qatar'),
  ('Riyadh'),
  ('Rokan Hilir Riau'),
  ('Samarinda'),
  ('Semarang'),
  ('Siak Sri Indrapura'),
  ('Sidoarjo'),
  ('Situbondo'),
  ('Solo Raya'),
  ('Subang'),
  ('Sudan'),
  ('Sukabumi'),
  ('Sulawesi Utara'),
  ('SULSELBAR (Sulawesi Selatan dan Barat)'),
  ('Sumatera Barat'),
  ('Sumatera Utara'),
  ('Surabaya'),
  ('Tangerang Raya'),
  ('Tanjung Pinang'),
  ('Tapanuli Bagian Selatan'),
  ('Tarakan'),
  ('Tasikmalaya'),
  ('Tegal'),
  ('Temanggung'),
  ('Thailand'),
  ('Trenggalek'),
  ('Tuban'),
  ('Tulungagung'),
  ('Turki'),
  ('Uni Emirat Arab'),
  ('Wonosobo'),
  ('Yogyakarta'),
  ('Yordania')
ON CONFLICT DO NOTHING;
