# Arsitektur Domain — Satu Sumber Kebenaran

> **Status dokumen**: hasil audit menyeluruh 2026-07-16 (verifikasi langsung ke kode, bukan asumsi
> dari dokumen lama), diikuti eksekusi bertahap (§ 9) — **seluruh roadmap (6 item) sudah selesai
> dan dikonfirmasi bekerja di production**, termasuk Admin-on-Custom-Domain (§ 7) yang diuji manual
> langsung di `visikita.com/admin` sampai berhasil login + navigasi dashboard tanpa error.
> Menggantikan versi sebelumnya (2026-05-26) yang sudah basi di beberapa klaim penting (lihat
> § 8 "Ralat Terhadap Dokumen Lama").
>
> **Mandat**: sesi ini diminta eksplisit oleh user 2026-07-16, menindaklanjuti catatan
> `[RENCANA]` di `CLAUDE.md` (dicatat 2026-07-14 setelah bug redirect custom domain nyata) yang
> sengaja tidak dieksekusi proaktif sampai user minta langsung.
>
> Panduan operasional step-by-step (setup tenant baru): `docs/panduan-custom-domain.md`
> (juga butuh koreksi minor, lihat § 8).

---

## 1. Prinsip yang Mengikat

> **Satu domain = satu identitas.** Identitas satu domain tidak boleh menyeberang ke domain lain.

Diterjemahkan jadi tiga aturan konkret yang mengikat setiap keputusan desain di dokumen ini:

1. **Domain sendiri (`jalakarta.com` dan turunannya) = identitas Jalakarta.** Boleh menampilkan
   co-branding Jalakarta (nama platform, atribusi, link ke dashboard admin) karena secara literal
   pengunjung sedang berada di properti Jalakarta.
2. **Custom domain tenant = identitas tenant, murni.** Begitu pengunjung berada di domain milik
   tenant (`ikpmjogja.com`, `visikita.com`, dst), **tidak boleh ada jejak identitas Jalakarta yang
   terlihat** — bukan cuma URL (sudah benar sejak Fase C), tapi juga teks, warna, dan brand apapun
   yang tampil ke pengunjung. Ini berlaku untuk **setiap permukaan** yang nanti berjalan di atas
   custom domain — front-end publik hari ini, dan admin dashboard kalau/ketika dibangun di atas
   custom domain (§ 7).
3. **Path admin (`/app/*`, `/platform/*`) tidak pernah diservis dari custom domain**, kecuali via
   mekanisme eksplisit yang dirancang khusus (§ 7) — bukan kebetulan lolos dari guard yang ada.

Prinsip #2 punya konsekuensi eksplisit yang jadi temuan utama audit ini: **kalau nanti admin
dashboard tenant dibangun di atas custom domain, ia WAJIB ikut menjadi tenant-branded sepenuhnya**
(logo, warna, tanpa atribusi Jalakarta) — bukan cuma soal routing/URL. Dashboard admin hari ini
sama sekali belum punya infrastruktur untuk itu (§ 5.3) — ini bagian dari yang perlu direncanakan,
bukan sekadar "tinggal buka domainnya".

---

## 2. Empat Entitas Domain — Peta Kebenaran Saat Ini

| # | Entitas | Alamat hari ini | Status | Bisa custom domain? |
|---|---------|------------------|--------|----------------------|
| 1 | **Landing page platform** | `jalakarta.com` (root) | ❌ **Belum dibangun** — `apps/web/app/page.tsx` cuma stub `<h1>Jalakarta</h1>`, tanpa metadata/redirect (label brand sudah dikoreksi 2026-07-16 — sebelumnya salah tulis "Jalagon", nama brand lama yang sudah tidak dipakai) | Tidak relevan (ini domain Jalakarta sendiri) |
| 2 | **Admin platform (tim Jalakarta)** | `jalakarta.com/platform/*` — *juga* reachable via `platform.jalakarta.com/platform/*` (lihat catatan di bawah) | ✅ Selesai, auth `platform_session` cookie terpisah | Tidak relevan — ini internal tool Jalakarta |
| 3 | **Admin dashboard tenant** | `jalakarta.com/app/{slug}/*` **atau** `{custom-domain}/admin/*` (entry) → `{custom-domain}/app/{slug}/*` (setelah navigasi pertama) | ✅ Selesai, dual-mode | ✅ **Bisa** — lewat `/admin/*` (§ 7), khusus untuk slug pemilik domain itu sendiri, tidak pernah tenant lain |
| 4 | **Front-end publik tenant** | `jalakarta.com/{slug}/*` **atau** `{custom-domain}/*` | ✅ Selesai, dual-mode | ✅ **Bisa** — tapi ada 1 celah branding aktif (§ 5.1) |

**Catatan penting soal #2**: `platform.jalakarta.com` **bukan** contoh routing subdomain→konten
seperti yang dibayangkan untuk Fase 2. Ia jalan karena `*.jalakarta.com` sudah wildcard DNS ke VPS
yang sama, dan `isOwnHost()` (§ 3.3) menganggap semua subdomain `*.jalakarta.com` sebagai "milik
sendiri" — routing tetap 100% path-based (`/platform/login`, dst), tidak ada logic yang membaca
subdomain untuk menentukan konten. Jadi `jalakarta.com/platform/login` dan
`platform.jalakarta.com/platform/login` betul-betul me-render halaman yang sama, bukan dua rute
berbeda. Ini bukan bug — hanya perlu dipahami agar tidak dikira ada routing subdomain yang sudah
jalan padahal belum (lihat Fase 2, § 7.1).

**Kolom DB `tenants.subdomain`**: ada, **tapi tidak pernah dibaca di manapun** dalam kode routing
(middleware, `resolve-domain`, atau file manapun) — Fase 2 tidak pernah diimplementasikan.

✅ **Fixed (Fase 2 roadmap, 2026-07-16)**: input field-nya di `/app/{slug}/settings/domain` yang
sebelumnya aktif (mengesankan fitur ini jalan padahal tidak) sudah diganti catatan statis "Segera
hadir" — user eksplisit memilih opsi "sembunyikan dulu" atas "implementasikan sungguhan" (§ 9 item
#4). Kolom DB dan pass-through nilai lama di `saveDomainSettingsAction` tetap dipertahankan (tidak
menghapus data), hanya UI edit yang dinonaktifkan.

---

## 3. Pipeline Request — Urutan Eksekusi Persis

Next.js App Router mengeksekusi dalam urutan tetap: **`headers()` config → `redirects()` →
`middleware.ts` → `rewrites()`**. Urutan ini krusial dan sudah pernah jadi sumber bug produksi nyata
(§ 8.1) — setiap aturan baru WAJIB mempertimbangkan di lapisan mana ia berjalan dan apakah lapisan
itu tahu bedanya custom domain vs domain sendiri.

### 3.1 Lapisan 1 — `next.config.ts: redirects()` (jalan SEBELUM middleware)

Redirect legacy (301, bookmark lama dari migrasi URL admin Fase 1–4) untuk 11 modul
(`dashboard, members, pengurus, divisi, accounts, media, website, letters, finance, donasi, toko,
settings`) dari pola lama `/{slug}/{module}` ke `/app/{slug}/{module}`.

**Wajib** di-guard `has: [{ type: "host", value: "jalakarta.com" }]` — karena lapisan ini berjalan
SEBELUM middleware, ia **tidak tahu** apa itu custom domain. Tanpa guard, pattern
`/:slug(TENANT_SLUG)/media` bisa salah menangkap path publik 2-segmen di custom domain manapun
(persis bug yang pernah terjadi ke `visikita.com/akun/media`, § 8.1).

**Celah minor yang perlu diawasi** (bukan bug aktif, tapi rapuh): guard `has.value: "jalakarta.com"`
adalah string literal apex saja — tidak mencakup `www.jalakarta.com` atau `app.jalakarta.com`/subdomain
`*.jalakarta.com` lain yang `isOwnHost()` juga anggap "milik sendiri". Selama slug tenant tidak pernah
diservis dari subdomain-subdomain itu ini aman, tapi kalau nanti ada fitur yang mengarahkan traffic
tenant ke `app.jalakarta.com/{slug}/...`, redirect legacy ini akan diam-diam tidak berlaku di sana.

Rewrite tambahan: `/app/api/:path*` → `/api/:path*` (beforeFiles) — perbaikan permanen untuk browser
yang meng-cache redirect 301 lama yang salah.

### 3.2 Lapisan 2 — `middleware.ts` (jalan setelah redirects, sebelum rewrites)

```
1. isOwnHost(host)?
   ├─ TIDAK (custom domain) →
   │    a. pathname mulai /app/ atau /platform/? → 302 redirect ke jalakarta.com + path yang sama
   │    b. pathname mulai /api/? → lolos apa adanya (route API urus sendiri konteks tenant)
   │    c. lainnya (konten publik) →
   │         - strip "www." dari host
   │         - fetch (loopback, timeout 3s) → /api/internal/resolve-domain?domain=...
   │         - DB: custom_domain = ? AND custom_domain_status = 'active' AND is_active = true
   │         - kalau host punya www → 301 redirect ke apex (tanpa www)
   │         - kalau path sudah kebetulan diawali /{slug}/ → 301 strip slug (C1, cegah slug bocor ke URL)
   │         - lainnya → REWRITE internal (bukan redirect) ke /{slug}{path} — URL bar tetap bersih
   │         - resolve gagal/timeout → lanjut apa adanya (biasanya berujung 404 dari [tenant] dynamic route)
   └─ YA (own host) → lanjut ke guard auth di bawah

2. Guard /platform/* — cek cookie platform_session (auth terpisah dari tenant)
3. Guard /app/*     — cek cookie better-auth.session_token (atau varian __Secure-)
4. Lainnya → next()
```

Poin #1a adalah **guard eksplisit yang mewujudkan Prinsip #3** di § 1 — ditambahkan 2026-07-08
setelah ditemukan custom domain bisa membuka dashboard admin tenant lain (celah keamanan nyata,
lihat § 8.1). Ini yang harus dibongkar/di-scope-ulang secara hati-hati kalau Admin-on-Custom-Domain
(§ 7) jadi dibangun — bukan dihapus begitu saja.

### 3.3 `isOwnHost()` — definisi "milik sendiri"

```typescript
// apps/web/lib/is-own-host.ts
host === "jalakarta.com" ||
host === "www.jalakarta.com" ||
host === "app.jalakarta.com" ||
host.endsWith(".jalakarta.com") ||   // mencakup semua subdomain, termasuk platform.
host.startsWith("localhost") ||
host.startsWith("127.0.0.1")
```

Satu-satunya sumber kebenaran untuk "apakah host ini identitas Jalakarta". Dipanggil independen di
**~15 titik berbeda** di seluruh `app/(public)/[tenant]/**` untuk menghitung `baseUrl` (lihat § 5.2)
— duplikasi ini sendiri adalah risiko (§ 8.3).

### 3.4 Lapisan 3 — `next.config.ts: rewrites()`

Cuma satu aturan (`beforeFiles`, sudah disebut di § 3.1) — `middleware.ts` sendiri melakukan
rewrite-nya lewat `NextResponse.rewrite()`, bukan lewat config `rewrites()`.

---

## 4. Skema Database (`public.tenants`)

```
slug                       TEXT UNIQUE NOT NULL  — identitas path-mode & nama schema tenant_{slug}
subdomain                  TEXT UNIQUE            — Fase 2, MATI TOTAL (§ 2), tidak dibaca kode manapun
custom_domain               TEXT UNIQUE            — apex domain saja, tanpa www/http/port
custom_domain_status        TEXT NOT NULL DEFAULT 'none'
                              enum: none | pending | active | failed
custom_domain_verified_at   TIMESTAMPTZ
domain_last_check_at        TIMESTAMPTZ            — timestamp cron terakhir cek DNS
domain_last_check_error     TEXT                   — pesan error DNS check terakhir (nullable)
is_active                   BOOLEAN NOT NULL DEFAULT true  — ikut jadi syarat resolve-domain
```

**Transisi status** (`saveDomainSettingsAction`, hanya bisa dipicu tenant sendiri dari
`/app/{slug}/settings/domain`):
- Domain dikosongkan → `none`, `custom_domain_verified_at` di-reset `null`.
- Domain baru/berubah → `pending`, memicu `triggerDomainVerification()` (fire-and-forget, fallback
  ke cron terjadwal kalau gagal).
- Domain tidak berubah dan sebelumnya sudah `active` → tetap `active`, tidak re-trigger verifikasi.

**Transisi status oleh cron** (`app/api/cron/verify-domains/route.ts`, DNS A-record check saja,
**tidak cek SSL/HTTP**):
- Hanya memproses tenant dengan status `pending` atau `failed` — **`active` tidak pernah disentuh**
  (sudah benar di kode saat ini — dokumen lama mengklaim ini masih bug, itu klaim basi, lihat § 8.2).
- `pending` → `active` kalau A record cocok VPS IP.
- `pending` → `failed` kalau tidak cocok/gagal lookup. `failed` yang sudah `failed` tetap `failed`
  (idempotent, cuma refresh timestamp+error).

---

## 5. Branding per Domain — Audit Kebocoran

### 5.1 ✅ Fixed (2026-07-16): footer bocor identitas Jalakarta ke custom domain

`components/website/public/layout/footers/dark-footer.tsx` dan `light-footer.tsx`, baris copyright,
**tanpa syarat apapun** (tidak dicek `isCustomDomain`/`baseUrl` sama sekali padahal `baseUrl` sudah
tersedia sebagai prop di komponen yang sama):

```tsx
<span>Jalakarta &mdash; developed with ❤️ by <span className="...">Webane</span></span>
```

Sebelumnya tampil identik di `jalakarta.com/{slug}/*` **dan** `{custom-domain}/*`. Ini melanggar
Prinsip #2 di § 1 secara langsung — satu-satunya kebocoran identitas Jalakarta yang ditemukan aktif
di front-end publik. Semua permukaan lain yang diaudit (header, SEO canonical/OG URL di
`lib/tenant-seo.ts`, halaman login) sudah benar sejak awal — bercabang berdasarkan
`customDomainStatus === "active"` dengan tepat.

**Fix dieksekusi 2026-07-16**: baris atribusi sekarang dibungkus `{baseUrl !== "" && (...)}` di
`dark-footer.tsx` dan `light-footer.tsx` — tampil hanya di domain sendiri (`baseUrl` berisi
`/{slug}`), disembunyikan total saat `baseUrl === ""` (custom domain). Baris "© {tahun} {siteName}.
All rights reserved." tidak diubah — tetap tampil di kedua mode karena itu memang copyright milik
tenant sendiri, bukan atribusi platform.

### 5.2 ✅ Fixed (Fase 3, 2026-07-16): Duplikasi `baseUrl` dikonsolidasi

Sebelumnya pola `isOwnHost(host) ? "/${slug}" : ""` dihitung ulang secara independen di 16 file
(server component + client component dengan pola `useState`+`useEffect` yang setara) di seluruh
`app/(public)/[tenant]/**`. Tidak ada satu sumber kebenaran/helper bersama — setiap halaman baru
mengulang komputasi sendiri, konsisten dengan pola bug yang berulang beberapa kali di histori
project (lesson CLAUDE.md "Bug Sistemik: `href="../"` di 6 Halaman", "Custom Domain Harus
Diisolasi", dst).

**Fix**: dua helper baru —
- `lib/resolve-base-url.ts` — `resolveBaseUrl(slug)`, server-only (pakai `next/headers`). Sekalian
  memperbaiki satu inkonsistensi: sekarang selalu cek `x-forwarded-host` dulu (proxy-aware,
  sebelumnya cuma dilakukan di `login/page.tsx`, sekarang berlaku universal di semua 12 server
  component yang memakainya).
- `lib/use-base-url.ts` — `useBaseUrl(slug)`, `"use client"`, untuk 4 client component yang tidak
  punya akses `next/headers()` (pola default `/${slug}` lalu koreksi via `useEffect`, dipertahankan
  identik dari implementasi sebelumnya).

Semua 16 titik lama (`app/(public)/[tenant]/layout.tsx`, `page.tsx`, `[pageSlug]/page.tsx`,
`agenda/[slug]/page.tsx`, `login/page.tsx`, `akun/layout.tsx`, `akun/page.tsx`,
`akun/profesional/page.tsx`, `akun/usaha/page.tsx`, `akun/pesantren/page.tsx`,
`akun/media/page.tsx`, dan 5 file di `akun/mitra/**`) diganti memanggil helper ini. Satu-satunya
sisa pemanggil `isOwnHost()` langsung di tree ini sekarang hanya `resolve-base-url.ts` dan
`use-base-url.ts` sendiri.

### 5.3 ✅ Fixed (sub-fase 2, 2026-07-16): Admin dashboard kini kondisional tenant-branded

**Sebelumnya**: dashboard admin (`/app/{slug}/*`) selalu platform-generic — avatar inisial pakai
`bg-primary` Jalakarta (bukan `primary_color` tenant), tidak ada logo tenant di manapun, footer
sidebar statis `"jalakarta v0.1"`, tidak ada injeksi CSS variable tema tenant sama sekali (beda
dengan `PublicLayout` yang sudah melakukannya untuk front-end publik).

**Fix**: `(dashboard)/app/[tenant]/layout.tsx` sekarang deteksi `isCustomDomainAdmin` dari `Host`
header request (`!isOwnHost(host)` — reliable karena rewrite middleware tidak mengubah `Host`,
cuma `pathname`). **Kondisional, bukan selalu-aktif** — sesuai Prinsip #1 di § 1 (domain sendiri
boleh co-branding Jalakarta, custom domain tidak boleh sama sekali):
- `isOwnHost` (akses via `jalakarta.com/app/{slug}/*`) → tetap platform-generic seperti semula,
  tidak berubah sama sekali.
- `!isOwnHost` (akses via `{custom-domain}/admin/*`) → fetch `general.logo_url` +
  `display.primary_color` tenant, inject `<style>` scoped ke class `.tenant-admin-branded`
  (override `--primary`/`--primary-foreground`, dihitung via `foregroundFor()` — diexport dari
  `lib/theme-palette.ts`, dipakai ulang bukan reimplementasi), render logo tenant (bukan huruf
  inisial) di `Sidebar`/`MobileSidebar`, dan sembunyikan footer `"jalakarta v0.1"` (prop baru
  `showPlatformFooter`).

**Scope yang disengaja dibatasi** — cuma logo + primary color + hilangkan atribusi platform, TIDAK
termasuk font/secondary color/tema penuh seperti `buildTenantThemeCss()` untuk front-end publik.
Admin dashboard tetap prioritaskan konsistensi UI internal (readability, familiar layout untuk
pengurus yang mengelola banyak tenant) di atas replikasi brand penuh — beda tujuan dengan front-end
publik yang memang harus terasa 100% milik tenant untuk pengunjung awam.

---

## 6. Infrastruktur SSL & DNS (Custom Domain Front-end)

100% terverifikasi konsisten dengan dokumen lama di bagian ini — tidak ada perubahan.

```
Tenant tambah DNS A record: @ → 72.61.215.7, www → 72.61.215.7 (DNS-only, TANPA proxy Cloudflare)
  ↓
Admin simpan domain di /app/{slug}/settings/domain → status: pending
  ↓
Cron verify-domains (dipicu otomatis saat simpan + terjadwal berkala) → cek A record via DNS lookup
  ↓ (kalau cocok VPS IP)
status → active (OTOMATIS, murni dari DB)
  ↓
[MANUAL, di luar kode — VPS/manusia]
sudo certbot --nginx -d DOMAIN -d www.DOMAIN
buat /etc/nginx/sites-available/DOMAIN dari template, symlink, nginx -t, reload
```

**Penting**: status DB `active` **tidak menjamin** Nginx+Certbot sudah benar-benar dikonfigurasi —
dua proses ini independen. Status `active` cuma berarti "DNS sudah mengarah ke VPS", bukan "domain
sudah live secara HTTPS". Admin/Jalakarta tim tetap harus menjalankan langkah manual Nginx+Certbot
terpisah. Ini bukan bug, tapi perlu dipahami sebagai keterbatasan yang disengaja (belum diautomasi).

Tidak ada Caddy di manapun dalam infrastruktur nyata — semua murni Nginx + Certbot manual per
domain. (Ada komentar salah di schema yang menyebut Caddy — lihat § 8.4.)

### 6.1 Fase D (usulan jangka panjang, belum dikerjakan) — Caddy on-demand TLS

Setiap custom domain baru hari ini butuh intervensi manual VPS (certbot + nginx config + reload).
Untuk skala >10 tenant dengan custom domain, opsi jangka panjang yang sudah pernah diusulkan (di
dokumen lama, dipertahankan di sini sebagai catatan — **belum ada keputusan atau jadwal**): migrasi
reverse-proxy dari Nginx+Certbot manual ke **Caddy dengan on-demand TLS**, yang bisa auto-issue
sertifikat Let's Encrypt untuk domain baru tanpa SSH ke VPS sama sekali. Ini akan mengubah alur di
atas secara signifikan (dan berpotensi mengubah kalkulasi biaya Opsi A vs B di § 7.1, karena SSL
tambahan untuk subdomain jadi hampir gratis di bawah Caddy). **Tidak urgent selagi jumlah tenant
custom domain masih sedikit** — dicatat di sini murni supaya referensi "Fase D" dari bagian lain
dokumen ini (§ 7.1, § 8.4) tidak menunjuk ke tempat kosong.

---

## 7. Admin-on-Custom-Domain — ✅ Selesai (2026-07-16)

Permintaan eksplisit user (skenario #1 di pesan awal sesi evaluasi domain). Sebelum sesi ini
**belum ada satupun kode untuk ini** — bahkan ada guard aktif (§ 3.2, poin 1a) yang secara sengaja
**memblokir** ini terjadi (dipasang 2026-07-08 untuk menutup celah keamanan lain). Rencana lama
(`docs/rencana-migrasi-url.md`, "Fase 5") sudah menuliskan proposal teknis, tapi **stale dan punya
kontradiksi internal** (§ 8.5) — TIDAK diadopsi mentah, direncanakan ulang dari nol di dokumen ini.

### 7.1 Dua opsi arsitektur — **Opsi B dipilih user 2026-07-16**

**Opsi A — Subdomain di atas custom domain tenant**: `admin.ikpmjogja.com` → dashboard admin
tenant tersebut.
- Kelebihan: tidak butuh path tambahan, jelas terpisah dari front-end publik (`ikpmjogja.com`).
- Kekurangan: butuh SSL cert TERPISAH untuk `admin.{domain}` (satu lagi certbot run manual per
  tenant, di atas yang sudah ada untuk apex+www) — makin menambah beban manual SSL yang sudah jadi
  masalah skalabilitas (§ 6.1, usulan Caddy jangka panjang). Tenant juga harus tambah DNS
  record ketiga (`admin` → VPS IP).

**Opsi B — Path di atas custom domain tenant**: `ikpmjogja.com/admin/*` (path saja, cert sama
dengan apex+www yang sudah ada).
- Kelebihan: **tidak butuh SSL cert tambahan** — satu cert (apex+www, sudah ada) menutupi semua
  path termasuk `/admin`. Tidak ada DNS record tambahan.
- Kekurangan: perlu hati-hati path-collision dengan konten publik tenant. **Konfirmasi konkret**:
  `app/(public)/[tenant]/[pageSlug]/page.tsx` adalah catch-all 1-segmen untuk halaman CMS
  (`/{pageSlug}` → di-rewrite middleware jadi `/{slug}/{pageSlug}`) — persis namespace path yang
  sama dengan `/admin` kalau prefix ini dipakai.

  ✅ **Dicek ke database production (2026-07-16)**: query dijalankan lintas SEMUA tenant aktif
  (loop dinamis per schema `tenant_{slug}`, cek kolom `slug = 'admin'` di tabel `posts`, `pages`,
  `products`, `campaigns`, `events`) — **nol collision ditemukan**. Prasyarat wajib § 7 poin 1
  terpenuhi, jalan untuk mulai implementasi Opsi B tidak ada lagi yang menghalangi dari sisi ini.

**✅ Keputusan (2026-07-16)**: user memilih **Opsi B — path-based** (`{custom-domain}/admin/*`).
Alasan: nol SSL tambahan, nol DNS tambahan per tenant, konsisten dengan filosofi "custom domain =
satu sertifikat, semua di baliknya" yang sudah berjalan untuk front-end publik. Opsi A (subdomain)
disimpan di dokumen ini sebagai catatan alternatif kalau nanti arsitektur SSL berubah jadi full-Caddy
(§ 6.1), tapi **bukan arah yang akan dikerjakan**.

### 7.2 Implementasi Final — Routing, Auth, Branding

✅ **Diuji manual di production (`visikita.com`) sampai berhasil**: login lewat domain sendiri,
navigasi sidebar tanpa error, branding tenant tampil. Tiga bug sempat ditemukan+difix berurutan
selama proses ini di hari yang sama — riwayat lengkapnya (untuk konteks debugging, bukan hal yang
perlu difix lagi) ada di § 8.1. Bagian ini mendeskripsikan **cara kerja final**, bukan urutan
perbaikannya.

**Alur routing** (`middleware.ts`, di dalam blok `!isOwnHost(host)`, urutan pengecekan persis):

```
1. pathname === "/admin" atau mulai "/admin/" ?
     → resolve slug dari Host header (resolveCustomDomainSlug(), reuse endpoint yang sama
       dengan flow konten publik, § 3.2 poin 1c)
     → slug tidak ketemu (domain belum/tidak aktif) → redirect jalakarta.com/app/login
     → slug ketemu, belum ada cookie sesi → redirect ke /login DI DOMAIN INI SENDIRI,
       ?redirect={pathname-admin-asli}
     → slug ketemu, sudah ada cookie sesi → REWRITE internal ke /app/{slug}/dashboard (kalau
       path bare "/admin") atau /app/{slug}{restPath} (kalau ada sub-path) — return, selesai.

2. pathname mulai "/app/" atau "/platform/" ?
     → untuk "/app/{X}/...": resolve slug dari Host header, bandingkan {X} dengan slug itu
     → {X} === slug pemilik domain ini → cek cookie sesi:
         - belum ada → redirect ke /login DI DOMAIN INI SENDIRI (sama seperti cabang 1)
         - sudah ada → return NextResponse.next() — request diproses APA ADANYA oleh
           Next.js App Router, identik dengan /app/{slug}/... di jalakarta.com sendiri
     → {X} !== slug (tenant lain) ATAU path "/platform/*" → redirect ke jalakarta.com
       (guard keamanan lama, tidak berubah)

3. Sisanya (konten publik, /api/*, dst) → tidak berubah dari sebelumnya.
```

> ⚠️ **Update 2026-07-30 (Carve-out `/app/login` pada Custom Domain)**:
> Jika Server Component/layout memanggil `redirect("/app/login")` atau browser meminta path `/app/login` di custom domain, segmen `pathSlug` yang diekstrak bernilai `"login"`, yang secara literal tidak cocok dengan `ownSlug` (`"login"` ≠ `"pc-ikpm-jogjakarta"`). Tanpa pengecualian khusus, middleware akan menangkapnya di cabang `{X} !== slug` dan salah memicu redirect 302 ke `https://jalakarta.com/app/login`.
> **Perbaikan (`middleware.ts`)**: Ditambahkan carve-out eksplisit `if (pathname === "/app/login" || pathname === "/app/login/")` pada cabang custom domain untuk me-redirect 302 ke `/login` milik custom domain itu sendiri (`{custom-domain}/login`), mempertahankan pengguna tetap di dalam domain tenant tanpa pernah terlempar ke domain utama.


**Keamanan**: slug SELALU di-resolve dari `Host` header request ini sendiri, TIDAK PERNAH dari
path — inilah yang menjamin baik `/admin/*` maupun `/app/{slug}/*` di sebuah custom domain hanya
bisa mengakses dashboard tenant PEMILIK domain itu, tidak pernah tenant lain (kelas celah yang
sama persis dengan yang ditutup 2026-07-08 untuk guard `/app/*` awal, § 8.1). Cookie sesi dicek
proaktif di kedua cabang (mencerminkan guard `/app/*` standar yang sudah ada untuk jalakarta.com)
— `(dashboard)/app/[tenant]/layout.tsx` tetap jadi lapis kedua/defense-in-depth di belakangnya.

**Auth cross-domain — terselesaikan tanpa mekanisme tambahan**: login lewat `{custom-domain}/login`
(bukan `jalakarta.com/app/login`) menghasilkan cookie Better Auth yang di-scope ke `Host` header
saat proses login (fix sesi sebelumnya, lesson "Login di Custom Domain — Better Auth CSRF") — jadi
otomatis valid untuk `{custom-domain}/admin/*` dan `{custom-domain}/app/{slug}/*` juga.
`login-form.tsx` sudah `window.location.href = redirectTo || baseUrl/akun` sejak awal — tidak ada
satu baris pun yang perlu diubah di sana untuk mendukung alur ini. Ini persis realisasi dari
preferensi user "SSO kalau bisa, kalau tidak bisa login manual tidak masalah" (§ 7.3) — sesi
terpisah per domain, tanpa token-exchange atau mekanisme SSO baru.

**Branding dashboard** — sesuai Prinsip #2 di § 1, dashboard yang diakses lewat custom domain
(baik via `/admin/*` maupun `/app/{slug}/*` setelah navigasi) tenant-branded: logo +
`primary_color` CSS variable + footer "jalakarta v0.1" tersembunyi. Deteksi berbasis `Host` header
di layout (§ 5.3) — independen dari path, jadi tetap konsisten meski address bar berubah dari
`/admin/...` ke `/app/{slug}/...` (lihat trade-off di bawah).

**Trade-off yang disetujui secara eksplisit oleh user**: address bar berubah dari `/admin/...` ke
`/app/{slug}/...` begitu user klik menu sidebar pertama kali. Ini bukan bug — seluruh dashboard
admin (ratusan file) menulis href/redirect sebagai path absolut `/app/{slug}/...`, dan browser
selalu menampilkan URL persis seperti yang tertulis di `href` pada client-side navigation
(middleware tidak bisa mengintervensi ini). Alternatifnya (refactor total ratusan file supaya URL
`/admin/...` konsisten selamanya) dipertimbangkan tapi ditolak — effort-nya sebanding migrasi URL
Fase 1-4 dulu, untuk manfaat yang murni kosmetik. Fungsi utama (tetap di domain sendiri, branding
tampil, keamanan terjaga) tercapai penuh terlepas dari path mana yang tampil di address bar.

**Duplikasi kecil yang disengaja**: `resolveCustomDomainSlug()` (fungsi baru di `middleware.ts`)
menduplikasi ~15 baris logic fetch-ke-resolve-domain yang sudah ada di blok konten-publik di bawahnya,
alih-alih di-share lewat refactor. Trade-off sadar — custom domain content routing adalah jalur
paling kritis di seluruh aplikasi, mengubahnya demi menghindari duplikasi kecil dianggap risiko
lebih besar daripada manfaatnya. Konsisten dengan pola duplikasi-demi-isolasi yang sudah berulang
di project ini (`generateEventRegNumber`, `formatEventDateWib`, dst).

### 7.3 Status keputusan (update 2026-07-16)

- ✅ Opsi A vs B (§ 7.1) — **dijawab: Opsi B (path-based)**.
- ✅ Item #1 roadmap (fix footer, § 9) — **dieksekusi**, lihat § 5.1. Item lain di § 9 masih
  menunggu sinyal eksekusi terpisah dari user.
- ✅ Auth cross-domain (§ 7.2 poin 3) — **dijawab: best-effort SSO, fallback boleh login manual.**
  Preferensi user: kalau admin sudah login di `jalakarta.com/app/{slug}`, idealnya otomatis
  ter-anggap login juga saat buka `{custom-domain}/admin` — TAPI kalau secara teknis tidak
  memungkinkan (skema cookie berbeda domain, browser modern makin ketat soal third-party/
  cross-site cookie), tidak masalah user login ulang manual di `{custom-domain}/admin`. Ini
  BUKAN persyaratan keras — jangan korbankan kesederhanaan/keamanan demi mengejar SSO sempurna.
  Implikasi teknis: opsi realistis yang konsisten dengan preferensi ini adalah sesi terpisah per
  domain (login manual, paling sederhana & aman — cookie `better-auth.session_token` di
  `jalakarta.com` secara native TIDAK bisa dibaca dari domain lain, itu batas browser bukan
  pilihan desain) — bukan named-session-sharing lintas domain yang butuh mekanisme tambahan
  (mis. token exchange, cross-domain hop). Kalau nanti dieksekusi, mulai dari sesi terpisah dulu
  (paling murah, sudah sesuai fallback yang diizinkan user) — SSO lintas domain bisa jadi
  peningkatan lanjutan, bukan syarat awal.

---

## 8. Ralat Terhadap Dokumen/Kode Lama

Ditemukan lewat audit langsung ke kode — bukan asumsi. Dicatat di sini supaya tidak terulang.

### 8.1 Riwayat bug nyata yang relevan (untuk konteks, bukan yang perlu difix lagi)

- **2026-07-08**: custom domain bisa membuka dashboard admin tenant LAIN
  (`visikita.com/app/pc-ikpm-jogjakarta/dashboard` bisa dibuka). Fix: guard middleware § 3.2 poin
  1a. Efek domino: semua link `/app/{slug}/...` di area publik wajib pakai URL absolut
  (`NEXT_PUBLIC_APP_URL`), bukan relatif.
- **2026-07-14**: `next.config.ts redirects()` (legacy admin bookmark) salah menangkap
  `visikita.com/akun/media` (2 segmen path, kebetulan cocok pola `/:slug/media`) → redirect ke admin
  login. Fix: guard `has: host jalakarta.com` di § 3.1. **Ini bug yang memicu permintaan sesi
  evaluasi domain ini.**
- **2026-07-16, tiga bug berurutan ditemukan+difix saat uji manual production Admin-on-Custom-Domain
  (§ 7)** — semua di hari yang sama, sampai fitur dikonfirmasi bekerja end-to-end di `visikita.com`:
  1. `/admin` bare (tanpa sub-path) → 404. Root cause: target rewrite `/app/{slug}` bare bukan route
     valid (tidak ada `page.tsx` di root `(dashboard)/app/[tenant]/`). Fix: map eksplisit ke
     `/app/{slug}/dashboard`.
  2. Setelah #1 difix, dashboard tampil tapi SEMUA link sidebar memicu CORS error ("Redirect is not
     allowed for a preflight request") dan melempar user ke `jalakarta.com`. Root cause: seluruh
     dashboard admin (ratusan file) hardcode href/redirect sebagai path absolut `/app/{slug}/...` —
     browser meresolve ini terhadap origin SAAT INI (`visikita.com`), memicu guard blanket
     `/app/*`→redirect-jalakarta.com di tengah CORS preflight. Fix: **Opsi C** — izinkan
     `/app/{slug-pemilik-domain-ini}/*` render langsung (bukan diredirect) kalau slug cocok dengan
     Host header — dipilih atas refactor total ratusan file (effort sebanding migrasi Fase 1-4)
     setelah trade-off dipresentasikan ke user.
  3. Deploy fix #2 menghilangkan CORS tapi menggantinya dengan 404 di semua link yang sama. Root
     cause: implementasi awal Opsi C "tidak `return`, biarkan jatuh ke guard cookie di bawah" salah
     — ada blok resolve-domain publik DI ANTARANYA (sama-sama di dalam `if (!isOwnHost(host))`),
     tanpa `return` eksplisit eksekusi jatuh ke situ dan salah rewrite jadi
     `/{slug}/app/{slug}/...` (4 segmen) → 404. Fix: `return NextResponse.next()` eksplisit +
     guard cookie sesi dicek langsung di cabang itu sendiri.

  Deskripsi lengkap cara kerja FINAL (bukan riwayat perbaikannya): § 7.2.

- **2026-09-04**: 7 link internal admin (modul Surat, Keuangan, Donasi, Website) membangun URL
  sebagai `` `/${slug}/{module}` `` tanpa prefix `/app/` — masih "aman" di `jalakarta.com` karena
  ketolong redirect 301 legacy `ADMIN_MODULES` (§ 3.1, `has: host jalakarta.com`), tapi 404
  NYATA di custom domain (redirect legacy itu sengaja tidak berlaku di sana). Ditemukan lewat
  laporan user: `visikita.com/letters/keluar/{id}` 404 padahal `jalakarta.com/app/visikita/
  letters/keluar/{id}` (link yang sama) aman. Detail lengkap + daftar 7 file:
  `docs/arsitektur-modul-surat.md` § 4 Bug #5. **Pola untuk deteksi kasus serupa ke depan**: link
  `` `/${slug}/{module}` `` tanpa `/app/` di komponen dashboard TIDAK BOLEH dianggap aman hanya
  karena teruji di `jalakarta.com` — redirect legacy `ADMIN_MODULES` menyamarkan bug persis ini.

### 8.2 Klaim basi di `docs/arsitektur-domain.md` versi lama (2026-05-26) — sudah dikoreksi di sini

- ~~"Cron Verify-Domains yang Aman — belum difix, cron bisa downgrade `active` → `failed`"~~ — SALAH.
  Kode cron sudah benar sejak commit `7b7138b` (2026-05-16), **10 hari sebelum** dokumen lama itu
  ditulis. `active` tidak pernah disentuh cron. Klaim ini murni basi, sudah dihapus di § 4 versi ini.
- ~~"Canonical Tag Custom Domain masih pakai `NEXT_PUBLIC_APP_URL`"~~ — SALAH untuk kode saat ini.
  `lib/tenant-seo.ts` sudah bercabang benar: `customDomainStatus === "active"` →
  `https://{customDomain}`, else fallback `{appUrl}/{slug}`. Sudah benar di § 5.1 (SEO tidak masuk
  daftar temuan aktif — hanya footer yang bocor).
- Dokumen lama **tidak menyebut sama sekali** guard `/app/*`/`/platform/*` di custom domain (§ 3.2
  poin 1a) — karena guard itu ditambahkan setelahnya (2026-07-08). Sudah dimasukkan di versi ini.

### 8.3 ✅ Fixed (Fase 3, 2026-07-16): Duplikasi `baseUrl`

Lihat § 5.2 untuk detail fix — `lib/resolve-base-url.ts` (server) + `lib/use-base-url.ts` (client),
16 titik lama dikonsolidasi.

### 8.4 ✅ Fixed (Fase 1, 2026-07-16): Komentar "SSL via Caddy" + nama domain salah di schema

`packages/db/src/schema/public/tenants.ts` baris 29 dan 46 (sebelum fix) punya komentar yang
menyebut "SSL sudah provisioned via Caddy" untuk status `active`. **Tidak ada Caddy di manapun**
dalam infrastruktur nyata (nginx.conf, deployment-guide.md, panduan-custom-domain.md, cron
verify-domains — semua murni Nginx + Certbot manual, lihat § 6). Caddy cuma disebut sebagai
**usulan masa depan** (§ 6.1) kalau jumlah tenant custom domain sudah besar — bukan yang dipakai
sekarang. Sekalian ditemukan (dan difix) komentar terkait yang salah menyebut domain sebagai
`app.jalajogja.com` / `{subdomain}.jalajogja.com` — mencampur nama repo (`jalajogja`) dengan brand
domain publik (`jalakarta.com`), pelanggaran langsung terhadap aturan penamaan yang sudah dikunci
di CLAUDE.md ("Repo/folder = jalajogja; brand/domain publik = jalakarta"). Komentar-komentar ini
kemungkinan sisa draft desain awal yang tidak pernah diupdate seiring project berjalan.

### 8.5 Rencana "Fase 5" lama (`docs/rencana-migrasi-url.md`, dihapus 2026-08-25) — kontradiksi internal, tidak pernah diadopsi

Dokumen lama itu (Fase 1-4-nya sudah lama selesai dan riwayatnya tercatat penuh di lesson
CLAUDE.md — lihat `[2025-05] Migrasi URL Admin — Lessons Learned`) mengusulkan admin subdomain
(`admin.{customdomain}`) via **Cloudflare orange-cloud proxy** untuk SSL-nya — ini **bertentangan
langsung** dengan seluruh pendekatan custom domain yang sudah berjalan (§ 6: DNS-only/grey-cloud,
SSL manual via Certbot di VPS, bukan Cloudflare). Proposal itu tidak pernah dieksekusi — solusi
yang benar-benar dibangun dan sudah live adalah **Opsi B path-based** (§ 7 di atas,
`{custom-domain}/admin/*`), bukan subdomain. Dicatat di sini sebagai alasan kenapa pendekatan
subdomain ditolak, kalau ide itu muncul lagi: kalau nanti Opsi A (subdomain) dipertimbangkan
ulang, SSL-nya harus tetap ikut pola yang sudah ada (Certbot manual per subdomain), **bukan**
memperkenalkan Cloudflare proxy sebagai pengecualian khusus — itu akan membuat dua pendekatan
SSL berbeda dalam satu sistem, sumber kebingungan operasional baru.

### 8.6 ✅ Fixed (Fase 1, 2026-07-16): `docs/panduan-custom-domain.md` sebut tombol yang tidak ada

Dokumen panduan itu (dan sisa CLAUDE.md draft lama) menyebut tombol manual "Verifikasi DNS" di UI
settings domain. **Tidak pernah diimplementasikan** — yang ada adalah trigger otomatis
(`triggerDomainVerification()`, fire-and-forget) tiap kali admin menyimpan domain baru/berubah, plus
cron terjadwal sebagai fallback. UI tidak butuh tombol manual karena sudah otomatis. Langkah 6
panduan ditulis ulang untuk menjelaskan alur otomatis ini, dengan psql sebagai jalur debug/darurat
saja — bukan langkah wajib.

### 8.7 ⚠️ Rencana Arsitektur Custom Permalinks & WordPress Import (Perlu Klarifikasi Before Execution)

> **Dokumen Arsitektur & Spesifikasi Terpisah**: **`docs/arsitektur-import-export-post-wordpress.md`**
> **STATUS: ⚠️ BELUM DIEKSEKUSI / PERLU KLARIFIKASI MATANG SEBELUM IMPLEMENTASI**

Kustomisasi struktur permalink post (`post_name`, `date_name`, `category_name`) yang menirukan WordPress `/%postname%/` membawa potensi tabrakan rute (*route collision*) dengan rute statis publik di custom domain (seperti `/toko`, `/event`, `/donasi`, `/surat`, `/akun`, `/login`, `/register`, `/admin`, `/api`). 

Rencana mitigasi 2-lapis yang dispesifikasikan (Reserved Slugs blacklist + priority fallback routing di Next.js) belum dieksekusi dan wajib diklarifikasi lebih matang dengan user sebelum penulisan kode dimulai.

---

## 9. Roadmap — Eksekusi Bertahap (SOP: baca CLAUDE.md → per-fase → tsc → dokumentasi → commit)

Diurutkan dari risiko paling rendah ke paling tinggi. Dieksekusi bertahap per fase mulai
2026-07-16 — status per item diupdate langsung di tabel ini setiap fase selesai.

| # | Item | Risiko | Effort | Status |
|---|------|--------|--------|-----------|
| 1 | Fix footer branding leak (§ 5.1) | Sangat rendah | Menit | ✅ **Selesai (2026-07-16)** |
| 2 | Koreksi komentar "Caddy" + nama domain salah (`jalajogja.com`→`jalakarta.com`) di schema (§ 8.4) | Nol — cuma komentar | Menit | ✅ **Selesai (Fase 1, 2026-07-16)** |
| 3 | Koreksi `docs/panduan-custom-domain.md` (§ 8.6) — hapus klaim tombol yang tidak ada, jelaskan alur otomatis | Nol — dokumentasi saja | Menit | ✅ **Selesai (Fase 1, 2026-07-16)** |
| 4 | Nasib `tenants.subdomain` (§ 2) — user pilih sembunyikan field dari UI settings sampai Fase 2 siap dikerjakan | Rendah | Menit | ✅ **Selesai (Fase 2, 2026-07-16)** |
| 5 | Konsolidasi duplikasi `baseUrl` (§ 5.2/8.3) jadi satu helper/hook bersama | Sedang — refactor lintas 16 file | Beberapa jam | ✅ **Selesai (Fase 3, 2026-07-16)** |
| 6 | Admin-on-Custom-Domain (§ 7), 3 sub-fase: middleware → branding dashboard → auth | Tinggi — security-sensitive (celah 2026-07-08 harus tidak terulang dalam bentuk baru) | Hari | ✅ **Selesai + diuji manual production (2026-07-16)** — semua sub-fase dieksekusi, 3 bug ditemukan+difix saat uji manual (§ 8.1), dikonfirmasi bekerja end-to-end di `visikita.com` (login + navigasi dashboard + branding). Belum ada automated test — kalau ada perubahan middleware/dashboard di masa depan, ulangi uji manual serupa sebelum deploy. |

**Urutan eksekusi**: #1–#3 selesai (Fase 1, murah/independen/nol risiko). #4 butuh keputusan cepat
user (implementasi vs sembunyikan) sebelum lanjut. #5 satu fase tersendiri dengan testing
menyeluruh. #6 menunggu hasil cek collision slug `admin` di production sebelum baris kode pertama
ditulis — keputusan produk (§ 7.3) sudah tuntas.
