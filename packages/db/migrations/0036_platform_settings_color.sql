-- Warna default IKPM (branding platform-wide) — dipakai MemberCard `/akun` saat
-- resolusi jatuh ke fallback platform (lihat resolveAkunBranding, lib/resolve-akun-branding.ts).
-- Default #2563eb konsisten dengan default warna tenant baru (settings/display).

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS default_color text NOT NULL DEFAULT '#2563eb';
