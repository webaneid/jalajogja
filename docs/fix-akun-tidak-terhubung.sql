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
-- CATATAN: public.members TIDAK punya kolom email.
-- Email anggota disimpan di public.contacts via FK members.contact_id.
-- Join path: members → contacts → user (match by email)
--
-- PREVIEW dulu — pastikan hasilnya masuk akal sebelum eksekusi UPDATE

SELECT
  m.id          AS member_id,
  m.name        AS member_name,
  c.email       AS contact_email,
  u.id          AS auth_user_id,
  u.email       AS auth_email,
  u.created_at  AS auth_created_at
FROM public.members m
JOIN public.contacts c ON c.id = m.contact_id
JOIN public."user" u ON LOWER(u.email) = LOWER(c.email)
WHERE m.better_auth_user_id IS NULL
  AND c.email IS NOT NULL
  AND c.email != '';

-- Setelah yakin preview hasilnya benar, jalankan UPDATE:
/*
UPDATE public.members m
SET better_auth_user_id = u.id
FROM public.contacts c
JOIN public."user" u ON LOWER(u.email) = LOWER(c.email)
WHERE c.id = m.contact_id
  AND m.better_auth_user_id IS NULL
  AND c.email IS NOT NULL
  AND c.email != '';
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


-- ── STEP 4: Cleanup akun orphan (tidak bisa di-backfill) ─────────────────────
--
-- Akun yang tidak cocok dengan member manapun via email/HP → kemungkinan:
--   a. User daftar dengan email berbeda dari yang di contacts
--   b. Register flow gagal di tengah jalan (insert profiles/members gagal,
--      tapi Better Auth account sudah terbuat)
--
-- Untuk kasus (b): hapus akun Better Auth-nya agar user bisa daftar ulang bersih.
-- Untuk kasus (a): user cukup keluar dari /akun-error, lalu login dengan email yang benar.
--
-- PREVIEW dulu — pastikan tidak ada akun yang seharusnya dipertahankan:
/*
SELECT u.id, u.email, u.name, u.created_at
FROM public."user" u
WHERE u.id NOT IN (
  SELECT better_auth_user_id FROM public.members   WHERE better_auth_user_id IS NOT NULL
)
AND u.id NOT IN (
  SELECT better_auth_user_id FROM public.profiles  WHERE better_auth_user_id IS NOT NULL
)
AND u.id NOT IN (
  SELECT better_auth_user_id FROM "tenant_pc-ikpm-jogjakarta".users WHERE better_auth_user_id IS NOT NULL
);

-- Setelah yakin, hapus:
DELETE FROM public."user"
WHERE id IN (
  -- paste ID dari hasil PREVIEW di atas
  '5nsYU1rI8SCLum5GZf4EXG2y2RFmRt2i'  -- wasugi@gmail.com (orphan, Wawan login dgn email yg salah)
);
*/


-- ── STEP 5: Verifikasi akhir ──────────────────────────────────────────────────
--
-- Jalankan lagi STEP 1 — hasilnya harus 0 rows.
-- Jika masih ada → user tersebut perlu:
--   a. Keluar (sign out) via halaman /{slug}/akun-error
--   b. Daftar ulang di /{slug}/register jalur Anggota IKPM
--      (sistem akan auto-link via email/HP)
