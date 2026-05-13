-- Migration 0011: Tabel referensi kota RajaOngkir
-- Di-sync dari API RajaOngkir via endpoint platform admin

CREATE TABLE IF NOT EXISTS public.ref_rajaongkir_cities (
  city_id     INTEGER  PRIMARY KEY,
  province_id INTEGER  NOT NULL,
  city_name   TEXT     NOT NULL,
  postal_code TEXT,
  type        TEXT     NOT NULL   -- 'Kabupaten' | 'Kota'
);

CREATE INDEX IF NOT EXISTS idx_ref_rajaongkir_cities_province ON public.ref_rajaongkir_cities(province_id);
CREATE INDEX IF NOT EXISTS idx_ref_rajaongkir_cities_name     ON public.ref_rajaongkir_cities(city_name);
