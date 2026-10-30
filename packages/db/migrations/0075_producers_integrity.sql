-- Migration: integritas produsen (langkah 3 perbaikan audit, docs/arsitektur-produsen.md § 15)
--  (a) UNIQUE INDEX parsial producers(source_type, source_id) — cegah produsen anggota ganda dari dua klik bersamaan.
--      Tenant yang SUDAH punya duplikat DILEWATI (NOTICE) agar migration tidak gagal total; bersihkan duplikatnya
--      lalu jalankan ulang file ini (idempotent).
--  (b) FK products.producer_id: ON DELETE SET NULL → ON DELETE RESTRICT. Produsen yang dipakai produk TIDAK BOLEH terhapus
--      (sebelumnya hapus yang balapan dengan pemasangan produk diam-diam menjadikan produk "internal").
--
-- DIAGNOSA DULU (read-only) — jalankan di VPS sebelum migration; harus 0 baris untuk semua tenant:
--   docker compose exec -T postgres psql -U jalakarta -d jalakarta -c "
--     DO \$\$ DECLARE r RECORD; n INT; BEGIN
--       FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
--         EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM tenant_%s.producers WHERE source_type IS NOT NULL AND source_id IS NOT NULL GROUP BY source_type, source_id HAVING count(*) > 1) d', replace(r.slug,'-','_')) INTO n;
--         RAISE NOTICE 'tenant % : % grup duplikat', r.slug, n;
--       END LOOP; END \$\$;"
--   (nama schema tenant memakai pola yang sama dengan 0070: 'tenant_' || slug — sesuaikan bila slug berisi tanda hubung.)
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0075_producers_integrity.sql

DO $$
DECLARE
  r RECORD;
  t TEXT;
  dup_groups INT;
  fk_name TEXT;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    t := 'tenant_' || r.slug;

    -- Lewati tenant yang belum punya tabel produsen (migration 0070 belum menjangkau)
    IF to_regclass(format('%I.producers', t)) IS NULL THEN
      RAISE NOTICE 'LEWATI % : tabel producers belum ada', t;
      CONTINUE;
    END IF;

    -- (a) unique index parsial
    EXECUTE format(
      'SELECT count(*) FROM (SELECT 1 FROM %I.producers WHERE source_type IS NOT NULL AND source_id IS NOT NULL GROUP BY source_type, source_id HAVING count(*) > 1) d',
      t
    ) INTO dup_groups;

    IF dup_groups > 0 THEN
      RAISE NOTICE 'LEWATI unique index % : % grup duplikat — bersihkan dulu lalu jalankan ulang', t, dup_groups;
    ELSE
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS producers_source_uniq ON %I.producers(source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL',
        t
      );
    END IF;

    -- (b) FK RESTRICT — cari nama constraint FK products.producer_id → producers apa adanya (jangan asumsikan nama)
    SELECT c.conname INTO fk_name
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid  = format('%I.products', t)::regclass
      AND c.confrelid = format('%I.producers', t)::regclass
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.products DROP CONSTRAINT %I', t, fk_name);
    END IF;
    EXECUTE format(
      'ALTER TABLE %I.products ADD CONSTRAINT products_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES %I.producers(id) ON DELETE RESTRICT',
      t, t
    );
  END LOOP;
END;
$$;
