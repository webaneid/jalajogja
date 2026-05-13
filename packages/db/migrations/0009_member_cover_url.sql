-- ── Migration 0009: cover_url di member_businesses + member_owned_pesantren ───
-- Tambah kolom cover_url (URL foto dari member media library)
-- Nullable TEXT — bukan FK karena cross-schema ke tenant.media tidak bisa FK

ALTER TABLE public.member_businesses
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE public.member_owned_pesantren
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
