-- Migration: kolom public.members.welcome_sent_at (flag notifikasi WA "Selamat Datang")
-- Schema public — jalankan sekali, tidak perlu loop tenant.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0029_member_welcome_sent_at.sql

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ;
