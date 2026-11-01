-- Migration P2: buku alamat per orang (anggota ATAU akun publik) — docs/arsitektur-alamat.md § 16.
-- Tabel PUBLIK; idempotent. WAJIB jalan SESUDAH 0084 (FK ke ro_destinations) dan SEBELUM deploy kode yang memakainya.
--
-- Jalankan: docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0086_address_book.sql

CREATE TABLE IF NOT EXISTS public.address_book (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      UUID        REFERENCES public.members(id)  ON DELETE CASCADE,
  profile_id     UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  label          TEXT        NOT NULL,
  recipient_name TEXT        NOT NULL,
  phone          TEXT        NOT NULL,
  destination_id INTEGER     NOT NULL REFERENCES public.ro_destinations(id),
  detail         TEXT        NOT NULL,
  is_default     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT address_book_owner_xor CHECK ((member_id IS NULL) <> (profile_id IS NULL))
);
CREATE INDEX IF NOT EXISTS address_book_member_idx  ON public.address_book (member_id);
CREATE INDEX IF NOT EXISTS address_book_profile_idx ON public.address_book (profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS address_book_member_default_uniq  ON public.address_book (member_id)  WHERE is_default AND member_id  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS address_book_profile_default_uniq ON public.address_book (profile_id) WHERE is_default AND profile_id IS NOT NULL;
