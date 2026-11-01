-- Migration P4 Tahap A: Asal Kirim satu struktur — docs/arsitektur-alamat.md § 20. ADITIF; aman diulang: penyalinan data HANYA terjadi
-- pada jalan pertama tiap tenant (saat tabel shipping_origins belum ada). Menjalankan ulang SESUDAH UI dipakai tidak menghidupkan
-- kembali asal yang sudah diubah/dihapus (tenant yang tabelnya sudah ada dilewati dengan NOTICE).
--   * buat tenant_X.shipping_origins + products.origin_id
--   * SALIN data lama (tidak menghapus apa pun):
--       producer_warehouses            → asal produsen
--       config add-on RajaOngkir       → asal utama toko (producer_id NULL)
--       products.origin_city_* (override per-produk) → asal pemilik + products.origin_id
--         (hanya override yang EFEKTIF: produsen yang punya gudang dulu mengabaikan override — tetap diabaikan)
--   * public.ro_destinations dilengkapi dari label RajaOngkir lama ("KEL, KEC, KOTA, PROV, KODEPOS"); label yang tak bisa diurai
--     DILEWATI dan dilaporkan lewat NOTICE (jangan diam-diam hilang).
-- Tabel/kolom lama TIDAK disentuh (penghapusan = migration 0089, setelah cadangan + verifikasi).
-- WAJIB jalan SESUDAH 0084 (ro_destinations) dan SEBELUM deploy kode yang memakainya.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0088_shipping_origins.sql

CREATE OR REPLACE FUNCTION pg_temp.ro_ensure_destination(p_id INTEGER, p_label TEXT) RETURNS BOOLEAN AS $f$
DECLARE parts TEXT[];
BEGIN
  IF p_id IS NULL OR p_label IS NULL THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.ro_destinations WHERE id = p_id) THEN RETURN TRUE; END IF;
  parts := string_to_array(p_label, ', ');
  IF array_length(parts, 1) <> 5 THEN RETURN FALSE; END IF;
  INSERT INTO public.ro_destinations (id, label, province_name, city_name, district_name, subdistrict_name, zip_code, search_text)
  VALUES (p_id, p_label, parts[4], parts[3], parts[2], parts[1], parts[5],
          trim(both ' ' from lower(regexp_replace(p_label, '[^a-zA-Z0-9]+', ' ', 'g'))))
  ON CONFLICT (id) DO NOTHING;
  RETURN TRUE;
END $f$ LANGUAGE plpgsql;

DO $$
DECLARE
  r RECORD;
  w RECORD;
  p RECORD;
  t TEXT;
  cfg_id INTEGER;
  cfg_label TEXT;
  new_id UUID;
  n_wh INT; n_tenant INT; n_prod INT; n_skip INT;
  already BOOLEAN;
BEGIN
  FOR r IN SELECT id, slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;
    IF to_regclass(format('%I.producers', t)) IS NULL OR to_regclass(format('%I.products', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel producers/products belum ada', t;
      CONTINUE;
    END IF;
    n_wh := 0; n_tenant := 0; n_prod := 0; n_skip := 0;
    already := to_regclass(format('%I.shipping_origins', t)) IS NOT NULL;

    -- 1) Struktur
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %1$I.shipping_origins (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        producer_id    UUID        REFERENCES %1$I.producers(id) ON DELETE RESTRICT,
        label          TEXT        NOT NULL,
        detail         TEXT        NOT NULL,
        destination_id INTEGER     NOT NULL REFERENCES public.ro_destinations(id),
        is_default     BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $f$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS shipping_origins_producer_idx ON %I.shipping_origins(producer_id)', t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS shipping_origins_producer_default_uniq ON %I.shipping_origins(producer_id) WHERE is_default AND producer_id IS NOT NULL', t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS shipping_origins_tenant_default_uniq ON %I.shipping_origins(is_default) WHERE is_default AND producer_id IS NULL', t);
    EXECUTE format('ALTER TABLE %1$I.products ADD COLUMN IF NOT EXISTS origin_id UUID REFERENCES %1$I.shipping_origins(id) ON DELETE RESTRICT', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_origin ON %I.products(origin_id) WHERE origin_id IS NOT NULL', t);

    IF already THEN
      RAISE NOTICE 'SUDAH dimigrasi sebelumnya, data tidak disalin ulang: %', t;
      CONTINUE;
    END IF;

    -- 2) Gudang produsen → asal produsen
    IF to_regclass(format('%I.producer_warehouses', t)) IS NOT NULL THEN
      FOR w IN EXECUTE format('SELECT producer_id, label, address_detail, rajaongkir_city_id, rajaongkir_city_label, is_default FROM %I.producer_warehouses', t) LOOP
        IF pg_temp.ro_ensure_destination(w.rajaongkir_city_id, w.rajaongkir_city_label) THEN
          EXECUTE format($f$
            INSERT INTO %1$I.shipping_origins (producer_id, label, detail, destination_id, is_default)
            SELECT $1, $2, $3, $4,
                   ($5 AND NOT EXISTS (SELECT 1 FROM %1$I.shipping_origins WHERE producer_id = $1 AND is_default))
            WHERE NOT EXISTS (SELECT 1 FROM %1$I.shipping_origins WHERE producer_id = $1 AND destination_id = $4 AND label = $2)
          $f$, t) USING w.producer_id, w.label, w.address_detail, w.rajaongkir_city_id, w.is_default;
          n_wh := n_wh + 1;
        ELSE
          n_skip := n_skip + 1;
          RAISE NOTICE '  DILEWATI gudang % (%): label tak bisa diurai: %', w.label, t, w.rajaongkir_city_label;
        END IF;
      END LOOP;
    END IF;

    -- 3) Asal default toko (config add-on RajaOngkir) → asal utama toko
    SELECT CASE WHEN i.config->>'origin_city_id' ~ '^[0-9]{1,9}$' THEN (i.config->>'origin_city_id')::INTEGER END, i.config->>'origin_city_name'
      INTO cfg_id, cfg_label
      FROM public.tenant_addon_installations i JOIN public.addons a ON a.id = i.addon_id
     WHERE i.tenant_id = r.id AND a.slug = 'rajaongkir' LIMIT 1;
    IF cfg_id IS NOT NULL THEN
      IF pg_temp.ro_ensure_destination(cfg_id, cfg_label) THEN
        EXECUTE format($f$
          INSERT INTO %1$I.shipping_origins (producer_id, label, detail, destination_id, is_default)
          SELECT NULL, 'Toko', 'Alamat lengkap belum diisi — ubah di Toko → Asal Kirim', $1, true
          WHERE NOT EXISTS (SELECT 1 FROM %1$I.shipping_origins WHERE producer_id IS NULL AND is_default)
        $f$, t) USING cfg_id;
        GET DIAGNOSTICS n_tenant = ROW_COUNT;
      ELSE
        n_skip := n_skip + 1;
        RAISE NOTICE '  DILEWATI asal toko (%): label tak bisa diurai: %', t, cfg_label;
      END IF;
    END IF;

    -- 4) Override kota per-produk (hanya yang efektif) → asal pemilik + products.origin_id
    FOR p IN EXECUTE format($f$
      SELECT pr.id, pr.producer_id, pr.origin_city_id, pr.origin_city_name
        FROM %1$I.products pr
       WHERE pr.origin_city_id IS NOT NULL AND pr.mitra_id IS NULL AND pr.origin_id IS NULL
         AND NOT (pr.producer_id IS NOT NULL AND EXISTS (SELECT 1 FROM %1$I.producer_warehouses w WHERE w.producer_id = pr.producer_id))
    $f$, t) LOOP
      IF pg_temp.ro_ensure_destination(p.origin_city_id, p.origin_city_name) THEN
        EXECUTE format('SELECT id FROM %I.shipping_origins WHERE producer_id IS NOT DISTINCT FROM $1 AND destination_id = $2 LIMIT 1', t)
          INTO new_id USING p.producer_id, p.origin_city_id;
        IF new_id IS NULL THEN
          EXECUTE format($f$
            INSERT INTO %I.shipping_origins (producer_id, label, detail, destination_id, is_default)
            VALUES ($1, 'Asal produk', 'Alamat lengkap belum diisi — ubah di Toko → Asal Kirim', $2, false) RETURNING id
          $f$, t) INTO new_id USING p.producer_id, p.origin_city_id;
        END IF;
        EXECUTE format('UPDATE %I.products SET origin_id = $1 WHERE id = $2', t) USING new_id, p.id;
        n_prod := n_prod + 1;
        new_id := NULL;
      ELSE
        n_skip := n_skip + 1;
        RAISE NOTICE '  DILEWATI override produk % (%): label tak bisa diurai: %', p.id, t, p.origin_city_name;
      END IF;
    END LOOP;

    RAISE NOTICE 'OK % : gudang→asal=%, asal toko=%, override produk=%, dilewati=%', t, n_wh, n_tenant, n_prod, n_skip;
  END LOOP;
END $$;
