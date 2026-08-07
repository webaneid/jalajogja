-- Migration: tambah 'ekosistem' ke CHECK constraint settings.group untuk semua tenant existing
-- Dibutuhkan oleh modul admin baru "Ekosistem" (/app/{slug}/ekosistem/*) — key
-- "usaha_enabled"/"pesantren_enabled"/"profesional_enabled" DIPINDAH dari group "general" ke
-- group "ekosistem" (nol data lama untuk dipindah — kolom itu selalu ambil default `true` di
-- resolveEkosistemModulesConfig() kalau key belum pernah diisi, jadi murni migrasi lokasi
-- penulisan KE DEPAN, bukan migrasi data existing). Lihat docs/arsitektur-ekosistem.md § 7.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0061_settings_group_ekosistem.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.settings DROP CONSTRAINT IF EXISTS settings_group_check',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.settings ADD CONSTRAINT settings_group_check CHECK ("group" IN (''general'',''contact'',''payment'',''display'',''mail'',''notif'',''website'',''keuangan'',''toko'',''donasi'',''event'',''forum'',''ekosistem''))',
      'tenant_' || r.slug
    );

    -- Defensif: kalau ada tenant yang KEBETULAN sudah pernah menyimpan salah satu dari 3 key
    -- toggle ini di group "general" lama, salin ke group "ekosistem" baru (bukan pindah/hapus —
    -- baris lama di "general" dibiarkan, sudah tidak pernah dibaca lagi oleh kode baru, tidak
    -- mengganggu apa pun). ON CONFLICT DO NOTHING karena constraint unik (key, "group").
    EXECUTE format(
      'INSERT INTO %I.settings (key, "group", value)
       SELECT key, ''ekosistem'', value FROM %I.settings
       WHERE key IN (''usaha_enabled'',''pesantren_enabled'',''profesional_enabled'') AND "group" = ''general''
       ON CONFLICT (key, "group") DO NOTHING',
      'tenant_' || r.slug, 'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
