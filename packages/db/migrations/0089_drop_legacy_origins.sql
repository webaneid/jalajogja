-- Migration P4 Tahap B (DESTRUKTIF): hapus struktur asal kirim LAMA — docs/arsitektur-alamat.md § 20.2 / § 22.
--   * DROP TABLE tenant_X.producer_warehouses
--   * ALTER TABLE tenant_X.products DROP COLUMN origin_city_id, origin_city_name   (digantikan products.origin_id)
--   * buang kunci origin_city_id / origin_city_name dari config add-on RajaOngkir (tidak dibaca kode lagi)
-- TIDAK menyentuh: mitras.rajaongkir_city_* (mitra di luar cakupan), invoice_shipping_lines.origin_city_* (snapshot pesanan).
--
-- SYARAT SEBELUM MENJALANKAN (jangan dilewati):
--   1. 0088 sudah jalan dan diverifikasi di browser.
--   2. Kode TANPA definisi Drizzle lama sudah ter-deploy (build + restart) — kalau tidak, query produk error begitu kolom hilang.
--   3. CADANGAN DB penuh sudah dibuat dan ukurannya wajar (lihat docs/arsitektur-alamat.md § 22).
-- Pengaman: dijalankan dalam SATU transaksi; bila ada tenant yang gudang lamanya belum tersalin ke shipping_origins (0088 belum jalan
-- / sebagian dilewati), seluruh migration DIBATALKAN dengan pesan jelas — tidak ada yang terhapus.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0089_drop_legacy_origins.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
  n_wh BIGINT;
  n_copied BIGINT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;
    IF to_regclass(format('%I.products', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel products belum ada', t;
      CONTINUE;
    END IF;

    -- Pengaman 1: struktur baru harus ada
    IF to_regclass(format('%I.shipping_origins', t)) IS NULL THEN
      RAISE EXCEPTION 'BATAL: % belum punya shipping_origins — jalankan 0088 dulu. Tidak ada yang dihapus.', t;
    END IF;

    -- Pengaman 2: setiap gudang lama sudah punya padanan asal produsen (jumlah asal produsen >= jumlah gudang)
    IF to_regclass(format('%I.producer_warehouses', t)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I.producer_warehouses', t) INTO n_wh;
      EXECUTE format('SELECT count(*) FROM %I.shipping_origins WHERE producer_id IS NOT NULL', t) INTO n_copied;
      IF n_wh > n_copied THEN
        RAISE EXCEPTION 'BATAL: % punya % gudang lama tetapi hanya % asal produsen baru (ada yang dilewati 0088?). Tidak ada yang dihapus.', t, n_wh, n_copied;
      END IF;
    END IF;

    EXECUTE format('DROP TABLE IF EXISTS %I.producer_warehouses', t);
    EXECUTE format('ALTER TABLE %I.products DROP COLUMN IF EXISTS origin_city_id', t);
    EXECUTE format('ALTER TABLE %I.products DROP COLUMN IF EXISTS origin_city_name', t);
    RAISE NOTICE 'OK % : producer_warehouses + products.origin_city_* dihapus (gudang lama=%, asal produsen baru=%)', t, coalesce(n_wh, 0), coalesce(n_copied, 0);
  END LOOP;

  -- Config add-on RajaOngkir: buang kunci asal lama (kode tidak membacanya lagi)
  UPDATE public.tenant_addon_installations i
     SET config = (i.config - 'origin_city_id') - 'origin_city_name'
    FROM public.addons a
   WHERE a.id = i.addon_id AND a.slug = 'rajaongkir'
     AND (i.config ? 'origin_city_id' OR i.config ? 'origin_city_name');
END $$;
