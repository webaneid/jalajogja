-- Migration: penanda notifikasi "keanggotaan aktif" (sekali per anggota per tenant).
-- Kolom activation_notified_at di public.tenant_memberships — NULL = belum diberi tahu.
-- Backfill: SEMUA baris yang SUDAH aktif saat migration ini jalan ditandai sudah diberi tahu,
-- supaya anggota lama tidak dibanjiri pesan "keanggotaan aktif" massal. Baris forum yang masih
-- pending sengaja dibiarkan NULL (akan diberi tahu saat benar-benar diaktifkan).
-- Lihat docs/arsitektur-gabung-forum.md § 9c.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0071_membership_activation_notified.sql

ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS activation_notified_at TIMESTAMPTZ;

UPDATE public.tenant_memberships
   SET activation_notified_at = now()
 WHERE activation_notified_at IS NULL
   AND status = 'active'
   AND (membership_type IS DISTINCT FROM 'forum' OR forum_status = 'active');
