-- Platform-wide settings (bukan per-tenant) — singleton row, dikelola dari /platform/settings.
-- Dipakai sebagai fallback branding (logo + nama org) untuk anggota IKPM yang cabang resminya
-- belum onboard jadi tenant. Lihat docs/arsitektur-akun.md § Resolusi Branding Kartu Anggota.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                text PRIMARY KEY,
  default_logo_url  text,
  default_org_name  text NOT NULL DEFAULT 'IKPM Gontor',
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id, default_org_name)
VALUES ('default', 'IKPM Gontor')
ON CONFLICT (id) DO NOTHING;
