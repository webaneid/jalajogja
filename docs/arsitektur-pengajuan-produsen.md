# Arsitektur Pengajuan Produsen — alur anggota mengajukan diri, kurasi pengurus, jadi produsen

> **Status: RENCANA (2026-11-03) — BELUM ADA KODE.** Ditulis bersama user lewat diskusi; dokumen ini adalah satu-satunya sumber keputusan untuk fitur ini.
> Dokumen terkait: `docs/arsitektur-portal-produsen.md` (portal, § 28 Syarat & Ketentuan), `docs/arsitektur-produsen.md` (data produsen),
> `docs/arsitektur-mitra.md` (sistem Mitra yang sudah ada — pola pengajuan dipinjam dari sini), `docs/arsitektur-keamanan.md`.
> Jawaban user 2026-11-03 (putaran 2) sudah dimasukkan (K10–K16). Bagian **§ 19** tinggal memuat hal yang MASIH terbuka — terutama model harga/bagi hasil (§ 17).

---

## 1. Tujuan

Hari ini calon produsen mendaftar lewat Google Form, pengurus mengurasi di luar sistem, lalu pengurus yang mengunggah produknya. Itu repot dan tidak tercatat di sistem.
Fitur ini memindahkan **pintu masuk** ke dalam Jalakarta:

```
Anggota mengisi pengajuan → pengurus mengurasi → disetujui → jadi produsen (akses portal) → tanda tangan Syarat & Ketentuan → (tahap berikut) unggah produk sendiri
```

Arah jauhnya (user, 2026-11-03): produsen adalah tangga pertama; **Mitra adalah tingkat berikutnya**. Perbedaan Mitra hanya dua hal: (1) batas jumlah produk lebih besar, (2) produknya terbit tanpa verifikasi admin. Fitur lainnya sama. Rancangan di bawah menyiapkan itu tanpa membangun Mitra sekarang.

## 2. Ruang lingkup

**Termasuk (tahap ini):** form pengajuan anggota (dengan foto/dokumen), antrean tinjauan pengurus, setujui/tolak, pembuatan produsen + akses login otomatis saat disetujui, batas produk per produsen (disimpan; penegakannya di tahap produk), notifikasi, pembersihan berkas otomatis, pelonggaran aturan "satu akun satu tenant".

**TIDAK termasuk (tahap berikut, urut):**
1. Produsen mengunggah/mengedit produk sendiri di portal (**saat ini portal baca-saja**, keputusan D3 `arsitektur-portal-produsen.md` § 9) + produk produsen berstatus *menunggu tinjauan* + penegakan batas produk.
2. Jenis produk **digital** dan **jasa** (sistem sekarang hanya melayani produk fisik: stok, ongkir, label, resi).
3. **Brand** sebagai entitas (arsip, halaman) dan pilihan brand di form produk. Kategori produk sudah ada (`product_categories`: bertingkat + SEO ringan + arsip `/produk/kategori/{slug}`); kebutuhan tambahan "jenis" menunggu penjelasan user.
4. **Salin produk lintas tenant** (opsi B): produsen yang sama di tenant lain menyalin produk jadi draf di tenant baru (independen setelah disalin; harga/stok diisi ulang; foto disalin ke bucket tenant tujuan).
5. Kenaikan tingkat **Mitra** (batas lebih besar, tanpa tinjauan produk).
6. **Pengajuan pembayaran** (pencairan ke produsen) dan model harga/bagi hasil (lihat § 17).

> **Konsekuensi penting urutan ini:** setelah tahap pengajuan selesai, produsen yang disetujui **belum bisa mengunggah produk sendiri** (portal masih baca-saja). Sampai tahap 1 di atas selesai, pengurus tetap mengunggah produknya — bedanya data calon (brand, contoh produk, foto) sudah ada di sistem, bukan di Google Form. Karena itu tahap 1 sebaiknya menyusul langsung setelah pengajuan.

## 3. Keputusan terkunci (user, 2026-11-03)

| # | Keputusan |
|---|---|
| K1 | Alur: **pengajuan → kurasi → disetujui → unggah produk sendiri** (opsi B diskusi). Kurasi dua lapis: kurasi produsen (dokumen ini) lalu kurasi produk (tahap berikut). |
| K2 | Kriteria kurasi: (a) produk milik sendiri, (b) punya brand sendiri (**nama brand WAJIB**), (c) punya tim/penanggung jawab pesanan. Foto proses produksi **opsional**. Dokumen legalitas **opsional** (penguat). Kriteria "tim" = pernyataan pemohon yang dinilai peninjau, bukan keputusan otomatis sistem. |
| K3 | Batas produk produsen **3**, admin bisa menaikkan per produsen (jika tokonya ramai). |
| K4 | **Pemohon harus anggota sah tenant yang dituju** (single ID). Anggota tenant lain TIDAK boleh mengajukan di tenant ini kecuali ia juga anggota sah tenant ini. Prosedur sama untuk semua. |
| K5 | Pemohon yang ditolak boleh mengajukan lagi dengan form baru. |
| K6 | Penyetuju: super admin (diartikan Owner — **belum dikonfirmasi**), Ketua, Sekjen (Sekretaris). |
| K7 | Seorang produsen di tenant A **boleh** juga jadi produsen di tenant B (pengajuan + persetujuan terpisah per tenant). Aturan lama "satu akun satu tenant" (D2, 2026-10-31) **digantikan** — lihat § 9. |
| K8 | Nama brand di pengajuan tetap tersimpan; saat membuat produk, pilihan brand dibahas terpisah (tahap brand). |
| K9 | Tahap pertama hanya menerima produk **fisik**; digital/jasa menyusul. |
| K10 | **Tidak menambah role/modul izin baru.** Penyetuju = pemegang `anggota: full` pada matriks izin yang ada, yang persis dimiliki **Owner, Ketua, Sekretaris** (Bendahara `none`). |
| K11 | Pemohon wajib punya **salah satu** dari: data **Usaha** (utama — ini bisnis), atau **Pesantren** milik/dikelola, atau **Profesional**. |
| K12 | Contoh produk: **minimal 1, tersedia 4 slot**. |
| K13 | Dokumen legalitas boleh **gambar dan/atau PDF**, dengan keterangan opsional. |
| K14 | Retensi berkas: **1 minggu** setelah keputusan ditolak/dibatalkan; **30 hari** untuk yang disetujui (pengurus masih mengunggah produknya pada masa peralihan). |
| K15 | **Ada saklar** buka/tutup pengajuan per tenant (Pengaturan Toko). |
| K17 | **Pemohon sendiri mengajukan persentase bagi hasil** dalam form; tawaran itu salah satu penilaian menarik-tidaknya bagi tenant. Penyetuju melihatnya berdampingan dengan harga jual contoh dan boleh menyetujui pada angka tawaran atau menyesuaikannya. |
| K16 | Notifikasi **hanya email**; kelengkapan kanal dibahas di rapat. Penyetuju melihat lencana + digest PJ yang sudah ada. |

## 4. Temuan kode (fakta yang menentukan rancangan, dibaca 2026-11-03)

1. **Produsen anggota wajib punya "sumber"**: `producers.type='member'` merujuk satu baris `member_businesses` / `member_owned_pesantren` / `member_professionals` milik anggota (`createMemberProducerAction`, `decideProducerAccess` mensyaratkan `type='member'`). Anggota tanpa satu pun data itu **tidak bisa** dijadikan produsen anggota. → Form pengajuan memilih satu sumber milik pemohon (§ 7).
2. **Pola Mitra** (`mitra_applications`, `/api/mitra/apply`, `toko/mitra/actions.ts`) sudah punya: pengajuan → pending → approve/reject/cancel, cek `isTenantMember`, validasi kepemilikan usaha. **Kelemahan yang TIDAK boleh ditiru:** `approveMitraAction` tidak memeriksa ulang keanggotaan; cek "sudah pending" tanpa unique index (balapan dua klik); approve tidak atomik (insert `mitras` lalu update application tanpa transaksi/kunci).
3. **`public.producer_logins` UNIQUE(user_id)** memaksa satu akun = satu tenant; pesan galat "sudah terdaftar sebagai produsen di tempat lain" ada di `grantProducerLoginAction`. Konsumen "satu portal": `findProducerPortal()`, `listUserContexts()`, `dashboard-redirect`. Halaman `/pilih-tujuan` sudah mendukung banyak konteks.
4. **Penyimpanan foto**: `public.member_media` (Media Library anggota, global per anggota; file fisik di bucket `tenant-{sourceTenantSlug}`), kolom `purpose` menyembunyikan file dari picker dan menjadi kunci pembersihan (`'resi'` → cron `cleanup-resi`). Pipeline unggah teruji di `api/produsen/resi/route.ts` (Content-Length dulu, Sharp, buang EXIF, WebP 1600px, rate limit, cek Origin). Pola ini dipakai ulang.
5. **Izin**: `lib/permissions.ts` — `Module` adalah union tertutup (10 modul). Peran sistem **Sekretaris punya `toko: "read"`**, jadi `hasFullAccess(toko)` TIDAK mencakup Sekjen. Modul `anggota` bernilai `full` untuk tepat owner, ketua, sekretaris (bendahara `none`) → dipakai sebagai izin penyetuju (§ 11), tanpa menambah modul.
6. **Notifikasi**: `notifyWa` (+ template di `lib/wa-templates.ts`, bisa diedit per tenant) dan `sendMailForTenant`; pola dual-channel di `lib/notify-customer.ts`. Digest PJ modul (`lib/pj-notification.server.ts`) punya digest "toko".
7. **Portal produsen baca-saja untuk produk** (D3); produk dibuat admin lewat `createProductAction` (butuh `toko:full`).
8. **Validasi harga di form produk**: Harga Dasar >0, Harga Publik >0, Harga Anggota ≤ Harga Publik. **Belum ada** aturan Harga Publik ≥ Harga Dasar atau Harga Anggota ≥ Harga Dasar — relevan untuk model bagi hasil (§ 17), BUKAN untuk dokumen ini.
9. Sistem Syarat & Ketentuan Produsen (§ 28 portal) sudah mengunci portal sampai produsen tanda tangan; produsen hasil persetujuan otomatis masuk gerbang itu.

## 5. Alur end-to-end

```
[Anggota login, tenant X]
   │ buka /{slug}/akun/produsen  (kartu "Jadi Produsen" di /akun bila pengajuan dibuka)
   ▼
 DRAFT ──(unggah foto/dokumen & isi form; boleh dilanjutkan nanti)──► PENDING ──► APPROVED  (jadi produsen)
   │  hapus sendiri / otomatis 7 hari                │   │
   ▼                                                 │   └──► REJECTED (alasan wajib; boleh ajukan lagi = baris baru)
 (dihapus)                                           └──────► CANCELLED (dibatalkan pemohon selagi pending)

APPROVED → produsen + akses login dibuat → pemohon diberi tahu → login portal → gerbang Syarat & Ketentuan (§ 28) → tanda tangan → portal terbuka
```

Aturan status:
- Hanya **satu pengajuan terbuka (`draft` atau `pending`) per anggota per tenant** — ditegakkan unique index parsial, bukan hanya cek aplikasi.
- `approved`/`rejected`/`cancelled` bersifat final. Mengajukan lagi = baris baru dengan isian baru.
- Perpindahan status hanya lewat Server Action yang memeriksa status asal (compare-and-set) di bawah kunci baris.

## 6. Syarat boleh mengajukan (semua diperiksa di SERVER, saat membuka form, saat mengunggah, dan saat mengirim)

1. Login, akun terhubung ke satu `members` (identitas dari sesi, tidak pernah dari input).
2. `isTenantMember(memberId, tenant)` — anggota sah tenant itu (status aktif; forum: `forum_status='active'`; alumni BUKAN anggota). **Diperiksa ulang saat disetujui.**
3. Belum menjadi produsen aktif di tenant ini; jika ada baris produsen nonaktif dari sumber yang sama → pesan "hubungi pengurus" (admin yang mengaktifkan kembali, bukan pengajuan baru).
4. Tidak punya pengajuan `draft`/`pending` lain di tenant ini.
5. Pengajuan sedang dibuka di tenant ini — saklar `producer_applications_enabled` (settings group `toko`, default **mati**; pola `mitra_enabled`, kartu baru di Pengaturan Toko). Saat mati: form/unggah/kirim ditolak di server; pengajuan yang sudah `pending` tetap bisa ditinjau.
6. Tenant aktif (`isActiveTenant(slug)` SEBELUM `createTenantDb`).

## 7. Form pengajuan (menggantikan Google Form)

| Bagian | Isian | Aturan |
|---|---|---|
| Identitas | Sumber produsen: pilih SATU dari **usaha** (utama) / **pesantren** milik/dikelola / profesional **milik sendiri** | wajib (K11); kepemilikan diverifikasi server dari `public.*` (bukan id mentah dari klien); sumber yang sudah jadi produsen ditolak. Anggota tanpa satu pun data itu diarahkan melengkapi dulu di `/akun/usaha` (atau pesantren/profesional); form tidak bisa dikirim sebelum itu. |
| Brand | Nama brand | **wajib**, 2–100 karakter |
| Produk | Jenis produk (fisik; digital/jasa tampil nonaktif "segera") | tahap ini hanya `physical` |
| | Kategori/jenis barang yang dijual | teks bebas, ≤200 |
| | Deskripsi singkat usaha & produk | wajib, 20–1000 karakter |
| | Pernyataan: "produk ini dibuat/dimiliki sendiri, bukan jual-beli ulang" | centang wajib |
| Contoh produk | **Minimal 1, maksimal 4** slot: nama + foto + harga jual umum & harga jual anggota (perkiraan, opsional) | K12 |
| Penawaran | **Persentase bagi hasil yang ditawarkan** ke tenant (dari harga jual) | wajib; angka 0 < p < 100 (satu desimal); menjadi **bahan penilaian kurasi** (K17) — mis. tawaran 3% kurang menarik bagi tenant |
| Operasional | Penanggung jawab pesanan: nama + WhatsApp (`PhoneInput`, `normalizePhone`) | wajib |
| | Jumlah orang di tim | angka 1–999 |
| | Kesanggupan proses pesanan | pilihan 1×24 / 2×24 / 3×24 jam |
| | Kota/kabupaten asal barang dikirim | Combobox wilayah; alamat gudang lengkap diisi kemudian di Profil portal |
| Bukti tambahan (opsional) | Tautan Instagram/marketplace/website (maks 3) | hanya `https://`, lewat `lib/safe-url.ts` |
| | Foto proses produksi (maks 3) | opsional |
| | Dokumen legalitas (PIRT/BPOM/Halal/NIB/lainnya) (maks 3: jenis + **keterangan opsional**) | opsional; **gambar dan/atau PDF** (K13); perlakuan PDF di § 13 |

Standar UI proyek: semua dropdown Combobox, telepon `PhoneInput`, wilayah `WilayahSelect`, tombol publik lewat `PublicButton`, kontainer `max-w-7xl`. Teks bebas ditampilkan sebagai teks biasa (tanpa `dangerouslySetInnerHTML`).

## 8. Model data

### 8.1 `tenant_{slug}.producer_applications` (tabel baru; migration `0092`)
```
id               uuid pk
member_id        uuid  NOT NULL            -- FK public.members via aplikasi (lintas schema)
status           text  NOT NULL DEFAULT 'draft'  CHECK in ('draft','pending','approved','rejected','cancelled')
source_type      text  CHECK in ('usaha','pesantren','profesional')
source_id        uuid
brand_name       text
product_kind     text  NOT NULL DEFAULT 'physical'
product_categories text
description      text
own_product_declared boolean NOT NULL DEFAULT false
ops_name         text
ops_whatsapp     text                      -- E.164
team_size        integer
process_days     integer                   -- 1..3
origin_regency_id integer                  -- ref_regencies
offered_share_percent numeric(5,2)          -- tawaran bagi hasil pemohon (0<p<100)
sample_products  jsonb  NOT NULL DEFAULT '[]'   -- [{name, estPriceUmum|null, estPriceAnggota|null, mediaId}]
process_media    jsonb  NOT NULL DEFAULT '[]'   -- [mediaId]
document_media   jsonb  NOT NULL DEFAULT '[]'   -- [{kind, note|null, mediaId}]  (gambar → member_media; PDF → lihat § 13)
links            jsonb  NOT NULL DEFAULT '[]'   -- [https url]
submitted_at     timestamptz
reviewed_at      timestamptz
reviewed_by      uuid                       -- tenant.users.id
rejection_reason text                       -- terlihat pemohon
review_note      text                       -- internal pengurus
producer_id      uuid                       -- hasil persetujuan
created_at / updated_at
UNIQUE INDEX (member_id) WHERE status IN ('draft','pending')      -- satu pengajuan terbuka per anggota
INDEX (status), INDEX (member_id)
```
`mediaId` merujuk `public.member_media.id` (purpose `producer_application`). Referensi disimpan sebagai JSON (maks ±10) — bukan tabel anak — karena selalu dibaca bersama dan dibersihkan bersama.

### 8.2 Tambahan `tenant_{slug}.producers` (kolom nullable, aditif)
```
brand_name     text            -- dari pengajuan (bahan awal entitas brand kelak)
revenue_share_percent numeric(5,2) NULL  -- bagi hasil yang DISEPAKATI saat persetujuan (default = tawaran pemohon; penyetuju boleh menyesuaikan). Dipakai tahap produk/pesanan, lihat § 17
product_limit  integer NULL    -- NULL = tanpa batas (produsen lama buatan admin); produsen hasil pengajuan = 3
application_id uuid NULL       -- jejak asal
```
Produsen lama tidak berubah perilaku (NULL = tanpa batas). Batas hanya ditegakkan pada produk yang dibuat produsen sendiri (tahap produk); produk yang dibuat admin tidak diblokir (admin yang menaikkan batas bila perlu). Aturan hitung (usulan): produk berstatus draf + aktif dihitung, diarsipkan tidak.

### 8.3 `public.producer_logins` — pelonggaran (migration `0091`, schema public)
Hapus `UNIQUE(user_id)` (`producer_logins_user_uniq`), ganti `UNIQUE(user_id, tenant_id)`. `UNIQUE(tenant_id, producer_id)` tetap. Aman diulang (`IF EXISTS`/`IF NOT EXISTS`).

### 8.4 Penyiapan tenant baru & lama
DDL ditambahkan ke `packages/db/src/helpers/create-tenant-schema.ts` (tenant baru) dan migration idempotent per tenant aktif (pola 0075/0083/0090; tenant tanpa tabel `producers` dilewati).

## 9. Pelonggaran "satu akun satu tenant" (K7) — dampak kode

Keputusan D2 (`arsitektur-portal-produsen.md` § 9, 2026-10-31) ditandai **DIGANTIKAN 2026-11-03**. Yang berubah:
- `producerLogins` (schema) + migration 0091 seperti § 8.3.
- `grantProducerLoginAction`: hapus pesan/penanganan "tempat lain"; 23505 hanya berarti "produsen ini sudah punya akses".
- `findProducerPortal()` → `listProducerPortals()` mengembalikan **semua** tenant tempat akun berstatus produsen yang lolos akses penuh; `listUserContexts()` memasukkan semuanya; `dashboard-redirect` otomatis (sudah mendukung banyak konteks lewat `/pilih-tujuan`).
- Tidak berubah: `getProducerAccess*` sudah per `slug`; gerbang Syarat & Ketentuan sudah per tenant+produsen; kartu/menu Produsen di `/akun` sudah per `slug`.
- Risiko: akun yang sama terlihat di dua tenant sebagai produsen. Isolasi data tetap per schema; tidak ada data lintas tenant yang bocor karena semua kueri tetap bersyarat `slug` dari sesi + `producer_id` dari login tenant itu.

## 10. Peninjauan dan keputusan (sisi pengurus)

**Lokasi UI:** `/app/{slug}/toko/produsen/pengajuan` (di bawah menu Produsen yang ada). Lencana jumlah *pending* di `TokoNav` dan di blok "perlu tindakan" Dashboard.

**Antrean:** daftar (filter status, pencarian nama/brand, paginasi); detail menampilkan seluruh isian, foto (lightbox), dokumen, tautan (rel noopener), data anggota (nama, stambuk, kontak, status keanggotaan), dan **daftar periksa tinjauan** (alat bantu visual, tidak mengikat): milik sendiri · brand jelas · tim/PJ ada · bukti proses · legalitas sesuai jenis barang · foto layak.

**Aksi:**
- **Setujui** — Server Action; langkah (semua dari DB, tidak ada nilai kepercayaan dari klien):
  1. `getTenantAccess` + izin penyetuju (§ 11); kunci advisory per `application_id`; muat pengajuan; status harus `pending`.
  2. **Periksa ulang**: pemohon masih `isTenantMember`; punya akun Better Auth terklaim; baris sumber masih milik pemohon & aktif; belum ada produsen untuk sumber itu.
  3. Buat `producers` (type `member`, sumber, `member_id`, `brand_name`, `product_limit=3`, `revenue_share_percent` = angka yang DISEPAKATI penyetuju [bawaan = tawaran pemohon, divalidasi 0<p<100], `application_id`, `name_cache`) di schema tenant.
  4. Buat `public.producer_logins` (dengan `granted_by`). Dua schema berbeda → **tidak satu transaksi**: bila langkah 4 gagal, produsen yang baru dibuat dihapus (kompensasi, pola `createFirstOwnerAction`); status pengajuan menjadi `approved` **terakhir**. Kegagalan di tengah tidak boleh meninggalkan produsen yatim tanpa tercatat.
  5. Tulis `reviewed_*`, `producer_id`; kirim notifikasi (fire-and-forget; kegagalan kirim tidak membatalkan persetujuan).
- **Tolak** — alasan wajib (min. 10 karakter), tampil ke pemohon; `review_note` internal terpisah.
- **Batalkan** — oleh pemohon selagi `pending`.
- Tidak ada "hapus pengajuan" oleh pengurus (jejak audit); pembersihan lewat cron (§ 13).

## 11. Izin akses

**Tanpa role/modul baru (K10).** Menyetujui/menolak = `hasFullAccess(access.tenantUser, "anggota")`; melihat antrean & detail = `hasReadAccess(..., "anggota")`. Pada matriks yang ada ini berlaku untuk **Owner, Ketua, Sekretaris**; Bendahara tidak punya akses (`anggota: none`). Peran kustom yang diberi `anggota: full` di `/settings/roles` otomatis ikut bisa menyetujui — itu perilaku yang disengaja dan dikontrol lewat pengaturan peran. Semua lewat helper izin, tidak ada cek peran manual. Aksi *kelola produsen* yang sudah ada (tambah produsen, beri/cabut akses login, ubah batas produk) tetap `toko:full`.
Catatan: "super admin" diartikan peran **Owner** tenant (super admin platform tidak bisa masuk dashboard tenant — aturan proyek).
Konsekuensi yang perlu disadari: orang yang menyetujui (anggota:full) dan orang yang kemudian mengatur produsen (toko:full) bisa berbeda — Sekretaris dapat menyetujui tetapi tidak dapat mengubah batas produk/akses login setelahnya.

## 12. Notifikasi (K16: email saja)

| Peristiwa | Penerima | Kanal |
|---|---|---|
| Pengajuan masuk (`pending`) | pengurus penyetuju | lencana jumlah menunggu (`TokoNav` + Dashboard "perlu tindakan") + satu baris di **digest PJ "toko"** yang sudah ada (mengikuti kanal PJ yang dikonfigurasi tenant). Tidak ada email seketika per pengajuan di v1. |
| Disetujui | pemohon | **Email** — tautan login portal + ajakan menandatangani Syarat & Ketentuan |
| Ditolak | pemohon | **Email** — alasan + informasi boleh mengajukan lagi |

Alamat tujuan = email akun login pemohon (selalu ada) — bukan kontak yang diketik di form. Dikirim lewat `sendMailForTenant` (SMTP tenant, fallback SMTP platform); kegagalan kirim dicatat, tidak membatalkan keputusan. Tidak ada template WhatsApp baru. Kelengkapan kanal (WA, email seketika ke penyetuju) dibahas di rapat.

## 13. Penyimpanan, pembersihan, retensi

- Unggah gambar lewat route handler `POST /api/produsen/pengajuan/upload` (bukan Server Action — batas body 1 MB), pola `resi/route.ts`: cek `Content-Length` sebelum membaca body, Origin/Referer, `getSessionMember`, `isTenantMember`, kepemilikan draf, **batas jumlah berkas per draf (≤14: 4 contoh + 3 proses + 3 dokumen + cadangan)**, Sharp (format dari isi file, buang EXIF, maks 1600 px, WebP q80, `limitInputPixels`), nama berkas `randomUUID()`, `member_media.purpose = 'producer_application'` (tersembunyi dari picker), rate limit per anggota.
- **PDF (K13), hanya untuk dokumen legalitas:** disimpan APA ADANYA (tidak diproses ulang), maksimal 5 MB, divalidasi dari ISI (header `%PDF-` dan penutup `%%EOF`, bukan `file.type` klien), nama acak, jumlah dibatasi. Karena PDF dari pihak tak tepercaya dibuka peninjau, berkas **tidak** disajikan lewat URL publik MinIO: disajikan oleh route handler berotorisasi (izin `anggota` read atau pemilik pengajuan) dengan `Content-Type: application/pdf`, `X-Content-Type-Options: nosniff` dan `Content-Security-Policy: sandbox` (PDF dibuka di penampil bawaan peramban yang ber-sandbox; tanpa menjalankan skrip halaman kita). Risiko sisa: kerentanan penampil PDF peramban peninjau — diterima, didokumentasikan; pemindaian antivirus tidak ada di infrastruktur saat ini.
- Perkiraan: gambar ±150–250 KB setelah WebP; PDF sampai 5 MB (batas keras 3 per pengajuan → ≤15 MB terburuk, wajar karena dihapus sesuai retensi).
- **Cron baru** `GET /api/cron/cleanup-pengajuan-produsen` (harian, `x-cron-secret`, pola `cleanup-resi`):
  - `draft` > 7 hari → hapus berkas (MinIO + `member_media`) dan barisnya.
  - `rejected`/`cancelled` > **7 hari** sejak keputusan → hapus **semua** berkas (K14).
  - `approved` > **30 hari** → hapus foto contoh & foto proses (pengurus masih memakainya saat mengunggah produk pada masa peralihan); **dokumen legalitas dipertahankan** sebagai catatan.
  - Rujukan di JSON dikosongkan; respons melaporkan `deleted/failed/tenantsSkipped` (kegagalan tidak boleh senyap).
- Retensi baris teks pengajuan: disimpan (kecil; jejak audit). Tidak ada penghapusan otomatis di v1.

## 14. Keamanan (kategori Critical khusus proyek ini diberi tanda ★)

- ★ Semua akses tenant lewat `createTenantDb(slug)` dengan slug tervalidasi (`isActiveTenant` + sesi); `memberId` selalu dari sesi; sumber (`source_id`) dan setiap `mediaId` diverifikasi milik anggota itu **dan** tenant itu; tidak ada id mentah dipercaya.
- ★ Keanggotaan diperiksa di server pada tiga titik: buka/ubah draf, kirim, setujui.
- Kunci/CAS: unique index parsial (satu pengajuan terbuka), kunci advisory saat setujui/tolak, status asal diperiksa → dua klik/dua penyetuju bersamaan aman.
- Privasi: pemohon hanya melihat pengajuannya sendiri; pengurus melihat data kontak pemohon karena memang perlu; tidak ada data pengajuan di halaman/API publik.
- Teks bebas: batas panjang, ditampilkan sebagai teks; URL hanya `https` lewat `safe-url`; telepon `normalizePhone` + validasi E.164 server.
- Unggah: lihat § 13 (format dari isi file, ukuran, jumlah, nama acak; PDF disajikan lewat route berotorisasi + sandbox, bukan URL publik).
- Rate limit: kirim ≤5/hari per anggota; unggah ≤30/jam per anggota (pola `checkRateLimit`).
- Pesan galat tidak membocorkan keadaan tenant lain (mis. "sudah produsen di tempat lain" tidak ada lagi).
- Wajib: skill `jalakarta-security-review` setiap fase + subagent `security-auditor` sebelum rilis; kelemahan Mitra (§ 4.2) tidak boleh ditiru.

## 15. UI publik (anggota)

- Rute: `/{slug}/akun/produsen` — jika sudah produsen aktif → alihkan ke portal; jika punya pengajuan → status (draf/menunggu/ditolak + alasan + tombol "Ajukan lagi"); jika belum → form. Kartu "Jadi Produsen" di beranda `/akun` hanya bila saklar pengajuan hidup dan anggota memenuhi syarat dasar (kartu Produsen yang ada tetap hanya untuk produsen aktif).
- Mobile: mengikuti mobile shell akun (`docs/arsitektur-mobile-shell.md`); form dibagi bagian yang bisa dilipat, bukan satu halaman panjang; tombol bawah tidak menutup konten (aturan spacer).
- Custom domain: tautan memakai `baseUrl` seperti halaman akun lain; tautan portal tetap `/app/{slug}/portal-produsen`.

## 16. Integrasi dengan Syarat & Ketentuan (§ 28 portal)

Produsen hasil persetujuan langsung terkena gerbang bila tenant sudah menerbitkan syarat. Disarankan **menerbitkan Syarat & Ketentuan Produsen SEBELUM membuka pengajuan** di sebuah tenant, supaya produsen baru langsung diarahkan menandatangani. Tidak ada kode tambahan di pengajuan untuk ini.

## 17. Model harga & bagi hasil — USULAN user 2026-11-03, BELUM FINAL (tidak dikerjakan di fitur pengajuan; memblokir tahap produk & pencairan)

### 17.1 Usulan user
Produsen cukup menulis **harga jual umum** dan **harga jual anggota**. Tenant mengambil **persentase dari harga jual** (bukan dari keuntungan, bukan harga pokok tetap). Persentase itulah yang menurunkan "harga pokok" (bagian produsen) sehingga keuntungan tenant diketahui. Alasan user: persentase mudah dikembangkan — mis. **program afiliasi** (dari bagian tenant 10%, 2–3% diberikan ke afiliasi).

### 17.2 Penilaian
- **Cocok:** produsen berpikir dalam harga jual; tidak perlu memverifikasi modal (menghindari sengketa "untung"); ikut naik-turun harga; satu aturan yang sama dengan komisi Mitra; afiliasi tinggal memotong dari bagian tenant. Tidak ada kelemahan fatal. Pendekatan "dari keuntungan" ditolak karena mensyaratkan modal yang tak bisa diverifikasi.
- **Konsekuensi pada kode yang ada:** `products.price` sekarang = Harga Dasar/modal yang diisi admin dan dipakai Laporan Produk. Untuk produk berpersentase, bagian produsen **harus dihitung per baris pesanan dan disimpan sebagai snapshot** (persentase + jumlah bagian produsen/tenant/afiliasi di `invoice_items`) — perubahan persentase di kemudian hari tidak boleh mengubah pesanan lama. Snapshot ini diperlukan oleh afiliasi dan pencairan apa pun modelnya.
- **Pembulatan:** bagian produsen = `round(harga × (1 − p))` ke rupiah, bagian tenant = harga − bagian produsen (jumlah selalu pas).
- **Dasar hitung:** hanya harga barang. **Ongkir dan kode unik tidak ikut** dibagi (bukan pendapatan produk). Siapa menanggung diskon **voucher** — belum diputuskan (lihat 17.4-c).

### 17.3 Dua varian perlakuan harga anggota (contoh: umum 70.000, anggota 65.000, p = 10%)

| | Pembeli umum | Pembeli anggota |
|---|---|---|
| **Varian A — persentase dari harga yang DIBAYAR** | produsen 63.000 · tenant 7.000 | produsen 58.500 · tenant 6.500 |
| **Varian B — bagian produsen dikunci dari harga umum** | produsen 63.000 · tenant 7.000 | produsen 63.000 · tenant 2.000 |

- **A (rekomendasi):** satu rumus, margin tenant tidak pernah negatif, diskon anggota dipikul proporsional — wajar karena produsen sendiri yang menetapkan harga anggota. Afiliasi 3% dari harga bayar tetap konsisten. Konsekuensi: biaya produsen per pesanan bergantung jenis pembeli → butuh snapshot per baris (yang toh dibutuhkan afiliasi).
- **B:** produsen tidak terdampak diskon anggota (lebih menarik bagi produsen); tenant menanggung diskon — margin anggota tipis (di contoh hanya 2.000 = ±3%) dan bisa negatif bila harga anggota lebih rendah dari bagian produsen. Cocok dengan `products.price` statis yang ada.

### 17.4 Pertanyaan yang menunggu user
a. **Varian A atau B?** (rekomendasi A.)
b. **Persentase (K17, diputuskan user 2026-11-03):** pemohon **menawarkan** persentase di form pengajuan; penyetuju menilai menarik-tidaknya, boleh menyetujui pada angka tawaran atau menyesuaikannya; angka yang disepakati disimpan di produsen (`revenue_share_percent`), berlaku untuk pesanan BARU, tercantum di email persetujuan dan Profil portal (read-only). Masih terbuka: apakah tenant perlu **batas bawah** (mis. 5%) yang menolak tawaran di bawahnya otomatis di form — usulan, belum diminta; tanpa batas bawah, penilaian sepenuhnya oleh penyetuju.
c. **Voucher:** persentase dihitung dari harga **sebelum** voucher (voucher = promo tenant, ditanggung tenant) atau **sesudah** (produsen ikut menanggung)? Rekomendasi: sebelum voucher.
d. **Ongkir:** siapa membayar kurir pada pengiriman oleh produsen — dibahas bersama fitur pencairan.

### 17.5 Dampak pada pengajuan (sudah diakomodasi)
Form pengajuan meminta **persentase bagi hasil yang ditawarkan** (wajib, K17) serta, per contoh produk, **harga jual umum** dan **harga jual anggota** (perkiraan, opsional) — penyetuju dapat langsung menghitung bagian tenant dari tawaran itu. Cocok dengan model ini apa pun varian yang dipilih. Pada tahap produk: validasi Harga Anggota ≤ Harga Umum (sudah ada) ditambah persentase 0 < p < 100 dan, untuk varian B, Harga Anggota ≥ bagian produsen.

## 18. Fase eksekusi (tiap fase: tsc → skill security-review → commit; push hanya bila diminta; deploy: migration DULU)

| Fase | Isi | Catatan |
|---|---|---|
| **P1** | Pelonggaran multi-tenant: migration 0091 + `producerLogins` + `listProducerPortals` + `listUserContexts` + pesan `grantProducerLoginAction`; tandai D2 digantikan | berdiri sendiri; bisa di-deploy lebih dulu |
| **P2** | Saklar `producer_applications_enabled` di Pengaturan Toko (tanpa role/modul baru — K10) | kecil |
| **P3** | Schema `producer_applications` + kolom `producers` + DDL tenant baru + migration 0092 | tanpa perubahan perilaku |
| **P4** | Upload route + aksi draf/kirim/batal + form publik `/akun/produsen` | audit keamanan wajib (unggah + kepemilikan) |
| **P5** | Antrean admin + setujui/tolak (atomik + kompensasi) + lencana + dashboard | audit keamanan wajib (alur uang-identitas) |
| **P6** | Email disetujui/ditolak + baris digest PJ toko | email saja (K16) |
| **P7** | Cron pembersihan + uji data nyata (berkas sungguhan, bukan panggilan kosong) + `security-auditor` menyeluruh + dokumen/lessons/CLAUDE.md | |

Uji wajib sebelum selesai: dua penyetuju menyetujui bersamaan; keluar keanggotaan di antara kirim & setujui; sumber dihapus di antara kirim & setujui; langkah login gagal setelah produsen dibuat (kompensasi); unggah berkas bukan gambar / terlalu besar / lewat batas jumlah; pemohon A mengacu `mediaId` milik B; pemohon tenant lain mengajukan di tenant ini.

## 19. Yang MASIH terbuka

Sudah dijawab user (putaran 2): izin (K10), sumber (K11), contoh produk (K12), PDF (K13), retensi (K14), saklar (K15), notifikasi (K16). Tersisa:
1. **Model harga/bagi hasil** — pertanyaan di § 17 (varian A/B, dasar perhitungan setelah voucher, batas bawah persentase; siapa mengajukan persentase sudah diputuskan = pemohon, K17). **Tidak memblokir P1–P5** (pengajuan hanya mengumpulkan harga perkiraan); memblokir tahap produk & pencairan.
2. Aturan hitung batas produk (usulan: draf + aktif; arsip tidak) dan produsen lama buatan admin = tanpa batas — usulan, belum dikonfirmasi.
3. Kategori/"jenis" produk tambahan di luar kategori yang sudah ada (jenis digital/jasa sudah dicatat sebagai tahap sendiri).
4. Apakah penyetuju perlu email seketika saat pengajuan masuk (sekarang: lencana + digest PJ) — dibahas di rapat.

## 20. Status

- Rencana ditulis 2026-11-03 (dua putaran keputusan user: K1–K17).
- **P1 SELESAI KODE (2026-11-03; type-check bersih; uji data nyata di DB lokal lulus; belum di-push/deploy):**
  migration `0091_producer_logins_multi_tenant.sql` (tambah `UNIQUE(user_id, tenant_id)`, hapus `UNIQUE(user_id)`; idempotent; diuji dua kali jalan),
  `schema/public/producer-logins.ts`, `grantProducerLoginAction` (pesan "tempat lain" diganti; 23505 dibedakan: produsen sama vs akun sudah jadi produsen lain di tenant ini),
  `findProducerPortal` → **`listProducerPortals`** (semua tenant, tiap tenant lolos akses penuh), `listUserContexts` memakainya (`/pilih-tujuan` + `dashboard-redirect` sudah mendukung banyak konteks).
  Uji: akun sama di tenant 1 & 2 diterima; dua produsen untuk satu akun di satu tenant ditolak; satu produsen = satu akun tetap berlaku.
  **Belum diuji di browser:** akun produsen di dua tenant melihat `/pilih-tujuan` dengan dua entri Portal Produsen.
  Deploy: jalankan migration 0091 di VPS (aman sebelum maupun sesudah kode; indeks baru lebih longgar dari yang lama).
- **P2 SELESAI KODE (2026-11-03; type-check + build bersih):** saklar `producer_applications_enabled` (settings group `toko`, default MATI, disimpan sebagai boolean ketat) — `lib/toko-settings.ts`
  (`producerApplicationsEnabled`), `saveTokoSettingsAction`, bagian "Pengajuan Produsen" di `toko-settings-form.tsx`. Otorisasi mengikuti aksi simpan Pengaturan Toko yang sudah ada (`canManageUsers` = **Owner dan Ketua saja**; Sekretaris tidak bisa membuka/menutup — perilaku bawaan form, bukan keputusan baru).
  Penegakan di server (form/unggah/kirim ditolak saat mati) dikerjakan di P4.
- **P3 SELESAI KODE (2026-11-03; type-check + build bersih; belum di-push/deploy):** `schema/tenant/producer-applications.ts`, kolom baru `producers.{brand_name, product_limit, revenue_share_percent, application_id}`,
  DDL tenant baru (`create-tenant-schema.ts`), migration **`0092_producer_applications.sql`** (idempotent, diuji dua kali jalan di DB lokal).
  Uji data nyata (transaksi di-rollback): satu pengajuan terbuka per anggota (draft/pending kedua ditolak; sesudah `rejected` boleh baris baru), CHECK persentase (0 dan 100 ditolak, 7,5 diterima), status/process_days di luar rentang ditolak, nama kolom Drizzle cocok dengan DB.
  Tidak mengubah perilaku apa pun (belum ada kode yang membaca tabel). Deploy: jalankan **0091 lalu 0092** di VPS sebelum kode P4+.
- P4–P7 belum dimulai.
