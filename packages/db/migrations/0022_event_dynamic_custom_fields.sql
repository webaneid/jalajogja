-- Migration 0022: tambah kolom custom_form_fields ke events semua tenant
-- Kolom ini menyimpan definisi field custom form (array CustomFormField[])
-- Menggantikan dua field hardcode (arrival_estimate, group_size)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    EXECUTE format(
      'ALTER TABLE %I.events ADD COLUMN IF NOT EXISTS custom_form_fields JSONB DEFAULT ''[]''',
      'tenant_' || r.slug
    );
  END LOOP;
END; $$;
