-- ── Migration 0013: Kolom visibilitas kontak ──────────────────────────────────
-- Tambah is_phone_public, is_whatsapp_public, is_email_public ke contacts
-- Default false (privat) — anggota opt-in untuk tampilkan ke publik

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_phone_public    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_whatsapp_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_email_public    BOOLEAN NOT NULL DEFAULT false;
