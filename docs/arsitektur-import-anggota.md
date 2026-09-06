# Arsitektur Import Anggota — Bulk Import Database Excel/CSV

> **§ 22 (2026-07-31)**: template Excel diverifikasi + 1 bug ditemukan+difix (contoh sektor
> lama di `EXAMPLE_ROW`, sudah COMMITTED), Panduan Sektor+Bidang Usaha digabung jadi list
> bertingkat copy-paste, rule "auto-join forum" — member yang datanya SUDAH ditaruh admin
> langsung di database tenant forum (import ATAU tambah manual) otomatis dianggap anggota resmi
> HANYA JIKA sudah punya Nomor Keanggotaan (tidak ada lagi ajakan "Gabung X" untuk baris itu) —
> TAPI overlay "Lengkapi Data" tetap wajib tampil kalau profil belum lengkap (independen status
> join). **§ 22.4 DIBATALKAN — SUPERSEDED oleh § 22.5**: sempat ditulis "member baru forum
> selalu auto-generate Nomor Keanggotaan kalau kosong" (commit `2d9bb47`), TAPI dikoreksi
> eksplisit oleh user: kosong berarti belum terdaftar; nomor TIDAK PERNAH digenerate saat
> import/admin-add — hanya jadi PENANDA status (ada nomor → active, tidak ada → tetap pending)
> supaya urutan sequence forum tidak pernah dikarang untuk data lama. Auto-generate TETAP
> eksklusif milik `/gabung`'s `joinForumAction`. Baca § 22.5 untuk perilaku final.

> **Status: ✅ KODE SELESAI (2026-07-26), 2 PIVOT ARSITEKTUR (§ 13 + § 14) + FITUR KOLOM PC IKPM CABANG (§ 20) +
> BUG KRITIS KEDUA DITEMUKAN+DIFIX SEBELUM TESTING (§ 21)** — **§ 21: baris "duplicate" (member
> sudah jadi anggota tenant ini) sebelumnya IKUT membuat member+contact+address BARU yang ganda
> setiap kali di-commit — ditemukan dari audit baca-kode ULANG sebelum user benar-benar upload
> file, BELUM PERNAH menyebabkan data ganda nyata tersimpan (tertutup oleh bug § 17 yang sudah
> lebih dulu menggagalkan baris itu). Sudah difix (1 kondisi boolean).** § 20 menambahkan kolom
> opsional PC IKPM Cabang (45 kolom) + sheet ke-3 "Daftar PC IKPM Cabang" di file Excel template
> serta auto-sync ke tenant cabang.
> **§ 17 adalah bug KRITIS ditemukan dari testing sungguhan PERTAMA KALI** (upload file nyata) — SEMUA baris yang match member existing gagal
> commit total (SQL error tertangkap diam-diam, baris di-skip meski pesan bilang akan
> diproses). Sudah difix DAN DIRE-VERIFIKASI ulang (§ 17.6, solid di kedua lapis) — TAPI
> re-verifikasi itu murni baca-kode, belum ada upload sungguhan untuk konfirmasi fungsional.
> § 18 dan § 19 adalah bug TERPISAH (bukan bagian pipeline import, ditemukan admin saat cek
> form sebelum benar-benar mulai import): § 18 — edit anggota via dashboard admin tidak pernah
> generate No. Anggota saat tanggal lahir baru diisi; § 19 — kabupaten tempat lahir tampak
> "tidak tersimpan" di form edit padahal DB-nya benar (bug tampilan, RegencyCombobox butuh nama
> selain ID untuk render pilihan awal). Ketiga-tiganya sudah difix. **Gap terbuka yang perlu
> diwaspadai user saat testing (§ 21.3)**: re-import file yang sama untuk member yang sudah
> punya data usaha akan menduplikasi `member_businesses` — belum ada kebijakan dedup, cek manual
> kalau terjadi. `tsc --noEmit`
> bersih di kedua package + `bun run build --filter=@jalajogja/web` sukses, kedua route baru
> (`/app/{slug}/members/import` + `/api/members/import/template`) terkonfirmasi muncul di
> build output. Migration `0047`+`0048` dijalankan+diverifikasi di lokal. **PENTING**: § 4e,
> § 4f, § 6, dan bagian template di § 7/§ 8 di bawah **SUDAH TIDAK BERLAKU** — dua kali
> ditulis ulang: § 13 mengubah pendekatan dari "tebak/terjemahkan struktur eksternal" menjadi
> "template = struktur kita sendiri" (tapi masih menyusun kolom dari struktur file Forcreator
> yang direformat, bukan dari audit skema independen), lalu **§ 14 mengoreksi § 13 sendiri** —
> nama kolom "Forbis ID" ternyata istilah internal SATU forum yang lolos ke template
> "generik", dan 10 kolom eligibility (`birthDate`, `waliSantri`, `domicileStatus`,
> `professionId`, dll) sama sekali tidak ada karena template masih dibentuk dari kolom yang
> KEBETULAN ada di Excel, bukan dari survei penuh skema `members`. **Baca § 14 untuk cara
> kerja yang berlaku SEKARANG** — § 13 dipertahankan sebagai catatan sejarah kenapa
> `category`/`sector` jadi nullable (itu bagian yang TETAP valid dari § 13), tapi bagian
> daftar kolom templatenya sendiri sudah digantikan § 14. **Belum dijalankan di VPS, belum
> di-commit/push, belum diverifikasi visual di browser (upload file sungguhan belum dicoba
> sama sekali).**

## 1. Tujuan & Prinsip

Tenant (forum, cabang, atau marhalah mana pun) punya database anggota lama di Excel/CSV yang
perlu masuk ke sistem sebagai anggota resmi — identitas, kontak, alamat, dan (untuk forum
seperti Forcreator) data usaha. Perlu **satu tool reusable** di dashboard admin — bukan script
sekali-pakai — yang bisa dipakai tenant mana pun, kapan pun (termasuk import susulan saat data
tambahan datang, sesuai konteks user: "masih beberapa blm ada memang").

**Prinsip kunci yang dikunci:**
1. **Reusable, tidak tenant-spesifik** — tool hidup di route generik `/app/{slug}/members/import`,
   dipakai tenant mana pun. TIDAK ada kode yang hardcode "Forcreator" atau path file tertentu.
2. **Template tetap, bukan column-mapper dinamis** — tool mengharapkan data dalam **satu bentuk
   template yang kita definisikan** (identitas + kontak + alamat + maksimal 1 usaha per baris —
   persis bentuk file Forcreator ini). Admin tenant lain mengisi ulang ke template yang sama,
   bukan upload sembarang bentuk spreadsheet lalu sistem menebak-nebak kolom mana untuk apa.
   Ini keputusan scope: column-mapper dinamis (Mailchimp-style "cocokkan kolom Anda ke field
   kami") adalah pengembangan besar tersendiri — dicatat sebagai kemungkinan Fase 2 di § 9,
   bukan dibangun sekarang.
3. **Preview sebelum commit, selalu** — tidak ada baris yang langsung masuk DB dari upload.
   Ada langkah "lihat hasil parsing + matching + pemetaan enum, koreksi kalau perlu, baru
   konfirmasi simpan".
4. **Data tidak lengkap tidak menghalangi import** — baris dengan field kosong/tidak bisa
   dipetakan tetap masuk (field itu di-null-kan), dicatat di laporan, bukan digagalkan.
5. **Import ≠ pendaftaran self-service** — anggota yang diimport TIDAK melalui `/gabung` dan
   TIDAK otomatis aktif. Mereka tercatat sebagai `forum_status='pending'` (khusus tenant tipe
   forum — untuk cabang/marhalah tidak ada status "pending" semacam ini, lihat § 5) sampai
   mereka login sendiri, melengkapi profil, dan klik "Gabung" — jalur yang **sudah berfungsi
   penuh tanpa kode baru** (§ 5.3).

## 2. Isi File Sumber (Forbis Database) — Hasil Analisis

File `docs/template/database-forbis.xlsx` — 1 sheet "ANGGOTA RESMI", 37 kolom, 1951 baris
mentah tapi **hanya 749 baris berisi data nyata** (1202 baris kosong total = artefak
formatting, harus di-skip saat parsing, bukan dianggap error).

**Temuan penting**: kolom **"Forbis ID"** (format `2017.00001`) **persis sama** dengan skema
Nomor Keanggotaan Forum yang sudah dibangun (`docs/arsitektur-backbone-ikpm.md` § "Nomor
Keanggotaan Lokal Forum"). Verifikasi urutan sequence per tahun membuktikan counter **tidak
pernah reset** (2017 berakhir di seq 260, 2018 lanjut 261→323, dst sampai 2026 di seq 749) —
konsisten dengan keputusan yang sudah dikunci untuk fitur nomor keanggotaan forum. Artinya
Forbis ID bisa langsung dipakai sebagai `tenant_memberships.membership_number` apa adanya, dan
`forum_membership_sequences.last_number` untuk tenant ini di-set ke 749 setelah import selesai
(supaya join berikutnya lewat `/gabung` melanjutkan dari 750, bukan tabrakan).

**37 kolom sumber, dikelompokkan:**

| Kelompok | Kolom Excel |
|---|---|
| Identitas | Forbis ID, Nama, Alumni (tahun lulus), Jenis Kelamin |
| Alamat pribadi | Alamat, Kecamatan, Kabupaten/Kota, Provinsi, Negara |
| Kontak pribadi | No HP, No WhatsApp, Email |
| Usaha — identitas | Nama Usaha, Deskripsi Usaha, Kategori Usaha, Jenis Usaha, Produk, Merk/Brand Produk, Foto Produk atau Usaha |
| Usaha — klasifikasi | Badan Hukum, Posisi, Kepemilikan Usaha, Jumlah Karyawan, Jumlah Cabang, Omzet Pertahun, Konsep Peluang |
| Usaha — alamat | Alamat Usaha, Kabupaten, Provinsi, Negara |
| Usaha — digital | URL Facebook, ID Instagram, URL Tiktok, Website, Telepon Usaha, WhatsApp Usaha, Logo |

**Completion rate** bervariasi drastis: identitas+kontak+alamat pribadi ~37% dari total baris
mentah (=hampir semua dari 749 baris nyata terisi), tapi field detail usaha jauh lebih jarang
("Deskripsi Usaha" cuma 4%, "Konsep Peluang" cuma 4%) — normal untuk database yang diisi
bertahap, sesuai konteks user.

## 3. Masalah Kualitas Data — WAJIB Ditangani, Bukan Diasumsikan Bersih

Ini bukan spreadsheet rapi — ditemukan pola kesalahan entri data yang harus ditangani eksplisit,
bukan dipercaya mentah-mentah:

- **Provinsi pakai non-breaking space** (`Jawa\xa0Barat`, `DKI\xa0Jakarta`, `DI\xa0Yogyakarta`) —
  bukan spasi biasa. WAJIB normalize (`\xa0` → spasi biasa) sebelum matching ke `ref_provinces`.
- **Negara personal** berantakan: `Indonesia`/`indonesia`/`INDONESIA`/`Indonesian`/`Indonésia`
  (typo/varian kapitalisasi — semua berarti Indonesia) bercampur dengan `Malaysia` (2 baris,
  genuinely luar negeri) dan **`Indramayu`** (1 baris — itu nama kabupaten, jelas salah kolom).
- **42 dari 735 nomor HP rusak**: ada yang berisi 2 nomor dipisah `/` atau "atau", ada yang
  kena **notasi ilmiah Excel** (`6.285713191214E12`, `8.5722393773E10`) — ini artefak Excel
  yang mengonversi teks-mirip-angka jadi float, **presisi digit aslinya sudah hilang dan TIDAK
  BISA dipulihkan otomatis**. Baris seperti ini wajib di-flag "nomor rusak, perlu input ulang
  manual", bukan ditebak.
- **5 dari 734 email tidak valid** (berisi nomor HP atau username tanpa domain).
- **Alumni (tahun lulus)** tersimpan sebagai float string (`"2010.0"`, bukan `"2010"`) — artefak
  Excel yang otomatis mengonversi angka. Parsing wajib strip `.0` di akhir sebelum jadi integer.
- **Kolom bergeser di beberapa baris** — ditemukan nilai "Jumlah Karyawan" berisi teks yang
  seharusnya di "Kepemilikan Usaha" (`"Milik Sendiri 100%"`), atau "Omzet Pertahun" berisi teks
  yang seharusnya di "Jumlah Cabang" (`"Tidak Memiliki Cabang"`) — indikasi baris tertentu
  salah isi kolom saat entry manual. Nilai yang tidak cocok kamus pemetaan field itu → treat
  sebagai tidak terpetakan (masuk kebijakan § 6), bukan dipaksa masuk kolom yang salah.
- **"Badan Hukum" berisi catatan bebas**, bukan pilihan baku: `"hanya NIB"`, `"Sedang proses
  pembuatan NIB"`, `"KEMENDUKBUD, Ribuan sekolah"`, `"Kedai penyedia Makanan dan Minuman"` — ini
  jelas bukan salah satu dari 7 pilihan legalitas kita, harus masuk kebijakan "tidak terpetakan".

## 4. Pemetaan Kolom → Skema Database (Diverifikasi ke Kode Aktual)

Semua nama field di bawah sudah dicek langsung ke `packages/db/src/schema/public/*.ts` — bukan
dari ingatan/dokumen lama.

### 4a. Identitas anggota (`public.members`)

| Kolom Excel | Field DB | Transform |
|---|---|---|
| Nama | `name` | trim |
| Jenis Kelamin | `gender` (enum `male`\|`female`) | `Laki-laki`→`male`, `Perempuan`→`female` |
| Alumni | `graduationYear` (smallint) | strip `.0`, parse int; validasi masuk akal (1950–tahun berjalan) |
| Forbis ID | **BUKAN** `members.member_number` | lihat § 4d — ini masuk `tenant_memberships.membership_number`, bukan nomor anggota IKPM global (kolom `member_number` unik dan diisi lewat `public.member_number_seq`, tabrakan kalau dipaksa nilai arbitrary dari Excel) |

> **⚠️ SUPERSEDED oleh § 14.3.** Paragraf di bawah menjelaskan kondisi § 13 (34 kolom) — SEMUA
> field yang disebut "tidak ada di Excel sama sekali" ini SEKARANG punya kolom template sendiri
> (§ 14.3), kecuali `primaryCabangRefId` (§ 14.4, tetap di luar scope kolom Excel). Paragraf ini
> masih relevan untuk MENJELASKAN KENAPA kolom-kolom itu ditambahkan — dipertahankan sebagai
> konteks, bukan sebagai daftar "yang belum ada".

**Field wajib member lain yang TIDAK ADA di Excel sama sekali** (dan karenanya akan tetap
kosong pasca-import **kalau kolomnya juga tidak diisi di template kita** — lihat § 14.3):
`nik`, `stambukNumber`, `birthDate`, `graduationPeriod` (relevan hanya kalau graduationYear=1999),
`professionId`, `waliSantri`, `primaryCabangRefId`, `domicileStatus`. Ini konsisten dengan
keputusan § 5.2 — anggota tetap `pending` sampai field ini dilengkapi sendiri via
`/akun/lengkapi`, TERLEPAS apakah sebagian sudah terisi lewat import atau belum.

### 4b. Kontak (`public.contacts`, via `members.contactId`)

| Kolom Excel | Field DB | Transform |
|---|---|---|
| No HP | `phone` | `normalizePhone()` (lib/phone.ts, sudah ada) — E.164. Kalau gagal (nomor rusak/notasi ilmiah/multi-nomor) → null + flag di laporan, JANGAN ditebak |
| No WhatsApp | `whatsapp` | sama seperti phone |
| Email | `email` | validasi regex dasar (`@` + domain); gagal → null + flag |

`isPhonePublic`/`isWhatsappPublic`/`isEmailPublic` — default `false` (privat) seperti biasa,
TIDAK ada sinyal dari Excel soal consent publikasi. Anggota bisa ubah sendiri nanti di profil.

### 4c. Alamat pribadi (`public.addresses`, via `members.homeAddressId`)

| Kolom Excel | Field DB | Transform |
|---|---|---|
| Alamat | `detail` | trim, apa adanya |
| Kecamatan | `districtId` | fuzzy-match ke `ref_districts`, di-scope oleh `regencyId` hasil match (lihat di bawah) |
| Kabupaten/Kota | `regencyId` | normalize prefix "Kota "/"Kabupaten " lalu fuzzy-match `ref_regencies`, di-scope `provinceId` |
| Provinsi | `provinceId` | normalize `\xa0`→spasi, exact-match `ref_provinces.name` |
| Negara | `country` | normalize varian Indonesia (Indonesia/indonesia/INDONESIA/Indonesian/Indonésia) → `null` (artinya Indonesia, pakai kolom wilayah); nilai lain (Malaysia) → simpan apa adanya; nilai yang jelas bukan nama negara (`Indramayu`) → flag "kemungkinan salah kolom", tetap null (asumsi Indonesia karena provinsi/kabupatennya valid) |

**Urutan matching wajib top-down** (provinsi dulu, baru kabupaten di-scope provinsi itu, baru
kecamatan di-scope kabupaten itu) — supaya nama yang sama di provinsi berbeda (banyak
kecamatan/kabupaten homonim di Indonesia) tidak salah tertaut. Kalau provinsi gagal match sama
sekali → kabupaten/kecamatan otomatis ikut gagal (tidak ada scope), field itu dibiarkan null +
flag, alamat tetap tersimpan sebagian (detail + apa pun yang berhasil match, sesuai § 6 — semua
kolom `addresses` sudah nullable).

| Kolom Excel | Field DB | Transform |
|---|---|---|
| Forbis ID | `membershipNumber` | apa adanya (`2017.00001`) — sudah dalam format final |
| — | `tenantId` | tenant target yang dipilih admin saat import (bukan dari Excel) |
| — | `membershipType` | `"forum"` (hardcode, tool ini untuk konteks forum — lihat § 8 soal kemungkinan tipe lain) |
| — | `status` | `"active"` (field generik "apakah baris ini valid" — default schema, bukan soal eligibility) |
| — | `registeredVia` | `"import"` — **sudah jadi enum resmi sejak migration 0018**, dibuat memang untuk skenario ini |
| — | `forumStatus` | `"pending"` — lihat § 5 |

**Auto-Sync PC IKPM & Marhalah (2026-07-25)**: Pada saat `commitImportAction`, setelah `tenant_memberships` untuk tenant tempat import dibuat, sistem memanggil `syncAutoTenantMemberships(tx, memberId, primaryCabangRefId, graduationYear, graduationPeriod)`. Jika anggota yang di-import memiliki PC IKPM (`primaryCabangRefId`) atau Tahun Kelulusan (`graduationYear`) dan tenant PC IKPM / Marhalah bersangkutan sudah ada & aktif di sistem, baris `tenant_memberships` tambahan otomatis dibuatkan (`registeredVia: 'auto_cabang'` / `'auto_marhalah'`).


### 4e. Usaha (`public.member_businesses`)

> **⚠️ SUPERSEDED oleh § 13 (2026-07-25).** Tabel di bawah menjelaskan pendekatan LAMA (alias
> typo, default+flag, capping skala) yang sudah dihapus total. Kolom template SAAT INI beda
> (34 kolom, ada "Sektor" terpisah, "Kepemilikan Usaha"/"Konsep Peluang"/foto/logo dihapus) —
> lihat § 13 untuk cara kerja yang benar-benar berlaku sekarang. Dipertahankan di sini sebagai
> catatan sejarah kenapa desainnya berubah.

| Kolom Excel | Field DB | Transform |
|---|---|---|
| Nama Usaha | `name` | trim; kalau kosong → **tidak buat baris usaha sama sekali** untuk member ini (usaha opsional per orang) |
| Deskripsi Usaha | `description` | apa adanya |
| Kategori Usaha | `category` (enum: Jasa/Produsen/Distributor/Trading/Profesional) | normalize `Trader`→`Trading` (varian typo); nilai yang tidak cocok 5 pilihan (mis. `Pendidikan & Pelatihan` yang nyasar ke kolom ini) → **tidak terpetakan** (lihat § 6 — category NOT NULL, perlu default+flag seperti sector) |
| Jenis Usaha | `sector` (enum 7 pilihan) **dan** `businessFields` (JSONB multi-tag) | lihat § 4f — SATU kolom sumber, DUA tujuan berbeda |
| Produk | *(tidak ada kolom persis)* | gabung ke akhir `description` sebagai baris tambahan "Produk: ..." — supaya tidak hilang |
| Merk / Brand Produk | `brand` | trim |
| Badan Hukum | `legality` (enum 7 pilihan, nullable) | normalize kapitalisasi (`Belum memiliki Legalitas`→`Belum Memiliki Legalitas`), strip `PT. Perseorangan`→`PT Perseorangan` (titik beda dari enum). Teks bebas/sampah (`hanya NIB`, dst) → null + flag |
| Posisi | `position` (enum: Komisaris/Direktur/Pengelola/Manajer, nullable) | `Pengelola/Manajer`→`Pengelola`; `Pemilik` (437 baris, PALING BANYAK) **tidak match enum manapun** → null + flag (lihat catatan § 6b) |
| Jumlah Karyawan | `employees` (enum: 1-4/5-10/11-20/Lebih dari 20, nullable) | rentang TIDAK identik dengan Excel (`1-3` vs `1-4`, `4-10` vs `5-10`, `11-25` vs `11-20`) — perlu tabel pendekatan terdekat, dicatat sebagai APROKSIMASI di laporan (bukan exact) |
| Jumlah Cabang | `branches` (enum: Tidak Ada/1-3/Diatas 3, nullable) | `Tidak Memiliki Cabang`→`Tidak Ada`; `1 - 3 Cabang`→`1-3`; `Diatas 3 Cabang`→`Diatas 3` — match bersih |
| Omzet Pertahun | `revenue` (enum: Dibawah 500jt/500jt-1M/1M-2M/Diatas 2M, nullable) | **skala Excel jauh lebih besar** (sampai "Diatas 10 Milyar") dari skala enum kita (puncak "Diatas 2M") — semua nilai ≥1M Excel akan terjepal ke "Diatas 2M", KEHILANGAN FIDELITAS. Dicatat eksplisit di laporan sebagai "revenue di-cap, lihat nilai asli" |
| Foto Produk atau Usaha | *(link Google Drive)* | **TIDAK diimport sebagai `coverUrl`** — link Drive butuh diunduh+diupload ulang ke MinIO, di luar scope tahap pertama (lihat § 9) |
| Logo | *(nama file lokal)* | sama — di luar scope, tidak ada file fisiknya untuk diupload |

### 4f. Sector vs businessFields — dua tujuan dari satu kolom sumber (dikonfirmasi user)

> **⚠️ SUPERSEDED oleh § 13.** "Sector diturunkan dari Jenis Usaha" sudah TIDAK berlaku —
> sekarang ada kolom **"Sektor"** terpisah, exact-match langsung, tidak diturunkan dari
> apa pun. Dipertahankan sebagai catatan sejarah.

Kolom **"Jenis Usaha"** (multi-value, dipisah koma — mis. `"Industri Manufaktur, Kontruksi &
Property, Perdagangan Jasa & Umum"`) memberi makan **dua field berbeda**:

1. **`businessFields`** (facet independen, JSONB array) — SEMUA tag di kolom itu, di-split
   koma, di-trim, dedup, disimpan apa adanya (field ini memang creatable/bebas, sesuai desain
   `docs/arsitektur-usaha.md`). Tag placeholder (`kosong`, `Lainnya`, `Lain-lain`) di-skip, tidak
   dianggap tag sungguhan.
2. **`sector`** (enum tunggal wajib, 7 pilihan) — diturunkan dari tag YANG SAMA via tabel
   pemetaan tag→sector, **tag pertama yang match menang** kalau baris punya beberapa tag dengan
   sector berbeda. Contoh tabel pemetaan (representatif, ~90% volume baris — daftar lengkap
   ~30 tag long-tail diselesaikan saat implementasi, bukan di dokumen ini):

   | Tag "Jenis Usaha" | → Sector |
   |---|---|
   | Perdagangan Jasa & Umum, Kuliner & Resto | Konsumsi & Ritel |
   | Konveksi & Fashion, Industri Kreatif | Kreatif |
   | Tour & Travel, Profesional, Profesi Konsultan Publik | Jasa Profesional |
   | Agribisnis, Pangan & Kehutanan, Peternakan Pangan & Kehutanan | Sumber Daya Alam |
   | Industri Pendidikan & Pelatihan, Industri Pengobatan & Kesehatan(+Kecantikan) | Kesehatan & Pendidikan |
   | Kontruksi & Property, Industri Manufaktur, Percetakan dan Penerbitan | Manufaktur |
   | Industri Digital | Teknologi |

   Baris yang cuma punya tag placeholder (`kosong`/`Lainnya` saja, tanpa tag lain) → sector
   fallback default **"Konsumsi & Ritel"** (bucket paling generik) + **flag wajib review** di
   laporan (bukan diam-diam, karena `sector` NOT NULL tidak bisa dikosongkan sama sekali).
   **Hasil sector untuk SEMUA baris ditampilkan di layar preview** — admin bisa override manual
   sebelum commit, tabel di atas cuma tebakan awal yang wajar, bukan keputusan final otomatis.

### 4g. Alamat usaha + digital usaha

Sama persis logika § 4c (matching wilayah top-down) untuk "Alamat Usaha"/"Kabupaten"/
"Provinsi"/"Negara" (kolom usaha) → `addresses` baru (label `"usaha"`) via
`member_businesses.addressId`. Kolom digital (Facebook/Instagram/Tiktok/Website) → satu baris
`public.social_medias` baru via `member_businesses.socialMediaId` (field `website` menampung
`Website` Excel). Telepon Usaha/WhatsApp Usaha → `public.contacts` baru (bukan contact yang
sama dengan kontak pribadi — usaha punya kontak sendiri sesuai skema) via
`member_businesses.contactId`.

## 5. Status Keanggotaan Pasca-Import (Dikunci)

**Keputusan eksplisit user**: SEMUA 749 anggota yang diimport masuk sebagai `forum_status =
'pending'` — **bukan** `'active'` — meski data mereka (identitas+kontak+usaha) sudah cukup
lengkap secara Excel. Alasan: `checkMemberEligibility()` (dipakai generik di seluruh sistem,
lihat `docs/arsitektur-akun.md` § "Standar Label Keanggotaan") mensyaratkan 8 field level-
anggota, dan **6 di antaranya sama sekali tidak ada di Excel** (tanggal lahir, profesi individu,
wali santri, PC IKPM Cabang, status domisili — plus periode-1999 kalau relevan). Dari 749 baris,
**0 yang akan lolos eligibility langsung** — jadi status `pending` bukan cuma "aman", tapi
memang satu-satunya yang jujur.

### 5.1. Apa yang TERJADI di `/akun` untuk anggota yang diimport

Begitu mereka (nanti) login: `MembershipEligibilityOverlay` menutupi kartu keanggotaan forum
(karena `forumStatus !== 'active'`), dengan salah satu dari 3 tombol standar (§
`docs/arsitektur-akun.md`):
- Belum lengkap profil pribadi → "Lengkapi Data Pribadi" → `/akun/lengkapi`
- Profil lengkap tapi belum ada direktori → sudah otomatis lolos (usaha dari import sudah
  memenuhi syarat "minimal 1 direktori"), TIDAK relevan untuk kasus ini
- Sudah eligible → "Gabung {Forcreator}" → `/gabung`

### 5.2. Bagaimana orang itu login pertama kali

749 orang ini kemungkinan besar **belum punya akun Better Auth** (`members.betterAuthUserId`
null). Jalur yang sudah ada dan tidak perlu dibangun ulang: register di `jalakarta.com/{slug}/
register` jalur "Anggota IKPM" → sistem lookup by stambuk/email/HP → **karena stambuk tidak ada
di Excel**, lookup akan jalan lewat **email atau HP** (yang sudah ter-import ke `contacts`) →
ketemu → klaim akun (`UPDATE members SET better_auth_user_id`). Tidak ada kode baru dibutuhkan
di jalur ini — sudah berfungsi.

### 5.3. Bagaimana `forum_status` akhirnya berubah jadi `'active'`

**Tidak butuh mekanisme baru sama sekali** — `joinForumAction` (dibangun sesi lalu) sudah
melakukan **UPSERT**, bukan INSERT buta: kalau baris `tenant_memberships` untuk (member, tenant)
sudah ada (dari import), fungsi ini akan **UPDATE** baris itu (set `forumStatus='active'`),
bukan bikin baris baru — dan **tidak menimpa `membershipNumber`** yang sudah ada (guard
`!existing?.membershipNumber` di `forum-membership-number.server.ts`). Jadi begitu orang yang
diimport login → lengkapi 6 field yang kurang di `/akun/lengkapi` → buka `/gabung` → klik
"Gabung Forcreator" → status aktif, **Forbis ID asli mereka tetap dipakai** sebagai nomor
keanggotaan, tidak diganti nomor baru.

## 6. Kebijakan Field yang Tidak Terpetakan

> **⚠️ SUPERSEDED oleh § 13.** Poin "field NOT NULL → default + flag wajib review" TIDAK
> BERLAKU LAGI — `category`/`sector` sudah dilonggarkan jadi nullable (migration 0048), jadi
> sekarang diperlakukan SAMA seperti field nullable lain: null + catatan informasional, tidak
> pernah didefault/ditebak. Bagian duplikat-baris di bawah TETAP BERLAKU, tidak berubah.

Dikunci dari klarifikasi user:

- **Field nullable** (legality, position, employees, branches, revenue, phone/email/whatsapp
  yang gagal validasi, wilayah yang gagal match) → **null-kan field itu saja**, baris tetap
  masuk, dicatat di laporan import (nilai asli Excel + alasan tidak terpetakan) supaya admin
  bisa lengkapi manual lewat form edit usaha/anggota yang SUDAH ADA (tidak perlu UI baru untuk
  ini — form edit existing sudah menangani semua field ini).
- **Field NOT NULL yang tidak bisa dipetakan** (`category`, `sector`) → **isi dengan default
  yang paling wajar** (ditentukan dari konteks baris, atau fallback generik kalau benar-benar
  tidak ada sinyal) **dan flag WAJIB REVIEW** di laporan — beda dari nullable field yang cuma
  "dicatat", NOT NULL field statusnya "harus dicek admin", karena defaultnya mungkin salah.
- **Baris duplikat** (member yang sama sudah ada di sistem — match by phone/whatsapp/email
  memakai pola JOIN yang benar, `members INNER JOIN contacts`, BUKAN `contacts.findFirst()` yang
  pernah kena bug salah-pilih-baris, lihat `docs/arsitektur-kontak.md` lesson terkait):
  - Member ada, TIDAK ada tenant_membership untuk tenant ini → tambah tenant_membership baru
    saja (jangan duplikasi member).
  - Member ada, tenant_membership untuk tenant ini JUGA sudah ada → **skip baris**, catat sebagai
    duplikat di laporan (tidak menimpa data yang sudah ada tanpa sepengetahuan admin).

## 7. Alur Kerja Tool (UI Admin Dashboard)

Route baru: **`/app/{slug}/members/import`** (generik — dipakai tenant tipe apa pun, meski
kolom "usaha" di template hanya relevan penuh untuk forum; cabang/marhalah bisa pakai bagian
identitas+kontak+alamat saja dan skip bagian usaha).

> Catatan (2026-07-25): jumlah kolom di Langkah 1 dan detail "Perlu Review" di Langkah 3 sudah
> berubah sejak § 13 (34 kolom, bukan 37; category/sector tidak lagi memaksa "Perlu Review").
> Alur 5 langkah di bawah (unduh→upload→preview→commit→laporan) TIDAK berubah strukturnya.

```
Langkah 1 — Unduh Template
  Tombol "Unduh Template Excel" — file kosong dengan kolom header (persis skema kita, lihat
  § 13) + 1 baris contoh + sheet kedua berisi kisi-kisi (lihat § 8, § 13).

Langkah 2 — Upload
  Admin upload file (.xlsx). Validasi: header cocok template (kolom hilang/beda nama → error
  jelas, bukan silent-skip kolom itu).

Langkah 3 — Preview & Validasi (server-side, TIDAK ada yang tersimpan ke DB)
  Tabel hasil parsing per baris:
  - Status: OK (siap commit) / Perlu Review (ada field NOT NULL yang di-default) / Duplikat
    (skip) / Error (baris gagal total, mis. Nama kosong)
  - Kolom yang di-default/tidak terpetakan ditandai visual, dengan dropdown untuk override
    manual (khusus sector/category — karena NOT NULL, harus reviewable, bukan cuma teks laporan)
  - Ringkasan angka di atas: "712 siap, 4 duplikat, 33 perlu review, 0 error"

Langkah 4 — Konfirmasi Commit
  Tombol "Import N Anggota" — baru di titik ini DB benar-benar ditulis. Transaction per-baris
  (satu baris gagal tidak menggagalkan baris lain — beda dari billing checkout yang all-or-
  nothing, di sini memang didesain best-effort per baris).

Langkah 5 — Laporan Hasil
  Ringkasan akhir + opsi unduh CSV detail (baris mana masuk, baris mana di-skip + alasan, field
  mana yang di-default/perlu dicek admin).
```

## 8. Kisi-Kisi Input — Untuk Template & Panduan Admin

Diminta eksplisit oleh user. Ini masuk sebagai sheet "Panduan" di file template yang diunduh:

**Nomor HP / WhatsApp:**
- Satu nomor per sel — jangan gabung 2 nomor dengan "/" atau "atau"
- Format sel Excel/Sheets sebagai **Teks** (bukan Angka/General) SEBELUM mengetik nomor —
  kalau tidak, nomor bisa berubah jadi notasi ilmiah dan **rusak permanen tidak bisa
  diperbaiki otomatis**
- Boleh diawali `08...`, `62...`, atau `+62...` — sistem akan menormalkan otomatis

**Email:**
- Satu alamat per sel, format standar `nama@domain.com`
- Jangan isi nomor HP atau username media sosial di kolom ini

**Field pilihan ganda (mis. Kategori Usaha, Sektor, Badan Hukum, dll):**
- Gunakan **PERSIS** istilah dari daftar baku yang disediakan (lihat sheet Panduan) — sejak
  § 13, sistem TIDAK LAGI mentolerir sinonim/typo ("Trader" tidak lagi otomatis dianggap
  "Trading") — kalau tidak persis cocok, field itu dibiarkan kosong, bukan ditebak
- **"Sektor" beda dari "Bidang Usaha"** (dulu bernama "Jenis Usaha") — Sektor cuma boleh SATU
  nilai dari daftar baku; Bidang Usaha boleh lebih dari satu nilai bebas, pisahkan dengan koma
  dalam SATU sel, jangan buat baris baru

**Alamat:**
- Provinsi, Kabupaten/Kota, Kecamatan — pakai ejaan resmi BPS (cek di `/wilayah` kalau ragu),
  hindari spasi ganda/karakter tersembunyi (yang sering terjadi kalau copy-paste dari PDF/Word)
- Kolom Negara — kosongkan saja kalau alamatnya di Indonesia (biar sistem asumsi otomatis),
  isi hanya kalau benar-benar di luar negeri

## 9. Di Luar Scope Tahap Pertama (Dicatat, Bukan Dilupakan)

- **Upload foto/logo usaha** — link Google Drive di kolom "Foto Produk atau Usaha"/"Logo" tidak
  diimport. Perlu langkah terpisah: unduh dari Drive → proses lewat `member-media` upload
  pipeline yang sudah ada → `coverUrl`. Butuh akses API Google Drive atau proses manual per
  file — di luar scope import data tabular ini.
- **Column-mapper dinamis** (upload sembarang bentuk file, sistem tebak kolom) — kalau nanti
  banyak tenant lain punya sumber data dengan bentuk sangat berbeda dari template kita, ini
  jadi pengembangan lanjutan. Untuk sekarang: satu template tetap, semua tenant isi ulang ke
  bentuk itu.
- **Recovery nomor HP rusak** (notasi ilmiah Excel) — presisi digit hilang permanen, tidak ada
  solusi otomatis. Satu-satunya jalan: cek ulang ke sumber data asli (kalau ada) atau hubungi
  orangnya langsung.
- **Tipe tenant selain forum** — template ini dirancang lengkap untuk forum (identitas+kontak+
  alamat+usaha). Untuk cabang/marhalah, bagian usaha kemungkinan besar tidak relevan/kosong —
  tool tetap jalan (usaha opsional per baris), tapi belum dites terhadap kebutuhan spesifik
  cabang/marhalah (misal field yang mereka anggap wajib beda dari forum).

## 10. Ringkasan Perubahan Skema yang Dibutuhkan

> **Update 2026-07-25**: sudah dieksekusi — migration `0047_import_batches.sql`. Lihat § 11
> untuk detail (tabel ini berkembang jadi draft-store, bukan cuma audit log murni).

- **Tidak ada perubahan ke tabel existing** (`members`, `contacts`, `addresses`,
  `member_businesses`, `tenant_memberships`, `social_medias`) — semua field yang dibutuhkan
  sudah ada.
- **Kandidat tabel baru** (opsional, untuk audit trail — belum diputuskan wajib atau tidak,
  perlu konfirmasi user saat mulai implementasi): `import_batches` (siapa import, kapan, nama
  file, tenant tujuan, ringkasan hasil) — berguna kalau import dilakukan berkali-kali seiring
  waktu ("masih beberapa blm ada memang" menyiratkan akan ada import susulan) dan admin perlu
  menelusuri riwayat, bukan cuma laporan sekali lihat yang hilang setelah ditutup.

Lihat juga: `docs/arsitektur-usaha.md` (businessFields), `docs/arsitektur-backbone-ikpm.md`
(nomor keanggotaan forum, alur `/gabung`), `docs/arsitektur-akun.md` (checkMemberEligibility,
label keanggotaan), `docs/arsitektur-kontak.md` (normalisasi phone/WA, pola JOIN yang benar
untuk deteksi duplikat).

## 11. Catatan Implementasi (2026-07-25) — Penyesuaian dari Rancangan Awal

**Route dikoreksi**: dashboard admin memakai `/members` (bukan `/anggota`) untuk modul anggota
— jadi tool ini hidup di `/app/{slug}/members/import`, bukan `/app/{slug}/anggota/import`
seperti tertulis di draft § 1/§ 7 awal (sudah dikoreksi di seluruh dokumen ini).

**`import_batches` diperluas jadi draft-store, bukan cuma log pasca-commit** — § 10 draft
sempat menyebut tabel ini sebagai "kandidat opsional" murni untuk audit trail. Saat
implementasi, tabel ini dijadikan **satu-satunya tempat penyimpanan hasil parsing** selama
fase preview (`status='draft'`) — bukan cuma dicatat SETELAH commit. Alasan: mengirim ratusan
baris preview bolak-balik lewat argumen Server Action (upload → preview di client → commit)
berisiko kena batas ukuran payload Next.js untuk file besar, dan tidak tahan reload
browser di tengah jalan. Dengan draft tersimpan di DB begitu file diparse, admin bisa
kembali ke import yang sama nanti (`getDraftBatchAction`, sudah dibangun sebagai server
action — **belum disambungkan ke UI**, lihat gap di bawah).

`import_batch_rows` dapat kolom `data JSONB` (bukan `notes` seperti draf awal) — menyimpan
SELURUH bentuk `ImportRowPreview` (nilai mentah + hasil mapping + catatan), bukan cuma
catatan singkat, supaya proses commit bisa membaca-ulang data lengkap tanpa parse ulang file
Excel.

**Kelas bug client/server boundary — muncul lagi, dicegah sebelum sempat jadi masalah**:
`ImportRowPreview` (type besar dipakai bersama server dan client) awalnya didefinisikan di
`lib/import-anggota.server.ts` (`import "server-only"`). Karena `import-client.tsx` (client
component) perlu type ini untuk preview table, dipindah ke `lib/import-anggota-mapping.ts`
(client-safe, zero dependency ke `@jalajogja/db`) — pola split yang sama seperti
`tenant-timezone.ts`/`forum-membership-number.ts` sebelumnya. Ini kelas bug ke-4 di project ini
kalau dihitung dari lesson CLAUDE.md yang sudah ada — kali ini dicegah SEBELUM `next build`
sempat gagal, bukan ditemukan sesudahnya.

**Gap yang belum ditutup (dicatat, bukan lupa)**:
- **Resume draft belum ada tombolnya di UI** — `getDraftBatchAction` sudah dibangun dan
  type-check bersih, tapi `import-client.tsx` belum punya cara memanggilnya (tidak ada
  `?batch=` query param handling atau daftar "draft belum selesai"). Kalau admin reload
  browser di tengah proses preview, draft tetap tersimpan di DB tapi UI tidak menawarkan
  jalan untuk melanjutkannya — perlu upload ulang.
- **Belum ada halaman "riwayat import"** — batch yang sudah `committed` tersimpan lengkap di
  `import_batches`/`import_batch_rows` tapi belum ada UI untuk melihatnya lagi. Data ada,
  tampilannya belum.
- **Duplikasi business untuk member yang di-link (bukan dibuat baru)** — kalau baris Excel
  match ke member yang SUDAH ADA (`linkOnly=true`) dan baris itu juga punya data usaha,
  `commitImportAction` tetap membuat baris `member_businesses` BARU untuk usaha itu — tidak
  mengecek apakah member itu kebetulan sudah punya usaha yang sama persis. Berpotensi
  menghasilkan usaha duplikat kalau data yang di-import tumpang-tindih dengan data yang
  sudah ada di sistem. Belum ada kebijakan eksplisit untuk kasus ini di § 6 (yang cuma
  membahas duplikasi di level member/tenant_membership).
- **Long-tail tag "Jenis Usaha"** — tabel pemetaan di `lib/import-anggota-mapping.ts` cuma
  cover ~20 tag paling sering (representatif § 4f). Tag yang tidak terdaftar jatuh ke
  fallback `"Konsumsi & Ritel"` + flag `review_needed` — sesuai kebijakan yang dikunci, tapi
  berarti PROPORSI baris yang perlu direview di data nyata kemungkinan lebih tinggi dari
  perkiraan awal (belum diuji terhadap file `database-forbis.xlsx` yang sesungguhnya).

**Belum diverifikasi sama sekali**: upload file `database-forbis.xlsx` yang sesungguhnya
belum pernah dicoba lewat UI ini (browser). `tsc`+build hijau memastikan kodenya konsisten
secara tipe, bukan bukti bahwa parsing+matching+commit benar-benar bekerja terhadap data
nyata. Langkah pertama sebelum dianggap production-ready: jalankan migration 0047 di
lingkungan tempat file itu bisa diuji, upload, lihat ringkasan preview cocok dengan analisis
manual di § 2–3 (749 baris nyata, distribusi status yang masuk akal), baru commit.

## 12. Audit Bug Pasca-Implementasi (2026-07-25) — Ditemukan+Difix Sebelum Testing Manual

Sebelum user coba upload file sungguhan, dilakukan review logika (bukan cuma `tsc`/build) —
ditemukan 3 bug nyata di `lib/import-anggota.server.ts` + 1 celah race condition di
`commitImportAction`, semuanya sudah difix dan diverifikasi ulang (`tsc`+build bersih lagi
setelah fix).

**Bug #1 — hampir semua baris ber-usaha salah masuk "Perlu Review"**: ada baris kode
`if (status === "ready" && notes.length > 0) status = "review_needed";` yang mengeskalasi
status HANYA karena ada `notes` — padahal `mapEmployees()`/`mapRevenue()` SENGAJA selalu
`matched:false` (untuk transparansi "rentang di-aproksimasi"/"omzet di-cap") sehingga SELALU
menambah note begitu "Jumlah Karyawan"/"Omzet Pertahun" terisi (~61% dari baris ber-usaha).
Akibatnya mayoritas baris yang sebenarnya baik-baik saja (category+sector cocok) akan salah
tampil sebagai "Perlu Review" — kebalikan dari maksud § 6 dokumen ini, yang cuma mewajibkan
review untuk field NOT NULL (category/sector), bukan semua ketidakcocokan. **Fix**: baris
eskalasi status dihapus total — sekarang HANYA `category`/`sector` yang tidak match yang
memaksa `review_needed`; field nullable lain tetap tercatat di `notes` untuk laporan tanpa
mengubah status.

**Bug #2 — kecamatan gagal match tidak pernah ke-flag kalau kabupatennya sendiri juga gagal**:
kondisi `flagged` di `matchWilayah()` mensyaratkan `regencyId !== null` sebelum menganggap
kecamatan sebagai "gagal match" — artinya kalau KABUPATEN saja sudah tidak ketemu (regencyId
null), kegagalan kecamatan ikut disembunyikan (kondisinya otomatis `false` karena
`regencyId !== null` gagal). **Fix**: syarat `regencyId !== null` dihapus dari kondisi
kecamatan — sekarang setiap kecamatan yang diisi tapi tidak ke-resolve akan selalu ter-flag,
terlepas alasan di baliknya.

**Bug #3 (gap, bukan regresi) — duplikat ANTAR-BARIS dalam satu file tidak terdeteksi**: kalau
dua baris Excel dalam file YANG SAMA punya nomor HP/email sama tapi keduanya belum ada di DB,
masing-masing baris lolos independen sebagai "member baru" (`findExistingMemberByContact` cuma
cek DB, tidak cek baris lain di batch yang sama) — hasil akhirnya DUA member terpisah dengan
kontak identik. **Fix**: `buildPreviewRow()` sekarang terima parameter tambahan
`seenContacts: Map<string, number>` (dipertahankan sepanjang loop parsing satu file oleh
`parseImportFileAction`) — baris yang kontaknya sudah dipakai baris sebelumnya dalam file yang
sama ditandai `review_needed` dengan catatan eksplisit menyebut nomor baris duplikatnya,
BUKAN otomatis di-skip (beda dari duplikat vs-DB yang hard-skip) — admin yang memutuskan lewat
checkbox skip, karena bisa jadi memang 2 orang berbeda berbagi 1 nomor keluarga.

**Race condition — double-submit tombol "Import N Anggota"**: `commitImportAction`
sebelumnya SELECT lalu cek `status !== "draft"` sebelum memproses — pola "cek di luar
transaction, cuma early-exit UX" yang sudah berkali-kali jadi sumber race condition di project
ini (checkout, payment confirm, event registration — lihat `docs/lessons-learned.md`, "Guard
status harus diulang setelah lock..." dan "Guard 'sudah ada sebelumnya' harus diulang di dalam
transaction..."). Kalau
admin klik dua kali cepat (atau dua tab), kedua request bisa lolos cek yang sama dan memproses
749 baris yang sama dua kali. **Fix**: diganti klaim atomic (`UPDATE import_batches SET
status='committed' WHERE id=X AND status='draft' RETURNING id`) — hanya SATU request yang bisa
berhasil meng-klaim baris batch ini, yang kedua dapat 0 baris ter-update dan berhenti dengan
pesan "sudah pernah dikomit". Tidak perlu held-lock sepanjang loop 749 baris (yang bisa makan
waktu lama) — cukup compare-and-swap sekali di awal.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (2 putaran, sekali
tertangkap 2 error "comparison has no overlap" dari dead-code guard `status !== "error"` yang
sengaja dihapus karena TypeScript membuktikan itu tidak mungkin terjadi di titik itu — bukan
di-suppress, dihapus karena memang tidak perlu) + `bun run build --filter=@jalajogja/web`
sukses ulang setelah semua fix. **Masih belum diverifikasi manual di browser** — keempat fix
ini murni hasil membaca logika kode, belum ada satu pun yang dikonfirmasi lewat upload file
sungguhan.

**Bug #5 (ditemukan dari pertanyaan user, bukan audit awal) — `forum_membership_sequences`
tidak pernah dilanjutkan setelah import**: Forbis ID yang diimport BENAR ditulis apa adanya
ke `tenant_memberships.membership_number` (§ 4d, sudah diverifikasi ulang end-to-end via grep
— `parseForbisId` → `buildPreviewRow` → `commitImportAction` → INSERT). TAPI tabel counter
`forum_membership_sequences` (dipakai `generateForumMembershipNumber()` untuk join `/gabung`
BERIKUTNYA) tidak pernah disentuh oleh proses import — kalau tenant ini belum punya baris
counter sama sekali, `generateForumMembershipNumber()` akan mulai dari `seq=1` lagi untuk join
pertama pasca-import, PADAHAL `seq=1` sudah dipakai anggota pertama yang diimport
("2017.00001"). Ini melanggar prinsip inti fitur ini ("counter tidak reset, jalan terus
selama umur tenant") — bagian seq HARUS unik selama-lamanya, terlepas prefix tahunnya beda.

**Fix**: `commitImportAction` sekarang melacak `maxImportedSeq` (seq tertinggi dari Forbis ID
yang BENAR-BENAR berhasil ditulis ke DB, bukan dari semua baris file — baris yang di-skip
tidak ikut dihitung karena nomornya tidak pernah benar-benar masuk sistem) sepanjang loop
commit, lalu SETELAH loop selesai melakukan UPDATE-jika-lebih-besar (`GREATEST`, tidak pernah
mundur) ke `forum_membership_sequences` — locking pattern (`SELECT ... FOR UPDATE`) disalin
PERSIS dari `generateForumMembershipNumber()` yang sudah ada, bukan pola baru. Kalau tenant
ini sudah pernah punya join manual SEBELUM import (counter sudah lebih tinggi dari batch
ini), update di-skip — counter tidak pernah dipaksa turun.

**Verifikasi**: `tsc`+build bersih lagi setelah fix ini, dev server direstart. Masih murni
verifikasi statis — belum dicoba end-to-end (import 749 baris lalu coba join baru via
`/gabung` untuk konfirmasi nomor lanjutannya benar tidak nabrak).

## 13. Pivot Arsitektur (2026-07-25) — Template = Struktur Kita, Bukan Struktur Eksternal

Diskusi lanjutan dengan user mengubah pendekatan inti tool ini secara fundamental. Ini
menggantikan § 4e, § 4f, § 6, dan bagian template § 7/§ 8 (ditandai superseded di masing-
masing tempat, dipertahankan sebagai catatan sejarah).

### 13.1. Masalah yang ditemukan

Pendekatan awal (§ 4e/§ 4f) membangun tabel alias/terjemahan untuk mencocokkan istilah
historis Forcreator ("Trader" → "Trading", derivasi `sector` dari tag "Jenis Usaha", "Diatas
10 Milyar" dipaksa masuk "Diatas 2M") ke skema kita. User menegaskan ini **salah arah**:
`docs/template/database-forbis.xlsx` yang dikirim hanyalah **satu contoh** database eksternal
yang berantakan — bukan sesuatu yang harus tool ini "pintar" beradaptasi dengannya. Prinsip
yang dikunci: **template = struktur kita sendiri persis, siapa pun yang punya database lama
harus reformat manual dulu ke template kita sebelum upload.** Kalau sebuah sel kosong atau
tidak cocok nilai baku → biarkan kosong di database kita, jangan pernah ditebak/didefault.

### 13.2. Kendala teknis: category/sector NOT NULL

Prinsip "kalau kosong, biarkan kosong" langsung menabrak satu kendala nyata: `category` dan
`sector` di `member_businesses` waktu itu **NOT NULL** — tidak bisa dikosongkan di level
database, terlepas apa pun filosofinya. Investigasi (bukan asumsi) menemukan constraint ini
BUKAN sesuatu yang dibuat khusus untuk import — `saveMemberBusinessesAction` (admin) dan
`POST /api/akun/member-business` (self-service) **keduanya sudah lama** memfilter/membuang
entri usaha yang `category`/`sector`-nya kosong sebelum disimpan (aturan pre-existing, dipakai
untuk direktori usaha + breakdown statistik + fitur pencocokan usaha yang direncanakan).

### 13.3. Keputusan final — pola yang sama dengan gender/birthDate/phone/whatsapp

User menunjuk pola yang SUDAH ADA di aplikasi: `members.gender`, `members.birthDate`,
`contacts.phone`, `contacts.whatsapp` semuanya **nullable di database**, wajibnya HANYA
ditegakkan di **form** (self-service `/akun/lengkapi` + `checkMemberEligibility()`), bukan di
kolom. Keputusan: terapkan pola yang PERSIS SAMA ke `category`/`sector`.

**Migration `0048_business_category_sector_nullable.sql`** — `ALTER TABLE member_businesses
ALTER COLUMN category DROP NOT NULL; ALTER COLUMN sector DROP NOT NULL;`. Form self-service
dan admin (`saveMemberBusinessesAction`, `POST /api/akun/member-business`) **TIDAK diubah** —
filter "buang kalau category/sector kosong" di kedua tempat itu tetap jadi penegak "wajib"
untuk data entry MANUAL, persis prinsip yang diminta ("front-end tetap wajib, database tidak").

**Audit blast-radius sebelum eksekusi** (bukan asumsi aman): grep seluruh pemakaian
`.category`/`.sector` di codebase. Hasil: `tsc --noEmit` setelah relaksasi skema HANYA
menghasilkan 2 error nyata (`members/[id]/edit/page.tsx` construction `BusinessEntry[]`,
dan `statistik/page.tsx` 2 groupBy query) — jauh lebih kecil dari perkiraan awal karena
hampir semua tempat TAMPILAN sudah defensif (`{entry.category && (...)}`). 2 tempat lagi
LOLOS dari `tsc` (interpolasi string `{b.category} · {b.sector}` di `anggota/[id]/page.tsx`
dan `anggota-directory-client.tsx` — akan tercetak literal "null · null" tanpa error type)
ditemukan via grep manual dan difix sekalian. 2 query statistik (`sektorRows`,
`kategoriUsahaRows`) ditambah `IS NOT NULL` filter — pola yang SUDAH established di query
`legalitasRows` di file yang sama (lesson lama: "field nullable wajib filter di statistik").

### 13.4. Simplifikasi mapping — hapus SEMUA alias/derivasi, jadi exact-match-or-null

`lib/import-anggota-mapping.ts` ditulis ulang total untuk field klasifikasi usaha:
- **Dihapus**: `CATEGORY_ALIASES` (termasuk "Trader"→"Trading"), `JENIS_USAHA_TO_SECTOR` +
  `deriveSector()` (derivasi sector dari tag Jenis Usaha), `LEGALITY_ALIASES`,
  `POSITION_ALIASES`, `EMPLOYEES_ALIASES` (rentang aproksimasi), `BRANCHES_ALIASES`,
  `REVENUE_ALIASES` (capping skala).
- **Diganti** satu helper generik `exactMatch<T>(raw, allowed)` — toleran spasi+kapitalisasi
  SAJA (bukan sinonim), dipakai oleh `mapCategory`, `mapSector` (BARU — sebelumnya tidak ada
  fungsi ini sendiri, sector selalu diturunkan), `mapLegality`, `mapPosition`, `mapEmployees`,
  `mapBranches`, `mapRevenue`. Semua sekarang `(raw: string) => T | null` — kalau tidak exact
  match, `null`, TITIK.
- **`MappingResult<T>` wrapper dihapus** — sudah tidak perlu konsep "matched vs default",
  cukup nilai `T | null` langsung. `notes` di `buildPreviewRow` sekarang murni informasional
  ("field X tidak dikenali: nilai asli") — TIDAK PERNAH mengubah `status` baris lagi untuk
  field usaha manapun (baik NOT-NULL-dulu category/sector maupun nullable lainnya) — status
  cuma dipengaruhi duplikat (vs DB, vs baris lain di file) dan error (Nama kosong).
- **`splitJenisUsaha` → `splitBusinessFields`** (rename, logic sama — masih facet multi-tag
  bebas untuk kolom "Bidang Usaha", TIDAK exact-match karena memang dirancang creatable).

### 13.5. Template Excel didesain ulang — kolom + nilai persis skema kita

`api/members/import/template/route.ts` ditulis ulang: 34 kolom (dari 37) — 4 kolom lama
dihapus karena TIDAK ADA field yang cocok di skema kita sama sekali ("Kepemilikan Usaha",
"Konsep Peluang", "Foto Produk atau Usaha", "Logo" — bukan tugas tool ini menyimpan data yang
tidak punya rumah), 1 kolom baru ditambah ("Sektor", exact-match terpisah, TIDAK lagi
diturunkan dari kolom lain), 1 kolom di-rename ("Jenis Usaha" → "Bidang Usaha", supaya tidak
rancu dengan "Sektor" yang sekarang jadi konsep berbeda). Sheet "Panduan" sekarang generate
daftar nilai baku LANGSUNG dari konstanta `lib/import-anggota-mapping.ts`
(`BUSINESS_CATEGORY_ENUM` dkk, satu sumber kebenaran — bukan diketik ulang manual, supaya
tidak pernah drift dari nilai yang benar-benar diterima parser).

### 13.6. Konsekuensi yang diterima (bukan celah tak terpikirkan)

- Kolom **"Kepemilikan Usaha"**/**"Konsep Peluang"** di `database-forbis.xlsx` (data asli
  Forcreator) **tidak akan pernah diimport** — tidak ada field yang cocok, dan sesuai § 13.1
  bukan tugas tool ini menebak-nebak rumah baru untuk data yang tidak punya tempat.
- **Foto/logo usaha tetap di luar scope** (§ 9) — konsisten, tidak berubah oleh pivot ini.
- Kalau `database-forbis.xlsx` ASLI (belum direformat) diupload apa adanya sekarang, banyak
  baris usaha akan punya `category`/`sector` KOSONG (karena istilah lama "Trader"/turunan
  "Jenis Usaha" tidak lagi dikenali) — ini SESUAI DESAIN, bukan bug. Untuk data Forcreator
  benar-benar masuk lengkap, filenya perlu direformat manual dulu: isi ulang "Kategori Usaha"
  persis salah satu dari 5 nilai baku, isi kolom "Sektor" baru secara eksplisit (bukan
  ditinggalkan berharap sistem menurunkannya dari "Bidang Usaha").

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+dibersihkan+direstart). Migration 0048
dijalankan+diverifikasi di lokal. **Belum diverifikasi manual di browser** — baik alur lama
(§ 12) maupun pivot ini (§ 13) murni hasil membaca kode + `tsc`/build, belum ada satu pun
upload file sungguhan yang dicoba.

## 14. Pivot Arsitektur Kedua (2026-07-25) — Template Masih Mengikuti Excel, Bukan Skema Kita

Setelah § 13 dianggap selesai, user mengoreksi lagi dengan lebih tajam: **§ 13 memang benar
soal PRINSIP** ("template = struktur kita, bukan struktur eksternal"), tapi eksekusinya masih
salah — kolom template yang dihasilkan tetap ditentukan dari "kolom apa yang KEBETULAN ada di
`database-forbis.xlsx`" (dikurangi 4, ditambah 1 "Sektor"), bukan dari survei independen "skema
`members`/`contacts`/`addresses` kita butuh field apa saja". Bukti paling telak: kolom **"Forbis
ID"** — istilah internal milik SATU forum (Forcreator) — tetap ada persis namanya di file yang
diklaim "generik untuk semua tenant forum". Kalau 10 forum lain memakai template ini, semuanya
akan melihat kolom bernama "Forbis ID" yang sama sekali bukan istilah mereka.

### 14.1. Audit ulang dari nol — bukan dari Excel

Dibaca penuh (bukan sekilas) 7 file schema yang relevan: `members.ts`, `contacts.ts`,
`addresses.ts`, `social-medias.ts`, `member-businesses.ts`, `member-professionals.ts`,
`member-owned-pesantren.ts`, `tenant-memberships.ts`, disilangkan dengan
`lib/member-eligibility.ts` (`checkMemberEligibility()` — 11 field yang jadi syarat kelengkapan
profil generik untuk SEMUA tipe tenant, bukan cuma forum).

**Temuan kunci**: template § 13 (34 kolom) SAMA SEKALI TIDAK PUNYA 6 dari 11 field eligibility
— `birthDate`, `waliSantri`, `domicileStatus`, `professionId`, `graduationPeriod` (relevan
untuk 1999), dan konsekuensinya `primaryCabangRefId` (satu-satunya yang memang di luar scope
wajar untuk kolom import — dijelaskan di § 14.6). Semuanya hilang murni karena Excel sumbernya
tidak punya kolom itu — bukan keputusan sadar bahwa field itu tidak relevan.

### 14.2. Rename "Forbis ID" → "Nomor Keanggotaan" (generik)

Kolom di-rename di SEMUA titik (template header, `TEMPLATE_HEADERS`, komentar kode). Nama baru
menyebut **konsep** (nomor keanggotaan forum, kolom ini memang cuma relevan untuk tenant tipe
forum — lihat `tenant_memberships.membershipNumber`), bukan **istilah SATU forum tertentu**.
Sheet "Panduan" menjelaskan eksplisit: kolom ini opsional, boleh kosong untuk forum yang belum
punya penomoran historis apa pun (kebanyakan forum baru ke depan).

**Format tidak lagi divalidasi ketat**: `parseForbisId()` (sebelumnya memvalidasi+reformat
`^\d{4}\.\d+$`) dihapus, diganti `extractYearSeqFromMembershipNumber()` yang HANYA dipakai
untuk best-effort melanjutkan counter `forum_membership_sequences` kalau nomornya kebetulan
berformat "TAHUN.URUTAN" (preset default `lib/forum-membership-number.ts`). Nilai kolom itu
sendiri **diterima apa adanya sebagai teks** (cuma trim) dan disimpan langsung ke
`membershipNumber` — karena setiap tenant forum bisa pakai preset penomoran BERBEDA (3 pilihan
di `FORUM_MEMBERSHIP_NUMBER_FORMATS`), tool import tidak berhak memaksa satu format "benar"
untuk semua forum. Forum yang preset-nya BUKAN "Tahun + Urutan" tetap bisa import nomor
historisnya (tersimpan verbatim), cuma tidak ikut mekanisme lanjutan-counter otomatis.

### 14.3. 10 kolom baru — semuanya field `members`/`addresses` yang nyata, bukan tebakan

| Kolom baru | Field DB | Catatan |
|---|---|---|
| NIK | `members.nik` | opsional, teks bebas |
| Tanggal Lahir | `members.birthDate` | `parseBirthDate()` — terima ISO (`YYYY-MM-DD`) atau format Indonesia (`DD/MM/YYYY`, `DD-MM-YYYY`), validasi tanggal benar-benar ada di kalender |
| Tempat Lahir | `members.birthPlaceText` | teks bebas — dipilih daripada `birthRegencyId` (butuh matching wilayah lagi) karena kolom ini memang fallback teks bebas di skema sendiri |
| Periode Angkatan 1999 | `members.graduationPeriod` | hanya relevan kalau Alumni=1999, nilai "Awal"/"Akhir" persis label form self-service |
| No Stambuk Gontor | `members.stambukNumber` | opsional, teks bebas — BEDA dari `memberNumber` (auto-generated, bukan input) |
| Profesi | `members.professionId` | FK ke `public.ref_professions` (26 baris seed) — matching via ILIKE exact (case-insensitive), bukan dari `member_professionals` (itu self-report terpisah, di luar scope import ini, lihat § 14.5) |
| Wali Santri | `members.waliSantri` | label PERSIS sama dengan pilihan di `step1-identity.tsx` ("Wali Santri PM Gontor", dst) — bukan istilah baru |
| Status Domisili | `members.domicileStatus` | label PERSIS sama dengan `/akun/lengkapi` ("Domisili Tetap"/"Domisili Sementara") |
| Desa/Kelurahan | `addresses.villageId` | `matchWilayah()` diperluas — matching desa di-scope oleh `districtId` yang sudah resolve, pola sama kabupaten/kecamatan |
| Kode Pos | `addresses.postalCode` | kolom eksplisit menang; kalau kosong, fallback otomatis ke `ref_villages.postal_code` dari desa yang ter-match |

Total kolom template naik dari 34 → **44**. `REQUIRED_HEADERS` disederhanakan jadi `["nama"]`
saja (satu-satunya field yang benar-benar wajib ADA sebagai kolom — field lain boleh kosong per
prinsip "jika kosong, kosongkan" yang dikunci user 2026-07-24, jadi tidak masuk akal memaksa
kolom itu WAJIB ADA di file kalaupun isinya boleh kosong per baris).

### 14.4. Keputusan scope yang DISENGAJA (dinyatakan eksplisit, bukan diam-diam dipotong lagi)

Untuk mencegah kesalahan yang sama (memilih cakupan tanpa menyatakannya), field berikut
**SENGAJA TIDAK ditambahkan** ke template, dengan alasan masing-masing:

- **Media sosial pribadi anggota** (`members.socialMediaId` → `social_medias`) — bukan bagian
  `checkMemberEligibility()`, dan data historis lama jarang punya kolom ini per-anggota (beda
  dari data usaha yang memang biasa punya akun media sosial bisnis). Ditinggalkan untuk
  dilengkapi sendiri via `/akun/lengkapi` setelah login.
- **Email usaha, Kecamatan usaha, LinkedIn/Twitter/YouTube usaha** — `member_businesses` sudah
  punya 4 dari 7 platform sosial + phone/whatsapp (tanpa email) sejak § 13; tidak diperluas ke
  paritas penuh dengan alamat/kontak pribadi karena bukan bagian eligibility dan berisiko
  membuat template makin panjang tanpa manfaat sepadan untuk data historis yang realistis.
- **`primaryCabangRefId`** — field eligibility ke-11, TIDAK ditambahkan sebagai kolom Excel
  (butuh matching ke 136 PC IKPM resmi, kompleksitas setara `matchWilayah`/`matchProfession`
  baru). Anggota melengkapi ini sendiri via `/akun/lengkapi` (combobox 136 cabang yang sudah
  ada) — dianggap lebih aman daripada menambah satu lagi mekanisme fuzzy-matching di tool ini.

### 14.5. Scope TETAP business-only (bukan business+professional+pesantren)

`checkMemberEligibility()`'s syarat "directory" (field ke-11) bisa dipenuhi oleh SALAH SATU
dari `member_businesses`/`member_professionals`/`member_owned_pesantren` — tapi tool import ini
HANYA mendukung `member_businesses`, sama seperti § 13. **Ini tetap keputusan scope yang
disengaja, bukan terlewat** — mendukung ketiganya sekaligus (dengan 3 blok kolom paralel,
masing-masing punya klasifikasi/alamat/kontak/sosial sendiri) akan membuat template jauh lebih
besar dari yang realistis untuk satu putaran kerja. Dicatat sebagai kandidat perluasan nyata ke
depan mengingat argumen "banyak forum akan datang, tidak semua berorientasi usaha" (forum
profesi seperti dokter/pengacara, atau forum pesantren) — bukan hipotetis, tapi di luar scope
sesi ini.

### 14.6. Verifikasi

`tsc --noEmit` bersih di `apps/web` DAN `packages/db` (percobaan pertama, nol error) +
`bun run build --filter=@jalajogja/web` sukses (dev server dimatikan+`.next`
dibersihkan+direstart setelah build, route `/app/[tenant]/members/import` terkonfirmasi
muncul). Tidak ada migrasi DB tambahan di putaran ini — semua 10 kolom baru menulis ke kolom
`members`/`addresses` yang SUDAH ADA sejak awal (migration 0047+0048 tetap satu-satunya yang
dibutuhkan fitur ini). **Belum diverifikasi manual di browser** — sama seperti § 12/§ 13, murni
hasil membaca kode + `tsc`/build. Kalau mau coba `database-forbis.xlsx` asli, HAMPIR SEMUA
kolom baru di § 14.3 (Tanggal Lahir, Wali Santri, Status Domisili, Profesi, dst) akan tetap
kosong karena file itu tidak pernah punya data ini sejak awal — itu bukan bug, itu jujur soal
kondisi data sumbernya (yang memang lebih dari 90% belum lengkap terhadap standar eligibility
kita, terlepas tool import-nya sendiri).

## 15. Bug: Nomor ID IKPM Ter-cetak Permanen dengan Placeholder Tanggal Lahir Kosong

Ditemukan dari pertanyaan klarifikasi user soal mekanisme Nomor ID IKPM (global,
`members.memberNumber`) saat import. `generateMemberNumber(db, birthDate)` (format
`{tahun}{DDMMYYYY}{urutan}`) sebelumnya **selalu dipanggil unconditional** di
`commitImportAction` untuk setiap member baru — kalau `preview.member.birthDate` kosong (umum
untuk database historis lama, termasuk sebagian besar `database-forbis.xlsx`), bagian
DDMMYYYY di nomor itu terisi placeholder `"00000000"` (fallback bawaan `generateMemberNumber`
di `packages/db/src/helpers/member-number.ts`) — dan nomor itu (beserta placeholder-nya)
**permanen selamanya**, karena nomor cuma dicetak sekali dan tidak ada mekanisme apa pun di
aplikasi yang meregenerasi nomor member yang sudah ada, meski orangnya nanti login dan mengisi
tanggal lahir asli via `/akun/lengkapi`.

**Root cause tepatnya**: `PATCH /api/akun/member-data` (dipanggil `/akun/lengkapi`) memang
punya logic "generate nomor kalau belum ada" — tapi guard-nya `if (!member.memberNumber)`.
Karena `commitImportAction` SUDAH mengisi `memberNumber` (walau dengan placeholder) di titik
import, guard ini tidak akan pernah `true` lagi untuk member itu — nomor yang sudah kadung
salah tidak pernah punya kesempatan diperbaiki.

**Fix — TIDAK membuat mekanisme baru, cukup menyamakan dengan pola yang SUDAH ADA di 2 tempat
lain**: dicek dulu (`grep insert(members)` di seluruh app) — ternyata `app/api/akun/register/
route.ts` (registrasi self-service jalur IKPM) dan `(platform)/.../actions.ts`
(`createFirstOwnerAction`, buat owner pertama dari platform admin) **keduanya SUDAH** membuat
`members` row TANPA field `memberNumber` sama sekali (dibiarkan `null` — kolom memang nullable
di schema, tidak ada `.notNull()`). Guard `if (!member.memberNumber)` di `member-data/route.ts`
justru DIRANCANG untuk skenario ini — member yang lahir tanpa nomor, baru dapat nomor pertama
kali begitu mereka sendiri melengkapi tanggal lahirnya.

`commitImportAction` sekarang mengikuti pola yang sama:
```typescript
const memberNumber = preview.member.birthDate
  ? await generateMemberNumber(db, preview.member.birthDate)
  : null;
```
Kalau Tanggal Lahir tersedia di baris import → nomor tetap di-generate segera seperti biasa
(tidak ada perubahan perilaku untuk baris yang datanya lengkap). Kalau kosong → `memberNumber`
dibiarkan `null`, dan guard existing di `PATCH /api/akun/member-data` akan otomatis
menghasilkan nomor yang BENAR (dengan tanggal lahir asli) begitu orangnya login dan melengkapi
data sendiri.

**Verifikasi tampilan aman tanpa perubahan apa pun**: dicek 3 titik display (`members/[id]/
page.tsx`, `akun/page.tsx`, `anggota/[id]/page.tsx`) — semuanya SUDAH menggunakan pola guard
`{row.memberNumber && (...)}` / komponen `Row` yang otomatis menyembunyikan baris kalau
value-nya `null` (bukan menampilkan "Belum diterbitkan" atau semacamnya) — jadi member yang
sementara belum punya nomor tidak menampilkan apa pun yang aneh, konsisten dengan pola yang
sudah lama dikunci untuk field opsional semacam ini.

**Verifikasi**: `tsc --noEmit` bersih (percobaan pertama) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol
migrasi DB (kolom `memberNumber` sudah nullable sejak awal). **Belum diverifikasi manual di
browser** — sama seperti seluruh fitur ini sejauh ini.

## 16. Perubahan Besar: Duplikat TIDAK Lagi Di-skip — Selalu Dilengkapi Datanya

User menemukan skenario berbahaya dari perilaku "duplikat = skip total" sebelumnya: seorang
anggota forum yang **sudah terdaftar** di tenant forum tertentu, tapi Nomor Keanggotaan
Forumnya masih kosong (mis. admin baru mengatur format penomoran belakangan, setelah orang itu
sempat gabung) — kalau ada batch import susulan yang kebetulan punya data nomor keanggotaan
untuk orang itu, baris itu **selalu di-skip total** (status "Duplikat") tanpa pernah melengkapi
nomor yang sebenarnya sudah tersedia dari data import. "Ketika saya import data di sebuah
tenant, otomatis kita berbicara tentang data tenant bersangkutan" — jadi field TENANT-SCOPED
(bukan cuma field pribadi member) juga harus ikut dilengkapi, bukan diabaikan.

### 16.1. Prinsip baru

Setiap baris yang cocok dengan member yang **sudah ada** di database (via HP/WA/Email) —
**baik yang sudah jadi anggota tenant ini maupun belum** — SELALU diproses untuk melengkapi
field yang di database masih kosong. Field yang **sudah terisi** (apa pun isinya) **tidak
pernah ditimpa** — prinsip ini konsisten dengan "jika kosong, kosongkan" yang sudah dikunci
sebelumnya, sekarang diperluas jadi "jika kosong DAN data import punya isinya, lengkapi."

Baris benar-benar di-skip HANYA untuk: nama kosong (`status="error"`, tidak bisa diproses sama
sekali) atau override manual admin via checkbox.

### 16.2. Cakupan field yang dilengkapi

- **`members`**: gender, graduationYear, graduationPeriod, birthDate, birthPlaceText,
  stambukNumber, nik, waliSantri, domicileStatus, professionId.
- **`contacts`** (kalau member existing sudah punya `contactId`, yang PASTI ada karena syarat
  match butuh minimal satu dari phone/whatsapp/email): phone, whatsapp, email.
- **`tenant_memberships.membershipNumber`** — HANYA kalau (1) tenant tujuan tipe forum, (2)
  baris `tenant_memberships` untuk (member, tenant ini) SUDAH ADA, (3) `membershipNumber`-nya
  masih `null`, (4) data import punya nilai untuk kolom "Nomor Keanggotaan". Ini SATU-SATUNYA
  field tenant-scoped yang relevan di-backfill (tidak ada field lain di `tenant_memberships`
  yang masuk akal dilengkapi dari data import — `status`/`forumStatus` SENGAJA tidak disentuh,
  lihat § 16.4).

### 16.3. Implementasi — `computeMemberMergeCandidate()`

Fungsi baru di `lib/import-anggota.server.ts`, dipakai KEDUANYA oleh:
- **Preview** (`buildPreviewRow`) — informasional, menampilkan field apa yang AKAN dilengkapi
  di kolom Catatan (mis. "akan melengkapi: Tanggal Lahir, Wali Santri, Nomor Keanggotaan
  Forum") — supaya admin tahu sebelum commit, konsisten prinsip "tidak ada yang masuk DB tanpa
  dilihat dulu" yang sudah dipegang tool ini sejak awal.
- **Commit** (`commitImportAction`) — dipanggil ULANG (bukan percaya hasil preview yang bisa
  saja sudah agak basi kalau draft sempat didiamkan lama sebelum commit), lalu benar-benar
  menulis `UPDATE` untuk field yang masih kosong.

Fungsi ini fetch snapshot `members`+`contacts`+`tenant_memberships` TERKINI dari DB, lalu pakai
helper murni baru `fillEmpty<T>(existing, incoming)` (di `lib/import-anggota-mapping.ts`,
client-safe) — generik, isi HANYA key yang di `existing` masih null/undefined DAN di `incoming`
punya nilai. `MERGEABLE_FIELD_LABELS` (juga di file yang sama) memetakan nama kolom → label
Bahasa Indonesia untuk tampilan.

### 16.4. Yang SENGAJA TIDAK disentuh (keputusan, bukan celah)

- **`tenant_memberships.status`/`forumStatus`** — TIDAK PERNAH diubah oleh proses backfill ini,
  meski keduanya secara teknis "field yang mungkin perlu diperbaiki". Alasan: status keanggotaan
  (`active`/`inactive`/`alumni`, atau `pending`/`active`/`suspended`/`rejected` untuk forum)
  adalah keputusan lifecycle/moderasi — kalau seseorang sengaja di-`suspended` oleh admin, bulk
  import TIDAK BOLEH diam-diam mengaktifkannya kembali hanya karena namanya muncul lagi di
  sebuah file Excel.
- **`member_businesses` (duplikasi usaha untuk member yang di-merge)** — TETAP jadi gap
  terbuka yang sudah dicatat sejak § 11: kalau baris yang match member existing JUGA punya
  data usaha, `commitImportAction` tetap membuat baris `member_businesses` BARU tanpa mengecek
  apakah member itu sudah punya usaha yang sama persis. Ini SENGAJA di luar scope perbaikan §
  16 — "lengkapi field kosong" adalah operasi yang jelas untuk NILAI TUNGGAL (scalar), sementara
  usaha adalah LIST (satu member bisa punya banyak usaha) — deduplikasi list butuh heuristik
  berbeda (cocokkan nama usaha? alamat? terlalu fuzzy untuk sekarang) dan tetap jadi pekerjaan
  terpisah.
- **Nomor ID IKPM (global, `members.memberNumber`)** — TIDAK termasuk dalam daftar field yang
  di-backfill di sini, karena field ini punya aturannya sendiri yang sudah dikunci di § 15
  (hanya di-generate sekali, oleh guard terpisah `PATCH /api/akun/member-data`) — mencampurnya
  ke logic `fillEmpty` generik berisiko menabrak aturan itu (mis. bisa jadi ter-generate dua
  kali kalau tidak hati-hati). Tetap terpisah.

### 16.5. Perubahan UI + pelaporan

- Badge status "Duplikat" (label lama, menyiratkan "akan dibuang") diganti "Sudah Ada —
  Dilengkapi" (biru, bukan abu-abu) — mencerminkan perilaku baru.
- Checkbox skip manual sekarang TETAP ditampilkan untuk baris berstatus "duplicate" (sebelumnya
  disembunyikan karena toh selalu di-skip otomatis) — admin masih bisa memilih melewati baris
  tertentu kalau memang tidak ingin dilengkapi.
- `CommitImportResult` dapat field baru `merged: number` (terpisah dari `inserted`) — laporan
  akhir sekarang membedakan "N anggota BARU diimport" vs "N anggota yang SUDAH ADA dilengkapi
  datanya". Tidak ada migrasi untuk pembedaan ini — `merged` murni nilai return TypeScript,
  hanya `insertedRows` di `import_batches` (kolom DB) yang tetap menyimpan TOTAL gabungan
  (`inserted + merged`) supaya laporan batch di DB tetap akurat tanpa perlu kolom baru.

### 16.6. Kenapa `maxImportedSeq` (lanjutan counter forum) ikut diperbaiki

`writtenMembershipNumber` (bukan `preview.membershipNumber` mentah) sekarang dipakai untuk
melacak nomor tertinggi yang BENAR-BENAR tertulis ke DB di setiap baris — mencakup DUA jalur:
insert `tenant_membership` baru (member benar-benar baru/baru ditautkan) ATAU UPDATE
`membershipNumber` pada `tenant_membership` yang sudah ada (backfill, kasus baru § 16 ini).
Tanpa perbaikan ini, backfill nomor lewat jalur UPDATE tidak akan ikut dihitung untuk lanjutan
counter `forum_membership_sequences` — bug turunan yang sama persis kelasnya dengan bug #5 di
§ 12, kali ini dicegah sekaligus di titik yang sama.

**Verifikasi**: `tsc --noEmit` bersih (percobaan pertama, kedua package) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol
migrasi DB — semua perubahan murni logic aplikasi di atas kolom yang sudah ada. **Belum
diverifikasi manual di browser, terutama skenario spesifik yang memicu perbaikan ini** (member
sudah jadi anggota tenant forum, nomor keanggotaannya kosong, lalu diimport ulang dengan nomor
yang benar) — user diminta coba ini secara spesifik sebelum dianggap benar-benar terbukti.

## 17. Bug Kritis: Merge Patch Bocor Field `fullName` — SEMUA Baris Match-Existing Gagal Commit

**Ditemukan dari testing sungguhan pertama kali** (upload `database-forbis-kecil.xlsx`,
129 baris) — bukan audit kode, tapi laporan user: "Wawan Sugianto" (member yang sudah ada di
sistem, HP+email sama) tidak muncul di data tenant forum meski pesan preview bilang "akan
ditambahkan sebagai anggota tenant ini."

### 17.1. Diagnosa — langsung ke data, bukan tebak

Query `public.members`+`contacts` konfirmasi Wawan memang sudah ada (dua record berbeda malah,
tidak terkait bug ini — satu terdaftar di `pc-ikpm-jogjakarta` sejak Mei, satu lagi tanpa
tenant_membership apa pun). Query `import_batches` menemukan pola mencurigakan: batch PERTAMA
(129 total) berhasil **128 inserted, 1 skipped**; DUA batch import ULANG file yang SAMA
sesudahnya (submenit kemudian) **SEMUA 129 baris skipped**. Query `import_batch_rows.data`
(JSONB, baris Wawan) menemukan bukti pasti — `notes` array-nya berisi:
```
"Gagal insert: syntax error at or near \"where\""
```
Ini error PostgreSQL SUNGGUHAN yang terjadi di dalam `db.transaction()`, ditangkap `catch`
block, baris ditandai `"skipped"` — MESKIPUN `notes` lain di baris yang sama sudah benar bilang
"akan ditambahkan sebagai anggota tenant ini" (janji preview, gagal ditepati saat commit).

### 17.2. Root cause — objek `incoming` bocor field yang bukan bagian skema

`"syntax error at or near \"where\""` adalah tanda klasik `UPDATE table SET WHERE ...` —
klausa SET KOSONG (Drizzle mengabaikan key yang tidak dikenali skema tabel saat membangun SQL,
hasilnya SET tanpa kolom apa pun). Root cause: `commitImportAction` (§ 16, bagian
`computeMemberMergeCandidate`) memanggil fungsi itu dengan **`preview.member` APA ADANYA**
(objek `ImportRowPreview["member"]` utuh) sebagai parameter `incomingMember`. Objek itu punya
field `fullName` — BUKAN bagian `MemberFieldPatch` (kolom DB-nya `members.name`, sudah pasti
terisi, tidak pernah "kosong yang perlu dilengkapi") — tapi `fillEmpty()` (helper di
`import-anggota-mapping.ts`) awalnya **iterasi berdasarkan key `incoming`** (runtime, bukan
dijamin TypeScript) — `fullName` ikut ter-scan, `existing["fullName"]` (snapshot dari
`computeMemberMergeCandidate`, hasil SELECT yang TIDAK PERNAH mengambil kolom `name`) jadi
`undefined` → dianggap "kosong di DB" → `fullName` masuk patch → `.set({fullName: "..."})` →
Drizzle buang key tak dikenal → SQL SET kosong → error.

**Kenapa lolos dari `buildPreviewRow` (preview benar) tapi gagal di `commitImportAction`
(commit salah)**: `buildPreviewRow` memanggil `computeMemberMergeCandidate` dengan objek yang
dibangun EKSPLISIT dari variabel lokal (`{ gender, graduationYear, ... }`, TANPA `fullName`) —
sudah benar sejak awal § 16. `commitImportAction` (ditulis di sesi yang sama, seharusnya
konsisten) malah mengirim `preview.member` UTUH — asimetri inilah sumber bug: preview "berjanji"
sesuatu yang commit gagal tepati, karena keduanya membangun parameter incoming dengan cara
berbeda padahal harus identik.

**Dampak nyata**: SETIAP baris yang match member existing (baik `linkOnly=true` maupun sudah
jadi anggota tenant, dua-duanya lewat jalur ini di § 16) SELALU gagal commit — bukan cuma
Wawan. Batch import KEDUA/KETIGA (di mana SEMUA 129 baris sudah match member yang baru saja
diinsert batch pertama) membuktikan ini — 129/129 gagal. Transaction gagal BERSIH (rollback
otomatis Postgres, tidak ada tulisan parsial) — tidak ada korupsi data, cuma niat yang gagal
tereksekusi.

### 17.3. Fix — dua lapis (titik yang salah + hardening helper)

**Lapis 1 — perbaiki titik panggilan yang salah**: `commitImportAction` sekarang membangun
objek `incomingMember` eksplisit (persis pola `buildPreviewRow`, 10 field `MemberFieldPatch`,
TANPA `fullName`) alih-alih mengirim `preview.member` utuh.

**Lapis 2 — hardening `fillEmpty()` supaya kelas bug ini TIDAK BISA terulang** (bukan cuma
tambal 1 titik): diubah dari `for (const key in incoming)` menjadi `for (const key in
existing)` — karena `existing` SELALU hasil `SELECT` eksplisit (daftar kolom yang BENAR-BENAR
ada di skema, ground truth), field ekstra apa pun di `incoming` yang tidak ada di `existing`
sekarang OTOMATIS diabaikan, terlepas caller berikutnya hati-hati membangun objeknya atau
tidak. Kalau nanti ada pemanggil baru yang lupa/malas membangun objek eksplisit dan mengirim
objek yang "kebetulan lebih besar", `fillEmpty()` sendiri yang mencegah kebocoran — bukan
mengandalkan disiplin tiap caller.

### 17.4. Yang TIDAK terjadi (dicek, bukan diasumsikan)

- **Tidak ada korupsi data** — transaction gagal bersih, di-rollback otomatis oleh Postgres.
  Member/contact/tenant_memberships yang SUDAH berhasil di batch pertama (128 baris) tidak
  tersentuh oleh kegagalan batch kedua/ketiga.
- **128 insert baru di batch pertama TIDAK terpengaruh** — jalur itu (`!preview.linkOnly`,
  member benar-benar baru) tidak pernah memanggil `computeMemberMergeCandidate` sama sekali,
  jadi bug ini murni soal baris yang MATCH EXISTING, bukan soal insert baru.

### 17.5. Langkah lanjutan untuk user

Upload ulang `database-forbis-kecil.xlsx` (batch baru, ke-4) sekarang seharusnya: 128 member
yang sudah ada dari batch pertama akan lewat jalur merge dengan aman (kemungkinan besar
`memberPatch`/`contactPatch` kosong karena datanya sudah lengkap — no-op, tidak error), DAN
Wawan Sugianto akan berhasil ditautkan sebagai anggota tenant forum untuk pertama kalinya
(cabang `linkOnly=true`, INSERT `tenant_memberships` baru, tidak lagi gagal di tengah jalan).

**Verifikasi**: `tsc --noEmit` bersih (percobaan pertama) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol
migrasi DB. **Fix ini SENDIRI belum diverifikasi lewat upload ulang** — user diminta coba
upload `database-forbis-kecil.xlsx` sekali lagi untuk konfirmasi Wawan Sugianto (dan baris lain
yang match existing) sekarang benar-benar masuk, bukan cuma dijanjikan di pesan preview.

### 17.6. Re-verifikasi ulang (2026-07-25, giliran terpisah) — kode dikonfirmasi solid

User minta dicek ulang sebelum lanjut testing. Dibaca ULANG dari nol (bukan percaya kerja
sebelumnya) 3 titik: `commitImportAction`'s blok merge (`actions.ts`), `computeMemberMerge
Candidate` (`import-anggota.server.ts`), dan `fillEmpty` (`import-anggota-mapping.ts`).
Dikonfirmasi:
- `commitImportAction` mengirim objek eksplisit 10 field `MemberFieldPatch` (tanpa `fullName`) —
  fix Lapis 1 utuh.
- `computeMemberMergeCandidate` SELECT `memberRow` dengan kolom eksplisit (tidak ada `name`/
  `fullName` sama sekali) — snapshot `existing` memang sudah bersih dari sononya.
- `fillEmpty` iterasi `for (const key in existing)` — fix Lapis 2 utuh, kelas bug ini
  struktural tidak mungkin terulang lagi terlepas apa yang dikirim caller.
- `buildPreviewRow`'s pemanggilan (baris preview) dikonfirmasi TETAP benar sejak awal (objek
  eksplisit lokal, tidak pernah jadi sumber bug).

**Kesimpulan**: fix § 17 solid secara statis di KEDUA lapis. **Tetap belum ada verifikasi lewat
upload sungguhan** — pengecekan ini murni baca-ulang kode, bukan tes fungsional (tidak ada akses
browser dari sesi Claude untuk upload file). Lihat § 18 untuk bug LAIN yang ditemukan+difix di
giliran verifikasi yang sama.

## 18. Bug Terkait (Bukan Import): Edit Anggota via Admin Tidak Generate No. Anggota

**Bukan bug import** — dilaporkan user di giliran yang sama saat minta re-verifikasi § 17, tapi
sumbernya `updateMemberAction` (`members/actions.ts`), dipakai halaman admin
`/app/{slug}/members/{id}/edit` — sama sekali BUKAN bagian pipeline import. Dicatat di sini
karena ROOT CAUSE-nya berhubungan langsung dengan pattern "generate No. Anggota saat tanggal
lahir pertama kali diketahui" yang sama dipakai § 15 (import) dan `PATCH /api/akun/member-data`
(self-service).

### 18.1. Gejala

User edit anggota lewat dashboard admin, tambahkan Tanggal Lahir yang sebelumnya kosong — No.
Anggota (`members.memberNumber`) tetap null, tidak ter-generate otomatis.

### 18.2. Root cause

`members.memberNumber` bisa null untuk member yang dibuat via 3 jalur SELAIN
`createMemberAction` (admin buat baru — SELALU generate langsung, unconditional): self-service
register (`api/akun/register/route.ts`), buat owner pertama dari platform admin
(`createFirstOwnerAction`), dan import massal (§ 15, hanya generate kalau `birthDate` ada saat
import). Ketiganya sengaja MENUNDA generate sampai tanggal lahir benar-benar diketahui — supaya
tidak mencetak nomor dengan placeholder `00000000` permanen (lihat § 15).

Satu-satunya titik yang dirancang "menyusulkan" generate itu adalah `PATCH /api/akun/member-
data` (self-service, guard `if (!member.memberNumber) { ... generateMemberNumber(...) }`).
**`updateMemberAction` (jalur ADMIN edit) TIDAK PERNAH punya guard yang sama** — sejak awal
ditulis, fungsi ini cuma `db.update(members).set({...sanitize(data), updatedAt})` tanpa
menyentuh `memberNumber` sama sekali. Kalau member yang di-null-kan nomornya oleh salah satu
dari 3 jalur di atas kemudian di-edit lewat dashboard admin (bukan self-service), nomornya
selamanya tidak pernah ter-generate — gap yang genuinely terlewat sejak fitur nomor anggota
dibuat, bukan regresi dari perubahan sesi ini.

### 18.3. Fix

`updateMemberAction` sekarang SELECT `memberNumber` existing sebelum update; kalau masih null,
generate via `generateMemberNumber(db, data.birthDate ?? null)` — persis pola yang sama dengan
`PATCH /api/akun/member-data`, cuma `data.birthDate` di sini berasal dari FormData form edit
admin (selalu terisi kalau field-nya sudah diisi, karena form submit seluruh nilai input, bukan
partial patch):

```typescript
const [existingMember] = await db
  .select({ memberNumber: members.memberNumber })
  .from(members)
  .where(eq(members.id, memberId))
  .limit(1);
const memberNumberPatch = existingMember && !existingMember.memberNumber
  ? { memberNumber: await generateMemberNumber(db, data.birthDate ?? null) }
  : {};

await db.update(members)
  .set({ ...sanitize(data), ...memberNumberPatch, updatedAt: new Date() })
  .where(eq(members.id, memberId));
```

Kalau member sudah punya nomor → `memberNumberPatch = {}`, tidak ada perubahan perilaku (nomor
yang sudah ada TIDAK PERNAH ditimpa — konsisten prinsip "sekali digenerate, permanen").

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol migrasi DB. **Belum
diverifikasi lewat edit sungguhan di browser** — user diminta coba edit anggota yang belum
punya No. Anggota (mis. hasil import tanpa tanggal lahir, atau hasil self-register yang belum
melengkapi profil), isi Tanggal Lahir, simpan, cek No. Anggota langsung terisi.

## 19. Bug Terkait (Bukan Import): Kabupaten Tempat Lahir Tampak "Tidak Tersimpan" di Form Edit Admin

**Bukan bug import juga** — dilaporkan user di giliran yang sama dengan § 18, saat mengecek
form edit anggota sebelum benar-benar mulai import: pilih kabupaten tempat lahir di
`/app/{slug}/members/{id}/edit`, simpan, tapi field itu tampak kosong lagi saat form dibuka
ulang.

### 19.1. Root cause — data TERSIMPAN benar, cuma TAMPILAN yang salah

Ditelusuri seluruh alur tulis (`updateMemberAction` → `sanitize()` → `db.update(members)`) dan
dikonfirmasi **BENAR sejak awal** — `birthRegencyId` selalu ikut ter-update ke DB setiap kali
form disubmit. Bukti tambahan: halaman detail (`members/[id]/page.tsx`) SUDAH benar sejak lama
menampilkan nama kabupaten tempat lahir (query-nya select `refRegencies.name AS
birthRegencyName`) — kalau datanya benar-benar hilang, halaman detail juga akan kosong, padahal
tidak.

Root cause SESUNGGUHNYA ada di form EDIT, bukan di penyimpanan: `RegencyCombobox` butuh DUA
nilai untuk menampilkan pilihan awal — `value` (ID) DAN `displayName` (nama, untuk ditampilkan
sebagai teks di input) — cek constructor `useState<Regency | null>(() => value && displayName
? {...} : null)`. `step1-identity.tsx` sebelumnya menginisialisasi state `birthRegencyName`
SELALU `null` (`React.useState<string | null>(null)`, tidak pernah dibaca dari `defaultValues`),
sementara `edit/page.tsx` sendiri TIDAK PERNAH men-select `refRegencies.name` ke `defaultStep1`
— hanya `refRegencies.provinceId` (dipakai field `birthProvinceId` yang ternyata dead code,
tidak dibaca di mana pun oleh komponennya). Akibatnya combobox SELALU render kosong setiap kali
form edit dibuka, meski `birthRegencyId` internalnya sudah terisi benar dari server — user
melihat field kosong dan MENGIRA data hilang, padahal kalau form langsung disubmit tanpa
disentuh, nilai lama tetap terkirim dan tersimpan utuh.

**Skenario yang membuat laporan user terasa nyata**: admin buka form edit → field tampak kosong
(bug) → admin pilih ULANG kabupaten yang sama/berbeda → submit → TERSIMPAN BENAR ke DB → admin
buka lagi form edit untuk verifikasi → field tampak kosong LAGI (bug yang sama berulang) → admin
menyimpulkan "tidak tersimpan", padahal DB-nya benar di setiap titik.

### 19.2. Fix

Tiga titik, saling melengkapi:
1. `edit/page.tsx` — select ditambah `birthRegencyName: refRegencies.name`, diteruskan ke
   `defaultStep1.birthRegencyName`.
2. `Step1DefaultValues` type (`step1-identity.tsx`) — field baru `birthRegencyName?: string`.
3. `step1-identity.tsx` — state `birthRegencyName` sekarang diinisialisasi
   `defaultValues?.birthRegencyName ?? null`, bukan selalu `null`.

`birthProvinceId` (field lama, dead code, tidak dibaca komponen mana pun) SENGAJA dibiarkan apa
adanya — tidak berbahaya, di luar scope perbaikan bug ini, cukup dicatat sebagai peninggalan
lama.

**Verifikasi**: `tsc --noEmit` bersih (percobaan pertama) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol
migrasi DB — murni bug tampilan form, tidak ada perubahan skema. **Belum diverifikasi lewat
edit sungguhan di browser** — user diminta buka form edit anggota yang sudah punya tempat lahir
tersimpan, konfirmasi combobox SEKARANG menampilkan nama kabupatennya (bukan kosong).

**Aturan yang ditegaskan**: kalau sebuah combobox/autocomplete butuh MENAMPILKAN pilihan awal
dari data server (bukan cuma menyimpan ID), field DISPLAY NAME-nya harus di-select eksplisit di
query server DAN diteruskan sampai ke state komponen — ID saja tidak cukup untuk re-render
pilihan yang sudah dipilih sebelumnya. Kalau laporan bug berbunyi "data tidak tersimpan" untuk
field combobox, cek DULU apakah datanya benar-benar hilang di DB (lewat halaman detail/query
langsung) sebelum menyimpulkan bug ada di jalur tulis — sering kali gejalanya "tampak tidak
tersimpan" padahal bug sesungguhnya di jalur BACA/DISPLAY saat form dibuka ulang.

## 20. Fitur Tambahan: Kolom PC IKPM Cabang pada Template & Parser Import (2026-07-26)

### 20.1. Latar Belakang
Pada form edit/tambah anggota di dashboard admin, terdapat field **PC IKPM Cabang** (`primaryCabangRefId`). Namun, pada template import awal (44 kolom), kolom ini belum tersedia. Admin memerlukan kolom **PC IKPM Cabang** agar data historis anggota hasil import dapat dikaitkan dengan cabang resmi, dan anggota tersebut otomatis terdaftar pada tenant cabang terkait (`syncAutoTenantMemberships`).

### 20.2. Perubahan & Implementasi (45 Kolom)
1. **Template Headers (`TEMPLATE_HEADERS` / `HEADERS`)**:
   - Ditambahkan kolom **"PC IKPM Cabang"** (total 45 kolom) setelah kolom *"Profesi"*.
2. **Template Download Route (`/api/members/import/template`)**:
   - Query daftar PC IKPM Cabang aktif dari database (`public.ref_ikpm_cabang`).
   - Panduan pengisian ditambahkan pada sheet `Panduan`.
   - Ditambahkan sheet ke-3: **"Daftar PC IKPM Cabang"** yang memuat tabel nama & kode cabang resmi agar mudah disalin/dirujuk oleh admin.
3. **Parser & Matching (`lib/import-anggota.server.ts`)**:
   - Helper `matchCabang(raw)` mencocokkan string input dengan `ref_ikpm_cabang.nama` / `kode` secara case-insensitive (`ilike`).
   - `primaryCabangRefId` disertakan pada `ImportRowPreview["member"]` dan `MemberFieldPatch`.
4. **Commit Import (`commitImportAction`)**:
   - `primaryCabangRefId` ditulis ke `public.members`.
   - Helper `syncAutoTenantMemberships` otomatis membuat `tenant_memberships` untuk tenant PC IKPM Cabang terkait.

## 21. Bug KRITIS Kedua: Baris "Duplicate" Ikut Membuat Member Baru Ganda (2026-07-26)

**Ditemukan dari audit ulang menyeluruh** (permintaan user "cek dulu sebelum eksekusi lanjutan"
sebelum benar-benar upload file sungguhan) — bukan dari testing browser, tapi dari membaca
ULANG seluruh alur `commitImportAction` baris-per-baris setelah fix § 17/§ 20 selesai.

### 21.1. Root cause

`ImportRowPreview.linkOnly` HANYA `true` untuk SATU dari tiga skenario match yang mungkin:
1. **Member baru** (`existingMemberId=null`, `linkOnly=false`) — genuinely tidak ada di sistem.
2. **Link-only** (`existingMemberId=X`, `linkOnly=true`) — member sudah ada di sistem TAPI belum
   jadi anggota tenant ini.
3. **Duplicate** (`existingMemberId=X`, `linkOnly=false`, `status="duplicate"`) — member sudah
   ada DAN sudah jadi anggota tenant ini.

`commitImportAction` sebelumnya menggate blok "insert member+contact+address baru" dengan
`if (!preview.linkOnly)` — kondisi ini bernilai `true` untuk skenario 1 **DAN** skenario 3,
padahal HANYA skenario 1 yang butuh insert member baru. Untuk skenario 3 (baris "duplicate"),
kode ini SALAH membuat `contacts`+`addresses`+`members` BARU yang identik/mirip dengan data
member yang sudah ada — bahkan bisa **membakar Nomor ID IKPM global baru** (`member_number_seq`)
kalau kolom Tanggal Lahir terisi, karena `generateMemberNumber()` tetap dipanggil di jalur ini.
Member ganda ini jadi ORPHAN — tidak pernah dapat `tenant_memberships` (karena blok insert
`tenant_memberships` di bawahnya sudah benar menggate `!existingTenantMembershipId`, yang
dihitung dari `preview.existingMemberId` — member LAMA, bukan member ganda yang baru saja
dibuat).

**Dampak nyata untuk skenario testing yang SUDAH TERJADI sebelumnya**: pola testing user di § 17
("upload file → sebagian sukses → upload file YANG SAMA lagi untuk verifikasi") persis skenario
yang memicu bug ini — begitu satu batch sukses (semua jadi member tenant ini), re-upload file
yang sama akan membuat SEMUA barisnya berstatus "duplicate", dan SEMUA baris itu akan membuat
member ganda orphan. Untungnya bug § 17 (SQL syntax error) sudah lebih dulu menggagalkan seluruh
transaction sebelum sempat commit apa pun untuk baris duplicate — jadi belum ada data ganda
nyata yang tersimpan permanen di database manapun (baik lokal maupun kalaupun sempat dicoba di
tempat lain), murni karena kebetulan urutan bug ditemukan (§ 17 duluan, "menutupi" § 21).

### 21.2. Fix

Kondisi gate diubah dari `if (!preview.linkOnly)` menjadi `if (!preview.existingMemberId)` —
HANYA insert member+contact+address baru kalau BENAR-BENAR tidak ada member existing yang cocok
sama sekali (skenario 1). Skenario 2 dan 3 sama-sama SKIP blok insert ini dan langsung reuse
`memberId = preview.existingMemberId` (line `let memberId = preview.existingMemberId` di awal
transaction sudah benar sejak awal — cuma kondisi override-nya yang salah).

### 21.3. Gap terkait yang TIDAK ikut difix (dicatat, bukan diabaikan)

Blok `if (preview.business)` (insert `member_businesses`) TIDAK digate berdasarkan
existingMemberId/linkOnly sama sekali — berjalan untuk SEMUA baris yang punya "Nama Usaha"
terisi, termasuk baris "duplicate". Re-import file yang sama untuk member yang SUDAH punya data
usaha tersimpan akan menambah baris `member_businesses` BARU yang duplikat (bukan
melengkapi/update yang sudah ada) setiap kali. Ini SUDAH tercatat sebagai gap terbuka sejak § 11
("duplikasi business untuk member yang di-link belum ada kebijakan") — TIDAK diperbaiki sekarang
karena butuh keputusan produk (apakah re-import harus skip usaha yang sudah ada, update yang
sudah ada, atau tetap tambah baris baru untuk kasus "member punya banyak usaha") yang belum
dikonfirmasi user. **User perlu tahu**: kalau testing berulang kali re-upload file yang sama
untuk member yang sudah punya data usaha, cek manual apakah `member_businesses` terduplikasi.

**Verifikasi**: `tsc --noEmit` bersih di kedua package (percobaan pertama) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol
migrasi DB — murni perbaikan 1 kondisi boolean. **Belum diverifikasi lewat upload sungguhan** —
ini murni hasil audit baca-kode sebelum testing dimulai, sesuai permintaan user "cek dulu
sebelum eksekusi lanjutan".

## 22. Panduan Sektor+Bidang Usaha Dicopas + Auto-Join Forum Saat Admin Menambahkan Anggota

Menyusul upgrade taksonomi sektor 10-BPS-hybrid (`lib/business-sectors.ts`, di luar dokumen ini
— lihat `docs/arsitektur-usaha.md` § 9), user tanya: apakah template Excel sudah ikut berubah?

### 22.1. Bug ditemukan: `EXAMPLE_ROW` template masih pakai nama sektor lama

Sheet "Panduan" (daftar pilihan Sektor/Profesi/PC IKPM/Wali Santri/Status Domisili) SUDAH
otomatis benar sejak awal — semua di-generate **dinamis** dari enum/DB live saat request
(`...bulletList(BUSINESS_SECTOR_ENUM)` dkk), jadi begitu `business-sectors.ts` berubah jadi 10
nilai baru, template ikut tanpa perlu sentuh kode. Kolom "Bidang Usaha" juga sudah lama parsing
+ tersimpan benar (`splitBusinessFields()` → `member_businesses.business_fields`, free-text
bukan enum) — tidak perlu perubahan mapping.

**Yang BUGGY**: baris CONTOH (`EXAMPLE_ROW`, hardcode literal) di sheet data masih
`"Konsumsi & Ritel"` untuk kolom Sektor — nilai LAMA, sudah tidak valid sejak upgrade taksonomi.
Kalau admin copy pola dari baris contoh, nilai itu gagal exact-match dan dikosongkan diam-diam
(cocok prinsip "jangan ditebak" § 1, tapi tetap sumber kebingungan). Fix: diganti
`"Perdagangan, Ritel & F&B"` (padanan langsung `OLD_TO_NEW_SECTOR["Konsumsi & Ritel"]`) + contoh
Bidang Usaha disesuaikan wording Tier-3 baru (`"Kuliner Modern & F&B, Toko Ritel & Minimarket"`).

### 22.2. Panduan Sektor+Bidang Usaha digabung jadi satu list bertingkat (copy-paste)

Sebelumnya Panduan cuma list flat 10 nama Sektor + 1 paragraf teks "Bidang Usaha bebas, pisah
koma" TANPA daftar nilai contoh (padahal `BUSINESS_FIELD_SUGGESTIONS` — 59 label Tier-3 — sudah
ada sejak Ekosistem Fase 1). User minta panduan yang bisa langsung dicopas untuk keduanya.

Diganti jadi list bertingkat: untuk tiap 10 Sektor, baris `SEKTOR: {nama}` diikuti bullet semua
Bidang Usaha Tier-3 di bawah sektor itu (dari `SECTOR_SUB_FIELDS[sector]`, sumber yang SAMA
dipakai `getPrioritizedBusinessFields()` di UI self-service/admin — nol duplikasi data, satu
sumber kebenaran). Diverifikasi: total 59 label tersebar merata ke 10 grup, cocok persis jumlah
`BUSINESS_FIELD_SUGGESTIONS` (dicek via script disposable, `bun run` dari `apps/web`).

**Bidang Usaha tetap TIDAK exact-match** — daftar ini murni referensi copy-paste, bukan enum
tertutup baru. Field ini `splitBusinessFields()` masih terima nilai bebas apa pun.

### 22.3. Rule baru: auto-join forum kalau admin sudah taruh data anggota di tenant itu

User: *"jika di database sudah memiliki id sebuah organisasi forum, maka otomatis dia
bergabung.. jangan ada ajakan bergabung lagi"* — lalu susulan: *"tapi tetap wajib melengkapi
data"*.

**Root cause sebelumnya**: `commitImportAction` (import massal) DAN `createMemberAction` (admin
tambah 1 anggota manual) sama-sama insert `tenant_memberships` dengan `forumStatus: "pending"`
(import) atau tidak diisi sama sekali/`null` (admin manual) untuk tenant forum. Overlay
"Lengkapi Data"/"Gabung X" di `/akun` (`MembershipEligibilityOverlay`) menggate tampilannya HANYA
dari `forumStatus !== "active"` — jadi meski admin BARU SAJA memasukkan anggota itu langsung ke
database tenant forum ini (via Excel atau form manual), member tetap melihat ajakan "Gabung X"
seolah-olah belum jadi anggota — padahal datanya sudah eksplisit ada di sana.

**Fix — 3 titik**:
1. `commitImportAction` (baris baru): `forumStatus: isForumTenant ? "active" : null` (dulu
   `"pending"`) — untuk member BARU yang di-insert lewat import.
2. `createMemberAction`: tambah `membershipType: access.tenant.tenantType` +
   `forumStatus: access.tenant.tenantType === "forum" ? "active" : null` ke insert
   `tenant_memberships` — sebelumnya kolom ini sama sekali tidak diisi di jalur admin manual,
   bug identik dengan import (ditemukan sekaligus, diperbaiki bareng — konsisten prinsip "jangan
   parsial" yang sudah dikunci sesi-sesi sebelumnya).
3. **Backfill untuk member yang SUDAH punya baris `tenant_memberships` tapi `forumStatus` masih
   `"pending"`** (sisa sebelum aturan ini ada) — `computeMemberMergeCandidate()` (dipanggil
   `commitImportAction` untuk baris "link-only"/"duplicate") sekarang juga menghitung
   `activateForumStatus: boolean` (true kalau `isForumTenant && tmRow.forumStatus !== "active"`),
   diterapkan lewat UPDATE gabungan bersama `membershipNumberPatch` yang sudah ada. Diverifikasi
   EMPIRIS (read-only, tidak memutasi data) terhadap member forum lokal nyata berstatus
   `"pending"` — `activateForumStatus` mengembalikan `true` seperti seharusnya.

**Yang TIDAK ikut diubah — "tetap wajib melengkapi data"**: `forumStatus="active"` cuma
menandai keanggotaan forum RESMI (mencegah ajakan "Gabung X" muncul lagi) — TIDAK berarti
profil pribadi member otomatis dianggap lengkap. `akun/page.tsx`'s logic overlay eligibility
sebelumnya SALAH: untuk tenant forum, `checkMemberEligibility()` HANYA dipanggil kalau
`forumStatus !== "active"` — begitu status jadi "active" (baik lewat `/gabung` LAMA atau
auto-join BARU ini), pengecekan data lengkap ikut ter-skip SELAMANYA, padahal data import bisa
saja tidak lengkap (prinsip "field boleh kosong" § 1 mengizinkan ini). Fix: eligibility SEKARANG
SELALU dicek untuk forum, independen dari `forumStatus` —
`showEligibilityOverlay = !eligibility.eligible || !isJoined`:
- Belum eligible (data kurang) → overlay tampil "Lengkapi Data Pribadi"/popup direktori,
  **terlepas dari forumStatus** (termasuk member yang sudah auto-joined tapi datanya bolong).
- Eligible tapi belum genuinely joined (`forumStatus !== "active"`) → overlay "Gabung X" —
  perilaku LAMA untuk member yang daftar sendiri via `/register`, tidak berubah.
- Eligible DAN sudah joined → tidak ada overlay sama sekali (tujuan utama fix ini).

Detail arsitektur `MembershipEligibilityOverlay` (3 kondisi tombol) sendiri TIDAK berubah — lihat
`docs/arsitektur-akun.md` § "Eligibility Overlay Generik". Yang berubah murni logic CALLER
(`akun/page.tsx`) yang menentukan kapan overlay itu dirender + `missing` apa yang dikirim.

**Verifikasi**: `tsc --noEmit` bersih (`apps/web`, tidak menyentuh `packages/db`) + `bun run
build --filter=@jalajogja/web` genuine sukses (dev server dimatikan+`.next` dibersihkan+
direstart). `computeMemberMergeCandidate()` diverifikasi empiris read-only terhadap data lokal
nyata (lihat § 22.3 poin 3). Nol migrasi DB — semua kolom (`forum_status`, `membership_type`)
sudah ada sejak lama. **Sudah di-commit+push** (`adbca7e`). **Belum diverifikasi visual di
browser** (buka `/akun` sebagai member forum yang baru diimport, konfirmasi tidak ada tombol
"Gabung X" lagi tapi overlay "Lengkapi Data" tetap muncul kalau datanya sengaja dikosongkan).

### 22.4. Susulan: Nomor Keanggotaan HARUS auto-generate, bukan cuma dari Excel

> **⚠️ SUPERSEDED oleh § 22.5.** Seluruh pendekatan di bawah ini (auto-generate nomor kalau
> kosong) TERBUKTI SALAH — dibalik total oleh koreksi eksplisit user. Dipertahankan sebagai
> catatan sejarah (kenapa pendekatan ini sempat ditulis+commit lalu di-revert), BUKAN sebagai
> panduan implementasi. **Jangan ikuti isi § 22.4 — baca § 22.5 untuk perilaku final.**

User, setelah menolak backfill 9 baris `pending` lokal (*"gk perlu itu kan dummy"* — data test,
tidak perlu dibereskan): *"ketika saya upload data baru nanti harus langsung aktif ya
anggotanya dgn parameter memiliki nomor id sesuai standard bentuk id yang ditetapkan forum
tertentu.."* — member baru harus langsung aktif DAN punya nomor ID sesuai format standar forum
itu, bukan cuma status "active" tanpa ID.

**Root cause**: `commitImportAction` sebelumnya HANYA memakai "Nomor Keanggotaan" apa adanya
dari kolom Excel (`preview.membershipNumber`) — kalau kolom itu kosong, `membershipNumber`
tersimpan `null` selamanya, tidak ada mekanisme untuk melengkapinya kemudian. Padahal
`/gabung` (`joinForumAction`) sudah lama punya pola yang benar: `if (!membershipNumber &&
config?.membershipNumberFormat) membershipNumber = await generateForumMembershipNumber(...)` —
generate on-demand pakai format standar tenant (`lib/forum-membership-number.server.ts`, 4
preset — dikonfigurasi admin di `/app/{slug}/settings/keanggotaan`). Pola ini belum pernah
diterapkan ke import maupun `createMemberAction`.

**Fix — 3 titik, semuanya reuse `generateForumMembershipNumber()` yang sama**:
1. `commitImportAction` — format tenant (`membershipNumberFormat`) di-fetch SEKALI di awal
   fungsi (sejajar `isForumTenant`), lewat `getSetting(tenantClient, "membership_config",
   "forum")`. Untuk member BARU (insert `tenant_memberships` baru): kalau
   `preview.membershipNumber` kosong DAN format sudah dikonfigurasi → generate sekarang,
   `memberId` sudah pasti tersedia di titik ini (member sudah di-insert lebih dulu di
   transaction yang sama).
2. `computeMemberMergeCandidate()` (`import-anggota.server.ts`) — diperluas dengan field baru
   `needsGeneratedMembershipNumber: boolean` (true kalau `tenant_membership` existing belum
   punya nomor SAMA SEKALI, baik dari Excel maupun DB) — fungsi ini SENGAJA TIDAK generate
   sendiri (pure-ish, tidak tahu konfigurasi tenant), hanya memberi sinyal ke caller.
   `commitImportAction`'s blok merge (baris "link-only"/"duplicate") yang benar-benar
   memanggil generator kalau flag ini `true`.
3. `createMemberAction` (`members/actions.ts`, admin tambah 1 anggota manual) — form ini SAMA
   SEKALI tidak punya field untuk isi nomor manual, jadi kalau tenant forum sudah punya format
   dikonfigurasi, SELALU generate untuk member baru. Bug identik forumStatus (§ 22.3) ditemukan
   ulang di sini secara konsisten — tanpa field ini, admin tambah manual akan menghasilkan
   member "active" tapi tanpa ID resmi selamanya, kontradiksi langsung dengan rule yang baru
   diminta user.

**Diverifikasi EMPIRIS, bukan cuma `tsc`** — memanggil `generateForumMembershipNumber()`
langsung (fungsi yang SAMA dipakai ketiga titik di atas) terhadap tenant `forcreator` lokal
(format terkonfirmasi `"year_seq"` via SQL langsung ke `tenant_forcreator.settings`): hasil
`"2026.00165"` (format benar, tahun berjalan + urutan 5-digit) dan `forum_membership_sequences.
last_number` terkonfirmasi naik dari 164 → 165 secara atomic. Efek samping DITERIMA (bukan bug)
— sequence gap dari 1 panggilan verifikasi ini harmless, konsisten prinsip "gap di sequence
selalu ditoleransi" yang sudah berlaku di seluruh project untuk kasus serupa (`member_number_
seq`, dll). `computeMemberMergeCandidate()`'s `needsGeneratedMembershipNumber` TIDAK sempat
diuji dengan kasus `true` — SEMUA baris `tenant_membership` di `forcreator` lokal sudah punya
nomor dari import awal (0 baris `membership_number IS NULL` ditemukan saat query verifikasi),
jadi jalur ini murni terverifikasi lewat `tsc` + review logic (identik struktur dengan jalur
"new insert" yang sudah teruji empiris).

**Verifikasi**: `tsc --noEmit` bersih (`apps/web`) + `bun run build --filter=@jalajogja/web`
genuine sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol migrasi DB.

**Pendekatan ini SALAH — di-revert total, lihat § 22.5.**

### 22.5. Koreksi: Nomor Keanggotaan TIDAK PERNAH di-generate saat import/admin-add — hanya penanda status

Commit `2d9bb47` (§ 22.4 di atas) di-push ke branch, TAPI user langsung mengoreksi sebelum
sempat dianggap final: *"kayanya ada yg salah, kalau kosong berarti blm terdaftar, hanya
anggota dengan nomor id saja yg otomatis jadi anggota, kalau di import tanpa nomor id berarti
blm menjadi anggota, kita pakai standard ketat gitu agar urutannya tidak berubah.."*

**Kesalahan interpretasi § 22.4**: kalimat user sebelumnya (*"harus langsung aktif ya
anggotanya dgn parameter memiliki nomor id..."*) dibaca sebagai "nomor ID adalah SYARAT yang
harus DIPENUHI (generate kalau belum ada)" — padahal maksud sesungguhnya "nomor ID adalah
GERBANG (gate): hanya baris yang SUDAH punya nomor (dari Excel atau DB) yang boleh otomatis
jadi anggota aktif; baris tanpa nomor tetap `pending` selamanya sampai diisi manual/di-generate
lewat jalur `/gabung` yang sesungguhnya."

**Kenapa aturan ketat ini penting** — bukan preferensi kosmetik: `forum_membership_sequences`
adalah counter yang merepresentasikan **urutan pendaftaran historis riil**. Kalau baris import
tanpa nomor (data lama yang memang belum pernah dapat ID resmi) di-generate-kan nomor baru
begitu saja, urutan sequence itu tidak lagi mencerminkan kapan orang itu SUNGGUH-SUNGGUH
bergabung — ia jadi angka yang dikarang untuk menambal data yang tidak lengkap. Auto-generation
HANYA sah dipanggil dari `joinForumAction` (`/gabung`, klik "Ya, Saya Ingin Bergabung" secara
real-time) — di situ "urutan berikutnya" memang benar secara harfiah.

**Fix — revert total ketiga titik § 22.4, bukan tambal**:
1. `commitImportAction` — `membershipNumberFormat`/`getSetting("membership_config","forum")`
   fetch dihapus. Untuk member baru: `membershipNumber = isForumTenant ?
   preview.membershipNumber : null` (apa adanya dari Excel, TIDAK PERNAH digenerate). Status
   ikut nomor: `forumStatus: isForumTenant ? (membershipNumber ? "active" : "pending") : null`
   — baris tanpa nomor immediate jadi `"pending"` (BUKAN `"active"` seperti § 22.3 sempat
   menulis "member baru forum SELALU active" — itu juga bagian yang dikoreksi di sini, "active"
   sekarang bersyarat pada punya nomor).
2. `computeMemberMergeCandidate()` — field `needsGeneratedMembershipNumber` DIHAPUS TOTAL dari
   `MemberMergeCandidate` type. `activateForumStatus` sekarang dihitung dari
   `hasOrGetsMembershipNumber = !!(tmRow?.membershipNumber || membershipNumberPatch)` — baris
   existing yang match tapi TIDAK punya nomor di DB DAN TIDAK ada nomor baru dari Excel row ini
   TIDAK di-aktivasi (tetap `pending`), meski secara data lain sudah lengkap.
3. `createMemberAction` — seluruh blok fetch config + panggilan generator dihapus. Form admin
   "Tambah 1 Anggota" TIDAK PERNAH punya field untuk isi Nomor Keanggotaan manual, jadi di
   bawah aturan baru ini SELALU insert `forumStatus: isForumTenant ? "pending" : null` tanpa
   `membershipNumber` sama sekali — member yang ditambah lewat form ini TIDAK PERNAH bisa
   otomatis "active" (sesuai desain: satu-satunya jalur legit untuk dapat nomor adalah
   `/gabung` atau Excel yang sudah punya kolom nomor terisi).

**Konsekuensi eksplisit ke § 22.3** (rule "auto-join forum" tetap BENAR, tapi syaratnya
diperketat): "auto-join tanpa ajakan gabung lagi" HANYA berlaku untuk baris yang SUDAH punya
Nomor Keanggotaan — bukan untuk SEMUA baris di tenant forum manapun. Baris tanpa nomor tetap
`pending`, `MembershipEligibilityOverlay` di `/akun` TETAP menampilkan ajakan "Gabung X" untuk
member itu (perilaku yang benar — mereka memang belum genuinely terdaftar sebagai anggota
forum menurut standar penomoran resmi).

**Verifikasi**: `tsc --noEmit` bersih (`apps/web`, 0 error) + `bun run build
--filter=@jalajogja/web` genuine sukses (dev server dimatikan+`.next` dibersihkan+direstart,
`Cached: 0 cached`, Time: 46.82s). Grep dikonfirmasi nol sisa referensi
`needsGeneratedMembershipNumber`/pemanggilan `generateForumMembershipNumber()` di ketiga file
selain di `/gabung`'s `joinForumAction` (satu-satunya pemanggil legit yang tersisa). Nol
migrasi DB (revert murni logic aplikasi). **Belum diverifikasi visual di browser** — user perlu
coba import file dengan sebagian baris kolom "Nomor Keanggotaan" kosong dan sebagian terisi,
konfirmasi hanya baris berisi nomor yang jadi `forumStatus="active"` tanpa ajakan gabung,
sisanya tetap `pending` dengan overlay "Gabung X" tetap tampil.

