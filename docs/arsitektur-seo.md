# Arsitektur SEO — Jalakarta

> **Status Dokumen: 📋 MASTER BLUEPRINT & ARSITEKTUR LENGKAP (Diperbarui 2026-07-26)**
> Dokumen ini adalah peta tunggal cakupan SEO di seluruh platform Jalakarta: audit status implementasi, analisa gap/bug, serta perencanaan matang bertahap untuk **Integrasi Admin Settings (GTM & Search Console)**, **Dual Sitemap Index (Migrasi Yoast SEO)**, **Aksesibilitas Robot AI (Gemini, ChatGPT, Claude)**, dan **Hirarki Google Search Sitelinks Keren** (seperti tampilan Google Search institusi besar).

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
   * *Masalah*: `robots.txt` belum secara eksplisit mengatur izin & jalur optimasi untuk Bot AI (Google Gemini / Google-Extended, ChatGPT / GPTBot, ClaudeBot, PerplexityBot).
   * *Dampak*: Konten tenant kurang terstruktur saat dibaca/diringkas oleh search engine AI modern (LLM Search).

4. **Gap 4: Tampilan Google Search Masih Standard (Belum Ada Sitelinks & Breadcrumb Rich Result)**
   * *Masalah*: Tampilan hasil pencarian Google untuk tenant belum memicu **Rich Google Sitelinks** (seperti tampilan pencarian institusi/kampus besar yang menampilkan sub-menu: *Penerimaan, Biaya Studi, Admisi, Program Studi*).
   * *Dampak*: Tampilan di halaman pencarian Google kurang profesional dan hirarki navigasi tidak muncul.

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

Di dalam UI Admin `/settings/seo`, disediakan komponen visual **"Petunjuk Verifikasi Google Search Console"**:
* Menampilkan URL Sitemap Resmi Tenant yang siap disalin: `https://{custom-domain}/sitemap.xml` dan `https://{custom-domain}/sitemap_index.xml`.
* Panduan 3 langkah mudah: (1) Copy Meta Tag ➔ (2) Paste di form di atas ➔ (3) Buka Google Search Console & Submit URL Sitemap.

---

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

### 4.1. Strategi A: Native Jalakarta Sitemap (`/sitemap.xml`)
Mengembalikan XML `<sitemapindex>` yang mengarahkan ke sub-sitemap modular:
- `sitemap-pages.xml` (Halaman Statis)
- `sitemap-posts.xml` (Artikel / Berita)
- `sitemap-categories.xml` (Kategori Post & Produk)
- `sitemap-toko.xml` (Produk Toko)
- `sitemap-event.xml` (Agenda & Kegiatan)
- `sitemap-donasi.xml` (Campaign Donasi)
- `sitemap-pesantren.xml` (Direktori Pesantren)
- `sitemap-usaha.xml` (Direktori Usaha Anggota)

### 4.2. Strategi B: Yoast SEO Migration Sitemap (`/sitemap_index.xml`)
Merespons URL `sitemap_index.xml` (alias untuk Yoast SEO) dan memetakan sub-sitemap sesuai konvensi Yoast:
- `post-sitemap.xml` ➔ Dipetakan ke `posts`
- `page-sitemap.xml` ➔ Dipetakan ke `pages`
- `category-sitemap.xml` ➔ Dipetakan ke `post_categories`
- `product-sitemap.xml` ➔ Dipetakan ke `products`

### 4.3. Cache Header & Performa Engine
- Header Response: `Content-Type: application/xml; charset=utf-8`
- Cache-Control: `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`
- Query database dibatasi per 1.000 URL per file sitemap dengan penanganan pagination otomatis.

---

## 5. Perencanaan Matang Fase 6: Optimasi AI Crawler & Agent (LLM Friendly)

Sistem pencarian modern telah bergeser ke **AI Engine** (Google Gemini, ChatGPT, Claude, Perplexity). Jalakarta dirancang agar ramah terhadap pemindaian Robot AI.

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
   │     ├── Tab baru di `/app/{slug}/settings/seo` (Integrasi & Verification)
   │     ├── Kolom GTM Container ID + Verification Meta Tags di DB `settings`
   │     ├── Injection Script GTM & Meta Tag di `PublicLayout`
   │     └── Card Petunjuk Submisi Google Search Console
   │
   ├── ⬜ Fase 5: Engine Dual Sitemap Index (Native & Yoast Migration)
   │     ├── Route `/sitemap.xml` (Native Modular Index)
   │     ├── Route `/sitemap_index.xml` (Yoast Migration Index)
   │     └── Sub-sitemaps (posts, pages, categories, products, events, campaigns)
   │
   ├── ⬜ Fase 6: Optimasi AI Crawler & Agent (LLM Bot Friendly)
   │     ├── Config `robots.txt` dengan izin eksplisit bot AI (Gemini, ChatGPT, Claude)
   │     └── Endpoint `/{slug}/llms.txt` (Index Markdown murni)
   │
   └── ⬜ Fase 7: Engine Google Rich Sitelinks & Breadcrumbs
         ├── Structuring HTML `<header>` & `<nav>` di `PublicHeader`
         ├── JSON-LD `SiteNavigationElement` Generator
         ├── JSON-LD `BreadcrumbList` Generator Universal
         └── JSON-LD `WebSite` + `SearchAction` (Sitelinks Search Box)
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
