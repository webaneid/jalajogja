# Arsitektur Ikon Tenant — Favicon, Apple Touch Icon, Web Manifest

> **Status: DIKUNCI 2026-10-30, dieksekusi bertahap (lihat § 7).** Terkait: `docs/arsitektur-domain.md`
> (custom domain), `docs/arsitektur-image.md` (varian gambar), `docs/arsitektur-seo.md`.

## 1. Masalah (diverifikasi di produksi 2026-10-30)

Laporan: ikon tab browser, ikon iPhone, dan ikon Android semua menampilkan ikon bawaan (Next.js/platform), bukan
favicon yang diatur admin di Pengaturan → Umum. Hasil `curl` HTML `/forbis` dan `/pc-ikpm-jogjakarta`:

1. **Ikon generik ikut dirender berdampingan.** `app/favicon.ico` (file-based) menyuntik
   `<link rel="icon" href="/favicon.ico" sizes="32x32">` ke SETIAP halaman, termasuk halaman tenant — bersaing dengan
   ikon tenant; banyak browser memilih yang ber-`sizes` eksplisit → ikon generik menang.
2. **Manifest PWA/Android milik platform.** Semua tenant menautkan `/manifest.webmanifest` (`app/manifest.ts`):
   `name: "Jalakarta"`, ikon `icon.svg`/`apple-icon.png`. "Tambahkan ke layar utama" di Android memakai itu.
3. **Format salah untuk iPhone.** `apple-touch-icon` menunjuk file **WebP**; Safari iOS umumnya hanya mau PNG
   (perlu dites di perangkat).
4. **Sumber kecil/tidak seragam.** `favicon_url` menyimpan `variants.square ?? media.url`: `forbis` 400×400,
   `pc-ikpm-jogjakarta` 150×150 (varian `_ori`). 150px yang diperbesar ke 180/192/512 menjadi buram.
5. `/favicon.ico` yang diminta langsung (crawler, tab tanpa tautan) selalu generik; di custom domain middleware
   mengecualikan path ini sehingga tidak pernah ter-rewrite ke tenant.

## 2. Keputusan user (2026-10-30)

1. **Sumber ikon**: kolom Favicon (`settings.general.favicon_url`); bila kosong/tidak valid → Logo (`logo_url`) sebagai cadangan.
2. **Front-end tenant WAJIB memakai ikon tenant.** Ikon platform (bawaan sekarang) belum didesain — hanya cadangan terakhir
   untuk tenant yang tidak punya favicon DAN logo, dan untuk domain platform sendiri.
3. `/favicon.ico` pada `jalakarta.com/{slug}` (path-based) tidak bisa tahu tenant → tetap ikon platform; tidak masalah karena
   browser memakai tautan `<link>` di HTML yang benar.

## 3. Rancangan

### 3.1 Endpoint ikon PNG per tenant — `app/(public)/[tenant]/tenant-icon/[size]/route.ts`
- `size` ∈ {32, 48, 180, 192, 512} (daftar tetap — nilai lain 404; mencegah beban/penyalahgunaan).
- Sumber: nilai `favicon_url` lalu `logo_url`. URL HANYA diterima bila diawali `${MINIO_PUBLIC_URL}/tenant-{slug}/` →
  path objek diekstrak lalu dibaca lewat `getFile(slug, path)` (SDK S3 ke bucket TENANT ITU SENDIRI). **Tidak ada fetch
  ke URL arbitrer → tidak ada SSRF**, dan tenant tidak bisa membaca bucket tenant lain.
- Sharp: `limitInputPixels`, batas ukuran file 5 MB, `resize(size, size, { fit: "contain" })`. Ukuran ≥180 diratakan ke
  latar putih (iOS menghitamkan transparansi); 32/48 mempertahankan transparansi. Output PNG.
- Cache dalam memori (LRU 200 entri, kunci `slug:size:pathObjek` — ganti favicon = path berubah = otomatis tervalidasi ulang) +
  `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`.
- Tidak ada sumber → 302 ke ikon platform (`/apple-icon.png` untuk ≥180, `/icon.svg` untuk lainnya).
- Guard `isActiveTenant(slug)` di awal (lihat lesson 2026-10-30 tenant palsu).

### 3.2 Metadata tenant — `app/(public)/[tenant]/layout.tsx` `generateMetadata`
Bila ada sumber ikon: `icons.icon` = PNG 32 & 48, `icons.apple` = PNG 180 (`sizes`, `type` eksplisit), `icons.shortcut` = 48,
`manifest` = `${baseUrl}/manifest.webmanifest`. `baseUrl` dari `resolveBaseUrl()` (`/{slug}` atau kosong di custom domain).
Tanpa sumber ikon: tidak menimpa (jatuh ke ikon platform).

### 3.3 `app/favicon.ico` (file) DIGANTI Route Handler
File-based `favicon.ico` adalah penyebab temuan #1 (tautan generik di semua halaman). File dipindah ke
`public/platform-favicon.ico` dan `app/favicon.ico/route.ts` menyajikannya — Route Handler tidak menyuntik `<link>`.
Di custom domain, `/favicon.ico` kini di-rewrite middleware ke `[tenant]/favicon.ico/route.ts` yang menyajikan ikon tenant 48px.

### 3.4 Manifest per tenant — `app/(public)/[tenant]/manifest.webmanifest/route.ts`
`name`/`short_name` = nama situs, `description` = tagline, `start_url`/`scope` = `${baseUrl}/`, `display: standalone`,
`theme_color` = `display.primary_color`, ikon 192 & 512 dari § 3.1. `Content-Type: application/manifest+json`.
`app/manifest.ts` (platform) tetap untuk domain platform.

### 3.5 Middleware
Komentar `middleware.ts` sendiri menetapkan aturannya: path ikon/manifest hanya boleh dikecualikan selama TIDAK punya versi
per-tenant. Setelah § 3.3–3.4, `favicon.ico` dan `manifest\\.webmanifest` DICABUT dari pengecualian matcher
(`icon.svg` dan `apple-icon.png` tetap dikecualikan — hanya platform). Biaya: request ikon di custom domain kini melewati
resolusi domain (sekali per request, hasilnya cacheable di browser).

### 3.6 Form Pengaturan Umum
Petunjuk di kolom Favicon: gunakan gambar persegi minimal 512×512 (ikon kecil tampak buram di layar HP).

## 4. Risiko
- Endpoint publik memanggil Sharp → dibatasi ukuran tetap, batas piksel/ukuran file, cache; tanpa sumber = redirect murah.
- Mengganti pengecualian middleware menambah resolusi domain untuk `/favicon.ico` dan manifest di custom domain (sudah
  dipertimbangkan; tenant-nya memang butuh versi per-tenant).
- Cache browser: ikon lama bisa tertahan beberapa menit-jam setelah admin mengganti favicon (max-age 1 jam, URL berubah per path objek
  hanya pada cache server, bukan URL publik).
- iOS: format PNG 180 adalah praktik umum, tapi harus dites di iPhone sungguhan.

## 5. Keamanan
Tanpa input dari pengguna anonim selain `size` (whitelist) dan slug (di-guard `isActiveTenant`); sumber dibaca hanya dari bucket tenant
via kredensial server; tidak ada fetch URL keluar; tidak ada HTML yang dirender.

## 6. Yang TIDAK dikerjakan sekarang
- Desain ikon platform baru (menunggu desain).
- `favicon.ico` format ICO sungguhan (PNG di `/favicon.ico` diterima semua browser modern).
- Ikon maskable Android dan splash screen iOS.
- Ikon dashboard admin per tenant (dashboard memang platform).

## 7. Status eksekusi
- [x] SELESAI KODE 2026-10-30 (belum deploy; type-check + build produksi lokal bersih; pipeline gambar diuji dengan 2 ikon asli produksi):
      `lib/tenant-icon.server.ts`, `app/(public)/[tenant]/tenant-icon/[size]/route.ts`, `.../favicon.ico/route.ts`,
      `.../manifest.webmanifest/route.ts`, metadata ikon+manifest di `app/(public)/[tenant]/layout.tsx`, matcher middleware
      (cabut `favicon.ico` + `manifest.webmanifest` dari pengecualian), petunjuk di form Pengaturan Umum.
- **Koreksi rancangan saat eksekusi**: `app/favicon.ico/route.ts` di ROOT DITOLAK Next.js (folder `app/favicon.ico` diperlakukan
  sebagai file metadata → build gagal "Can't resolve app/favicon.ico?__next_metadata__"). Diganti redirect di `next.config.ts`
  (`/favicon.ico` → `/icon.svg`, hanya host `(www.|app.)?jalakarta.com` karena `redirects()` berjalan SEBELUM middleware).
  Versi bersarang `[tenant]/favicon.ico/route.ts` (custom domain) aman, sama seperti `robots.txt`.
- **Hasil review keamanan (diperbaiki sebelum commit)**: format sumber dibatasi raster (SVG ditolak), `HeadObject` cek ukuran sebelum
  unduh (batas 5 MB), cache negatif 5 menit untuk sumber rusak, host redirect diperluas ke www/app.
- Uji online yang masih perlu: tab browser tenant, iPhone "Tambah ke Layar Utama" (apple-touch-icon PNG 180), Android (manifest per
  tenant), custom domain (`/favicon.ico` + `/manifest.webmanifest` ter-rewrite), `view-source` memastikan tautan `/favicon.ico` generik hilang.
