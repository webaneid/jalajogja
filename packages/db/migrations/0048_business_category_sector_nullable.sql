-- member_businesses.category dan .sector dilonggarkan dari NOT NULL — pola yang sama
-- dengan members.gender/members.birth_date/contacts.phone/contacts.whatsapp: wajib diisi
-- di FORM (self-service + admin, sudah ditegakkan di kode aplikasi, tidak berubah), tapi
-- tidak dipaksa di level database. Alasan: import bulk (docs/arsitektur-import-anggota.md)
-- perlu bisa menyimpan data usaha yang belum lengkap klasifikasinya tanpa membuang seluruh
-- baris (nama, deskripsi, alamat, kontak, sosial media) — anggotanya melengkapi sendiri nanti
-- via /akun/usaha, sama seperti field lain yang boleh kosong sampai dilengkapi sendiri.

ALTER TABLE public.member_businesses ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.member_businesses ALTER COLUMN sector DROP NOT NULL;
