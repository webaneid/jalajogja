# Arsitektur Pengajuan Produsen — alur anggota mengajukan diri, kurasi pengurus, jadi produsen

> **Status: KODE SELESAI P1–P7 (2026-11-03) — lihat § 20 (status) dan § 21 (regresi + runbook deploy).** Ditulis bersama user lewat diskusi; dokumen ini adalah satu-satunya sumber keputusan untuk fitur ini.
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
sample_products  jsonb  NOT NULL DEFAULT '[]'   -- [{id, name, estPriceUmum|null, estPriceAnggota|null, file:{id,key,mime}|null}]
process_media    jsonb  NOT NULL DEFAULT '[]'   -- [{id,key,mime}]
document_media   jsonb  NOT NULL DEFAULT '[]'   -- [{id, kind, note|null, file:{id,key,mime}}]  (gambar & PDF; bucket PRIVAT — § 13)
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
Berkas dirujuk lewat `{id, key, mime}`: `key` = path di bucket MinIO PRIVAT `private-{slug}` (`pengajuan-produsen/{applicationId}/{fileId}.webp|pdf`), TIDAK pernah dikirim ke klien; klien hanya memakai `id`. **Perubahan dari rencana awal (dicatat saat P4):** semula berkas direncanakan di `public.member_media` (Media Library anggota) — dibatalkan karena bucket tenant publik-baca (siapa pun yang tahu URL bisa membaca) sedangkan dokumen legalitas bersifat sensitif, dan agar Media Library anggota tidak tercemar. Referensi disimpan sebagai JSON (maks 10) — bukan tabel anak — karena selalu dibaca bersama dan dibersihkan bersama.

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
  4. Buat `public.producer_logins` (dengan `granted_by`). **Realisasi (lebih aman dari rencana awal):** semua langkah tenant (produsen + status) ada dalam SATU transaksi tenant dan `producer_logins` (schema `public`, client terpisah) disisipkan PALING AKHIR di dalam blok transaksi itu — kegagalannya me-rollback produsen + status. Satu-satunya celah (commit gagal SETELAH login tersisip) dikompensasi dengan menghapus login di `catch`. Sebelum insert, login YATIM (produsen sudah tak ada) untuk akun yang sama dibersihkan; login yang menunjuk produsen lain yang masih ada → ditolak jelas. `name_cache` diisi sesudah commit (upaya terbaik).
  5. Tulis `reviewed_*`, `producer_id`; kirim notifikasi (fire-and-forget; kegagalan kirim tidak membatalkan persetujuan).
- **Tolak** — alasan wajib (min. 10 karakter), tampil ke pemohon; `review_note` internal terpisah.
- **Batalkan** — oleh pemohon selagi `pending`.
- Tidak ada "hapus pengajuan" oleh pengurus (jejak audit); pembersihan lewat cron (§ 13).

## 11. Izin akses

**Tanpa role/modul baru (K10).** Menyetujui/menolak = `hasFullAccess(access.tenantUser, "anggota")`; melihat antrean & detail = `hasReadAccess(..., "anggota")`. Pada matriks yang ada ini berlaku untuk **Owner, Ketua, Sekretaris**; Bendahara tidak punya akses (`anggota: none`). Peran kustom yang diberi `anggota: full` di `/settings/roles` otomatis ikut bisa menyetujui — itu perilaku yang disengaja dan dikontrol lewat pengaturan peran. Server Action setujui/tolak MENAMBAH syarat `hasReadAccess(toko)` (halamannya ada di bawah `/toko`; menutup pemanggilan langsung oleh peran kustom `anggota:full` tanpa akses Toko). Sekretaris (`toko: read`) tetap bisa menyetujui. Syarat `toko:read` juga berlaku di penyaji berkas untuk jalur peninjau (konsisten dengan aksi & halaman). Semua lewat helper izin, tidak ada cek peran manual. Aksi *kelola produsen* yang sudah ada (tambah produsen, beri/cabut akses login, ubah batas produk) tetap `toko:full`.
Catatan: "super admin" diartikan peran **Owner** tenant (super admin platform tidak bisa masuk dashboard tenant — aturan proyek).
Konsekuensi yang perlu disadari: orang yang menyetujui (anggota:full) dan orang yang kemudian mengatur produsen (toko:full) bisa berbeda — Sekretaris dapat menyetujui tetapi tidak dapat mengubah batas produk/akses login setelahnya.

## 12. Notifikasi (K16: email saja) — ✅ terimplementasi (P6)

| Peristiwa | Penerima | Kanal |
|---|---|---|
| Pengajuan masuk (`pending`) | pengurus penyetuju | lencana jumlah menunggu (`TokoNav` + Dashboard "perlu tindakan") + satu baris di **digest PJ "toko"** yang sudah ada (mengikuti kanal PJ yang dikonfigurasi tenant). Tidak ada email seketika per pengajuan di v1. |
| Disetujui | pemohon | **Email** — tautan login portal + ajakan menandatangani Syarat & Ketentuan |
| Ditolak | pemohon | **Email** — alasan + informasi boleh mengajukan lagi |

Alamat tujuan = email akun login pemohon (selalu ada) — bukan kontak yang diketik di form. Dikirim lewat `sendMailForTenant` (SMTP tenant, fallback SMTP platform); kegagalan kirim dicatat, tidak membatalkan keputusan. Tidak ada template WhatsApp baru. Kelengkapan kanal (WA, email seketika ke penyetuju) dibahas di rapat. Implementasi: `lib/producer-application-notify.server.ts` (`buildDecisionEmail` murni + `notifyApplicationDecision` fire-and-forget; alamat dari `public.user.email` via akun pemohon, teks di-escape, subjek tanpa CR/LF); baris digest: `lib/pj-notification.server.ts` (digest toko + "Pengajuan produsen menunggu tinjauan: N").

## 13. Penyimpanan, pembersihan, retensi

- **Bucket privat** `private-{slug}` (dibuat otomatis, TANPA kebijakan publik; `lib/minio.ts`: `ensurePrivateBucket/uploadPrivate/getPrivate/deletePrivate`). Terverifikasi: URL langsung ke objek dijawab 403 oleh MinIO. **Nama sengaja berprefiks `private-`**, bukan akhiran `-private` pada nama bucket tenant (temuan audit M1): slug `foo-private` punya bucket PUBLIK `tenant-foo-private` yang akan bertabrakan dengan bucket privat tenant `foo`. `ensurePrivateBucket` juga FAIL-CLOSED: bucket yang sudah ada tetapi memiliki kebijakan akses ditolak. Bucket publik `tenant-{slug}` TIDAK dipakai untuk berkas pengajuan.
- Unggah lewat route handler `POST /api/produsen/pengajuan/upload?tenant={slug}` (bukan Server Action — batas body 1 MB). Urutan jaminan: Origin/Referer → sesi + anggota + keanggotaan tenant (`resolveApplicant`, SEBELUM body dibaca) → saklar hidup & belum jadi produsen → rate limit (30/jam/anggota) → Content-Length → validasi dari ISI berkas → simpan ke bucket privat → lampirkan ke draf dalam transaksi + kunci advisory per anggota (batas jumlah dicek DI DALAM transaksi) → bila lampiran gagal, objek baru dihapus lagi.
- **Pemrosesan** (`lib/producer-application-file.server.ts`): gambar (JPG/PNG/WebP/HEIC) diproses ulang Sharp → WebP, EXIF dibuang, maks 1600 px, `limitInputPixels`; SVG/HTML/teks/format lain ditolak. **PDF hanya slot dokumen**, disimpan APA ADANYA: header `%PDF-` + penutup `%%EOF`, maks 5 MB. Nama berkas `randomUUID()` buatan server. Batas: 4 contoh + 3 proses + 3 dokumen = 10 berkas per draf.
- **Penyaji berkas** `GET /api/produsen/pengajuan/berkas?tenant&app&f`: `key` dicari dari JSON pengajuan itu sendiri (tidak ada path dari klien); boleh untuk pemilik pengajuan ATAU pengurus `hasReadAccess(anggota)`; selain itu 404 (tidak membedakan "tidak ada" dari "bukan hakmu"). Header: `Content-Type` dari catatan server, `nosniff`, `X-Frame-Options: DENY`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `inline`; gambar tambahan `Content-Security-Policy: default-src 'none'; sandbox`. Peninjau (`hasReadAccess(anggota)`) hanya boleh membuka berkas pengajuan yang SUDAH dikirim (bukan `draft`).
  **Koreksi atas rencana awal:** rencana semula menyebut `Content-Security-Policy: sandbox` untuk PDF. TIDAK dipakai — yang diketahui, CSP sandbox pada dokumen PDF top-level dapat memblokir penampil PDF bawaan peramban (belum diuji di sini). PDF dibuka inline di penampil peramban peneliti; risiko sisa (celah penampil PDF peramban) diterima dan tidak ada pemindaian antivirus di infrastruktur ini.
- **Cron pembersihan** `GET /api/cron/cleanup-pengajuan-produsen` (harian, `x-cron-secret`, pola `cleanup-resi`) — ✅ **terimplementasi (P7)**: `lib/producer-application-cleanup.server.ts` + `app/api/cron/cleanup-pengajuan-produsen/route.ts` (fail-closed bila `CRON_SECRET` tak terkonfigurasi). Urutan aman: rujukan DB dihapus/dikosongkan DULU (usia diulang di klausa WHERE), baru objek; objek sisa ditangkap penyapu yatim (umur >1 jam). Aturan:
  - `draft` > 7 hari → hapus objek privat + baris.
  - `rejected`/`cancelled` > **7 hari** sejak keputusan → hapus semua berkas (K14).
  - `approved` > **30 hari** → hapus foto contoh & foto proses; **dokumen legalitas dipertahankan**.
  - Rujukan di JSON dikosongkan; respons melaporkan `draftsDeleted/finalCleared/approvedPhotosCleared/orphansDeleted/objectsDeleted/failed/tenantsSkipped/tenantsFailed` dan berstatus **500 bila `failed>0` atau ada tenant gagal** (curl -f di crontab ikut gagal); kunci terreferensi diambil lewat SQL (bukan memuat seluruh JSONB).
  **Crontab VPS (harus dipasang):** `20 3 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://jalakarta.com/api/cron/cleanup-pengajuan-produsen >> /var/log/jalajogja-cron.log 2>&1` — respons `{draftsDeleted, finalCleared, approvedPhotosCleared, orphansDeleted, objectsDeleted, failed, tenantsSkipped, tenantsFailed}`; `failed`/`tenantsFailed` ≠ kosong = periksa log.
- Retensi baris teks pengajuan: disimpan (kecil; jejak audit).

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

## 19. Yang MASIH terbuka (diperbarui setelah P7)

Sudah dijawab user: izin (K10), sumber (K11), contoh produk (K12), PDF (K13), retensi (K14), saklar (K15), notifikasi (K16), tawaran bagi hasil dari pemohon (K17). Tersisa — TIDAK memblokir peluncuran pengajuan, tetapi perlu keputusan:
1. ~~Penyetuju memutuskan pengajuannya sendiri~~ — **DIJAWAB user 2026-11-03 (K19): BOLEH** (Ketua/Sekjen punya otoritas). Perilaku sekarang (peringatan + penanda otomatis) dipertahankan; tidak ada penguncian.
2. **Model harga/bagi hasil** (§ 17): **varian diskon anggota DIJAWAB user 2026-11-03 (K18): ditanggung BERSAMA** — persentase bagi hasil berlaku atas harga yang benar-benar dibayar pembeli. Contoh: tawaran 10%, harga umum Rp10.000 → bagian toko Rp1.000; harga anggota Rp9.000 → bagian toko Rp900; persentasenya TETAP 10% di keduanya (produsen dan toko sama-sama menanggung selisih diskon). Masih terbuka: dasar hitung terhadap voucher, batas bawah persentase di form. Memblokir tahap produk & pencairan, bukan pengajuan.
3. **Mengubah persentase bagi hasil SETELAH disetujui** — **DIJAWAB user 2026-11-03 (K20): produsen TIDAK boleh mengubah sendiri; HANYA admin** (setelah produsen dan toko berkomunikasi, bisa naik/turun). UI admin untuk ini BELUM dibuat (hanya batas produk yang bisa diubah); perubahan harus tercatat (siapa, kapan, nilai lama → baru) — dirancang di tahap pencairan.
4. **Aturan hitung batas produk** (draf+aktif, tanpa arsip) — usulan; belum ditegakkan karena portal belum bisa membuat produk (tahap produk).
5. **Kategori/"jenis" produk tambahan** di luar `product_categories` yang sudah ada (digital/jasa dicatat sebagai tahap sendiri).
6. ~~Email seketika ke penyetuju~~ — **DIKERJAKAN 2026-11-03 (PR-E, `arsitektur-produk-produsen.md` § 8)**; lencana, dashboard, dan digest PJ tetap ada.
7. **Sekretaris tanpa akses penuh Toko** boleh menyetujui (keputusan K6) — dicatat agar disadari.
8. **Retensi data pribadi** (hasil audit akhir): dokumen legalitas pengajuan DISETUJUI disimpan tanpa batas waktu (K14), pengajuan PENDING tanpa batas waktu (berkas tertahan selama belum diputuskan), dan baris teks final (nama PJ, WA, deskripsi) disimpan selamanya. Pertimbangkan TTL panjang (mis. 1–2 tahun) untuk dokumen, dan pembatalan/peringatan otomatis untuk pending > N bulan.
9. **Deploy**: migration 0092 hanya menyentuh tenant `is_active=true`; tenant nonaktif yang diaktifkan kemudian harus menjalankan 0091/0092 lagi sebelum fitur dipakai (tabel/kolom tak ada → 42P01/42703).

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
- **P4 SELESAI KODE (2026-11-03; type-check + build bersih; audit `security-auditor` selesai & temuan diperbaiki; belum di-push/deploy):**
  `lib/producer-application.ts` (batas + `parseDraftInput(unknown)` + `validateForSubmit` + `DraftView`), `lib/producer-application.server.ts` (`resolveApplicant`, draf/berkas/kirim/batal/buang),
  `lib/producer-application-file.server.ts`, route unggah + penyaji berkas, `akun/produsen/{actions.ts,page.tsx,producer-application-client.tsx}`, kartu "Jadi Produsen" di beranda `/akun`
  (hanya bila saklar hidup & bukan produsen), bucket privat di `lib/minio.ts`.
  **Audit (0 Critical, 0 High, 2 Medium, 5 Low; tanpa celah lintas-tenant/IDOR) — semua yang menyangkut P4 sudah diperbaiki:**
  M1 nama bucket privat bertabrakan dengan bucket publik tenant bersluk `*-private` → `private-{slug}` + fail-closed bila bucket punya kebijakan;
  L contoh produk digabung per POSISI (autosave basi bisa menghapus foto baru) → kini per ID server, contoh yang tak ada di kiriman klien DIPERTAHANKAN, unggah memakai `sampleId`;
  L payload Server Action aneh melempar TypeError → `parseDraftInput(unknown)` menyaring tipe, angka ketat (tanpa `0x10`/`1e1`), seluruh aksi simpan dalam try;
  L Sharp berjalan sebelum cek status draf → draf/status dicek lebih dulu, `MAX_PIXELS` 25→16 MP, batas konkurensi global 2 (sisanya 503 "sibuk");
  L cache berkas sensitif → `private, no-store`; peninjau tak boleh membaca draf; gambar diberi CSP; tautan berkredensial (`https://user:pass@…`) ditolak.
  **M2 (cron pembersihan belum ada) = fase P7 dan MENJADI SYARAT sebelum saklar pengajuan dihidupkan di production** (draf ditinggalkan & berkas pengajuan final belum terhapus otomatis).
  Tidak dikerjakan: PDF disajikan inline tanpa CSP (keputusan § 13, risiko diterima); pemindaian antivirus.
  **Uji data nyata (DB + MinIO lokal; data uji dihapus):** 50 pengecekan lib + 17 pengecekan ulang pasca-audit (nama bucket, fail-closed kebijakan publik, akses anonim 403, payload aneh, 6 pemrosesan bersamaan → 2 selesai/4 sibuk lalu normal kembali,
  klien basi/urutan terbalik/id ngawur/hapus lewat removeDraftItem). Uji HTTP (dev server + akun uji sementara): form tampil; tanpa Origin / Origin asing = 403; tanpa sesi = 401; unggah sah 200; PDF di slot contoh 400; HTML menyamar PNG 400;
  `sampleId` hilang 400 / ngawur 409; penyaji berkas pemilik 200 (header `no-store`, `nosniff`, CSP gambar), anonim 404, akun lain 404, traversal/tenant palsu/id lain 404; unggah saat pending 409, saat saklar mati 403; kartu beranda tak tampil saat saklar mati.
  **Belum diuji:** tampilan/gesture formulir di browser sungguhan (terutama HP); jalur pengurus membuka berkas (`hasReadAccess(anggota)`, perlu akun pengurus); perilaku Origin/Host di belakang Nginx & custom domain.
  **CATATAN DEPLOY P4:** (1) Nginx: `client_max_body_size 10m;` untuk `location /api/produsen/pengajuan/upload` (default 1 MB menolak unggahan sebelum sampai ke aplikasi); (2) jalankan migration 0091 lalu 0092 SEBELUM kode; (3) saklar biarkan MATI di production sampai P7 (cron) selesai; (4) bucket `private-{slug}` dibuat otomatis saat unggahan pertama — pastikan kredensial MinIO aplikasi boleh membuat bucket.
- **P5 SELESAI KODE:** antrean + detail + setujui/tolak di `/app/{slug}/toko/produsen/pengajuan` (lihat § 10–11). Audit `security-auditor` (0 Critical, 0 High, 2 Medium, 5 Low; tanpa IDOR/lintas-tenant) — diperbaiki:
  daftar → SQL `COUNT/LIMIT/OFFSET` + kolom ringan + `ILIKE` dengan escape `%`/`_` (pencarian nama pemohon lewat `public.members`); login YATIM (produsen sudah tak ada) dibersihkan sebelum persetujuan, login sah milik produsen lain → ditolak jelas;
  aksi setujui/tolak mensyaratkan `anggota:full` **dan** `toko:read`; log galat aksi tidak lagi mencetak objek galat utuh.
  **Keputusan bisnis yang saya ambil SENDIRI saat Anda tidur (mohon dikonfirmasi):** (1) penyetuju BOLEH memutuskan pengajuannya sendiri (agar tenant dengan satu pengurus tidak buntu) — tetapi halaman detail menampilkan peringatan dan keputusan ditandai `[Diputuskan oleh pemohon sendiri]` di catatan internal; bila ingin dikunci, tambahkan penolakan `access.tenantUser.memberId === app.memberId` di `approveApplication`/`rejectApplication`.
  (2) Sekretaris (`toko: read`) boleh menyetujui — sesuai keputusan K6, meski aksi Produsen lain butuh `toko:full`.
- **P6 SELESAI KODE:** email disetujui/ditolak + baris digest toko (§ 12). Teruji: isi email (escape, tanpa tag dari input, subjek tanpa CR/LF), kait berjalan & kegagalan SMTP tidak menghalangi keputusan. **Belum teruji:** pengiriman email sungguhan (SMTP lokal tidak ada) dan kiriman digest PJ nyata (butuh PJ terkonfigurasi).
- **P7 SELESAI KODE:** cron pembersihan (§ 13). Teruji data nyata dengan jam simulasi: draf kedaluwarsa (draf baru disentuh selamat), ditolak/dibatalkan (semua berkas hilang, baris teks tetap), disetujui >30 hari (dokumen legalitas dipertahankan), pending tak tersentuh, objek yatim terhapus, idempoten; rute: tanpa header/header salah 401, header benar 200 + laporan; tanpa `CRON_SECRET` selalu 401.
- **Pelengkap hasil evaluasi total (celah yang ditutup sebelum push):** (a) K3 "admin bisa menaikkan batas produk" belum punya UI → tombol "Batas produk" di kartu produsen anggota (`setProducerProductLimitAction`, `toko:full`, 1–999 atau kosong = tanpa batas); kartu juga menampilkan bagi hasil & brand;
  (b) § 17.4b "bagi hasil tampil di Profil portal (read-only)" belum ada → bagian "Kesepakatan" (brand, bagi hasil, batas produk) di Profil portal produsen.

## 21. Regresi & runbook deploy (2026-11-03)

### 21.1 Regresi
Proyek belum punya suite tes. Skrip data-nyata: `cd apps/web && SMOKE_I_KNOW=1 bun run --preload ./scripts/stub-server-only.ts scripts/smoke-producer-application.ts` — 41 pengecekan (berkas, parsing, draf, tinjauan termasuk balapan/rollback/login yatim/keputusan sendiri, daftar+paginasi+escape LIKE, email, cron dengan jam simulasi).
**Pengaman:** menolak jalan bila host `DATABASE_URL`/`MINIO_ENDPOINT` (di-parse, bukan sekadar kata yang cocok) bukan localhost, atau tanpa `SMOKE_I_KNOW=1`; kandidat anggota yang sudah punya produsen/pengajuan dikecualikan (skrip membuat akun/produsen/berkas uji dan mengganti sementara tautan akun 3 anggota; dipulihkan di `finally`). Butuh migration 0083–0092 di DB lokal, MinIO lokal hidup, ≥3 anggota aktif berusaha.
Jalankan ulang setiap mengubah modul ini.

### 21.2 Urutan deploy VPS (migration DULU, lalu kode)
1. `git pull` → cek `git log --oneline -3`.
2. Migration (idempotent; jalankan berurutan): `docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0091_producer_logins_multi_tenant.sql` lalu `…/0092_producer_applications.sql`. (0090 = Syarat & Ketentuan, sudah jalan.) Hasil benar: `NOTICE: OK tenant_<slug>` per tenant, tanpa `ERROR`.
3. Nginx: tambahkan `client_max_body_size 10m;` untuk `location /api/produsen/pengajuan/upload` (default 1 MB menolak unggahan), `nginx -t && systemctl reload nginx`.
4. `bun install && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env && pm2 flush jalajogja`.
5. Crontab (user `webane`): tambahkan baris di § 13. Uji manual sekali: `curl -s -H "x-cron-secret: $CRON_SECRET" https://jalakarta.com/api/cron/cleanup-pengajuan-produsen` → harapan `{"draftsDeleted":0,…,"failed":0,"tenantsSkipped":[],"tenantsFailed":[]}`.
6. Pastikan kredensial MinIO aplikasi boleh membuat bucket (bucket `private-{slug}` dibuat otomatis saat unggahan pertama) dan **tidak ada** kebijakan akses pada bucket itu (fungsi menolak bila ada).
7. Peluncuran per tenant: terbitkan Syarat & Ketentuan Produsen (§ 28 portal) → hidupkan saklar di Pengaturan Toko (Owner/Ketua) → uji dengan satu anggota asli.
8. Mundur cepat: matikan saklar (tidak ada data yang perlu dihapus).

### 21.3 Belum diuji / tidak diuji di sini
Tampilan & gesture formulir di browser sungguhan (terutama HP); pengiriman email sungguhan & digest PJ; jalur pengurus asli membuka berkas dan menekan tombol setujui/tolak di browser (logika diuji di lib, halaman diuji lewat HTTP dengan Ketua/Bendahara sementara); perilaku Origin/Host di belakang Nginx & custom domain; kinerja pool Postgres di bawah beban persetujuan paralel (rate limit 60/jam).

### 21.4 Sengaja belum dibangun (tahap berikut)
Produsen mengunggah/mengedit produk sendiri + tinjauan produk + penegakan batas produk · jenis digital/jasa · entitas brand · salin produk lintas tenant (opsi B) · kenaikan ke Mitra · pengajuan pembayaran/pencairan · keputusan model harga § 17.

