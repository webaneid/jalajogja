-- Migration: Tambah akun 4400 Pendapatan Event untuk tenant existing
-- Jalankan per tenant: ganti {slug} dengan slug tenant yang ada
-- Contoh: psql -c "SET search_path TO tenant_ikpm; ..."
--
-- Idempotent — aman dijalankan ulang (ON CONFLICT DO NOTHING)

DO $$
DECLARE
  s TEXT := 'tenant_{slug}'; -- ganti {slug} dengan slug tenant
BEGIN
  EXECUTE format('
    INSERT INTO %I.accounts (code, name, type)
    VALUES (''4400'', ''Pendapatan Event'', ''income'')
    ON CONFLICT (code) DO NOTHING
  ', s);
END $$;

-- Verifikasi:
-- SELECT code, name, type FROM tenant_{slug}.accounts WHERE code = '4400';
