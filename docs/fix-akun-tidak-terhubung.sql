-- ==========================================================================
-- Diagnosa & Fix: Better Auth users yang tidak terhubung ke identity apapun
-- Jalankan via: docker compose exec -T postgres psql -U jalakarta -d jalakarta
-- ==========================================================================

-- ── STEP 1: Diagnosa — lihat siapa yang bermasalah ────────────────────────────
--
-- Better Auth users yang tidak ada di:
--   1. public.members.better_auth_user_id  (anggota IKPM)
--   2. public.profiles.better_auth_user_id (akun publik)
--   3. tenant.users.better_auth_user_id    (pengurus)

SELECT
  u.id         AS auth_user_id,
  u.email      AS auth_email,
  u.name       AS auth_name,
  u.created_at AS registered_at
FROM public."user" u
WHERE u.id NOT IN (
  SELECT better_auth_user_id FROM public.members
  WHERE better_auth_user_id IS NOT NULL
)
AND u.id NOT IN (
  SELECT better_auth_user_id FROM public.profiles
  WHERE better_auth_user_id IS NOT NULL
)
AND u.id NOT IN (
  SELECT better_auth_user_id FROM "tenant_pc-ikpm-jogjakarta".users
  WHERE better_auth_user_id IS NOT NULL
)
ORDER BY u.created_at;


-- ── STEP 2: Backfill via email match (anggota yang email-nya cocok) ───────────
--
-- PREVIEW dulu — pastikan hasilnya masuk akal sebelum eksekusi UPDATE

SELECT
  m.id          AS member_id,
  m.name        AS member_name,
  m.email       AS member_email,
  u.id          AS auth_user_id,
  u.email       AS auth_email,
  u.created_at  AS auth_created_at
FROM public.members m
JOIN public."user" u ON LOWER(u.email) = LOWER(m.email)
WHERE m.better_auth_user_id IS NULL
  AND m.email IS NOT NULL
  AND m.email != '';

-- Setelah yakin preview hasilnya benar, jalankan UPDATE:
/*
UPDATE public.members m
SET better_auth_user_id = u.id
FROM public."user" u
WHERE LOWER(u.email) = LOWER(m.email)
  AND m.better_auth_user_id IS NULL
  AND m.email IS NOT NULL
  AND m.email != '';
*/


-- ── STEP 3: Backfill via tenant.users (pengurus yang juga anggota) ────────────
--
-- Untuk pengurus lama yang member_id-nya terhubung tapi better_auth_user_id di members belum diisi

UPDATE public.members m
SET better_auth_user_id = tu.better_auth_user_id
FROM "tenant_pc-ikpm-jogjakarta".users tu
WHERE tu.member_id = m.id
  AND m.better_auth_user_id IS NULL
  AND tu.better_auth_user_id IS NOT NULL;


-- ── STEP 4: Sisa yang tidak bisa di-backfill otomatis ─────────────────────────
--
-- Setelah Step 2 dan 3, jalankan lagi query STEP 1.
-- Jika masih ada baris → user ini perlu:
--   a. Keluar (sign out) via halaman /akun-error
--   b. Daftar ulang di /{slug}/register jalur Anggota IKPM
--      (sistem akan auto-link via email/HP/stambuk)
