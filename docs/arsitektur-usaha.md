# Arsitektur Usaha Anggota (`/akun/usaha`) — Bidang Usaha & Rencana Jaringan Kolaborasi

> **Dokumen Terkait & Saling Terhubung**:
> - [`docs/arsitektur-usaha-taxonomy-gemini.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-usaha-taxonomy-gemini.md) — Rincian Sub-Sektor Tier 3 & 9 Sub-Bidang Custom Forcreator.
> - [`docs/arsitektur-ekosistem.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-ekosistem.md) — Payung Sinergi Interkoneksi Usaha, Profesional, & Pesantren (`offeredTags`/`neededTags`).
> - [`docs/arsitektur-profesional.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-profesional.md) — Taksonomi & Kredensial Profesional Perorangan.
> - [`docs/evaluasi-arsitektur-usaha-gemini.md`](file:///Users/webane/sites/jalajogja/docs/evaluasi-arsitektur-usaha-gemini.md) — Dokumen Hasil Evaluasi & Riset BPS KBLI 2020.

---

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

## 8. Fase 2 (SEDANG DIEKSEKUSI, 2026-07-29) — Tag Ekosistem `offeredTags`/`neededTags`

> Bagian ini SUPERSEDED oleh rencana payung **`docs/arsitektur-ekosistem.md` § 6 Fase 1** —
> dokumen itu adalah sumber kebenaran untuk keputusan lintas-modul (Usaha + Profesional +
> Pesantren sekaligus). Bagian ini dipertahankan sebagai catatan sejarah keputusan awal
> (kenapa fitur ini ditunda dulu, lalu kenapa akhirnya dieksekusi) + detail spesifik modul Usaha.

**Tujuan** (tidak berubah dari draft awal): retailer bisa menemukan produsen yang relevan, dan
sebaliknya — matchmaking sederhana lintas direktori Usaha/Profesional/Pesantren, bukan cuma
direktori pasif.

**Keputusan final (bukan lagi draft)**: field dinamai `offeredTags: string[]` (apa yang
ditawarkan/disuplai) dan `neededTags: string[]` (apa yang dicari/dibutuhkan) — **diseragamkan
namanya lintas SEMUA 3 modul** (Usaha, Profesional, Pesantren), bukan `supplies`/`seeking` yang
disketsakan draft awal — supaya query/helper API server dan komponen `<TagMultiSelect>` di ketiga
form self-service bisa memakai prop dan nama state yang identik (DRY).

Untuk Usaha spesifik: suggestion autocomplete `offeredTags`/`neededTags` REUSE vocabulary yang
sama dengan `businessFields` (via `lib/ecosystem-tags.ts`, aggregator — lihat
`arsitektur-ekosistem.md` § 6 Fase 1) — bukan vocabulary baru terpisah. Ini menjaga prinsip yang
sudah dikunci sejak awal: pencocokan "siapa yang menyediakan X" vs "siapa yang mencari X" bisa
langsung jalan dengan overlap query sederhana (`inArray`/JSONB containment) terhadap tag yang
sama, tanpa migrasi data ulang.

**Kenapa sempat ditunda, lalu jadi layak dieksekusi**: alasan penundaan asli (jangan bangun
`supplies`/`seeking` sebelum `businessFields` matang dan terisi organik) tetap valid sebagai
PRINSIP — tapi audit adopsi lokal (2026-07-29, `docs/arsitektur-ekosistem.md` § "Fase 0")
menunjukkan `businessFields` SUDAH terisi cukup baik di data yang ada (bukan kosong semua), jadi
fondasi kosakata dianggap cukup matang untuk lapis tag berikutnya. Field baru ini TETAP flat
`string[]` sederhana (BUKAN JSONB terstruktur dengan volume/satuan/geospasial) — itu ditunda ke
fase yang jauh lebih lanjut (Fase 4+ di `arsitektur-ekosistem.md`), kalau memang terbukti perlu.

**UI Fase 2** (`docs/arsitektur-ekosistem.md` § 6 Fase 2, BELUM dibangun di sesi ini — Fase 1
hanya menambah kolom+form): filter pencarian di direktori publik `/{slug}/usaha` berdasarkan
`offeredTags`/`neededTags`, plus cross-link ke direktori Profesional/Pesantren berbasis
tag-overlap sederhana. TANPA hub `/ekosistem` baru, TANPA algoritma matching kompleks.

**Status: ✅ kolom + form self-service + admin wizard SELESAI dieksekusi (2026-07-29, Fase 1
payung). Filter pencarian lintas-direktori (Fase 2 payung) belum dimulai.**

---

## 9. Rencana Transisi & Upgrade Sektor Usaha (BPS Hybrid + Mandiri Forcreator)

> ✅ **STATUS: SELESAI DIEKSEKUSI (2026-07-30).** `member_businesses.sector` sekarang 10 nilai
> baru (§ 9.2, TANPA sektor ke-11 `sec_other_services`/"Jasa Komunitas & Lainnya" — dibuang
> sesuai keputusan user, tetap persis 10 sektor). `lib/business-sectors.ts` (BARU) berisi
> `BUSINESS_SECTOR_ENUM`, `normalizeBusinessSector()` (backward-compat, 2 mapping ambigu —
> "Kesehatan & Pendidikan" dan "Sumber Daya Alam" — sengaja diarahkan ke `null`, bukan ditebak;
> data lokal terkonfirmasi nol baris kena kedua nilai ambigu itu saat migrasi dijalankan), dan
> `SECTOR_SUB_FIELDS`+`getPrioritizedBusinessFields()` untuk soft-prioritize (lihat di bawah).
> Migration `packages/db/migrations/0055_business_sector_taxonomy_upgrade.sql` — murni `UPDATE`
> data (kolom `sector` TEXT biasa tanpa CHECK constraint, dikonfirmasi via `\d
> member_businesses` — nol DDL berisiko), dijalankan LOKAL, belum di VPS.
>
> **Perluasan dari rencana asli § 9.3.B (dikonfirmasi user sebelum eksekusi)**: SEMUA ~52 label
> Sub-Sektor (Tier 3, `docs/arsitektur-usaha-taxonomy-gemini.md`) digabung SEKALIGUS ke
> `lib/business-fields.ts`'s `BUSINESS_FIELD_SUGGESTIONS` (bukan cuma rename sektor Tier-2) —
> supaya bisa juga dipakai untuk `offeredTags`/`neededTags` lewat `ecosystem-tags.ts` yang sudah
> aggregate dari situ. Wording Kreatif diadopsi PERSIS dari taxonomy-gemini.md (beda tipis dari 9
> item lama business-fields.ts — field creatable, tag lama di data manapun tidak pernah rusak).
>
> **`businessFields` TETAP TIDAK di-hard-filter oleh `sector`** — prinsip § 2-3 (facet
> independen, bukan hierarki) dipertahankan. Sebagai gantinya: **soft-prioritize** —
> `getPrioritizedBusinessFields(sector)` menaruh Tier-3 milik sektor terpilih di URUTAN PALING
> ATAS daftar saran `TagMultiSelect`, tapi seluruh ~52 tag tetap bisa dicari/diketik bebas, tidak
> ada yang disembunyikan (keputusan eksplisit user — hard-filter ditolak karena banyak Tier-3
> seperti "Desain Komunikasi Visual" natural masuk >1 sektor).
>
> **6 titik kode diupdate** (di luar schema+migration): `lib/import-anggota-mapping.ts`
> (`BUSINESS_SECTOR_ENUM`/`mapSector` sekarang re-export dari `business-sectors.ts`, bukan
> definisi lokal), `usaha-client.tsx` + `step4-business.tsx` (`SECTORS`/`SECTOR_ITEMS` const +
> `TagMultiSelect` options pakai `getPrioritizedBusinessFields`), `api/akun/member-business/
> route.ts` + admin `members/actions.ts` (inline TS union cast → `as BusinessSector`),
> `usaha/page.tsx` + `usaha-filters-client.tsx` (`SEKTOR_OPTIONS` duplikat, keduanya diupdate).
>
> `tsc --noEmit` 0 error kedua package + `bun run build --filter=@jalajogja/web` genuine sukses
> + disposable test verifikasi `getPrioritizedBusinessFields`/`normalizeBusinessSector` (semua
> PASS — total 52 item konsisten, nol duplikat, Kreatif prioritize benar, mapping ambigu→null
> benar). **Belum dijalankan di VPS, belum di-commit/push, belum diverifikasi visual di
> browser** — user perlu coba pilih sektor di `/akun/usaha` atau admin wizard, konfirmasi
> Tier-3 sektor terkait muncul duluan di dropdown "Bidang Usaha".
>
> **Rujukan Analisis**: [`docs/evaluasi-arsitektur-usaha-gemini.md`](file:///Users/webane/sites/jalajogja/docs/evaluasi-arsitektur-usaha-gemini.md) dan [`docs/arsitektur-profesional.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-profesional.md).
> Ditambahkan: 2026-07-29. Updated: 2026-07-30.

### 9.1 Evaluasi & Aturan Kunci Arsitektur

1. **Sektor `Kreatif` WAJIB Berdiri Sendiri (Kebutuhan Spesifik Forcreator)**:
   - Berbeda dari KBLI BPS murni yang menggabungkan Industri Kreatif ke Informasi/Media, **Sektor `Kreatif` WAJIB dipertahankan sebagai sektor mandiri**.
   - Ini adalah *hard-requirement* untuk komunitas **Forcreator** (forum pelaku seni, desainer, media rekam, audio visual, kaligrafi, kriya, pertunjukan, dll) agar dapat difilter dan dikelompokkan secara independen di direktori usaha.

2. **Harmonisasi dengan Modul Profesional (`docs/arsitektur-profesional.md`)**:
   - Jalakarta telah memiliki modul terpisah `public.member_professionals` ([`docs/arsitektur-profesional.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-profesional.md)) untuk mencatat kredensial profesional individu (dokter, pengacara, akuntan, dosen, konsultan, insinyur, dll).
   - Oleh karena itu, taksonomi Sektor Usaha pada `member_businesses` **dibuat lebih sederhana dan murni berfokus pada entitas bisnis/lembaga**, tanpa membebani entitas usaha dengan spesialisasi profesi perorangan yang rumit, guna mencegah duplikasi atau konflik data antar modul.

3. **Pemisahan "Kesehatan" & "Pendidikan"**:
   - Sektor Kesehatan (KBLI Q - Klinik, Apotek, Alkes) dan Pendidikan (KBLI P - Sekolah, Pesantren, Bimbel) dipisah tegas karena memiliki *supply chain* dan regulasi legalitas yang sangat bertolak belakang.

---

### 9.2 Taksonomi Terencana: 10 Sektor Usaha Hybrid (Tier 2 & Tier 3 Sub-Sektor)

> **Dokumen Rincian Sub-Sektor Tier 3**: [`docs/arsitektur-usaha-taxonomy-gemini.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-usaha-taxonomy-gemini.md).

Daftar sektor utama (Tier 2) direncanakan terdiri dari **10 Sektor Mandiri Hybrid**, dengan rincian sub-sektor (Tier 3) custom untuk komunitas:

| ID / Value | Label Sektor Baru | Pengelompokan & Catatan Sub-Sektor Tier 3 |
|---|---|---|
| `sec_agriculture` | **Pertanian, Peternakan & Perikanan** | Agribisnis, tanaman pangan, perkebunan, peternakan, perikanan. |
| `sec_manufacturing` | **Manufaktur & Pengolahan** | Pabrik, olahan pangan, tekstil/konveksi, kemasan, perakitan. |
| `sec_trade_retail` | **Perdagangan, Ritel & F&B** | Toko ritel, grosir, kuliner/F&B, catering harian. |
| `sec_technology` | **Teknologi & Informasi** | Software development, SaaS, IT infrastructure, pemasaran digital, publishing. |
| `sec_creative` | **Kreatif** *(Mandiri — Custom Forcreator)* | **10 Sub-Bidang Custom Forcreator**: `Event` · `Kaligrafi` · `Desain Komunikasi Visual` · `Seni Teater dan Sastra` · `Seni Media Rekam` · `Seni Lukis dan Illustrasi` · `Seni Musik` · `Seni Instalasi dan Kontemporer` · `Seni Kriya`. |
| `sec_logistics_construction` | **Logistik, Transportasi & Konstruksi** | Ekspedisi, armada kurir, pergudangan, kontraktor, bahan bangunan. |
| `sec_business_services` | **Jasa Usaha & Keuangan** | Konsultan bisnis, legal, notaris, BMT/Koperasi Usaha, SDM. |
| `sec_education` | **Pendidikan & Pelatihan** | Sekolah, pesantren, bimbel, pusat pelatihan vokasi *(Dipisah dari Kesehatan)*. |
| `sec_health` | **Kesehatan, Farmasi & Herbal** | Klinik, apotek, produsen herbal, alat kesehatan (alkes) *(Dipisah dari Pendidikan)*. |
| `sec_energy_resources` | **Sumber Daya Alam & Energi** | Pertambangan, pengolahan air, energi terbarukan, pengelolaan limbah. |

---

### 9.3 Strategi Migrasi Data & Mitigasi Risiko

#### A. Mitigasi Potensi Data Hilang (*Zero Data Loss Mitigation*)
1. **Keamanan Database Schema**:
   - Sejak migration `0048` (`0048_business_category_sector_nullable.sql`), kolom `sector` pada `public.member_businesses` bertipe `text` biasa **tanpa NOT NULL** dan **tanpa PostgreSQL pgEnum constraint**.
   - Artinya, pembaruan daftar enum di Drizzle TypeScript **TIDAK memerlukan DDL SQL berisiko tinggi** (`ALTER TABLE`). Data lama aman 100% dan tidak akan memicu database error.
2. **Helper Mapping Dual Compatibility (`normalizeBusinessSector`)**:
   - Dibuat helper sentral `normalizeBusinessSector(rawSector)` yang mampu memetakan sektor lama secara otomatis saat dibaca:
     - `"Teknologi"` ➔ `"Teknologi & Informasi"`
     - `"Kreatif"` ➔ `"Kreatif"` *(Tetap utuh, tidak diubah)*
     - `"Jasa Profesional"` ➔ `"Jasa Usaha & Keuangan"`
     - `"Manufaktur"` ➔ `"Manufaktur & Pengolahan"`
     - `"Kesehatan & Pendidikan"` ➔ Dipetakan secara cerdas ke `"Pendidikan & Pelatihan"` atau `"Kesehatan, Farmasi & Herbal"`.
     - `"Konsumsi & Ritel"` ➔ `"Perdagangan, Ritel & F&B"`
     - `"Sumber Daya Alam"` ➔ `"Pertanian, Peternakan & Perikanan"` atau `"Sumber Daya Alam & Energi"`.

#### B. Mitigasi Error & Bug pada Kode (8 Touchpoints Update Check List)
Setiap agent atau developer yang mengeksekusi upgrade Sektor BPS ini **WAJIB** memperbarui 8 titik sentuh kode secara bersamaan:
1. `packages/db/src/schema/public/member-businesses.ts` (Drizzle schema `sector` enum definition).
2. `apps/web/lib/business-sectors.ts` (Registry Sektor + Helper Dual-Compatibility Mapping).
3. `apps/web/app/(public)/[tenant]/akun/usaha/usaha-client.tsx` (Dropdown Sektor Form Self-Service Anggota).
4. `apps/web/components/members/wizard/step4-business.tsx` (Dropdown Sektor Form Admin Wizard).
5. `apps/web/app/(dashboard)/app/[tenant]/members/actions.ts` (`saveMemberBusinessesAction` type assertion & validation).
6. `apps/web/app/api/akun/member-business/route.ts` (API endpoint self-service `POST/PATCH`).
7. `apps/web/lib/import-anggota-mapping.ts` & `import-anggota.server.ts` (Logika auto-mapping sektor saat bulk import Excel/CSV).
8. `apps/web/components/usaha/usaha-filters-client.tsx` & `app/(public)/[tenant]/usaha/page.tsx` (Filter pencarian direktori publik).

---

## 10. Aturan Validasi Field Wajib Usaha (Mandatory Fields Rule)

Sesuai keputusan arsitektur dan penyelarasan form (2026-07-30), data usaha anggota (`public.member_businesses`) mewajibkan kelengkapan **11 Field Data Usaha Utama** (ditambah 3 field dasar `name`, `category`, `sector`).

Aturan validasi wajib ini ditegakkan secara **simetris & identik** di dua lokasi form:
1. **Form Self-Service Anggota (`/akun/usaha`)**: client-side validation (`saveEditing()`) & penanda UI bintang merah (`*`).
2. **Form Admin Wizard / Edit Anggota (`step4-business.tsx` & `saveMemberBusinessesAction`)**: client-side & server action validation.

### Daftar 11 Field Wajib Usaha:
1. **Logo Usaha** (`logoUrl`): Wajib diunggah via Member Media Picker (`Logo usaha wajib diunggah.`).
2. **Foto Sampul Usaha** (`coverUrl`): Wajib diunggah via Member Media Picker (`Foto sampul usaha wajib diunggah.`).
3. **Deskripsi Usaha** (`description`): Wajib diisi deskripsi ringkas produk/layanan (`Deskripsi usaha wajib diisi.`).
4. **Legalitas Usaha** (`legality`): Wajib dipilih (mis. PT, CV, UD, Perorangan, dst) (`Legalitas usaha wajib dipilih.`).
5. **Posisi dan Jabatan** (`position`): Wajib dipilih (mis. Owner, Founder, Direktur, dst) (`Posisi dan jabatan wajib dipilih.`).
6. **Bidang Usaha** (`businessFields`): Wajib dipilih minimal 1 tag bidang usaha (`Bidang usaha (minimal 1 tag) wajib dipilih.`).
7. **Jumlah Karyawan** (`employees`): Wajib dipilih kisaran jumlah karyawan (`Jumlah karyawan wajib dipilih.`).
8. **Jumlah Cabang** (`branches`): Wajib dipilih kisaran jumlah cabang (`Jumlah cabang wajib dipilih.`).
9. **Omzet Usaha** (`revenue`): Wajib dipilih kisaran omzet per tahun (`Omzet usaha wajib dipilih.`).
10. **Alamat Usaha (Min. Kecamatan)**:
    - Mode Indonesia: Wajib terisi Provinsi, Kab/Kota, dan Kecamatan (`addressDistrictId`) (`Alamat usaha wajib diisi minimal sampai tingkat Kecamatan.`).
    - Mode Luar Negeri: Wajib terisi Nama Negara (`addressCountry`) (`Negara alamat usaha wajib diisi.`).
11. **Nomor WhatsApp** (`whatsapp`): Wajib diisi nomor WhatsApp valid atau centang *"Sama dengan nomor telepon"* (`Nomor WhatsApp usaha wajib diisi.`).

### Integrasi Tag Sinergi Ekosistem (`offeredTags` / `neededTags`):
Field **Menawarkan** (`offeredTags`) dan **Membutuhkan** (`neededTags`) diintegrasikan dengan komponen `TagMultiSelect` berbasis `ECOSYSTEM_TAG_SUGGESTIONS` (`apps/web/lib/ecosystem-tags.ts`), memungkinkan sinergi pasokan dan kebutuhan secara fleksibel antar-modul **Usaha, Profesional, dan Pesantren**.


