-- Upgrade member_businesses.sector dari 7 nilai lama ke 10 sektor taksonomi baru
-- (docs/arsitektur-usaha.md § 9). Kolom TEXT biasa TANPA CHECK constraint (dikonfirmasi via
-- \d member_businesses) — migrasi ini MURNI UPDATE data, tidak ada DDL berisiko (tidak perlu
-- DROP/ADD CONSTRAINT). Tabel public schema — jalan SEKALI, bukan loop per-tenant.
--
-- Mapping AMBIGU ("Kesehatan & Pendidikan", "Sumber Daya Alam" — 1-ke-banyak, tidak ada padanan
-- tunggal pasti) sengaja dikosongkan (NULL), bukan ditebak — pemilik usaha pilih ulang manual
-- lewat form (kolom sudah nullable sejak migration 0048). Keputusan user 2026-07-30.

UPDATE public.member_businesses SET sector = 'Teknologi & Informasi'     WHERE sector = 'Teknologi';
UPDATE public.member_businesses SET sector = 'Jasa Usaha & Keuangan'    WHERE sector = 'Jasa Profesional';
UPDATE public.member_businesses SET sector = 'Manufaktur & Pengolahan'  WHERE sector = 'Manufaktur';
UPDATE public.member_businesses SET sector = 'Perdagangan, Ritel & F&B' WHERE sector = 'Konsumsi & Ritel';
UPDATE public.member_businesses SET sector = NULL WHERE sector = 'Kesehatan & Pendidikan'; -- ambigu
UPDATE public.member_businesses SET sector = NULL WHERE sector = 'Sumber Daya Alam';        -- ambigu
-- 'Kreatif' tetap sama, tidak perlu UPDATE.
