-- Migration: pemisahan donasi/pembelian ORGANIK vs pembayaran yang genuinely berniat daftar
-- forum lewat /gabung. Lihat docs/arsitektur-backbone-ikpm.md § "Pemisahan Donasi vs Registrasi
-- Forum" untuk latar belakang lengkap.
--
-- Tanpa kolom ini, activateForumMembershipIfApplicable() menganggap SIAPA PUN yang bayar ke
-- produk/campaign yang jadi syarat iuran forum (dari jalur MANA PUN, bukan cuma /gabung) sebagai
-- niat gabung forum — donasi organik lewat /campaign bisa tidak sengaja mengaktifkan
-- keanggotaan forum. Kolom ini jadi penanda eksplisit: HANYA true kalau item ditambahkan lewat
-- link "?forGabung=1" di halaman /gabung.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0046_for_gabung_registration.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM public.tenants WHERE is_active = true
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.cart_items ADD COLUMN IF NOT EXISTS for_gabung_registration BOOLEAN NOT NULL DEFAULT false',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'ALTER TABLE %I.invoice_items ADD COLUMN IF NOT EXISTS for_gabung_registration BOOLEAN NOT NULL DEFAULT false',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;
