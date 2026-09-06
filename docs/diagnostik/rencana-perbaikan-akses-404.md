# Rencana Perbaikan — 404 Tersembunyi, Beban DB, dan Dugaan Blokir IP

> **Susulan (2026-08-31)**: bug KOREKTNESS terpisah (500 untuk tenant fiktif, bukan cuma
> query-boros) ditemukan+difix di fungsi yang sama (`resolveSlugKind()`) — lihat § 13.

> **Status: ✅ SELESAI SELURUHNYA (2026-07-28).** Fase A+B+C dieksekusi+diverifikasi. § 6 (cek
> Fail2ban di VPS) sudah dijalankan user — **hasil: Fail2ban TIDAK TERINSTALL sama sekali** di
> VPS ini (`systemctl status fail2ban` → "Unit fail2ban.service could not be found"). Ini
> **menggugurkan total** teori "404 → Fail2ban ban IP → user asli ikut kena" dari laporan agen
> lain (§ 5.1) — mekanismenya tidak pernah ada di server ini. Fase D dan § 8 (keduanya
> kontinjen pada data ini) **DIBATALKAN, bukan cuma ditunda** — tidak ada jail untuk di-tuning.
> Lihat **§ 11 "Hasil Eksekusi"** untuk detail implementasi Fase A/B/C + § 12 untuk hasil cek
> Fail2ban dan rekomendasi lanjutan kalau keluhan "beberapa orang tidak bisa buka situs" masih
> berulang setelah fix ini di-deploy.
>
> Ditulis 2026-07-28 setelah user melaporkan "kadang beberapa orang tidak bisa membuka website
> kita" dan meminta verifikasi ulang atas analisa agen lain (dikutip di § 1). Sesi yang menulis
> rencana ini TIDAK punya akses SSH ke VPS — semua temuan § 3 berbasis baca kode langsung (grep +
> Read), semua yang butuh akses VPS ditandai eksplisit "TIDAK BISA diverifikasi dari sini" dan
> dipindah jadi prosedur manual untuk user (§ 6) — ini TETAP berlaku, sesi eksekusi juga tidak
> punya akses SSH.

## 1. Latar Belakang

User bertanya: *"apa yg membuat orang buka website kita tiba2 404? apakah ada hal yg salah di
kita sehingga membuat orang berulang request?"* — disertai kutipan analisa dari agen lain yang
mengklaim 4 penyebab (favicon/icon hilang, Next.js `<Link>` prefetch badai request, gambar
rusak, tautan lama WordPress tanpa redirect) yang berujung ke Fail2ban VPS mem-blokir IP
pengguna karena dianggap bot/scanner.

Dokumen ini memverifikasi keempat klaim itu SATU PER SATU terhadap kode aktual (bukan menerima
mentah-mentah), menambahkan 1 temuan baru yang ditemukan SAAT proses verifikasi (bukan
diantisipasi sejak awal), dan menyusun rencana perbaikan yang bisa dieksekusi bertahap.

## 2. Metodologi Verifikasi

Setiap klaim dicek dengan salah satu dari:
- **Baca file langsung** (`Read`) — untuk memahami logic persis, bukan menebak dari nama file.
- **Grep terarah** — untuk konfirmasi pola dipakai/tidak dipakai di seluruh codebase (bukan
  cuma 1 contoh yang kebetulan cocok).
- **Cross-check terhadap dokumentasi/lesson yang sudah ada** (`docs/lessons-learned.md`) — kalau
  sebuah masalah SUDAH pernah ditemukan+difix sebelumnya (mis. bug 404 bot/scraper
  generateMetadata, `## [2026-08-31] Guard "tenant exists" wajib diaudit ke SEMUA titik
  pemanggilan...`), itu jadi konteks penting apakah temuan baru ini tumpang tindih atau
  benar-benar baru.

Yang **TIDAK BISA diverifikasi** dari sesi ini (dan kenapa) ditandai eksplisit — bukan
diasumsikan benar/salah tanpa bukti.

## 3. Temuan — Terverifikasi BENAR (dengan bukti)

### 3.1. `apps/web/public/` benar-benar kosong

```
$ ls -la apps/web/public/
.gitkeep    (0 bytes)
```

Tidak ada `favicon.ico`, `apple-touch-icon.png`, `apple-touch-icon-precomposed.png`,
`site.webmanifest`/`manifest.json`, `favicon-32x32.png`/`favicon-16x16.png`. Juga dicek: tidak
ada file khusus Next.js App Router (`app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`) di
`apps/web/app/` root. **Setiap browser (terutama HP — Chrome Android/Safari iOS) SELALU mencoba
fetch beberapa path icon standar di background begitu halaman dibuka**, terlepas apakah kita
deklarasikan `<link rel="icon">` di `<head>` atau tidak — kalau kita tidak sediakan file
apa pun, semua percobaan itu 404.

### 3.2. Middleware matcher cuma exclude `favicon.ico`, bukan icon path lain

`apps/web/middleware.ts` baris 210-214:
```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|dashboard-redirect).*)",
  ],
};
```

`apple-touch-icon.png`, `apple-touch-icon-precomposed.png`, `site.webmanifest`,
`favicon-32x32.png`, dll TIDAK match negative-lookahead ini — jadi request ke path-path itu
TETAP masuk middleware, ikut logic resolve-custom-domain (kalau di custom domain), di-rewrite
jadi `/{slug}/apple-touch-icon.png`, lalu diteruskan ke catch-all route publik yang MELAKUKAN
QUERY DATABASE untuk mencari "halaman"/"post" dengan slug itu (lihat § 3.3) sebelum akhirnya
404. Untuk domain sendiri (jalakarta.com), efeknya cuma "404 boros query" — untuk **custom
domain**, ada lapisan masalah tambahan (§ 3.4).

### 3.3. BARU DITEMUKAN — Catch-all route query DB dua kali per request (tidak di-cache)

`apps/web/app/(public)/[tenant]/[...slug]/page.tsx` — `resolveSlugKind()` (2-4 query DB:
cek Page, cek Post kalau permalink relevan, cek `legacy_url_redirects`) dipanggil **DUA KALI
independen** untuk request yang sama:
1. Sekali di `generateMetadata()` (baris ~235-242)
2. Sekali lagi di komponen halaman `CatchAllPage()` (baris ~244-258)

Next.js **TIDAK otomatis men-dedup pemanggilan fungsi custom** seperti ini di antara
`generateMetadata` dan komponen halaman (beda dari `fetch()` yang di-dedup otomatis dalam satu
request) — kecuali fungsinya dibungkus `React.cache()`. Pola `React.cache()` ini SUDAH ada
presedennya di project ini (`lib/tenant.ts`'s `getCurrentSession`), dan gap yang SAMA PERSIS
sudah dicatat sebagai technical debt lama di `CLAUDE.md` (*"`getTenantAccess()` dipanggil di
layout DAN page — perlu `React.cache()` saat query makin banyak"*) — jadi ini bukan gap baru
secara jenis, cuma instance baru yang belum pernah ditutup.

**Dampak**: setiap 404 (favicon/icon yang hilang, ATAU bot scanner yang asal tembak
`/wp-admin`, `/.env`, `/xmlrpc.php` — traffic ini SELALU ada untuk situs publik manapun, tidak
bisa dicegah, cuma bisa dibuat murah) menghabiskan **sampai 8 query DB** untuk sekadar bilang
"tidak ketemu". Kalau ada burst traffic scanner (umum terjadi, bot vulnerability-scanning
men-scan ribuan domain per menit tanpa pandang bulu), ini bisa membebani koneksi DB tenant
schema yang sama — berpotensi membuat request LEGIT dari pengunjung asli di saat bersamaan
jadi lambat/timeout.

### 3.4. Di custom domain, `favicon.ico` lolos middleware TAPI salah-tafsir jadi tenant slug

Karena `favicon.ico` di-exclude middleware sepenuhnya (§ 3.2), request `https://visikita.com/
favicon.ico` TIDAK PERNAH melalui logic resolve-custom-domain-ke-slug sama sekali — Next.js
langsung mencoba match route App Router `app/(public)/[tenant]/page.tsx` dengan
`[tenant]="favicon.ico"` (nama tenant LITERAL, bukan tenant asli custom domain itu, mis. bukan
"visikita"). Lookup tenant dengan slug "favicon.ico" di `public.tenants` pasti gagal → fallback
sudah AMAN (lihat lesson `[2026-05] Bot/Scraper Errors — generateMetadata Harus Cek Tenant
Existence`, fix lama yang mencegah ini crash) → hasilnya 404 bersih, BUKAN crash. Jadi ini
bukan bug fatal, tapi tetap mubazir (nyasar ke lookup tenant yang salah sebelum akhirnya gagal).

## 4. Klaim dari Laporan Agen Lain yang TIDAK Akurat / Terlalu Digeneralisir

### 4.1. Next.js `<Link>` prefetch — diverifikasi TIDAK relevan untuk situs kita

Klaim: setiap `<Link>` yang masuk viewport otomatis di-prefetch, dan kalau target-nya rusak
(draft/dihapus/salah slug), ini bikin badai request 404 di background.

**Ini MEKANISME NYATA Next.js secara umum** — tapi diverifikasi ke kode kita: header, footer,
post card, nav menu SEMUA pakai `<a href>` polos, **BUKAN** `next/link`:
```
$ grep -rl 'from "next/link"' components/website/public/layout/
(0 hasil)
```
`next/link` cuma dipakai di **7 file total** di seluruh front-end publik, SEMUANYA halaman
pagination direktori (`/usaha`, `/pesantren`, `/profesional`) dengan href sederhana
(`?page=2`) yang praktis selalu valid. **Kesimpulan**: klaim ini kelihatannya pengetahuan umum
Next.js yang ditempelkan tanpa mengecek kode kita — untuk situasi kita saat ini, dampaknya
minimal/tidak signifikan.

## 5. Klaim yang TIDAK BISA Diverifikasi dari Sesi Ini

### 5.1. Fail2ban — LYNCHPIN seluruh teori "404 → IP diblokir", tapi tidak ada bukti dari sisi kode

`grep -rln "fail2ban" docs/ *.md` → **nol hasil**. Tidak ada dokumentasi Fail2ban sama sekali
di repo ini, dan sesi Claude ini **tidak punya akses SSH ke VPS** untuk mengecek konfigurasi
sungguhan. Ini berarti: seluruh rantai sebab-akibat "404 numpuk → Fail2ban anggap
scanner → ban IP → user asli ikut kena karena shared/CGNAT IP" **MASIH DUGAAN**, bukan fakta
terverifikasi — meskipun secara teknis ini POLA YANG UMUM TERJADI di banyak VPS hardening
setup (jail bawaan seperti `nginx-botsearch`/`nginx-limit-req` memang biasa mem-flag rate 404
tinggi sebagai indikasi scanning).

**Wajib dicek langsung oleh user di VPS** — prosedur lengkap ada di § 6.

### 5.2. Gambar rusak (claim #3 laporan agen) — belum diinvestigasi mendalam, prioritas rendah

Dicek sekilas: 10 file pakai `next/image` (butuh domain terdaftar di `remotePatterns` —
`next.config.ts` cuma allow-list domain MinIO), 17 file pakai `<img>` polos (bebas domain apa
pun, tapi kalau URL-nya salah/dihapus tetap 404 biasa, bukan error `next/image` yang lebih
spesifik). Ini KEMUNGKINAN berkontribusi ke 404 count secara marjinal (gambar post lama yang
di-delete dari MinIO tapi masih dirujuk `coverId`, dll) — tapi SKALANYA jauh lebih kecil dari
§ 3.1-3.3 (satu-per-satu per konten, bukan sistemik di SETIAP page load) dan TIDAK diprioritaskan
di rencana eksekusi § 6-7. Dicatat sebagai audit lanjutan opsional.

### 5.3. Tautan lama WordPress tanpa redirect (claim #4 laporan agen) — SUDAH ADA solusinya, tinggal soal data

`legacy_url_redirects` (dibangun Fase 2 Import/Export WordPress, `docs/arsitektur-import-
export-post-wordpress.md`) SUDAH menangani ini SECARA STRUKTURAL — asalkan tenant benar-benar
sudah import kontennya via fitur Import WordPress kita (§ 5, dokumen itu). Kalau sebuah tenant
PUNYA URL lama dari WordPress yang BELUM PERNAH diimport (baik karena belum sempat, atau
karena mereka tidak pakai fitur import kita sama sekali), memang TIDAK ADA redirect untuk URL
itu — tapi ini bukan bug, murni status migrasi yang belum lengkap. Tidak perlu perbaikan kode
tambahan di sini — cukup pastikan tenant yang migrasi dari WordPress benar-benar menjalankan
importnya.

## 6. Prosedur Cek Fail2ban di VPS (untuk user, langkah demi langkah)

> Jalankan via SSH ke VPS (`ssh root@72.61.215.7` atau user yang biasa dipakai). Semua command
> di bawah HANYA membaca status, tidak mengubah apa pun — aman dijalankan kapan saja.

**Langkah 1 — Cek Fail2ban terinstall dan jalan:**
```bash
sudo systemctl status fail2ban
```
Kalau output `Unit fail2ban.service could not be found` → Fail2ban **TIDAK terinstall sama
sekali** di VPS ini, dan seluruh teori § 5.1 otomatis gugur (bukan penyebabnya, harus cari
penjelasan lain untuk keluhan user).

**Langkah 2 — Kalau terinstall, lihat jail apa saja yang AKTIF:**
```bash
sudo fail2ban-client status
```
Cari nama jail yang berkaitan dengan Nginx/HTTP 404 (biasanya bernama `nginx-botsearch`,
`nginx-404`, `nginx-noscript`, `nginx-badbots`, atau custom name lain).

**Langkah 3 — Untuk SETIAP jail yang relevan, lihat detail (ban aktif + total ban historis):**
```bash
sudo fail2ban-client status nginx-botsearch   # ganti nama jail sesuai hasil langkah 2
```
Perhatikan baris `Total banned` (berapa kali sudah ban sepanjang waktu) dan `Banned IP list`
(IP yang SEDANG diban saat ini).

**Langkah 4 — Lihat definisi jail (threshold berapa kali 404 dalam berapa detik sebelum ban):**
```bash
cat /etc/fail2ban/jail.local 2>/dev/null || cat /etc/fail2ban/jail.d/*.conf 2>/dev/null
```
Cari baris `maxretry` (berapa kali percobaan sebelum ban) dan `findtime`/`bantime` (dalam
jendela waktu berapa detik, dan berapa lama IP diban). Kalau `maxretry` kecil (mis. 3-5) dan
`findtime` singkat (mis. 60 detik), ini AGRESIF dan konsisten dengan gejala "orang normal
kadang kena ban gara-gara beberapa 404 icon/prefetch tak sengaja".

**Langkah 5 — Cek log Nginx untuk pola 404 yang genuinely mencurigakan vs 404 wajar:**
```bash
sudo grep " 404 " /var/log/nginx/access.log | tail -100
```
Bandingkan: apakah mayoritas 404 itu untuk path SEPERTI `/favicon.ico`, `/apple-touch-icon.png`
(dari browser pengunjung asli), atau untuk path SEPERTI `/wp-admin`, `/.env`, `/xmlrpc.php`,
`/config.php` (bot scanner sungguhan)? Kalau sebagian besar 404 justru dari path icon/favicon
— ini justru MENGUATKAN teori bahwa fix § 7 (sediakan favicon dsb) akan langsung mengurangi
volume ban, bukan cuma soal Fail2ban-nya sendiri.

**Langkah 6 — Kalau IP tertentu memang pernah ke-ban, cek riwayatnya:**
```bash
sudo grep "Ban " /var/log/fail2ban.log | tail -50
```

**Bawa hasil ke sesi berikutnya** — dengan data ini (jail aktif atau tidak, threshold berapa,
pola 404 yang dominan), kita bisa putuskan apakah perlu tuning Fail2ban (§ 8, opsional) atau
cukup dengan fix kode di § 7.

## 7. Rencana Eksekusi — Sisi Kode (bisa dikerjakan tanpa akses VPS)

Urutan disusun dari risiko PALING RENDAH ke yang menyentuh file paling sensitif
(`middleware.ts`), sesuai pola kehati-hatian yang sudah dipakai project ini untuk file
routing/security-critical.

### Fase A — Sediakan file icon standar di `public/` (risiko: nol)

- `favicon.ico`, `icon.png` (Next.js App Router special file, taruh di `app/`), `apple-icon.png`
  (App Router special file), `manifest.json`/`site.webmanifest` — pakai brand Jalakarta generik
  (BUKAN logo tenant manapun — ini file level PLATFORM, dipakai sebagai fallback SEBELUM
  konteks tenant diketahui oleh browser).
- Next.js App Router: kalau file `app/icon.png`/`app/favicon.ico`/`app/apple-icon.png` ada,
  Next.js OTOMATIS generate route metadata untuk file-file itu (tidak perlu config tambahan).
- Verifikasi: `curl -I https://jalakarta.com/favicon.ico` harus 200, bukan lagi masuk ke
  logic tenant lookup.

### Fase B — Perluas exclude middleware untuk semua path icon standar (risiko: RENDAH, tapi
   file sensitif — WAJIB regresi sweep setelahnya)

Ubah `matcher` di `middleware.ts` (baris 210-214) dari:
```typescript
"/((?!_next/static|_next/image|favicon.ico|api/auth|dashboard-redirect).*)"
```
menjadi (menambahkan alternasi untuk file icon/manifest umum):
```typescript
"/((?!_next/static|_next/image|favicon\\.ico|apple-touch-icon.*\\.png|icon\\.png|apple-icon\\.png|manifest\\.json|site\\.webmanifest|robots\\.txt|sitemap\\.xml|api/auth|dashboard-redirect).*)"
```
> **Catatan desain**: `robots.txt` dan `sitemap.xml` ditambahkan sekalian ke daftar exclude —
> keduanya sudah punya Next.js special-file handling sendiri (`app/robots.ts`,
> `app/sitemap.ts` kalau ada) yang seharusnya tidak perlu melalui middleware tenant-rewrite
> sama sekali; dicek dulu saat eksekusi apakah ini menimbulkan regresi terhadap robots.txt
> PER-TENANT (kalau ada) sebelum dipastikan aman ditambahkan.

**WAJIB verifikasi setelah perubahan ini** (regresi sweep, pola yang sudah established di
project ini untuk perubahan middleware/routing):
- `curl -I https://jalakarta.com/apple-touch-icon.png` → 200 (file statis, bukan lagi masuk
  tenant lookup)
- Custom domain routing masih benar: `curl -I https://{custom-domain-test}/{path-normal}` →
  tetap ter-rewrite ke tenant yang benar
- `/app/{slug}/dashboard`, `/platform/*`, semua guard auth di middleware.ts masih berfungsi
  (regresi sweep rute admin + publik seperti yang selalu dilakukan sesi-sesi sebelumnya)

### Fase C — Fix duplikasi query `resolveSlugKind()` via `React.cache()` (risiko: rendah,
   perubahan lokal 1 fungsi)

```typescript
import { cache } from "react";

const resolveSlugKind = cache(async (tenantSlug: string, segments: string[]): Promise<Resolution> => {
  // ...isi fungsi sama persis, tidak berubah logic-nya sama sekali
});
```

`React.cache()` men-dedup pemanggilan dengan ARGUMEN YANG SAMA dalam satu request lifecycle —
`generateMetadata` dan `CatchAllPage` yang menerima `params` yang sama akan otomatis berbagi
satu hasil, bukan query 2x. **Verifikasi**: tambah `console.log` sementara di dalam fungsi,
konfirmasi cuma tercetak SEKALI per request (bukan dua kali), lalu hapus log itu sebelum
selesai. `tsc --noEmit` + build produksi seperti biasa.

### Fase D — (Opsional, prioritas rendah, dipertimbangkan tapi belum tentu perlu) Early-reject
   path yang jelas bukan konten kita

Sebelum masuk ke query DB APA PUN di catch-all, cek pola path yang HAMPIR PASTI bukan konten
kita (ekstensi `.php`, `.env`, `.git`, prefix `wp-`, `xmlrpc.php`, dll) dan langsung
`notFound()` tanpa sentuh DB sama sekali. **Trade-off yang perlu dipertimbangkan sebelum
eksekusi**: daftar blocklist ini butuh maintenance (pola scanner berubah-ubah), dan manfaatnya
CUMA signifikan kalau volume scanning traffic-nya memang tinggi (baru bisa dipastikan dari data
§ 6 langkah 5). **Keputusan: tunda sampai data VPS (§ 6) menunjukkan ini benar-benar perlu** —
jangan bangun blocklist spekulatif tanpa bukti volume traffic yang genuinely bermasalah.

## 8. Opsional — Tuning Fail2ban (HANYA kalau § 6 menunjukkan jail terlalu agresif)

Kalau dari § 6 langkah 4 ditemukan `maxretry`/`findtime` yang terlalu ketat, opsi yang bisa
didiskusikan (BUKAN keputusan final, perlu dibahas terpisah sesuai hasil temuan VPS):
- Naikkan `maxretry` dan/atau perpanjang `findtime` khusus untuk jail nginx-404-related.
- Whitelist IP range tertentu kalau ada pola (mis. IP kantor/rumah sendiri untuk testing).
- Pertimbangkan pindah dari deteksi murni "rate 404" ke pola yang lebih presisi (mis. cuma
  flag kalau path yang di-404-kan mengandung tanda tangan scanner jelas: `wp-`, `.php`, `.env`).

Ini di luar scope kode aplikasi kita — murni konfigurasi VPS, harus dikerjakan langsung oleh
user (atau dengan bimbingan Claude via instruksi command yang jelas, tapi TIDAK dieksekusi
otomatis oleh Claude tanpa konfirmasi eksplisit — mengubah firewall/jail config adalah aksi
infra yang berisiko kalau salah, konsisten prinsip kehati-hatian project ini).

## 9. Urutan Eksekusi yang Disarankan

1. **Fase A + B + C (kode)** — bisa dikerjakan sekarang, independen dari hasil cek VPS,
   sudah pasti bermanfaat (mengurangi 404 palsu + beban query) terlepas Fail2ban jadi
   penyebab akhir atau bukan.
2. **§ 6 (cek VPS)** — dijalankan user, kapan saja, bisa PARALEL dengan poin 1.
3. **Fase D + § 8** — HANYA kalau data dari § 6 menunjukkan itu genuinely dibutuhkan —
   jangan dikerjakan spekulatif.

## 10. Checklist Verifikasi Sebelum Dianggap Selesai

- [x] `tsc --noEmit` bersih di `apps/web` — 0 error di setiap tahap (Fase A, B, C terpisah)
- [x] `bun run build --filter=@jalajogja/web` sukses (dev server dimatikan, `.next`
      dibersihkan dulu, sesuai SOP project) — genuine build (bukan cache-hit) di tiap fase
- [x] `curl -I` untuk `/favicon.ico`, `/icon.svg`, `/apple-icon.png`, `/manifest.webmanifest` di
      domain sendiri → 200, tidak lagi masuk ke tenant lookup (nama file beda dari draft — lihat
      § 11.1 untuk alasan)
- [x] Regresi sweep rute publik + admin + custom domain — SEMUA lulus: robots.txt/sitemap.xml
      custom domain (genuine rewrite via `x-middleware-rewrite` header, bukan false-positive),
      halaman biasa custom domain, `/app/*` auth guard (own+custom domain), `/platform/*` guard,
      isolasi cross-tenant (slug tidak cocok → redirect canonical), carve-out `/admin/*`. Detail
      di § 11.2.
- [x] Konfirmasi `resolveSlugKind()` cuma dipanggil sekali per request — dibuktikan dengan
      `console.log` sementara + curl 3 skenario (existing page ×2, 404), log tercetak PERSIS
      sekali tiap kali. Log dihapus setelah verifikasi. Detail deviasi signature di § 11.3.
- [ ] Hasil § 6 (cek Fail2ban VPS) dibawa balik ke sesi ini untuk diputuskan apakah § 8 perlu
      dikerjakan — **masih tugas user, belum dijalankan**

## 11. Hasil Eksekusi (2026-07-28)

Fase A, B, C dieksekusi berurutan sesuai § 9 (independen dari hasil § 6). Dua deviasi dari draft
rencana ini ditemukan SAAT eksekusi (bukan diantisipasi saat rencana ditulis) — dicatat di sini
supaya siapa pun yang baca dokumen ini nanti tidak bingung kenapa kode aktual sedikit berbeda
dari § 7 di atas.

### 11.1. Fase A — nama file beda dari draft, alasan teknis

Draft menyebut `icon.png`, `manifest.json`/`site.webmanifest`. Yang genuinely dibangun:
- `apps/web/app/icon.svg` — SVG geometris murni (bujur sangkar rounded + lingkaran), BUKAN PNG
  berteks. Percobaan pertama pakai teks "J" dengan `font-family` gagal render (Sharp/librsvg
  tidak resolve font di environment ini, tanpa error apa pun — cuma hasil kosong/invisible).
  Diganti bentuk geometris murni yang tidak butuh font sama sekali.
- `apps/web/app/apple-icon.png` — 180×180 PNG, di-generate dari SVG yang sama via Sharp. Ini
  Next.js App Router **special file** (bukan static asset biasa) — otomatis jadi route
  `/apple-icon.png` tanpa config tambahan.
- `apps/web/app/favicon.ico` — PNG 32×32 dibungkus manual ke container ICO (ICONDIR 6 byte +
  ICONDIRENTRY 16 byte + data PNG mentah) via Node buffer construction — Sharp tidak punya
  encoder ICO native, browser modern menerima ICO berisi PNG compressed.
- `apps/web/app/manifest.ts` — Next.js special file (BUKAN `manifest.json` statis), otomatis
  jadi route `/manifest.webmanifest` (bukan `/site.webmanifest` seperti draft).

Fungsional: SEMUA 4 path tetap terpenuhi (browser fetch `/favicon.ico`, `/manifest.webmanifest`,
dll — bukan `/site.webmanifest` yang sudah lama tidak jadi standar). Draft menyebut nama file
generik dari pengetahuan umum web, bukan verifikasi ke Next.js App Router convention yang
sebenarnya dipakai project ini.

### 11.2. Fase B — `robots.txt`/`sitemap.xml` DIKELUARKAN dari exclude list, kebalikan draft

**Ini deviasi paling penting.** Draft § 7 Fase B secara eksplisit menyertakan `robots\\.txt` dan
`sitemap\\.xml` di daftar exclude middleware, dengan catatan "dicek dulu saat eksekusi apakah
ini menimbulkan regresi". Saat eksekusi, dicek — DAN GENUINELY MENIMBULKAN REGRESI: kedua path
itu di sesi lain (paralel, sebelum sesi 404 ini) baru saja dibangun sebagai Route Handler
ter-nested per-tenant (`app/(public)/[tenant]/robots.txt/route.ts`,
`.../sitemap*.xml/route.ts`) yang **BERGANTUNG** pada middleware men-rewrite custom domain
(`{custom-domain}/robots.txt` → `/{slug}/robots.txt` secara internal) — fix yang sudah
diverifikasi LIVE di production (`docs/arsitektur-seo.md` § 6c.2/6c.3). Mengecualikan kedua path
itu dari middleware akan MEMATIKAN rewrite tersebut dan meregresi fix production yang sudah
berjalan.

Matcher final HANYA menambah `icon\\.svg`, `apple-icon\\.png`, `manifest\\.webmanifest` ke
exclude list — TIDAK menyertakan `robots.txt`/`sitemap.xml` sama sekali (beda persis dari
contoh kode di § 7 Fase B di atas). Diverifikasi empiris: `robots.txt`/`sitemap.xml` pada
custom domain simulasi TETAP ter-rewrite dengan benar (header `x-middleware-rewrite` muncul,
konten sitemap pakai domain custom yang benar) SETELAH perubahan matcher ini — regresi nol.

### 11.3. Fase C — signature `resolveSlugKind()` beda dari draft, akibat temuan `React.cache()`

Draft § 7 Fase C menulis signature `cache(async (tenantSlug: string, segments: string[]) => ...)`
— TIDAK bekerja seperti diharapkan. Dibuktikan empiris (`console.log` + curl): argumen `segments`
(array) yang didestructure dari `await params` di `generateMetadata()` dan `CatchAllPage()`
ternyata REFERENCE BERBEDA meski isinya identik — `React.cache()` membandingkan argumen
non-primitif SECARA REFERENCE, bukan deep-equality, jadi cache MISS tetap terjadi (log tercetak
2×, bukan 1×). Fix: signature diubah jadi `cache(async (tenantSlug: string, joinedSegments:
string) => ...)` — array digabung jadi string SEBELUM masuk fungsi cache (string dibandingkan
by VALUE), di-split lagi di dalam. Setelah fix ini, log tercetak PERSIS 1× per request di semua
3 skenario tes (existing page ×2, 404 ×1). Kode aktual: `apps/web/app/(public)/[tenant]/
[...slug]/page.tsx` baris 66-115 (komentar di file itu sendiri sudah mendokumentasikan temuan
ini secara lengkap).

### 11.4. Verifikasi regresi Fase B — cakupan penuh

Setup: 1 tenant lokal (`pc-ikpm-jogjakarta`) diberi custom domain palsu sementara
(`test-middleware-verify.local`) via `UPDATE public.tenants`, test server `next start` dengan
`APP_INTERNAL_URL` diset benar (pelajaran dari kejadian false-positive robots.txt sebelumnya di
sesi lain — lihat `docs/arsitektur-seo.md` § 6c.2b), dibersihkan (`custom_domain = NULL`) setelah
selesai. Hasil (semua via curl langsung, bukan cuma baca kode):

| Skenario | Hasil |
|---|---|
| `/favicon.ico`, `/icon.svg`, `/apple-icon.png`, `/manifest.webmanifest` (domain sendiri) | 200 |
| `/robots.txt` (custom domain) | 200, `x-middleware-rewrite` present, `Sitemap:` pakai domain custom |
| `/sitemap.xml` (custom domain) | 200, `x-middleware-rewrite` present, isi `<loc>` pakai domain custom |
| `/post` (custom domain, halaman biasa) | 200, `x-middleware-rewrite` present, title benar |
| `/app/{slug}/dashboard` tanpa sesi (domain sendiri) | 307 → `/app/login?redirect=...` |
| `/platform/dashboard` tanpa sesi (domain sendiri) | 307 → `/platform/login` |
| `/app/{slug-cocok}/dashboard` tanpa sesi (custom domain, slug = pemilik domain) | 302 → `/login?redirect=...` DI DOMAIN YANG SAMA (Opsi C, pre-existing, tidak terkait perubahan Fase B) |
| `/app/{slug-BEDA}/dashboard` (custom domain) | 302 → URL kanonik absolut (isolasi cross-tenant tetap intact) |
| `/admin` tanpa sesi (custom domain) | 302 → `/login?redirect=%2Fadmin` (carve-out Sub-fase 1 tetap intact) |
| `/produk`, `/agenda` (domain sendiri) | 200 |
| `/produk` (custom domain) | 200, `x-middleware-rewrite` present |

Semua data test (custom domain sementara di DB, temp file curl, test server) dibersihkan setelah
verifikasi, dikonfirmasi bersih.

## 12. Hasil Cek § 6 — Fail2ban TIDAK TERINSTALL (2026-07-28)

User menjalankan § 6 Langkah 1 di VPS (`72.61.215.7`):
```
$ sudo systemctl status fail2ban
Unit fail2ban.service could not be found.
```

Persis kondisi yang sudah diantisipasi § 6 Langkah 1: **Fail2ban tidak terinstall sama sekali**
di server ini. Sesuai catatan di langkah itu sendiri, hasil ini menggugurkan TOTAL teori "404
numpuk → Fail2ban anggap scanner → ban IP → user asli ikut kena" — bukan cuma "belum terbukti",
tapi genuinely TIDAK MUNGKIN jadi penyebab, karena mekanisme banning itu tidak ada di server ini
untuk dipicu sama sekali. Langkah 2-6 (jail aktif, threshold, log ban) otomatis tidak relevan —
tidak ada yang perlu dicek lebih jauh soal Fail2ban.

**Konsekuensi ke roadmap**: Fase D (early-reject scanner path, § 7) dan § 8 (tuning Fail2ban)
DIBATALKAN, bukan sekadar tetap ditunda — keduanya didesain sebagai mitigasi UNTUK skenario
Fail2ban yang sekarang terbukti tidak ada. Kalau volume traffic scanner nanti terasa mengganggu
performa (bukan soal ban IP lagi, murni soal beban server), Fase D bisa dipertimbangkan ulang
dari nol sebagai optimasi independen — tapi itu keputusan terpisah, bukan lanjutan rencana ini.

### Kemungkinan penyebab lain untuk "beberapa orang tidak bisa membuka website" (belum diselidiki)

Karena teori Fail2ban gugur, keluhan awal user (§ 1) masih belum punya penjelasan pasti. Fase
A+B+C (favicon hilang + query DB dobel per request + middleware boros) tetap perbaikan nyata dan
bermanfaat terlepas dari itu — mengurangi 404 palsu dan beban database yang BISA berkontribusi
ke pengalaman lambat/timeout saat traffic scanner sedang tinggi bersamaan dengan pengunjung asli
— tapi belum tentu itu SATU-SATUNYA sebab.

Kandidat lain yang BELUM dicek (di luar scope sesi ini, cuma dicatat untuk referensi kalau
keluhan berulang setelah fix ini di-deploy):
- **Firewall lain di VPS** (bukan Fail2ban) — cek `sudo ufw status` dan
  `sudo iptables -L -n -v` untuk pastikan tidak ada rule blokir IP/rentang IP yang aktif dari
  mekanisme lain (CrowdSec, sshguard, atau aturan manual yang pernah ditambahkan).
- **Rate limiting di level Nginx sendiri** (`limit_req`/`limit_conn` di config Nginx, TERPISAH
  dari Fail2ban) — kalau ada zona rate-limit yang terlalu ketat, bisa menghasilkan 429/503 untuk
  pengunjung yang browsing normal dengan cepat (klik banyak halaman berturut-turut).
  `grep -rn "limit_req\|limit_conn" /etc/nginx/` untuk cek apakah ada konfigurasi seperti ini.
- **Beban server saat burst traffic** — sebelum Fase C (dedup query), tiap request (termasuk
  404 dari bot) bisa makan sampai 8 query DB; kalau banyak bot menyerang bersamaan, koneksi DB
  bisa penuh dan request pengunjung asli ikut lambat/timeout. Fase C sudah mengurangi ini secara
  signifikan — worth di-observasi apakah keluhan berkurang SETELAH deploy, sebelum menyelidiki
  lebih jauh.
- **Masalah jaringan sisi pengunjung** (ISP/ponsel tertentu, ekstensi ad-blocker yang agresif,
  DNS lokal yang cache entry lama) — sulit dibuktikan dari sisi server sama sekali, biasanya
  cuma bisa dikonfirmasi lewat laporan detail dari pengunjung yang mengalami (browser apa,
  provider apa, pesan error persis apa yang mereka lihat).

**Rekomendasi**: deploy Fase A+B+C dulu, observasi apakah laporan "tidak bisa buka situs"
berkurang/berhenti. Kalau masih berulang, kandidat paling murah untuk dicek berikutnya adalah
`ufw`/`iptables` (Langkah pertama di atas) — sama-sama cuma perintah baca status, aman
dijalankan kapan saja tanpa risiko.

---

## 13. Bug Terpisah Ditemukan di `resolveSlugKind()` — Error 500 untuk Tenant Fiktif (2026-08-31)

Ditemukan LANGSUNG dari `pm2 logs` produksi saat deploy fitur lain (tidak terkait investigasi
di atas) — beda dari § 3.3/§ 11.3 (dedup query, sudah difix), ini bug KOREKTNESS baru: bot/
scraper probe path acak (mis. `/dist/some-page`, `/v1/foo/bar`) ke-capture segmen pertamanya
sebagai `[tenant]`. `resolveSlugKind()` langsung `createTenantDb(tenantSlug)` dan query
`tenant_{slug}.pages`/`.posts`/`.legacy_url_redirects` **tanpa cek dulu apakah tenant itu
genuinely ada di `public.tenants`** — schema `tenant_dist`/`tenant_v1` yang tidak pernah exist
bikin PostgreSQL lempar `relation "..." does not exist`, dan karena route group `(public)` tidak
punya `error.tsx` boundary, error itu tembus jadi **500** (bukan 404 rapi) untuk request itu.

**Fix**: tambah guard `public.tenants WHERE slug=X AND isActive=true` di AWAL
`resolveSlugKind()`, sebelum `createTenantDb()` dipanggil sama sekali — kalau tidak ketemu,
langsung `return { kind: "none" }` (jatuh natural ke `notFound()`). Pola sama persis
`getPage()`'s `tenant.isActive` check di file yang sama.

Diverifikasi empiris (bukan cuma baca kode): `/dist/some-page` dan `/v1/foo/bar` di lokal
sekarang balikan `404` bersih, log dev server nol exception. Dikonfirmasi ulang LANGSUNG di
production setelah deploy — `curl` ke path fake tenant balikan `404`, `pm2 logs` bersih.

File: `apps/web/app/(public)/[tenant]/[...slug]/page.tsx`. Nol migrasi DB. **Sudah di-commit,
push, dan di-deploy ke VPS** (2026-08-31).
