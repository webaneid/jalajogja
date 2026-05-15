-- ── Migration 0014: Kolom baru di public.members ──────────────────────────────
-- better_auth_user_id: link ke Better Auth user untuk login front-end anggota IKPM
-- graduation_period: sub-periode angkatan 1999 (awal/akhir)
-- wali_santri: nama wali santri (opsional)

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS better_auth_user_id TEXT
    UNIQUE REFERENCES public.user(id) ON DELETE SET NULL;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS graduation_period TEXT
    CHECK (graduation_period IN ('awal', 'akhir'));

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS wali_santri TEXT;

CREATE INDEX IF NOT EXISTS idx_members_better_auth_user_id
  ON public.members(better_auth_user_id)
  WHERE better_auth_user_id IS NOT NULL;

-- wali_santri di public.profiles (untuk akun publik non-anggota IKPM)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wali_santri TEXT;
