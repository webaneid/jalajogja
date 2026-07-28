# Arsitektur SEO — Jalakarta

> **Status Dokumen: 📋 MASTER BLUEPRINT & ARSITEKTUR LENGKAP (Diperbarui 2026-07-26)**
> Dokumen ini adalah peta tunggal cakupan SEO di seluruh platform Jalakarta: audit status implementasi, analisa gap/bug, serta perencanaan matang bertahap untuk **Integrasi Admin Settings (GTM & Search Console)**, **Dual Sitemap Index (Migrasi Yoast SEO)**, **Aksesibilitas Robot AI (Gemini, ChatGPT, Claude)**, **Hirarki Google Search Sitelinks Keren** (seperti tampilan Google Search institusi besar), dan **Article JSON-LD + Integrasi Penulis (Author) — § 6b, ditambahkan 2026-07-26**.
> Semua Fase (4–7B) berstatus RENCANA, belum diimplementasikan — akan dieksekusi bertahap sesuai instruksi user.
>
> **✅ Diverifikasi ulang menyeluruh (2026-07-26, "audit rencana agen lain")**: semua klaim § 2.1
> (Fase 1-3 ✅) dikonfirmasi akurat terhadap kode aktual. Fase 4/5/7 Pilar 2/4/5 dikonfirmasi
> genuinely 0% (bukan asumsi — dibuktikan grep nol hasil). Ditemukan+dikoreksi 3 hal: Gap 3
> (robots.txt) diluruskan — route-nya SUDAH ada tapi isinya generik, bukan "belum ada sama
> sekali"; Gap 6 BARU — Fase 4 butuh migration `SETTING_GROUPS` dulu (§ 3.1); Gap 7 BARU — Pilar
> 1 Fase 7 (§ 6.2) understate, `<nav>` header sudah ada. **Temuan paling kritis**: § 6c —
> kemungkinan besar BUG LIVE SEKARANG (`/robots.txt` 404 di custom domain manapun), akar
> masalah arsitektural yang juga akan menjegal Fase 5 (sitemap) kalau tidak dihindari dari
> awal. Belum diperbaiki — dicatat sebagai prasyarat Fase 5/6, bukan dieksekusi di sesi ini.
>
> **✅ Update 2026-07-28 — bug § 6c DIPERBAIKI (Langkah 1 dari 3 eksekusi yang dikonfirmasi
> user)**: rencana fix § 6c.2 semula ("pindah `robots.ts` ke nested `[tenant]/robots.ts`")
> **TERBUKTI TIDAK BEKERJA** saat dieksekusi — Next.js genuinely tidak mengizinkan `robots.ts`
> di-nest (regex `isMetadataRouteFile()` di-anchor ke root untuk `robots`/`manifest`/
> `favicon.ico`, beda dari `sitemap`/`icon`/`opengraph-image` yang tidak di-anchor), ditemukan
> lewat verifikasi empiris (file compile 0 error tapi menghasilkan NOL route). Fix sesungguhnya:
> Route Handler `app/(public)/[tenant]/robots.txt/route.ts`. Detail lengkap + koreksi §
> 6c.2/6c.2a/6c.2b — TERMASUK koreksi metodologi verifikasi (percobaan pertama custom-domain
> test sempat false-positive karena `APP_INTERNAL_URL` tidak diset saat testing, lihat catatan
> di § 6c.2a).
>
> **✅ Update 2026-07-28 — Langkah 2+3 SELESAI**: § 4 (rencana sitemap) disinkronkan dengan
> `resolvePostHrefs()` (§ 4.0a/4.4, permalink-aware) — post yang belum ada saat § 4 pertama
> ditulis. **Fase 5 (Dual Sitemap Index) DIEKSEKUSI PENUH** — 14 Route Handler +
> `lib/sitemap-builder.server.ts`, diverifikasi `tsc`+build genuine+curl 14 route dengan data
> real+permalink-switch live+custom domain (metodologi sudah diperbaiki, header
> `x-middleware-rewrite` dikonfirmasi). Detail lengkap § 4.5. **Ketiga langkah yang dikonfirmasi
> user ("1, 2, 3") sekarang selesai dari sisi kode.**
>
> **✅ Audit sinkronisasi susulan (2026-07-28, diminta eksplisit user "cek sekali lagi
> singkronisasi antara dokumentasi dan implemented code")**: dibaca ulang SETIAP fungsi/fetcher/
> file di `lib/sitemap-builder.server.ts` + 15 route.ts (14 sitemap + robots.txt) baris-per-baris
> dan dibandingkan ke klaim dokumen — **4 drift NYATA ditemukan+difix**: (1) § 4.4 salah nama
> fungsi helper (`escapeXml`/`buildUrlset`/`buildSitemapIndex` — nama sesungguhnya
> `xmlEscape`/`buildUrlsetXml`/`buildSitemapIndexXml`, return `Response` bukan `NextResponse`);
> (2) § 4.1 & § 4.2 masih menyebut "Kategori Post & Produk"/`post_categories` untuk
> `sitemap-categories.xml` — SALAH, implementasi final justru MENGECUALIKAN post_categories dan
> MEMASUKKAN event+campaign+dokumen (draf lama tidak pernah diupdate ke keputusan final § 4.4);
> (3) § 4.3 overclaim "pagination otomatis" — kenyataannya cuma `.limit(1000)` safety cap, tidak
> ada split multi-file; (4) **gap genuine di KODE** — komentar `robots.txt/route.ts` sendiri
> menulis "baris Sitemap: menyusul saat Fase 5 selesai", TAPI baris itu belum pernah ditambahkan
> meski Fase 5 sudah selesai — **ditambahkan sekarang** (`Sitemap: {baseUrl}/sitemap.xml` +
> `/sitemap_index.xml`), diverifikasi build+curl ulang. Semua fetcher/route/tabel referensi
> lain dikonfirmasi SUDAH sinkron sejak awal (nol drift). `tsc --noEmit` bersih setelah semua
> fix. Detail lengkap 4 temuan ada di masing-masing section terkait (§ 4.4, § 4.1/4.2, § 4.3,
> § 5).

---

## 1. Tiga Kelas Halaman — Prinsip Inti

Setiap halaman publik di Jalakarta dikelompokkan ke dalam salah satu dari tiga kelas utama. Kelas ini menentukan **di mana data/field SEO disimpan dan dikelola**, agar sistem SEO tetap rapi, efisien, dan tidak membuat duplikasi UX bagi admin:

| Kelas | Ciri-Ciri | Lokasi Field SEO | Contoh Halaman |
|---|---|---|---|
| **Kelas A — Konten Bertabel** | Satu record DB = Satu halaman publik. Admin memiliki form create/edit sendiri. | Kolom SEO di tabel yang sama + `<SeoPanel>` (11-field) di form edit. | Post, Halaman Statis, Produk Toko, Event/Agenda, Campaign Donasi, Dokumen |
| **Kelas B — Taksonomi & Kategori** | Satu record DB (kategori/tag) memfilter Halaman Arsip. | Kolom SEO ringan (`meta_title`, `meta_desc`) di tabel taksonomi + field di form kategori. | Kategori Post, Tag Post, Kategori Produk, Kategori Event, Kategori Donasi, Kategori Dokumen |
| **Kelas C — Halaman Statis Tanpa "Rumah" Form** | Path tetap, tidak ber-record tunggal di DB. | Tabel `seo_page_overrides` (tenant-scoped) + UI Pengaturan SEO Admin di `/settings/seo`. | Login, Register, Arsip Post/Produk/Campaign/Agenda/Dokumen, Direktori Anggota/Usaha/Pesantren/Profesional, Statistik |

> [!IMPORTANT]
> **Aturan Emas**: Halaman Pengaturan SEO terpisah (Kelas C) HANYA untuk halaman utility/arsip yang tidak memiliki form edit sendiri. Konten bertabel (Kelas A) SELALU dikelola via `<SeoPanel>` di form edit masing-masing.

---

## 2. Status Implementasi & Analisa Gap/Bug (Hasil Audit 2026-07-26)

### 2.1. Status Fitur yang Sudah Terimplementasi (Fase 1 – 3)

* ✅ **Fase 1 (Modul Dokumen)**: 11 Kolom SEO ditambahkan ke tabel `documents`, `<SeoPanel>` terpasang di `dokumen-form.tsx`, dan `generateMetadata` aktif di `dokumen/view/[id]/page.tsx` (Migration `0037`).
* ✅ **Fase 2 (Taksonomi & Kategori)**: Kolom `meta_title` dan `meta_desc` ditambahkan ke 6 tabel kategori (Migration `0038`).
* ✅ **Fase 3 (Page Overrides)**: Tabel `seo_page_overrides` terpasang (Migration `0039`), UI Pengaturan SEO Halaman Statis aktif di `/app/{slug}/settings/seo`, dan 16 rute `generateMetadata` sudah terhubung.
* ✅ **Invoice Protection**: Halaman `/invoice/[id]` secara otomatis memuat `robots: { index: false, follow: false }`.

---

### 2.2. Temuan Gap & Bug Baru (Hasil Audit 2026-07-26)

Meskipun fondasi SEO dasar sudah berjalan, hasil audit 2026-07-26 menemukan **4 Gap/Kebutuhan Utama** yang perlu direncanakan secara matang:

1. **Gap 1: Belum Ada Tab/Form Integrasi SEO & Analytic di Settings Admin**
   * *Masalah*: Belum ada tempat bagi admin tenant untuk memasukkan **Google Tag Manager (GTM) Container ID** (`GTM-XXXXXXX`) dan **Webmaster Verification Tags** (Google Search Console, Bing, Yandex).
   * *Dampak*: Admin kesulitan memverifikasi kepemilikan domain di Google Search Console dan memasang script analytics/tracking.

2. **Gap 2: Format Sitemap Masih Tunggal (Risiko Migration Break dari Yoast SEO)**
   * *Masalah*: Jalakarta baru merencanakan sitemap tunggal. Jika website tenant sebelumnya menggunakan WordPress + Yoast SEO, Google Search Console sudah mengindeks file `sitemap_index.xml` (dan sub-sitemap seperti `post-sitemap.xml`, `page-sitemap.xml`).
   * *Dampak*: Jika URL `sitemap_index.xml` lama 404, indeks Google Search Console akan error saat migrasi.

3. **Gap 3: Belum Ada Optimasi Eksplisit untuk Robot AI / LLM Crawlers**
   * *Masalah — dikoreksi 2026-07-26, setelah verifikasi kode langsung*: rute `robots.txt` **SUDAH
     ADA dan aktif** (`apps/web/app/robots.ts`, Next.js file convention), TAPI isinya cuma
     `{userAgent:"*", allow:"/"}` generik — **tidak ada satu baris pun** untuk Bot AI spesifik
     (Google Gemini/Google-Extended, ChatGPT/GPTBot, ClaudeBot, PerplexityBot). Konstanta yang
     sudah disiapkan untuk ini (`AI_FRIENDLY_CRAWLERS`, `ROBOTS_ALLOW_ALL`, dst di
     `lib/seo-defaults.ts`) **dead code — tidak pernah diimpor/dipakai di mana pun** (grep nol
     pemanggil). CLAUDE.md sempat salah klaim baris ini "sudah dibuat" — sudah dikoreksi
     (§ Lessons, `[2026-07-26]`).
   * *Dampak*: Konten tenant kurang terstruktur saat dibaca/diringkas oleh search engine AI modern (LLM Search).
   * *Temuan tambahan yang lebih kritis (bukan cuma isi robots.txt, tapi ROUTING-nya) — lihat § 6c*:
     `app/robots.ts` adalah Next.js file convention SINGULAR (hanya melayani path literal
     `/robots.txt` di ROOT domain) — TIDAK kompatibel dengan arsitektur custom-domain project
     ini. `middleware.ts` me-rewrite SEMUA path non-`/admin`/non-`/api` di custom domain jadi
     `/{slug}${pathname}` (baris 169-172) — artinya `https://custom-domain.com/robots.txt` di-
     rewrite jadi `/{slug}/robots.txt`, yang TIDAK PERNAH match `app/robots.ts` (yang cuma
     serve `/robots.txt` tanpa prefix), melainkan jatuh ke catch-all
     `(public)/[tenant]/[pageSlug]/page.tsx` dengan `pageSlug="robots.txt"` → `notFound()`. Ini
     kemungkinan besar **BUG LIVE SEKARANG** (bukan cuma gap rencana Fase 6) — `/robots.txt`
     tenant dengan custom domain aktif kemungkinan 404. Belum diverifikasi via curl/browser
     sungguhan ke domain nyata — perlu konfirmasi sebelum dianggap pasti, TAPI logic
     middleware-nya sudah cukup jelas menunjukkan arah masalahnya. Detail: § 6c.

4. **Gap 4: Tampilan Google Search Masih Standard (Belum Ada Sitelinks & Breadcrumb Rich Result)**
   * *Masalah*: Tampilan hasil pencarian Google untuk tenant belum memicu **Rich Google Sitelinks** (seperti tampilan pencarian institusi/kampus besar yang menampilkan sub-menu: *Penerimaan, Biaya Studi, Admisi, Program Studi*).
   * *Dampak*: Tampilan di halaman pencarian Google kurang profesional dan hirarki navigasi tidak muncul.

5. **Gap 5 (BARU, ditemukan 2026-07-26): JSON-LD TIDAK PERNAH DIRENDER SAMA SEKALI DI HALAMAN MANA PUN — termasuk Article/Penulis**
   * *Masalah — diverifikasi langsung ke kode, bukan asumsi*: `lib/seo.ts` sudah punya 4 generator JSON-LD lengkap (`generateArticleJsonLd`, `generateProductJsonLd`, `generateOrganizationJsonLd`, `generateBreadcrumbJsonLd`) — TAPI grep `application/ld+json` di SELURUH `apps/web` mengembalikan **nol hasil**. Tidak satu pun halaman publik (post, produk, campaign, event, dokumen, beranda) menyuntikkan `<script type="application/ld+json">`. Fungsi-fungsi itu ada, tapi dead code — tidak pernah dipanggil oleh siapa pun.
   * *Dampak langsung untuk Penulis*: `generateArticleJsonLd()` SUDAH punya param `authorName?: string | null` sejak awal (baris 48) dan sudah tahu cara membangun `author: { "@type": "Person", name: authorName }` (baris 278) — infrastrukturnya ADA, tapi karena fungsi ini tidak pernah dipanggil, byline penulis (`docs/arsitektur-penulis-post.md`, selesai dibangun 2026-07-26) SAAT INI hanya tampil sebagai HTML visual biasa (nama+foto+bio di halaman), **sama sekali tidak masuk sebagai data terstruktur** yang dibaca Google untuk Article Rich Result / Google News eligibility / kartu penulis di hasil pencarian.
   * *Dampak turunan*: Pilar 3 dan Pilar 5 di § 6 (Fase 7 — `BreadcrumbList` dan `Organization` JSON-LD) sebenarnya JUGA sudah 100% siap pakai dari sisi fungsi (`generateBreadcrumbJsonLd`, `generateOrganizationJsonLd` sudah lengkap parameternya, match persis kebutuhan Pilar 3/5) — pekerjaan Fase 7 untuk kedua pilar itu murni WIRING (panggil fungsi + render `<script>`), bukan membangun generator dari nol.
   * Detail perencanaan penutupan gap ini: **§ 6b** di bawah.

6. **Gap 6 (BARU, ditemukan 2026-07-26): `SETTING_GROUPS` Belum Punya Grup `"seo"` — Blocker Fase 4**
   * *Masalah*: rencana Fase 4 (§ 3.1) menulis "disimpan di `tenant_{slug}.settings` Group:
     `seo`" seolah tinggal insert — TAPI `SETTING_GROUPS` di
     `packages/db/src/schema/tenant/settings.ts` adalah array TS TETAP (`general, contact,
     payment, display, mail, notif, website, keuangan, toko, donasi, event, forum`) **DAN**
     punya CHECK constraint fisik di DB (`settings_group_check`) — grup baru TIDAK BISA
     langsung dipakai, harus migration dulu (pola sama `0031_settings_group_event.sql`/
     `0042_settings_group_forum.sql`: tambah ke array TS + `DROP`/`ADD CONSTRAINT`).
   * *Dampak kalau terlewat*: Fase 4 akan gagal di runtime (`CHECK constraint violation`) saat
     admin pertama kali simpan setting GTM/verification — bukan error yang ketahuan dari
     `tsc`/build, cuma muncul saat insert sungguhan ke DB.
   * Detail perencanaan: ditambahkan ke § 3.1.

7. **Gap 7 (BARU, ditemukan 2026-07-26): Pilar 1 Fase 7 Understate — `<nav>` Sudah Ada, Tinggal `<ul>/<li>`+`aria-label`**
   * *Masalah*: § 6 Pilar 1 menulis seolah header belum pakai `<nav>` semantik sama sekali.
     Diverifikasi: ketiga varian header publik (`classic-header.tsx`, `flex-header.tsx`,
     `pill-header.tsx`) SUDAH pakai tag `<nav>` — yang belum ada cuma pembungkus `<ul>/<li>`
     dan `aria-label="Navigasi Utama"`. Bukan salah arah, cuma perlu dikoreksi supaya scope
     kerjanya jelas: modifikasi struktur existing, bukan bangun dari nol.

---

## 3. Perencanaan Matang Fase 4: Integrasi SEO Admin (GTM & Search Console)

Halaman **Pengaturan SEO Admin** (`/app/{slug}/settings/seo`) akan diperluas dengan **Dua Tab**:
1. **Tab 1: Kustomisasi Halaman Statis (Sudah Ada - Kelas C)**.
2. **Tab 2: Integrasi & Verifikasi Webmaster (Fase 4 Baru)**.

```
/app/[tenant]/settings/seo/
├── Tab 1: Overrides Halaman Statis (16 pageKey)
└── Tab 2: Integrasi & Verifikasi Webmaster
    ├── Google Tag Manager Container ID (GTM-XXXXXXX)
    ├── Google Search Console Verification Meta Tag
    ├── Bing Webmaster Verification Tag
    └── Card Petunjuk Submisi XML Sitemap ke Google Search Console
```

### 3.1. Database Schema (`settings` Table Keys)

> ⚠️ **Prasyarat WAJIB sebelum insert apa pun (Gap 6, § 2.2)**: `SETTING_GROUPS` di
> `packages/db/src/schema/tenant/settings.ts` adalah array TS tetap + CHECK constraint fisik
> di DB — grup `"seo"` BELUM ADA di sana. Migration diperlukan LEBIH DULU: (1) tambah `"seo"`
> ke array `SETTING_GROUPS`, (2) migration SQL `DROP`/`ADD CONSTRAINT settings_group_check`
> untuk semua tenant aktif — pola PERSIS `packages/db/migrations/0031_settings_group_event.sql`
> / `0042_settings_group_forum.sql`. Tanpa ini, insert setting apa pun di grup `"seo"` akan
> gagal dengan CHECK constraint violation di runtime (bukan error `tsc`).

Metadata integrasi disimpan di tabel `tenant_{slug}.settings` (Group: `seo`):
- `seo_gtm_id`: string (Contoh: `"GTM-K89XPL2"`)
- `seo_google_verification`: string (Contoh: `"google-site-verification=abc123xyz"`)
- `seo_bing_verification`: string (Contoh: `"msvalidate.01=123456"`)

### 3.2. Script Downstream Injection di `PublicLayout` (`app/(public)/[tenant]/layout.tsx`)

* **`<head>` Script Injector**:
  Memuat tag meta verifikasi Google/Bing dan script penyiapan GTM:
  ```html
  <!-- Meta Verification -->
  <meta name="google-site-verification" content="{seo_google_verification}" />
  
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','{gtm_id}');</script>
  ```
* **`<body>` `<noscript>` Injector**:
  Memuat iframe fallback GTM persis setelah pembuka tag `<body>`.

### 3.3. Card Informasi Submisi Google Search Console (GSC)

> ✅ **Sebagian SUDAH dieksekusi (2026-07-28)** — bagian sitemap URL saja, DILUAR urutan Fase 4
> penuh (di luar tab GTM/verification meta yang masih § 3.1/3.2, belum dibangun). Lihat detail
> di bawah.

Di dalam UI Admin `/settings/seo`, disediakan komponen visual **"Petunjuk Verifikasi Google Search Console"**:
* Menampilkan URL Sitemap Resmi Tenant yang siap disalin: `https://{custom-domain}/sitemap.xml` dan `https://{custom-domain}/sitemap_index.xml`.
* Panduan 3 langkah mudah: (1) Copy Meta Tag ➔ (2) Paste di form di atas ➔ (3) Buka Google Search Console & Submit URL Sitemap.

**Status eksekusi nyata (2026-07-28)** — diminta user langsung ("apakah mungkin sitemap dll ada
di pengaturan website, sehingga saat upload di Google Search Console tau URL sitemap-nya"):
komponen `SitemapUrlsCard` (`components/settings/sitemap-urls-card.tsx`) dibangun dan dipasang
di ATAS `SeoOverridesManageClient` yang sudah ada di `/app/{slug}/settings/seo` — TIDAK
menunggu Tab 2/GTM/verification meta (§ 3.1/3.2, belum dibangun). Card menampilkan 2 URL
(native `/sitemap.xml` + alias Yoast `/sitemap_index.xml`) sebagai read-only input + tombol
salin (pola sama link TTD di `signature-slot-manager.tsx`), dihitung dari
`getTenantSeoBase(slug).baseUrl` — SUMBER YANG SAMA dipakai Route Handler sitemap sendiri
(`lib/sitemap-builder.server.ts`), jadi otomatis benar untuk domain sendiri MAUPUN custom
domain tanpa kode tambahan. Diverifikasi `tsc`+build genuine, **di-commit+push+deploy ke VPS,
live di production** (dikonfirmasi bareng seluruh Fase 5 — lihat § 4.5). Sisa Fase 4 (Tab 2,
GTM script injection, verification meta tag, migration `SETTING_GROUPS`) TETAP belum dieksekusi.

---

> ⚠️ **Prasyarat routing WAJIB dibaca dulu**: § 6c di bawah menjelaskan kenapa route sitemap
> TIDAK BOLEH dibangun via Next.js Metadata Route convention di ROOT (`app/sitemap.ts`) —
> harus NESTED di dalam `app/(public)/[tenant]/`, supaya jalan benar di custom domain.

## 4. Perencanaan Matang Fase 5: Dual Sitemap Index Engine

Untuk menjamin mulusnya migrasi dari WordPress (Yoast SEO) sekaligus mendukung standar Jalakarta, platform menyediakan **Dual Sitemap Index**:

```
                                  ┌───────────────────────────────┐
                                  │      GOOGLE SEARCH CONSOLE    │
                                  └───────────────┬───────────────┘
                                                  │
                         ┌────────────────────────┴────────────────────────┐
                         │                                                 │
                         ▼                                                 ▼
      ┌────────────────────────────────────┐             ┌──────────────────────────────────┐
      │   STRATEGI A: NATIVE JALAKARTA     │             │    STRATEGI B: YOAST COMPATIBLE  │
      │       GET /{slug}/sitemap.xml      │             │    GET /{slug}/sitemap_index.xml │
      └──────────────────┬─────────────────┘             └─────────────────┬────────────────┘
                         │                                                 │
      ┌──────────────────┴─────────────────┐             ┌─────────────────┴────────────────┐
      │ sitemap-pages.xml                  │             │ page-sitemap.xml                 │
      │ sitemap-posts.xml                  │             │ post-sitemap.xml                 │
      │ sitemap-categories.xml             │             │ category-sitemap.xml             │
      │ sitemap-toko.xml                   │             │ product-sitemap.xml              │
      │ sitemap-event.xml                  │             │ ...                              │
      └────────────────────────────────────┘             └──────────────────────────────────┘
```

> ⚠️ **Sinkronisasi wajib dengan fitur Custom Permalink Structure (dibangun SETELAH bagian ini
> pertama ditulis)** — lihat § 4.0a di bawah SEBELUM implementasi `sitemap-posts.xml`.

### 4.0a. `sitemap-posts.xml` WAJIB Pakai `resolvePostHrefs()` — Bukan Hardcode `/post/{slug}`

`docs/arsitektur-import-export-post-wordpress.md` § 5 menambahkan fitur **Custom Permalink
Structure** (setting per-tenant `permalink_structure`, 5 mode: `default`, `post_name`,
`date_name`, `category_name`, `category_date_name`) — TIDAK ADA saat § 4 ini pertama ditulis.
Helper `apps/web/lib/post-permalink.server.ts` (`resolvePostHrefs<T>(tenantDb, rows)`) SUDAH
menjadi satu-satunya cara yang benar membangun URL post di SELURUH app (post card, header
search, hero, arsip, canonical, admin Public Link Picker, WordPress import) — sub-sitemap
`sitemap-posts.xml` (Strategi A) DAN `post-sitemap.xml` (Strategi B) **WAJIB ikut pola yang
sama**, bukan asumsi `/post/{slug}` seperti di draf awal dokumen ini.

Pola pemakaian untuk builder sitemap (query post → panggil `resolvePostHrefs` → pakai `.href`
sebagai `<loc>` relatif, gabung dengan `baseUrl` tenant seperti konsumen href lain):
```typescript
const rows = await tenantDb.select({
  slug: schema.posts.slug,
  categorySlug: postCategories.slug,     // JOIN, sama seperti 9 query-builder site lain
  publishedAt: schema.posts.publishedAt,
  updatedAt: schema.posts.updatedAt,      // untuk <lastmod>, TIDAK termasuk return resolvePostHrefs
}).from(schema.posts)
  .leftJoin(postCategories, eq(postCategories.id, schema.posts.categoryId))
  .where(eq(schema.posts.status, "published"));

const withHref = await resolvePostHrefs(tenantClient, rows);
// <loc>{baseUrl}{row.href}</loc> — baseUrl WAJIB dari getTenantSeoBase(slug).baseUrl (absolut,
// custom-domain-aware), BUKAN resolveBaseUrl() (relatif+request-header-dependent, tidak cocok
// untuk konteks Route Handler tanpa halaman — lihat § 4.4, keputusan final saat implementasi).
```

**Konten lain (produk/event/campaign/dokumen/kategori/direktori) TIDAK punya opsi permalink
custom** — hanya Post yang punya fitur ini. Sub-sitemap untuk tipe konten lain tetap pakai
slug tetap (`/produk/{slug}`, `/agenda/{slug}`, `/campaign/{slug}`, dst) seperti draf awal —
tidak perlu penyesuaian serupa.

**URL yang pernah di-redirect (`legacy_url_redirects`, § 6c.4) TIDAK PERNAH masuk sitemap** —
sitemap hanya berisi URL kanonik/aktif saat ini, bukan URL lama yang sudah 308 ke tempat lain.

### 4.1. Strategi A: Native Jalakarta Sitemap (`/sitemap.xml`)
Mengembalikan XML `<sitemapindex>` yang mengarahkan ke sub-sitemap modular:
- `sitemap-pages.xml` (Halaman Statis)
- `sitemap-posts.xml` (Artikel / Berita — **permalink-aware, § 4.0a**)
- `sitemap-categories.xml` (Kategori Produk+Event+Campaign+Dokumen — **BUKAN Post**, § 4.4:
  arsip `/post` belum punya filter `?category=` yang berfungsi, sengaja dikecualikan)
- `sitemap-toko.xml` (Produk Toko)
- `sitemap-event.xml` (Agenda & Kegiatan)
- `sitemap-donasi.xml` (Campaign Donasi)
- `sitemap-pesantren.xml` (Direktori Pesantren)
- `sitemap-usaha.xml` (Direktori Usaha Anggota)

### 4.2. Strategi B: Yoast SEO Migration Sitemap (`/sitemap_index.xml`)
Merespons URL `sitemap_index.xml` (alias untuk Yoast SEO) dan memetakan sub-sitemap sesuai konvensi Yoast:
- `post-sitemap.xml` ➔ Dipetakan ke `posts` (**permalink-aware, § 4.0a** — sama seperti
  `sitemap-posts.xml` Strategi A, keduanya sumber data yang sama, cuma nama file beda)
- `page-sitemap.xml` ➔ Dipetakan ke `pages`
- `category-sitemap.xml` ➔ Dipetakan ke `product_categories`+`event_categories`+
  `campaign_categories`+`document_categories` — **BUKAN `post_categories`** (koreksi dari draf
  awal ini, lihat § 4.4/§ 4.1 untuk alasan)
- `product-sitemap.xml` ➔ Dipetakan ke `products`

### 4.3. Cache Header & Performa Engine
- Header Response: `Content-Type: application/xml; charset=utf-8`
- Cache-Control: `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`
- Query database dibatasi per 1.000 URL per file sitemap — **koreksi (§ 4.5)**: ini SEKADAR
  safety cap (`.limit(1000)` di tiap fetcher), BUKAN "pagination otomatis" — tidak ada mekanisme
  split multi-file (`sitemap-posts-2.xml`, dst) kalau tenant tembus 1.000 item per tipe konten.
  Draf awal ini overclaim; pagination genuine di luar scope eksekusi Fase 5 yang sudah selesai.

### 4.4. Rencana Implementasi Konkret — Struktur File + Tabel Referensi (Diverifikasi 2026-07-28)

> Ditulis SEBELUM eksekusi (Langkah 3 dari 3 urutan yang dikonfirmasi user), setelah recon
> menyeluruh terhadap skema aktual (bukan asumsi) — setiap kolom/enum/URL di tabel bawah dicek
> langsung ke `packages/db/src/schema/tenant/*.ts` + `packages/db/src/schema/public/*.ts` + file
> `page.tsx` publik yang bersangkutan.

**Mekanisme file**: Route Handler manual (`route.ts` di folder literal), BUKAN Metadata Route
convention `sitemap.ts` — meski `sitemap.ts` TERBUKTI bisa di-nest (§ 6c.2a, regex tidak
di-anchor), convention itu hanya menghasilkan SATU `<urlset>` per file (atau split via
`generateSitemaps()` yang menghasilkan `/sitemap/{id}.xml`, bukan nama file arbitrer). Rencana
ini butuh BANYAK file dengan nama PERSIS (`sitemap-posts.xml`, `post-sitemap.xml`, dst, demi
kompatibilitas Yoast) — Route Handler manual memberi kontrol penuh atas nama file dan struktur
XML (index vs urlset), pola yang SAMA dipakai `robots.txt/route.ts` (§ 6c.2).

**Helper bersama** — `apps/web/lib/sitemap-builder.server.ts` (baru, `import "server-only"`) —
nama fungsi aktual (dikoreksi 2026-07-28 saat audit sinkronisasi, sebelumnya draf rencana ini
salah tulis `escapeXml`/`buildUrlset`/`buildSitemapIndex`):
- `xmlEscape(s)` (privat, tidak diekspor), `buildUrlsetXml(entries: {loc, lastmod?}[])` → string
  `<urlset>...</urlset>`
- `buildSitemapIndexXml(entries: {loc, lastmod?}[])` → string `<sitemapindex>...</sitemapindex>`
- `xmlResponse(body)` → `Response` (plain, BUKAN `NextResponse`) dengan header sesuai § 4.3
- `getTenantClient(slug)` → thin wrapper `createTenantDb(slug)`, dipakai route.ts index supaya
  tidak duplikasi pemanggilan di tiap file
- 9 fetcher per tipe konten (semua terima `tenantClient`/`slug`, return `{loc, lastmod}[]` —
  `loc` SUDAH absolut, base URL dari `getTenantSeoBase(slug).baseUrl`, BUKAN `resolveBaseUrl()`
  yang relatif+request-header-dependent dan tidak cocok untuk konteks Route Handler tanpa halaman)

**Tabel referensi terverifikasi** (kolom `status`/`visibility` filter WAJIB "hanya yang publik"):

| Tipe | Tabel (lokasi) | Filter publik | `lastmod` | URL |
|---|---|---|---|---|
| Post | `tenant.posts` | `status='published'` | `updatedAt` | **`resolvePostHrefs()`** — § 4.0a, WAJIB, bukan hardcode |
| Halaman | `tenant.pages` | `status='published'` | `updatedAt` | `/{slug}` — singleton `terms`/`privacy` ikut apa adanya (row biasa, bukan special-routed) |
| Produk | `tenant.products` | `status='active'` | `updatedAt` | `/produk/{slug}` |
| Event | `tenant.events` | `status='published'` | `updatedAt` | `/agenda/{slug}` |
| Campaign | `tenant.campaigns` | `status='active'` | `updatedAt` | `/campaign/{slug}` |
| Dokumen | `tenant.documents` | `visibility='public'` | `updatedAt` | `/dokumen/view/{id}` — pakai ID, tabel ini TIDAK punya kolom slug |
| Kategori Produk | `tenant.product_categories` | tidak ada status, selalu publik | tidak ada `updatedAt` (skip `lastmod`) | `/produk/kategori/{slug}` — satu-satunya kategori dengan path nested asli |
| Kategori Event | `tenant.event_categories` | tidak ada status | skip `lastmod` | `/agenda?category={slug}` — filter TERKONFIRMASI berfungsi |
| Kategori Campaign | `tenant.campaign_categories` | tidak ada status | skip `lastmod` | `/campaign?category={slug}` — filter TERKONFIRMASI berfungsi |
| Kategori Post | `tenant.post_categories` | — | — | **SENGAJA TIDAK DIMASUKKAN** — arsip `/post` belum punya filter `?category=` sama sekali (dikonfirmasi: comment kode sendiri "belum punya filter kategori/tag"), memasukkan ke sitemap akan mengirim Google ke URL yang tidak benar-benar memfilter apa pun. Tambahkan setelah filter post archive dibangun (di luar scope fase ini). |
| Kategori Dokumen | `tenant.document_categories` | tidak ada status | skip `lastmod` | `/dokumen?category={slug}` — pola sama, belum di-spot-check individual tapi konsisten dengan event/campaign |
| Direktori Pesantren | **`public.member_owned_pesantren`** (bukan tenant schema!) | JOIN `tenant_memberships.status IN ('active','alumni')` scoped ke tenant ini | `updatedAt` | `/pesantren/{id}` — pakai ID |
| Direktori Usaha | **`public.member_businesses`** (bukan tenant schema!) | `isActive=true` DAN JOIN `tenant_memberships.status IN ('active','alumni')` | `updatedAt` | `/usaha/{id}` — pakai ID |

**Penamaan file berbeda Strategi A vs B, DATA SAMA** — Strategi B (Yoast) HANYA alias nama file
(`post-sitemap.xml` vs `sitemap-posts.xml`) yang memanggil fetcher SAMA — bukan implementasi
kedua yang independen. `sitemap-categories.xml`/`category-sitemap.xml` menggabungkan SEMUA
kategori yang "sengaja dimasukkan" di tabel atas (produk+event+campaign+dokumen — bukan cuma
"Post & Produk" seperti draf pertama § 4.1, diperluas karena verifikasi membuktikan filter
event/campaign/document category JUGA fungsional, bukan cuma produk).

**`legacy_url_redirects` (§ 6c.4) TIDAK PERNAH masuk fetcher manapun di atas** — semua fetcher
query tabel kontennya sendiri (yang otomatis hanya berisi URL AKTIF), tidak pernah membaca
tabel redirect.

**Struktur file `route.ts` (14 total, semua di `app/(public)/[tenant]/`)**:
```
sitemap.xml/route.ts          → index Strategi A (referensi 8 sub-sitemap di bawah)
sitemap-posts.xml/route.ts
sitemap-pages.xml/route.ts
sitemap-categories.xml/route.ts   → gabung produk+event+campaign+dokumen
sitemap-toko.xml/route.ts
sitemap-event.xml/route.ts
sitemap-donasi.xml/route.ts
sitemap-pesantren.xml/route.ts
sitemap-usaha.xml/route.ts
sitemap_index.xml/route.ts    → index Strategi B (referensi 4 sub-sitemap Yoast-style)
post-sitemap.xml/route.ts     → panggil fetcher SAMA dengan sitemap-posts.xml
page-sitemap.xml/route.ts     → panggil fetcher SAMA dengan sitemap-pages.xml
category-sitemap.xml/route.ts → panggil fetcher SAMA dengan sitemap-categories.xml
product-sitemap.xml/route.ts  → panggil fetcher SAMA dengan sitemap-toko.xml
```

**Verifikasi rencana**: bangun `sitemap-builder.server.ts` + 1 slice kerja penuh (index + posts +
pages) dulu, verifikasi `tsc`+build+curl (data tenant lokal real) — BARU perluas ke sisa 11 file
secara bertahap, checkpoint `tsc` per beberapa file (pola sama Fase 2 WordPress Import).

### 4.5. Status — ✅ SELESAI DIEKSEKUSI (2026-07-28, Langkah 3 dari 3)

Semua 14 Route Handler (§ 4.4) + `lib/sitemap-builder.server.ts` sudah dibangun sesuai rencana
di atas TANPA penyimpangan. Verifikasi empiris menyeluruh (bukan cuma `tsc`/build):

1. **`tsc --noEmit`**: 0 error di seluruh `apps/web` (helper + 14 route baru sekaligus).
2. **Build produksi genuine**: `next build` (dev server dimatikan, `.next` dibersihkan dulu) —
   seluruh 14 route terkonfirmasi terdaftar (`ƒ /[tenant]/sitemap*.xml`, dst) di output build.
3. **Curl seluruh 14 route** terhadap tenant lokal real (`pc-ikpm-jogjakarta`) — semua 200,
   `Content-Type: application/xml; charset=utf-8` benar, XML well-formed (diparse via
   `xml.etree.ElementTree` Python, bukan cuma dicek visual).
4. **Isi data diverifikasi benar per tipe** — posts (17 entri), pages (5), produk (4), event (1),
   campaign (1), kategori (2, gabungan produk+campaign — event/dokumen kebetulan kosong di data
   lokal ini), pesantren (1), usaha (4) — semua `<loc>` mengarah ke URL yang benar-benar valid
   sesuai pola masing-masing modul.
5. **Permalink-aware TERBUKTI genuine, bukan asumsi** — tenant disetel sementara ke
   `permalink_structure="post_name"` → `sitemap-posts.xml` langsung berubah dari `/post/{slug}`
   jadi `/{slug}` tanpa prefix, persis sesuai § 4.0a — mengonfirmasi `resolvePostHrefs()`
   benar-benar terintegrasi, bukan hardcode. Setting direvert setelah verifikasi.
6. **Custom domain — diverifikasi dengan metodologi yang SUDAH DIPERBAIKI** (lihat catatan
   metodologi di § 6c.2a soal false-positive robots.txt) — test server dijalankan dengan
   `APP_INTERNAL_URL` eksplisit menunjuk ke instance yang sama, header `x-middleware-rewrite`
   dikonfirmasi muncul (bukti rewrite genuinely terjadi, bukan sekadar status 200), DAN `<loc>`
   di hasil sitemap terbukti pakai domain custom itu sendiri (`https://test-....local/...`) —
   bukti ganda bahwa `getTenantSeoBase()` dan seluruh chain resolusi bekerja benar di custom
   domain, bukan cuma di path-based access.

**Yang SENGAJA belum dibangun (di luar scope eksekusi ini, dicatat eksplisit)**: pagination
multi-file untuk tenant dengan >1.000 item per tipe konten (§ 4.3 cap, `ENTRY_CAP=1000` di kode
sekadar SAFETY LIMIT, belum ada split `sitemap-posts-2.xml` dst); Fase 6 (isi robots.txt per-bot
AI + `llms.txt`) dan Fase 4 (GTM/Search Console) TETAP belum dieksekusi — keduanya independen
dari Fase 5, tidak termasuk 3 langkah yang dikonfirmasi user sesi ini.

**✅ Di-commit (`636123d`) + push + deploy ke VPS (2026-07-28)** — 4 migration dijalankan
(`0049`-`0052`), `bun install` (dependency baru `@tiptap/html`/`fast-xml-parser`/`happy-dom`),
build + `pm2 restart`, semua sukses tanpa error. **Diverifikasi ulang LANGSUNG di production
terhadap bug ASLI** (bukan simulasi) — `ikpmjogja.com` (custom domain aktif milik
`pc-ikpm-jogjakarta`): `curl -i https://ikpmjogja.com/robots.txt` → 200, header
`x-middleware-rewrite: /pc-ikpm-jogjakarta/robots.txt` (bukti rewrite genuinely jalan),
`Sitemap:` lines dan seluruh `<loc>` di `sitemap.xml` benar-benar pakai `ikpmjogja.com` —
bug 404 yang jadi motivasi seluruh pekerjaan ini (§ 6c) sekarang genuinely tertutup di
production. Detail lengkap: § 6c.3.

---

## 5. Perencanaan Matang Fase 6: Optimasi AI Crawler & Agent (LLM Friendly)

Sistem pencarian modern telah bergeser ke **AI Engine** (Google Gemini, ChatGPT, Claude, Perplexity). Jalakarta dirancang agar ramah terhadap pemindaian Robot AI.

> ⚠️ **Fase ini BUKAN "buat baru dari nol"** — `apps/web/app/robots.ts` (root, generik
> `allow: "/"`, melayani domain telanjang) DAN `apps/web/app/(public)/[tenant]/robots.txt/
> route.ts` (Route Handler, BUKAN Metadata Route file `robots.ts` — lihat § 6c.2a untuk kenapa
> `robots.ts` genuinely tidak bisa di-nest, ditemukan+dieksekusi 2026-07-28) **SUDAH ADA DAN
> AKTIF**, bug 404 custom domain SUDAH TERTUTUP (§ 6c.3). Route tenant SEKARANG SUDAH mengirim
> baris `Sitemap: {baseUrl}/sitemap.xml` + `Sitemap: {baseUrl}/sitemap_index.xml` (ditambahkan
> 2026-07-28 begitu Fase 5 selesai, menutup TODO yang sebelumnya tertulis di komentar file itu
> sendiri — lihat § 4.5) — item ini SUDAH SELESAI, bukan lagi bagian yang tersisa. Yang TETAP
> tersisa untuk fase ini: (1) isi `route.ts` (tenant) diperluas dari generik `allow: "/"` jadi
> per-bot AI menggunakan `AI_FRIENDLY_CRAWLERS`/`ROBOTS_ALLOW_ALL` yang SUDAH ADA di `lib/
> seo-defaults.ts` (Gap 3, § 2.2) — REUSE, jangan tulis daftar bot baru dari nol; (2) tambahkan
> hal yang sama ke `app/robots.ts` (root) juga, supaya konsisten untuk kedua konteks (tenant +
> domain telanjang) — root TIDAK punya konteks sitemap tenant, jadi baris `Sitemap:` tidak
> relevan di sana, cukup daftar bot AI-nya saja.

### 5.1. Konfigurasi `robots.txt` Dinamis (`/{slug}/robots.txt`)

Mengatur izin akses khusus bot AI secara transparan di file `robots.txt`:

```ini
User-agent: *
Allow: /
Disallow: /app/
Disallow: /admin/
Disallow: /api/
Disallow: /login
Disallow: /register
Disallow: /checkout
Disallow: /keranjang

# Explicit AI Crawlers Authorization (Gemini, ChatGPT, Claude, Perplexity)
User-agent: Google-Extended
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

# Sitemap Index Links
Sitemap: https://{domain}/sitemap.xml
Sitemap: https://{domain}/sitemap_index.xml
```

### 5.2. Endpoint Dokumen AI (`/{slug}/llms.txt`)

Jalakarta menyediakan endpoint `llms.txt` berstandar internasional yang berisi ringkasan profil organisasi, struktur menu, dan tautan artikel penting dalam format Markdown murni yang sangat disukai oleh LLM AI model.

---

## 6. Perencanaan Matang Fase 7: Hirarki Tampilan Google Search Keren (Google Rich Sitelinks Result)

### 6.1. Target Hasil Tampilan (Google Search Sitelinks)

Untuk menghasilkan tampilan Google Search yang **keren, berhirarki rapi, dan memiliki sub-menu Sitelinks** (seperti tampilan hasil pencarian Universitas / Institusi Besar):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Universitas Islam Indonesia | Bahasa Indonesia                         │
│  https://www.uii.ac.id                                                  │
│  UII didirikan pada 8 Juli 1945. Dengan perjalanan lebih dari 8...      │
│  ─────────────────────────────────────────────────────────────────────  │
│  Penerimaan Mahasiswa Baru UII                                       >  │
│  "UII dibangun sebagai kampus yang kondusif bagi mereka..."             │
│  ─────────────────────────────────────────────────────────────────────  │
│  Biaya Studi 2026/2027                                               >  │
│  * Nilai tertera adalah total UKA yang dibayarkan...                    │
│  ─────────────────────────────────────────────────────────────────────  │
│  Jalur Rapor                                                         >  │
│  Ketentuan Umum · Biaya pendaftaran Rp300.000...                        │
│  ─────────────────────────────────────────────────────────────────────  │
│  Admisi                                                              >  │
│  Penerimaan Mahasiswa Baru dalam dan luar negeri...                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2. 5 Pilar Komponen Pemicu Google Sitelinks di Jalakarta

Google **tidak pernah** memberikan tombol manual untuk "membuat Sitelinks". Sitelinks dibuat **secara otomatis oleh algoritma Google** apabila website memenuhi 5 pilar struktur berikut:

```
                                  ┌─────────────────────────────────────────┐
                                  │      PILAR GOOGLE SITELINKS ENGINE      │
                                  └────────────────────┬────────────────────┘
                                                       │
        ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
        │                  │                   │                   │                  │
        ▼                  ▼                   ▼                   ▼                  ▼
┌───────────────┐  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐  ┌───────────────┐
│ PILAR 1:      │  │ PILAR 2:      │   │ PILAR 3:      │   │ PILAR 4:      │  │ PILAR 5:      │
│ Semantic HTML │  │ JSON-LD       │   │ JSON-LD       │   │ JSON-LD       │  │ JSON-LD       │
│ Navigation    │  │ SiteNav       │   │ Breadcrumb    │   │ WebSite       │  │ Organization  │
│ (<nav>, <ul>) │  │ Element       │   │ List          │   │ SearchAction  │  │ Identity      │
└───────────────┘  └───────────────┘   └───────────────┘   └───────────────┘  └───────────────┘
```

#### Pilar 1: Semantic HTML Navigasi yang Bersih (`PublicHeader`)
> ✅ **Sebagian sudah ada** (dikoreksi 2026-07-26, Gap 7 § 2.2) — ketiga varian header publik
> (`classic-header.tsx`, `flex-header.tsx`, `pill-header.tsx`) SUDAH pakai tag `<nav>`. Yang
> BELUM: pembungkus `<ul>/<li>` (link nav dirender `<a>` flat) dan `id="main-menu"`/
> `aria-label="Navigasi Utama"`. Scope kerja Pilar 1 = MODIFIKASI struktur existing, bukan
> bangun `<nav>` dari nol.
- Menggunakan tag HTML5 `<header>` dan `<nav id="main-menu" aria-label="Navigasi Utama">`.
- Tautan navigasi dibungkus tag list `<ul>` ➔ `<li>` ➔ `<a href="...">` dengan teks jangkar (*anchor text*) yang sangat jelas, unik, dan konsisten (misal: "Penerimaan Anggota", "Agenda Kegiatan", "Donasi", "Toko Usaha").

#### Pilar 2: `SiteNavigationElement` JSON-LD (Navigasi Utama)
Di dalam header public, menyuntikkan Schema.org `SiteNavigationElement` yang mendaftar seluruh menu navigasi utama agar Google dapat langsung mengenali struktur sub-menu situs:
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    {
      "@type": "SiteNavigationElement",
      "position": 1,
      "name": "Berita & Artikel",
      "url": "https://ikpmjogja.com/post"
    },
    {
      "@type": "SiteNavigationElement",
      "position": 2,
      "name": "Agenda Kegiatan",
      "url": "https://ikpmjogja.com/agenda"
    },
    {
      "@type": "SiteNavigationElement",
      "position": 3,
      "name": "Donasi & Infaq",
      "url": "https://ikpmjogja.com/campaign"
    },
    {
      "@type": "SiteNavigationElement",
      "position": 4,
      "name": "Direktori Usaha",
      "url": "https://ikpmjogja.com/usaha"
    }
  ]
}
```

#### Pilar 3: `BreadcrumbList` JSON-LD Universal (Semua Detail & Arsip)
Setiap halaman detail (Post, Page, Produk, Event, Campaign, Dokumen, Usaha, Pesantren) dan Halaman Kategori memuat schema `BreadcrumbList` lengkap dari root hingga item:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Beranda", "item": "https://ikpmjogja.com" },
    { "@type": "ListItem", "position": 2, "name": "Berita", "item": "https://ikpmjogja.com/post" },
    { "@type": "ListItem", "position": 3, "name": "Kegiatan Alumni", "item": "https://ikpmjogja.com/post?category=kegiatan" },
    { "@type": "ListItem", "position": 4, "name": "Silaturahmi Akbar 2026", "item": "https://ikpmjogja.com/post/silaturahmi-akbar-2026" }
  ]
}
```

#### Pilar 4: `WebSite` JSON-LD + `SearchAction` (Sitelinks Search Box)
Menyediakan Schema `WebSite` di beranda tenant yang menginformasikan fitur pencarian internal situs kepada Google Search Box:
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "IKPM Jogja",
  "url": "https://ikpmjogja.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://ikpmjogja.com/post?search={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

#### Pilar 5: `Organization` / `EducationalOrganization` / `NGO` JSON-LD
Identitas resmi organisasi dengan dukungan `logo`, `sameAs` (URL Facebook, Instagram, TikTok, YouTube), dan `contactPoint` (Telepon, WhatsApp, Email).

---

## 6b. Perencanaan Matang Fase 7B: Article/NewsArticle JSON-LD + Integrasi Penulis (Author)

> **Status: 📋 DIRENCANAKAN — BELUM DIIMPLEMENTASIKAN.** Ditambahkan 2026-07-26 atas permintaan
> eksplisit: pastikan sistem Penulis & Editor (`docs/arsitektur-penulis-post.md`, kode SUDAH
> selesai dibangun, belum di-deploy) masuk sebagai bagian arsitektur SEO — bukan cuma tampilan
> HTML visual. Berbeda dari Fase 7 (§ 6) yang fokus SITE-WIDE (navigasi, breadcrumb, identitas
> organisasi), Fase 7B ini PER-ARTIKEL (satu blok JSON-LD per halaman detail post).

### 6b.1. Kenapa Ini Fase Terpisah, Bukan Bagian Fase 7

Fase 7 (§ 6) tentang **Sitelinks** — bagaimana Google menampilkan sub-menu navigasi situs di
bawah judul hasil pencarian. Fase 7B tentang **Article Rich Result** — bagaimana Google
menampilkan satu ARTIKEL secara individual di hasil pencarian (dengan nama penulis, tanggal
terbit, gambar) dan apakah artikel itu ELIGIBLE masuk Google News/Google Discover. Dua tujuan
Google Search yang berbeda, dua schema.org type yang berbeda (`SiteNavigationElement`/`WebSite`
vs `Article`/`NewsArticle`/`BlogPosting`) — sengaja tidak digabung ke satu fase supaya masing-
masing bisa dieksekusi dan diverifikasi independen.

### 6b.2. Sumber Data — Reuse Penuh dari `docs/arsitektur-penulis-post.md`, Tidak Ada Tabel Baru

Data byline (penulis, editor) SUDAH punya rumahnya di `tenant.post_authors` +
`posts.display_author_id`/`editor_id` — Fase 7B TIDAK butuh kolom/tabel baru sama sekali,
murni menyambungkan data yang sudah ada ke output JSON-LD. Fallback chain yang SAMA PERSIS
dipakai render visual (`post/[slug]/page.tsx`, § 3 dokumen penulis) WAJIB dipakai juga di sini
— satu sumber kebenaran, jangan pernah resolve byline dua kali dengan logic berbeda:

```
displayAuthorId ada → resolve dari post_authors (name, bio, avatarUrl)
displayAuthorId NULL → fallback ke authorId lama (tenant.users → public.user + public.members)
```

### 6b.3. Perluasan `ArticleJsonLdParams` — `authorName` Tunggal → Struktur Person Lengkap

`lib/seo.ts`'s `generateArticleJsonLd()` SAAT INI cuma terima `authorName?: string | null` dan
langsung bangun `{ "@type": "Person", name: authorName }` — cukup untuk kasus minimal, tapi
tidak memanfaatkan `bio`/`avatarUrl` yang sekarang tersedia di `post_authors`. Rencana:

```typescript
// SEBELUM (ArticleJsonLdParams saat ini)
authorName?: string | null;

// SESUDAH — objek terstruktur, backward-compatible (masih boleh authorName string polos
// untuk caller lama/fallback authorId yang tidak punya bio/avatar)
author?: { name: string; description?: string | null; imageUrl?: string | null } | string | null;
```

Schema.org `Person` mendukung field `description` dan `image` — dipetakan langsung dari
`post_authors.bio` dan `.avatarUrl`. **`author.url` (link ke halaman profil penulis) SENGAJA
TIDAK diisi untuk sekarang** — `docs/arsitektur-penulis-post.md` § 9 eksplisit mencatat halaman
arsip publik per penulis (`/{slug}/penulis/{id}`) BELUM dibangun (di luar scope MVP byline).
Kalau halaman itu dibangun nanti, `author.url` tinggal ditambahkan tanpa mengubah struktur data
lain — dicatat sebagai dependency terbuka, bukan blocker Fase 7B.

### 6b.4. Editor — SENGAJA TIDAK Masuk JSON-LD (Keputusan Eksplisit, Bukan Terlewat)

Schema.org `CreativeWork`/`Article` **tidak punya properti resmi `editor`** yang didukung
Google Structured Data (beda dari `author`, yang didukung penuh). Field Editor
(`posts.editor_id`, "Disunting oleh X") tetap PURE VISUAL — tampil di HTML halaman, TIDAK
pernah dimasukkan ke `<script type="application/ld+json">`. Ini keputusan sadar supaya JSON-LD
tidak diisi properti yang tidak dikenali/divalidasi Google (berisiko warning di Rich Results
Test), bukan kelupaan — dicatat eksplisit di sini supaya sesi implementasi nanti tidak
"menambahkannya kembali" tanpa sadar ini sudah pernah diputuskan.

### 6b.5. Titik Wiring — `post/[slug]/page.tsx`

Tepat setelah blok resolusi byline yang SUDAH ADA (menghasilkan `authorName`/`authorAvatar`/
`authorBio`/`editorName`), tambahkan render `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />`
di dalam `<head>` (via `generateMetadata` tidak bisa — JSON-LD wajib di body/head via komponen,
bukan Metadata API — pola: render langsung di JSX halaman, sama seperti dokumen Next.js App
Router merekomendasikan `<script>` inline di komponen Server Component). Parameter yang
dikirim ke `generateArticleJsonLd()`:

```typescript
generateArticleJsonLd({
  headline: post.title,
  description: post.metaDesc || post.excerpt,
  imageUrl: coverUrl,
  author: authorName ? { name: authorName, description: authorBio, imageUrl: authorAvatar } : null,
  publishedAt: post.publishedAt,
  updatedAt: post.updatedAt,
  siteUrl: baseUrl,
  articleUrl: pageUrl,
  publisherName: tenantName,
  publisherLogoUrl: logoUrl, // dari settings general — perlu dicek/ditambah fetch kalau belum ada di scope query ini
  schemaType: post.schemaType, // "Article" | "NewsArticle" | "BlogPosting" — SUDAH ada di kolom posts, tinggal pakai
});
```

`post.schemaType` sudah jadi kolom DB sejak awal modul SEO (§ 1, Kelas A) dan sudah dipilih
admin lewat `<SeoPanel>` — cukup diteruskan apa adanya, tidak perlu logic tambahan.

### 6b.6. Dampak Non-Post — Produk, Campaign, Event, Dokumen Tidak Ikut Fase Ini

Fase 7B di-scope KHUSUS Post — konsisten dengan `docs/arsitektur-penulis-post.md` § 11 yang
juga men-scope byline hanya ke Post. `generateProductJsonLd` (untuk `/produk/{slug}`) adalah
gap terpisah (Product Rich Result, bukan Article) — sama-sama belum pernah dipanggil di mana
pun, tapi TIDAK dibahas di Fase 7B ini, dicatat sebagai kandidat fase lanjutan sendiri kalau
diminta.

### 6b.7. Checklist Verifikasi (saat implementasi nanti)

1. `tsc --noEmit` bersih setelah perubahan `ArticleJsonLdParams` (cek semua caller — saat ini
   NOL caller, jadi perubahan signature aman tanpa breaking apa pun).
2. Buka halaman post publik → `view-source:` → cari `application/ld+json` → pastikan JSON valid
   (bukan cuma "ada tag-nya").
3. Tempel JSON ke [Google Rich Results Test](https://search.google.com/test/rich-results) →
   pastikan terdeteksi sebagai `Article` (atau `NewsArticle`/`BlogPosting` sesuai
   `schemaType`), field `author` terisi, TANPA warning field tidak dikenal.
4. Uji 3 skenario byline: (a) post dengan Penulis dari Anggota (author.description harus
   TERISI kalau member itu sudah pernah diberi bio via "Edit Bio/Foto"), (b) post dengan
   Penulis tamu custom, (c) post lama yang field Penulis-nya kosong (fallback `authorId` —
   `author.description`/`author.image` boleh kosong, itu ekspektasi yang benar untuk jalur
   fallback lama, bukan bug).

---

## 6c. Temuan Kritis: Next.js Metadata Route Singular TIDAK Kompatibel dengan Custom Domain

> **Ditemukan 2026-07-26 saat audit menyeluruh rencana Fase 4-7B terhadap kode aktual** — bukan
> bagian dari fase manapun secara langsung, tapi PRASYARAT ARSITEKTUR untuk Fase 5 (sitemap)
> DAN mempengaruhi Fase 6 (robots.txt) yang **sudah punya implementasi live SEKARANG**, bukan
> cuma rencana. Kemungkinan besar bug live yang belum pernah dilaporkan — belum diverifikasi
> via curl/browser ke domain custom sungguhan, tapi logic middleware sudah cukup jelas.

### 6c.1. Akar Masalah

`apps/web/middleware.ts` (baris 169-172), untuk SEMUA request yang datang dari custom domain
(`!isOwnHost(host)`) dan bukan `/admin/*`/`/api/*`, di-rewrite TANPA KECUALI:
```typescript
const url = request.nextUrl.clone();
url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
return NextResponse.rewrite(url);
```
Ini termasuk `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, `/llms.txt` — TIDAK ADA pengecualian
untuk path "metadata/well-known" apa pun. Jadi `https://custom-domain.com/robots.txt` selalu
di-rewrite internal jadi `/{slug}/robots.txt` sebelum Next.js sempat mencocokkan route.

`apps/web/app/robots.ts` — Next.js Metadata Route file convention SINGULAR di ROOT `app/` —
HANYA melayani path literal `/robots.txt` (tanpa prefix apa pun). Path hasil rewrite
`/{slug}/robots.txt` **tidak pernah match** file ini — jatuh ke catch-all
`app/(public)/[tenant]/[pageSlug]/page.tsx` (`pageSlug = "robots.txt"`), yang query tabel
`pages` mencari slug literal "robots.txt" (hampir pasti tidak ada tenant yang punya halaman CMS
bernama itu) → `notFound()`.

**Kesimpulan**: `/robots.txt` di custom domain kemungkinan besar 404 SEKARANG JUGA, terlepas
dari fase SEO manapun sudah/belum dikerjakan. Ini murni konsekuensi arsitektur routing custom-
domain yang sudah dikunci sejak lama (`docs/arsitektur-domain.md`), belum pernah ketahuan
karena `robots.txt` yang 404 tidak menghasilkan error yang mencolok (crawler biasanya
menganggap "tidak ada robots.txt" = boleh crawl semua, efeknya nyaris sama dengan
`allow: "/"` generik yang memang jadi isi file itu — makanya lolos tanpa terdeteksi).

### 6c.2. Fix — ✅ SELESAI DIEKSEKUSI (2026-07-28) — Route Handler, BUKAN Nested Metadata File

> **Koreksi penting terhadap rencana awal di atas**: klaim "Next.js MENDUKUNG Metadata Route
> convention (`robots.ts`) di dalam segmen dinamis" **TIDAK AKURAT untuk `robots.ts` secara
> spesifik** — ditemukan lewat verifikasi empiris (bukan dipercaya dari dokumentasi), bukan
> cuma teori. Detail temuan + eksekusi lengkap ada di § 6c.2a di bawah.

### 6c.2a. Root Cause Sesungguhnya — Regex `isMetadataRouteFile()` Di-Anchor untuk `robots`

Percobaan pertama menaruh `app/(public)/[tenant]/robots.ts` (persis usulan rencana awal) **lolos
`tsc --noEmit` tanpa error dan lolos `next build` tanpa error** — tapi menghasilkan **NOL route**
sama sekali (dikonfirmasi via `next build` genuine + inspeksi langsung `.next/server/
app-paths-manifest.json`: hanya `/robots.txt` root yang terdaftar, `/{tenant}/robots.txt` tidak
ada). File itu diam-diam diabaikan Next.js — bukan page, bukan route, bukan metadata file yang
dikenali di lokasi itu.

Root cause ditemukan dari source Next.js sendiri
(`node_modules/next/dist/lib/metadata/is-metadata-route.js`, fungsi `isMetadataRouteFile`):
```javascript
new RegExp(`^[\\/]robots${ext}${trailing}`)    // ANCHORED — HANYA match kalau path MULAI dari root
new RegExp(`^[\\/]manifest${ext}${trailing}`)  // ANCHORED — sama
new RegExp(`^[\\/]favicon\\.ico$`)             // ANCHORED — sama
new RegExp(`[\\/]sitemap${ext}${trailing}`)              // TIDAK di-anchor — BOLEH nested
new RegExp(`[\\/]${icon.filename}${ext}${trailing}`)     // TIDAK di-anchor — BOLEH nested (icon/opengraph-image/dst)
```
Dikonfirmasi eksplisit via test regex langsung (`node -e`): pattern `^[\/]robots...` cocok untuk
`/robots` (root) tapi **tidak pernah cocok** untuk `/(public)/[tenant]/robots` (nested) — bukti
pasti bahwa **`robots.ts`/`manifest.ts`/`favicon.ico` genuinely TIDAK BISA di-nest** ke dalam
folder/dynamic segment apa pun, beda dari `sitemap.ts`/`icon.ts`/`opengraph-image.ts` yang
memang didesain bisa nested (regex-nya tidak di-anchor).

**Fix yang benar-benar bekerja**: Route Handler biasa (`route.ts`) di folder literal bernama
`robots.txt` — `app/(public)/[tenant]/robots.txt/route.ts`. Route Handler mendukung nesting di
kedalaman path berapa pun tanpa batasan (tidak terikat regex `isMetadataRouteFile` sama sekali,
itu cuma berlaku untuk special-file convention), menghasilkan route `/{tenant}/robots.txt` —
PERSIS path hasil rewrite middleware pada custom domain.

**Diverifikasi empiris end-to-end** (bukan cuma `tsc`/build) — 3 skenario via `next start` +
curl sungguhan:
1. Root `jalakarta.com/robots.txt` (tanpa tenant) → 200, `text/plain`, isi generik (`app/
   robots.ts`, TIDAK disentuh/dihapus — tetap melayani domain telanjang/landing page platform).
2. Path-based tenant `jalakarta.com/pc-ikpm-jogjakarta/robots.txt` → 200, `text/plain`, isi
   sama — via file baru langsung (bukan lewat middleware rewrite, karena `isOwnHost` true).
3. **Custom domain** — tenant lokal disetel sementara `custom_domain='test-...local'`,
   `custom_domain_status='active'`, curl dengan `Host: ...` spoofed header → **200**, `text/plain`,
   isi benar — konfirmasi pasti bug 404 yang didokumentasikan § 6c.1 SUDAH TERTUTUP. Data test
   dan test server dibersihkan seluruhnya setelah verifikasi.

> ⚠️ **Catatan metodologi penting (ditemukan+dikoreksi saat verifikasi Fase 5 sesudahnya)**:
> percobaan PERTAMA skenario #3 di atas SEMPAT jadi false-positive — `next start` test server
> dijalankan tanpa `APP_INTERNAL_URL` eksplisit, jadi middleware's internal fetch ke
> `/api/internal/resolve-domain` (dituju ke `NEXT_PUBLIC_APP_URL=http://localhost:6202`, yang saat
> itu MATI) gagal secara silent (`try/catch` menelan error, "lanjut normal") — custom domain
> rewrite TIDAK PERNAH benar-benar jalan, request jatuh ke ROOT static `/robots.txt` yang
> KEBETULAN isinya identik dengan versi tenant (sama-sama "User-agent: *\nAllow: /") — hasil 200
> terlihat benar padahal sebenarnya tidak menguji jalur custom domain sama sekali. Ditemukan
> ulang saat sitemap testing (404 nyata muncul di sana, memaksa investigasi). **Fix metodologi**:
> jalankan test server dengan `APP_INTERNAL_URL=http://localhost:{PORT_TEST}` eksplisit (menunjuk
> ke instance yang sama), verifikasi header response `x-middleware-rewrite` benar-benar muncul
> (bukti rewrite terjadi) — bukan cuma percaya status code 200 + isi yang cocok. Diulang dengan
> perbaikan ini: `x-middleware-rewrite: /pc-ikpm-jogjakarta/robots.txt` terkonfirmasi muncul,
> 200, isi benar — SEKARANG genuine, bukan false-positive. **Aturan untuk verifikasi custom
> domain manapun ke depan**: SELALU set `APP_INTERNAL_URL` ke instance test yang sedang berjalan,
> dan SELALU cek header `x-middleware-rewrite` sebagai bukti rewrite genuinely terjadi — jangan
> cuma percaya status code + kecocokan isi, terutama untuk konten yang KEBETULAN identik antara
> jalur root dan jalur tenant (seperti robots.txt generik).

**Isi robots.txt masih generik (identik sebelum fix)** — perbaikan ini murni menutup bug ROUTING,
belum menambah konten kustom per-tenant/per-bot AI (itu tetap scope Fase 6, § 5).

### 6c.2b. Implikasi untuk Fase 5 (Sitemap) — Rencana § 4 TETAP Valid, Klarifikasi Mekanisme

`sitemap.ts` **BOLEH tetap pakai special-file convention nested** (`app/(public)/[tenant]/
sitemap.ts`, regex-nya TIDAK di-anchor — dikonfirmasi dari source di atas) — bagian rencana § 4
yang menyarankan ini **tidak perlu diubah**. Yang salah HANYA klaim yang menyamakan mekanisme
`robots.ts` dengan `sitemap.ts` seolah keduanya identik — keduanya BUKAN Route Handler yang sama
persis, `sitemap.ts` sendiri yang genuinely mendukung nesting, `robots.ts` yang tidak.

**Aturan yang ditegaskan untuk pengerjaan SEO/routing selanjutnya**: jangan percaya klaim
kompatibilitas Next.js Metadata Route convention dari dokumentasi/asumsi manapun (termasuk
dokumen ini sendiri) tanpa verifikasi empiris — `tsc`/`next build` yang lolos TANPA ERROR bukan
bukti route benar-benar terdaftar; special-file convention Next.js punya aturan anchor per-jenis
file yang tidak seragam (`robots`/`manifest`/`favicon` dibatasi ke root, `sitemap`/`icon`/
`opengraph-image` bebas nested) — cek `app-paths-manifest.json` hasil build atau curl langsung
untuk memastikan.

### 6c.3. Status — ✅ SELESAI + DIVERIFIKASI PRODUCTION (2026-07-28)

Fix ini sudah dieksekusi dan diverifikasi (§ 6c.2/6c.2a/6c.2b) sebagai LANGKAH PERTAMA dari
urutan eksekusi SEO yang dikonfirmasi user (robots.ts fix → sinkron rencana sitemap § 4 dengan
`resolvePostHrefs()` → eksekusi Fase 5). **Di-commit (`636123d`) + push + deploy ke VPS
(migration 0049-0052 dijalankan, `bun install`, build, `pm2 restart`) — SEMUA sukses tanpa
error.**

**Diverifikasi ulang LANGSUNG terhadap bug asli di production** — `ikpmjogja.com` (custom
domain AKTIF milik tenant `pc-ikpm-jogjakarta`, bukan simulasi/Host-header-spoof seperti
verifikasi lokal) — `curl -i https://ikpmjogja.com/robots.txt`:
```
HTTP/1.1 200 OK
x-middleware-rewrite: /pc-ikpm-jogjakarta/robots.txt
Content-Type: text/plain

User-agent: *
Allow: /

Sitemap: https://ikpmjogja.com/sitemap.xml
Sitemap: https://ikpmjogja.com/sitemap_index.xml
```
Header `x-middleware-rewrite` mengonfirmasi rewrite custom domain genuinely jalan (bukti sama
yang dipakai verifikasi lokal), `Sitemap:` lines dan seluruh `<loc>` di `sitemap.xml` benar-benar
memakai `ikpmjogja.com` (custom domain-nya sendiri, bukan `jalakarta.com/pc-ikpm-jogjakarta`).
**Bug 404 asli (yang jadi motivasi seluruh § 6c) sekarang genuinely tertutup di production,
bukan cuma di lokal.**

### 6c.4. Terkait — Preservasi URL Lama Saat Migrasi dari Platform Lain (Redirect 301)

> Ditambahkan 2026-07-27 sebagai cross-reference, BUKAN duplikasi rencana penuh — detail teknis
> lengkap (skema tabel, alur populate, wiring routing) ada di
> `docs/arsitektur-import-export-post-wordpress.md` § 5.5, ditemukan dari pertanyaan user saat
> mengaudit dokumen itu ("apakah URL lama WordPress di-preservasi agar tidak kehilangan nilai
> SEO Google?"). Dicatat di SINI juga karena ini fundamentally topik SEO (link equity/domain
> authority preservation saat migrasi platform), bukan cuma detail teknis importer — sesi
> mendatang yang bekerja di modul SEO manapun (bukan cuma yang menyentuh importer WP) sebaiknya
> tahu prinsip ini ada: tabel `legacy_url_redirects` (tenant-scoped) dicek di langkah TERAKHIR
> routing catch-all (§ 6c.2 — nested `[...slug]`) SEBELUM `notFound()`, redirect WAJIB 301
> (permanent, bukan 302), dan sitemap/canonical URL untuk konten yang pernah di-redirect harus
> selalu menunjuk ke URL BARU, tidak pernah URL lama.

---

## 7. Roadmap Pelaksanaan Bertahap (Execution Phases)

Semua perbaikan dikelompokkan ke dalam fase-fase terstruktur. Setiap fase wajib mematuhi standar project: **Jelaskan risiko ➔ Tulis kode ➔ Jalankan `bun x tsc --noEmit` ➔ Dokumentasikan**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ROADMAP PENGEMBANGAN SEO JALAKARTA                  │
└─────────────────────────────────────────────────────────────────────────┘
   │
   ├── ✅ Fase 1: Kolom SEO Modul Dokumen (Selesai 2026-07-21)
   ├── ✅ Fase 2: Kolom SEO Taksonomi & Kategori (Selesai 2026-07-21)
   ├── ✅ Fase 3: Overrides SEO Halaman Statis & UI Admin (Selesai 2026-07-21)
   │
   ├── ⬜ Fase 4: Integrasi SEO Admin (GTM & Webmaster Verification)
   │     ├── ⚠️ PRASYARAT: migration `SETTING_GROUPS` tambah `"seo"` (Gap 6, § 3.1) — sebelum insert apa pun
   │     ├── Tab baru di `/app/{slug}/settings/seo` (Integrasi & Verification)
   │     ├── Kolom GTM Container ID + Verification Meta Tags di DB `settings`
   │     ├── Injection Script GTM & Meta Tag di `PublicLayout`
   │     └── Card Petunjuk Submisi Google Search Console
   │
   ├── ✅ Fase 5: Engine Dual Sitemap Index (Selesai 2026-07-28, § 4.5) — Langkah 3 dari 3
   │     ├── 14 Route Handler manual (BUKAN `sitemap.ts` metadata-convention — butuh kontrol
   │     │   nama file arbitrer untuk kompatibilitas Yoast, lihat § 4.4)
   │     ├── ✅ Sinkron dengan `resolvePostHrefs()` — permalink-aware, diverifikasi genuine
   │     │   (bukan asumsi) dengan switch mode `post_name` live
   │     ├── Route `/sitemap.xml` (Native Modular Index) + `/sitemap_index.xml` (Yoast Index)
   │     ├── Sub-sitemaps: posts, pages, categories (produk+event+campaign+dokumen), toko,
   │     │   event, donasi, pesantren, usaha — 8 tipe konten, semua diverifikasi curl+data real
   │     └── ✅ Di-commit+push+deploy VPS, verified live production (custom domain
   │         ikpmjogja.com). Pagination >1.000 item/tipe belum ada (safety cap saja)
   │
   ├── ⬜ Fase 6: Optimasi AI Crawler & Agent (LLM Bot Friendly)
   │     ├── ✅ LANGKAH PERTAMA SELESAI (2026-07-28): bug 404 robots.txt custom domain SUDAH
   │     │   DITUTUP — via Route Handler `app/(public)/[tenant]/robots.txt/route.ts` (BUKAN
   │     │   `robots.ts` — tidak bisa di-nest, § 6c.2a). ✅ Di-commit+push+deploy, verified live
   │     │   di custom domain production `ikpmjogja.com` (§ 6c.3).
   │     ├── ✅ Baris `Sitemap:` sudah ditambahkan (tenant route, mengarah ke sitemap.xml +
   │     │   sitemap_index.xml) — sisa isi masih generik (`allow: "/"` polos, belum per-bot AI)
   │     ├── Isi content diperluas dengan izin eksplisit bot AI, REUSE `AI_FRIENDLY_CRAWLERS`
   │     │   dari `lib/seo-defaults.ts` (Gap 3), jangan tulis ulang — untuk KEDUA file (tenant +
   │     │   root `app/robots.ts`, root tidak perlu baris `Sitemap:`)
   │     └── Endpoint `/{slug}/llms.txt` (Index Markdown murni)
   │
   ├── ⬜ Fase 7: Engine Google Rich Sitelinks & Breadcrumbs
   │     ├── Structuring HTML `<header>` & `<nav>` di `PublicHeader`
   │     ├── JSON-LD `SiteNavigationElement` Generator
   │     ├── JSON-LD `BreadcrumbList` Generator Universal (fungsi SUDAH ADA di lib/seo.ts, tinggal wiring)
   │     └── JSON-LD `WebSite` + `SearchAction` (Sitelinks Search Box)
   │
   └── ⬜ Fase 7B: Article/NewsArticle JSON-LD + Integrasi Penulis (Author) — § 6b
         ├── Perluas `ArticleJsonLdParams.author` → objek Person (name+bio+avatarUrl), bukan authorName string saja
         ├── Wiring `generateArticleJsonLd()` ke `post/[slug]/page.tsx` (SAAT INI: 0 pemanggil di seluruh app)
         ├── Reuse fallback chain byline yang sama dengan render visual (displayAuthorId → post_authors, fallback authorId lama)
         └── Editor SENGAJA tidak masuk JSON-LD (Schema.org Article tidak punya properti `editor` resmi)
```

---

## 8. Panduan Verifikasi & Quality Assurance

1. **Verifikasi Typescript**: `bun x tsc --noEmit` di `apps/web` wajib 0 error.
2. **Verifikasi Schema.org (Google Rich Results Test)**:
   - Pengujian URL publik menggunakan Google Rich Results Test Tool (`https://search.google.com/test/rich-results`).
   - Memastikan `BreadcrumbList`, `WebSite`, dan `SiteNavigationElement` terdeteksi valid tanpa warning/error.
3. **Verifikasi Validator Sitemap**:
   - Pengujian kelayakan file XML via `XML Sitemap Validator`.

---

> **Dokumen ini telah diperbarui dan dikunci sebagai acuan resmi arsitektur SEO Jalakarta. Pengembangan selanjutnya akan mengeksekusi Fase 4 hingga Fase 7 secara bertahap sesuai spesifikasi di atas.**
