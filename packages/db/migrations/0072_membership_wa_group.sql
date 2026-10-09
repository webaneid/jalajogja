-- Migration: catatan "sudah bergabung grup WhatsApp" per anggota per tenant.
-- wa_group_joined_at  : kapan pertama kali menekan tombol "Gabung Grup" atau melapor "Saya sudah di grup".
-- wa_group_joined_via : 'click' (menekan tombol) | 'self' (laporan diri anggota yang sudah di grup).
-- NULL = belum tercatat. Dipakai kartu /akun dan (nanti) ringkasan sekretariat. Tautan grup sendiri
-- disimpan di tenant.settings (key whatsapp_group_url, group general), BUKAN di sini.
-- Lihat docs/arsitektur-gabung-forum.md § 9b.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0072_membership_wa_group.sql

ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS wa_group_joined_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_group_joined_via TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_memberships_wa_group_via_check'
  ) THEN
    ALTER TABLE public.tenant_memberships
      ADD CONSTRAINT tenant_memberships_wa_group_via_check
      CHECK (wa_group_joined_via IS NULL OR wa_group_joined_via IN ('click','self'));
  END IF;
END $$;
