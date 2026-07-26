# Arsitektur Usaha Anggota (`/akun/usaha`) — Bidang Usaha & Rencana Jaringan Kolaborasi

## 1. Latar Belakang

Modul Usaha (`public.member_businesses`) sudah lama ada — self-report data usaha/bisnis anggota
IKPM, pola identik `member_owned_pesantren`/`member_professionals`. Klasifikasi yang sudah ada:

```
category: "Jasa" | "Produsen" | "Distributor" | "Trading" | "Profesional"
sector:   "Teknologi" | "Jasa Profesional" | "Kreatif" | "Manufaktur" |
          "Kesehatan & Pendidikan" | "Konsumsi & Ritel" | "Sumber Daya Alam"
```

> **Update 2026-07-25 (migration `0048`)**: kedua kolom di atas **nullable di database** —
> sebelumnya `NOT NULL`, dilonggarkan supaya fitur bulk import (`docs/arsitektur-import-
> anggota.md` § 13) bisa simpan data usaha yang belum lengkap klasifikasinya tanpa membuang
> seluruh baris (nama, deskripsi, alamat, kontak, sosial media). **Form self-service
> (`/akun/usaha`) dan admin (wizard members) TIDAK BERUBAH** — keduanya tetap mewajibkan
> `category`+`sector` diisi sebelum bisa menyimpan (filter di `saveMemberBusinessesAction` +
> `POST /api/akun/member-business`, sudah ada sejak awal, dipertahankan apa adanya). Pola ini
> sama persis dengan `members.gender`/`members.birthDate`/`contacts.phone` — wajib di FORM,
> bukan di kolom.

Diskusi 2026-07-24 (dipicu penambahan kategori profesi "Kreatif" untuk forum "Forcreator") —
user bertanya: bisakah 9 "Bidang Usaha" spesifik forum itu (Kaligrafi, Desain Komunikasi
Visual, dst) dimasukkan ke `/akun/usaha` juga? Dan lebih jauh: tujuan akhirnya BUKAN sekadar
data lebih detail, tapi **memungkinkan relasi/kolaborasi antar usaha** — mis. retailer bisa
menemukan produsen yang relevan untuk disourcing.

## 2. Masalah: "Sub-Sektor" Bukan Struktur Pohon yang Benar

Percobaan pertama membayangkan struktur bertingkat: `sector` → `sub-sector` (9 bidang forcreator
di bawah "Kreatif"). User sendiri menemukan masalahnya lebih dulu sebelum implementasi: **bidang
usaha spesifik sering tumpang tindih lintas sektor**. Contoh konkret: "Desain Komunikasi Visual"
secara natural masuk akal sebagai **"Kreatif"** (kreatif secara sifat) MAUPUN **"Jasa
Profesional"** (jasa yang ditawarkan) — tidak ada satu induk yang "benar".

**Kesimpulan**: `sector` (klasifikasi ekonomi kasar, 7 nilai) dan "bidang usaha spesifik"
(Kaligrafi, DKV, dst) BUKAN relasi induk-anak — keduanya adalah **dua facet independen** yang
kebetulan sering berkorelasi, bukan hierarki. Memaksakannya jadi tree akan selalu menghasilkan
pertanyaan "yang mana induknya?" tanpa jawaban tunggal yang benar.

## 3. Keputusan — Facet Independen, Bukan Hierarki

`sector` **TIDAK diubah sama sekali** — tetap single-select, 7 nilai, tetap dipakai untuk
statistik/reporting level kasar yang sudah ada.

**Field baru**: `businessFields: string[]` — **multi-select tag, satu daftar datar** yang
**tidak dimiliki satu sektor tertentu**. Satu usaha bisa punya beberapa tag sekaligus, terlepas
dari sektor yang dipilih. Tidak ada constraint "tag X hanya boleh dipakai kalau sector=Y".

Daftar kurasi awal (`BUSINESS_FIELD_SUGGESTIONS` di `lib/business-fields.ts`) memakai **9 Bidang
Usaha ASLI dari data forcreator** (bukan versi lebih pecah seperti daftar `professionType`
"Kreatif" — lihat § 4 untuk alasan perbedaan ini):

```
Kaligrafi
Desain Komunikasi Visual
Interior & Arsitektur
Teater & Sastra
Media Rekam (Film, Fotografi & Audio Visual)
Seni Lukis & Ilustrasi
Seni Musik
Seni Instalasi & Kontemporer
Seni Kriya
```

Combobox bertipe **creatable** (kurasi + custom, pola sama `ProfessionTypeCombobox`) — anggota
tetap bisa mengetik bidang lain yang belum ada di daftar. Daftar ini dirancang untuk terus
bertambah seiring waktu (bidang dari sektor lain, bukan cuma Kreatif) — TIDAK dibatasi
per-sektor karena memang bukan hierarki (§ 2).

## 4. Kenapa Daftarnya Beda dari `professionType` "Kreatif"

Kategori profesi "Kreatif" (`lib/professional-types.ts`) memecah bidang jadi **~15 profesi
spesifik per JABATAN individu** (mis. Media Rekam → Fotografer / Videografer / Editor — 3
profesi berbeda, karena itu 3 pekerjaan berbeda untuk seorang PROFESIONAL individu).

Untuk **USAHA** (entitas bisnis, bukan individu), pemecahan itu tidak masuk akal — satu usaha
(mis. rumah produksi) bisa sekaligus menyediakan fotografi+videografi+editing di bawah satu
badan usaha. Maka `businessFields` memakai **9 Bidang Usaha ASLI** (level industri/domain),
bukan pecahan per-jabatan seperti `professionType`. Dua daftar ini sengaja TIDAK sama persis
meski sumbernya sama.

## 5. Skema

```typescript
// packages/db/src/schema/public/member-businesses.ts
businessFields: jsonb("business_fields").$type<string[]>().notNull().default([]),
```

Migration: `packages/db/migrations/0044_member_business_fields.sql` — `ALTER TABLE
public.member_businesses ADD COLUMN IF NOT EXISTS business_fields JSONB NOT NULL DEFAULT
'[]'::jsonb`. Tabel di PUBLIC schema (bukan per-tenant) — migration jalan SEKALI, tidak perlu
loop `DO $$ ... LOOP` seperti migration `settings.group`.

Index tambahan: **tidak ditambahkan sekarang** — GIN index untuk query JSONB array baru relevan
begitu ada fitur pencarian/pencocokan sungguhan (§ 8 Fase 2). Menambahnya sekarang tanpa query
yang memakainya cuma overhead penulisan tanpa manfaat baca.

## 6. Komponen UI Baru — `TagMultiSelect`

`components/ui/tag-multi-select.tsx` — generik, dipakai di SEMUA tempat yang butuh multi-select
dengan autocomplete + rekomendasi (bukan cuma usaha). Beda dari `TagInput` (`post-form.tsx`,
khusus tag artikel — DB-backed, panggil server action untuk buat tag baru): `TagMultiSelect`
murni client-side, value adalah `string[]` polos, tidak ada konsep "ID"/"buat entity baru di DB"
— custom value yang diketik user langsung jadi bagian array, disimpan sebagai JSONB.

Interaksi (pola sama `TagInput`): pills terpilih + input dengan dropdown autocomplete
(`Popover`+`Command`) + koma/Enter untuk tambah + backspace saat input kosong untuk hapus tag
terakhir + opsi "buat baru" muncul kalau ketikan tidak cocok satu pun rekomendasi.

## 7. Titik Integrasi (Fase 1 — dieksekusi)

- `apps/web/lib/business-fields.ts` (baru) — `BUSINESS_FIELD_SUGGESTIONS: string[]`
- `apps/web/app/(public)/[tenant]/akun/usaha/usaha-client.tsx` — field baru di section
  Klasifikasi, `TagMultiSelect` dengan `BUSINESS_FIELD_SUGGESTIONS`
- `apps/web/app/api/akun/member-business/route.ts` — GET/POST baca+tulis `businessFields`
- `apps/web/components/members/wizard/step4-business.tsx` — form admin, field yang sama
- `apps/web/app/(dashboard)/app/[tenant]/members/actions.ts` — `saveMemberBusinessesAction`
  baca+tulis `businessFields`

Sesuai aturan project "Setiap perubahan form anggota → update KEDUA tempat (front-end + admin)
sekaligus" — kedua form (self-service DAN admin wizard) diupdate bersamaan, bukan salah satu.

## 8. Fase 2 (BELUM Dibangun) — Jaringan Kolaborasi/Pencocokan

**Didokumentasikan sekarang atas permintaan eksplisit user** ("bagus untuk dicatat dalam
arsitektur"), TAPI implementasinya DITUNDA — bukan bagian scope Fase 1.

**Tujuan**: retailer bisa menemukan produsen yang relevan, dan sebaliknya — matchmaking B2B di
antara sesama anggota IKPM, bukan cuma direktori pasif.

**Model data yang direkomendasikan** (draft, belum final):
- `supplies: string[]` — "yang saya sediakan/tawarkan" (tag dari vocabulary yang sama dengan
  `businessFields`)
- `seeking: string[]` — "yang saya cari/butuhkan" (tag dari vocabulary yang sama)

Kedua field ini SENGAJA memakai **vocabulary yang sama** dengan `businessFields` (bukan
vocabulary baru terpisah) — supaya begitu Fase 2 dibangun, pencocokan "siapa yang menyediakan X"
vs "siapa yang mencari X" bisa langsung jalan dengan `inArray`/overlap query sederhana terhadap
tag yang SUDAH ada, tanpa perlu migrasi data ulang.

**Kenapa ditunda sekarang**: kalau `supplies`/`seeking` dibangun SEBELUM `businessFields` (tag
vocabulary dasar) matang dan terisi cukup banyak, kedua field itu akan jadi free-text tidak
terstruktur yang susah dicocokkan otomatis. Urutan yang benar: bangun kosakata dulu
(`businessFields`, Fase 1), biarkan terisi secara organik, BARU bangun mesin pencocokan di
atasnya (Fase 2).

**Kemungkinan UI Fase 2** (belum didesain detail, sekadar arah): halaman "Cari Mitra Usaha" di
`/{slug}/usaha` (direktori publik) atau `/akun/usaha` — filter "saya butuh X" → tampilkan semua
usaha dengan `supplies` mengandung X. Atau notifikasi otomatis saat ada usaha baru yang
`supplies`-nya cocok dengan `seeking` usaha lain (lebih kompleks, kandidat jangka lebih panjang).

**Status: perencanaan konseptual saja, urutan eksekusi belum ditentukan, menunggu sinyal user.**
