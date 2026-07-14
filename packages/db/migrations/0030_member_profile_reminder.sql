-- Migration: kolom baru public.members untuk pengingat lengkapi profil
-- Schema public — jalankan sekali, tidak perlu loop tenant.
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0030_member_profile_reminder.sql

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS welcome_sent_tenant_slug TEXT,
  ADD COLUMN IF NOT EXISTS profile_reminder_sent_at TIMESTAMPTZ;
