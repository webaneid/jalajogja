# Arsitektur Import & Export Post WordPress — Blueprint Perencanaan

> **Status Dokumen: 📋 RANCANGAN ARSITEKTUR & DESAIN SPESIFIKASI (2026-07-26)**
> **Tujuan**: Menjadi panduan teknis tunggal dan sumber kebenaran (*single source of truth*) dalam membangun modul Import/Export Post WordPress, kustomisasi Permalink/URL, kompatibilitas Yoast SEO, penanganan Timezone, serta migrasi Media & Editor pada platform Multi-Tenant **Jalakarta**.

---

## 1. Prinsip Utama & Latar Belakang

Banyak organisasi (PC IKPM Cabang, Forum Bisnis/Forbis, Marhalah/Angkatan, Pesantren) yang berpindah ke platform **Jalakarta** memiliki website berbasis **WordPress** (situs lama) dengan ratusan hingga ribuan artikel/berita yang sudah terindeks di mesin pencari (Google).

**Tiga Mandat Sistem yang Ditetapkan:**
1. **Zero Data Loss & Easy Migration**: Seluruh artikel, kategori, tag, featured image, serta metadata SEO dari WordPress lama harus bisa dipindahkan ke Jalakarta tanpa kehilangan riwayat dan kualitas SEO.
2. **Bebas Vendor Lock-In (Dua Arah)**: Admin tidak hanya bisa *import* dari WordPress, tetapi juga bisa *export* seluruh data website Jalakarta ke format standar WordPress (WXR XML) kapan saja.
3. **Pilihan URL SEO-Friendly Flexibel**: Mendukung kustomisasi struktur Permalink (termasuk gaya WordPress `/%postname%/` atau `/post/%postname%/`) secara aman tanpa mengganggu sistem rute bawaan platform (*Reserved System Routes*).

---

## 2. Fitur Import & Export (XML WXR & REST API WordPress)

```
                       ┌──────────────────────────────────────────────┐
                       │               WORDPRESS LAMA                 │
                       │ (XML WXR File  OR  REST API /wp-json/wp/v2)  │
                       └──────────────────────┬───────────────────────┘
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │          JALAKARTA IMPORT PIPELINE           │
                       │   (Batching, Sanitization, Media Worker)     │
                       └──────────────────────┬───────────────────────┘
                                              │
                                              ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                               DATABASE PUBLIC & TENANT                                 │
 │  ┌─────────────────┐   ┌──────────────────────┐   ┌────────────────┐   ┌────────────┐  │
 │  │  website_posts  │   │  website_categories  │   │  website_tags  │   │   media    │  │
 │  └─────────────────┘   └──────────────────────┘   └────────────────┘   └────────────┘  │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Metode Import 1: Upload File XML (WordPress WXR Format)

WordPress memiliki format ekspor standar beresktensi `.xml` bernama **WXR (WordPress eXtended RSS)**.

* **Struktur XML Parser (`fast-xml-parser`)**:
  * Root tag: `<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.0/">`
  * Item tag: `<item>`
  * Tipe Konten Filter: `<wp:post_type>post</wp:post_type>` (hanya ambil tipe `post` dan `page`, abaikan `attachment`, `nav_menu_item`, dll).
  * Status Filter: `<wp:status>` (`publish` → `published`, `draft` → `draft`, `trash`/`private` → `archived`).
* **Ekstraksi Data Per Item:**
  * **Judul**: `<title>`
  * **Slug**: `<wp:post_name>`
  * **Konten**: `<content:encoded>` (CData HTML / Gutenberg content)
  * **Ringkasan (Excerpt)**: `<excerpt:encoded>`
  * **Tanggal Publish**: `<wp:post_date_gmt>` (UTC) atau `<wp:post_date>` (Local)
  * **Taksonomi**: `<category domain="category" nicename="slug">Name</category>` dan `<category domain="post_tag" nicename="slug">Name</category>`
  * **Featured Image ID**: Dipetik dari `<wp:postmeta>` di mana `<wp:meta_key>_thumbnail_id</wp:meta_key>`, yang kemudian mencocokkan ke `<item>` ber-`<wp:post_type>attachment</wp:post_type>` untuk mendapatkan URL gambar asli (`<wp:attachment_url>`).
  * **Yoast SEO Meta**: Dipetik dari `<wp:postmeta>` dengan meta key `_yoast_wpseo_*`.

### 2.2. Metode Import 2: Pull via WordPress REST API (`/wp-json/wp/v2/`)

Import langsung melalui jaringan HTTP tanpa perlu unduh file XML secara manual. Admin hanya memasukkan URL domain situs WordPress lama.

* **Endpoints yang Dipanggil:**
  1. `/wp-json/wp/v2/posts?per_page=100&page=1&_embed=1` (Artikel + Media + Authors + Terms)
  2. `/wp-json/wp/v2/categories?per_page=100` (Daftar Kategori)
  3. `/wp-json/wp/v2/tags?per_page=100` (Daftar Tag)
* **Keunggulan `_embed=1`:**
  Setiap item post langsung menyertakan objek `_embedded['wp:featuredmedia']` (URL featured image) dan `_embedded['wp:term']` (kategori & tag), memangkas jumlah request HTTP hingga 80%.
* **Auto-Pagination**:
  Membaca header respons HTTP `X-WP-Total` (total artikel) dan `X-WP-TotalPages` (total halaman). Loop asynchronous memproses batch per 100 artikel.

### 2.3. Ekspor Data Jalakarta ke WordPress (WXR XML Generator)

Agar tenant tidak merasa terkunci (*vendor lock-in*), Jalakarta menyediakan tombol **Export ke WordPress WXR XML** di `/{slug}/website/posts`.
* Mengambil data dari `website_posts`, `website_categories`, `website_tags`, dan `media`.
* Menyusun string XML berformat standar RSS 2.0 / WXR 1.2 yang dapat langsung di-import di situs WordPress mana pun via **Tools -> Import -> WordPress**.

---

## 3. Analisa Gap & Potensi Konflik Beserta Solusinya

| Potensi Konflik / Gap | Solusi Arsitektural Jalakarta |
|---|---|
| **1. Memory Exhaustion / Timeout**<br>File XML besar (50MB+, 10.000 artikel). | Menggunakan **Background Job Batching Pattern** (tabel `import_batches` & `import_batch_rows`, sama seperti Importer Anggota). File di-chunk per 200 baris. |
| **2. Broken Remote Image Link**<br>Gambar di server WordPress lama mati/404. | Pekerja latar belakang (MinIO Asset Downloader) mengecek HTTP status gambar. Jika 404/error, set `coverId = null` dan catat warning di log import tanpa menggagalkan import teks artikel. |
| **3. Duplikat Post (Re-import)**<br>Admin meng-upload file XML yang sama 2 kali. | Unique constraint pada `posts.slug` per tenant. Jika slug sudah ada di database tenant:<br>- *Mode Skip*: Abaikan artikel duplikat.<br>- *Mode Update*: Perbarui konten & SEO metadata artikel. |
| **4. Duplikat Kategori & Tag**<br>Kategori `"Kegiatan"` sudah ada di Jalakarta. | Pencocokan otomatis (*Upsert by slug/name*). Jika kategori/tag dengan slug yang sama sudah ada, gunakan ID yang sudah ada daripada membuat kategori duplikat. |
| **5. Partial Failure / Disconnected Network**<br>Koneksi terputus di tengah jalan saat download media. | Setiap baris di `import_batch_rows` menyimpan status `pending`, `success`, atau `failed`. Admin dapat menekan tombol **"Resume Import"** untuk melanjutkan baris yang pending/failed. |

---

## 4. Arsitektur SEO: Pemetaan Yoast SEO ke Jalakarta

Jalakarta telah memiliki skema database SEO yang kaya di tabel `website_posts` & `website_pages`. Metadata dari plugin **Yoast SEO** di WordPress dipetakan secara presisi 1-to-1 ke kolom database Jalakarta.

### 4.1. Tabel Pemetaan Metadata SEO (Yoast Meta Key ➔ Jalakarta Schema)

| Meta Key Yoast SEO (WP) | Kolom Database Jalakarta | Penanganan & Normalisasi |
|---|---|---|
| `_yoast_wpseo_title` | `posts.metaTitle` | Mengganti variabel WP (seperti `%%title%%`, `%%sitename%%`) dengan nilai asli. |
| `_yoast_wpseo_metadesc` | `posts.metaDesc` | Teks murni meta description (maks 160 karakter). |
| `_yoast_wpseo_focuskw` | `posts.focusKeyword` | Kata kunci utama artikel. |
| `_yoast_wpseo_opengraph-title` | `posts.ogTitle` | Judul saat dibagikan ke Media Sosial / WhatsApp. |
| `_yoast_wpseo_opengraph-description` | `posts.ogDescription` | Deskripsi saat dibagikan ke Media Sosial / WhatsApp. |
| `_yoast_wpseo_opengraph-image` | `posts.ogImageId` | URL di-download ke MinIO Storage ➔ disimpan sebagai `media.id`. |
| `_yoast_wpseo_canonical` | `posts.canonicalUrl` | URL kanonisasi asli. |
| `_yoast_wpseo_meta-robots-noindex` | `posts.robots` | Jika `1` ➔ set `"noindex"`, jika `0`/kosong ➔ `"index,follow"`. |
| `_yoast_wpseo_meta-robots-nofollow` | `posts.robots` | Jika `1` ➔ set `"noindex,nofollow"`. |
| `_yoast_wpseo_schema_article_type` | `posts.schemaType` | Dipetakan ke `"Article"`, `"NewsArticle"`, atau `"BlogPosting"`. |

### 4.2. XML Sitemap & Robots.txt Dinamis di Jalakarta

* **Dynamic XML Sitemap (`/{slug}/sitemap.xml`)**:
  * Mengompres dan mempublikasikan sitemap XML otomatis yang menggabungkan:
    * Posts yang ber-status `published` dan `robots != 'noindex'`.
    * Pages yang ber-status `published` dan `robots != 'noindex'`.
    * Kategori post & Produk toko.
* **Dynamic Robots.txt (`/{slug}/robots.txt`)**:
  * Mengarahkan Googlebot ke URL sitemap resmi tenant: `Sitemap: https://{domain}/sitemap.xml`.

---

## 5. Perencanaan Custom URL / Permalink Structure di Website Settings

Untuk mengakomodasi fleksibilitas WordPress, admin tenant dapat memilih struktur URL postingan di Halaman **Website Settings** (`/{slug}/website/pengaturan`).

### 5.1. Opsi Permalinks yang Disediakan (`settings` key: `website_permalink_structure`)

1. **`default` (Aman & Ringkas - Bawaan Jalakarta)**:
   * Pattern: `/{tenant}/post/{postSlug}`
   * Contoh: `jalakarta.com/ikpm-jogja/post/berita-silaturahmi`
2. **`post_name` (Mirip WordPress `/%postname%/`)**:
   * Pattern: `/{tenant}/{postSlug}`
   * Contoh: `jalakarta.com/ikpm-jogja/berita-silaturahmi`
3. **`date_name` (Mirip WordPress `/%year%/%monthnum%/%postname%/`)**:
   * Pattern: `/{tenant}/{year}/{month}/{postSlug}`
   * Contoh: `jalakarta.com/ikpm-jogja/2026/07/berita-silaturahmi`
4. **`category_name` (Kategori & Judul)**:
   * Pattern: `/{tenant}/post/{categorySlug}/{postSlug}`
   * Contoh: `jalakarta.com/ikpm-jogja/post/kegiatan/berita-silaturahmi`

### 5.2. Interaksi dengan Multi-Tenant Domain Routing (Fase 1 - Fase 3)

Sesuai spesifikasi `docs/arsitektur-domain.md`, routing URL berlaku di semua fase domain:
* **Fase 1 (Path-based)**: `jalakarta.com/{tenant}/{permalink}`
* **Fase 2 (Subdomain)**: `{tenant}.jalakarta.id/{permalink}`
* **Fase 3 (Custom Domain)**: `ikpmjogja.com/{permalink}`

### 5.3. Pencegahan Tabrakan Rute Sistem (Reserved System Routes & Catch-All Routing)

Jika tenant menggunakan opsi **`post_name` (`/{tenant}/{slug}`)**, slug postingan berpotensi bertabrakan dengan **Rute Statis Sistem** (seperti `toko`, `event`, `donasi`, `surat`, `akun`, `login`, `register`, `admin`, `api`).

#### Solusi 2-Lapis Pencegahan Tabrakan:

1. **Lapis 1 — Validasi Input Slug Admin (Blacklist Check)**:
   Saat admin membuat/meng-edit post atau page, sistem mencocokkan slug dengan daftar kata terlarang (`RESERVED_TENANT_SLUGS`):
   ```typescript
   export const RESERVED_TENANT_SLUGS = new Set([
     "toko", "produk", "event", "agenda", "donasi", "campaign", "surat",
     "letters", "members", "anggota", "akun", "login", "register", "admin",
     "dashboard", "api", "platform", "settings", "pengaturan", "keranjang",
     "transaksi", "pesantren", "usaha", "statistik", "sitemap.xml", "robots.txt"
   ]);
   ```
2. **Lapis 2 — Fallback Catch-All Matching di Next.js App Router**:
   Di Next.js, rute dinamis public `app/(public)/[tenant]/[...slug]/page.tsx` mengeksekusi pencarian dengan urutan prioritas ketat:
   ```
   1. Cek Rute Statis Sistem (Toko/Event/Donasi) ──► Render Modul Sistem
   2. Cek `website_pages` WHERE slug = {slug}   ──► Render Page Template
   3. Cek `website_posts` WHERE slug = {slug}   ──► Render Post Template
   4. Jika Semua Tidak Ditemukan                ──► Render 404 Page
   ```

---

## 6. Analisa Timezone & Penanganan Gap Waktu saat Import

### 6.1. Perbedaan Format Penyimpanan Waktu

| Sistem | Tipe Data & Format | Sifat Timezone |
|---|---|---|
| **WordPress DB** | `post_date` (`datetime`) | Local Server/WP Timezone (Tanpa timezone offset, misal `2026-07-26 14:30:00`) |
| **WordPress GMT** | `post_date_gmt` (`datetime`) | UTC Timezone (`2026-07-26 07:30:00`) |
| **Jalakarta DB** | `timestamp with time zone` (`timestamptz`) | Disimpan murni sebagai **UTC ISO 8601** (`2026-07-26T07:30:00.000Z`) |

### 6.2. Potensi Bug / Gap Waktu & Solusinya

* **Kasus 1: `post_date_gmt` bernilai `0000-00-00 00:00:00`**
  * *Penyebab*: Database WordPress tua atau post draft sering kali memiliki nilai GMT nol/invalid.
  * *Solusi*: Jika `post_date_gmt` invalid, ambil `post_date` lokal WP lalu konversikan ke UTC menggunakan offset Timezone Tenant (`settings.timezone`, default `"Asia/Jakarta"` / UTC+7).
* **Kasus 2: Pergeseran Jam Publikasi di Frontend (+7 Jam / -7 Jam)**
  * *Penyebab*: String tanggal lokal tanpa timezone offset dianggap sebagai UTC oleh JavaScript `new Date()`.
  * *Solusi*: Gunakan parser `dayjs.tz(dateString, tenantTimezone).toDate()` untuk memastikan tanggal publish pas dengan jam lokal Indonesia saat artikel pertama kali dibuat di WordPress.

---

## 7. Migrasi Featured Image & Sanitasi Editor (HTML ➔ Tiptap)

### 7.1. Migrasi Featured Image (Cover Artikel)

1. **MinIO Asset Downloader Worker**:
   * Ambil URL gambar eksternal dari WordPress (misal `https://wp-lama.com/wp-content/uploads/2024/05/foto.jpg`).
   * Unduh gambar via HTTP stream di background job.
   * Upload gambar ke **MinIO Self-Hosted Storage** Jalakarta di folder `/website/posts/imported/`.
   * Buat record baru di tabel `public.media` (UUID) dan set `posts.coverId = media.id`.
2. **Fallback Gambar Rusak (404 / Server Lama Mati)**:
   * Jika gambar lama 404 atau koneksi terputus, `coverId` di-set `null`. Artikel tetap berhasil di-import tanpa menggagalkan proses.

### 7.2. Sanitasi & Konversi Konten Editor (WordPress HTML ➔ Jalakarta Tiptap)

Konten WordPress lama mengandung tag-tag khusus, shortcode, dan markup Gutenberg yang harus dibersihkan sebelum masuk ke Editor Tiptap Jalakarta.

* **Pembersihan Markup Gutenberg Block Comment**:
  * Menghapus comment HTML bawaan WordPress seperti `<!-- wp:paragraph -->` dan `<!-- /wp:paragraph -->` menggunakan regex sanitization.
* **Pembersihan Shortcode WordPress**:
  * Shortcode seperti `[caption id="..." align="aligncenter" width="600"]...[/caption]` atau `[gallery ids="1,2,3"]` dikonversi menjadi tag HTML standar `<figure>` / `<img>` atau dibersihkan.
* **Sanitasi HTML (DOMPurify / Cheerio)**:
  * Menghapus script berbahaya (`<script>`), iframe tidak terdaftar, dan inline style yang merusak tata letak Tailwind CSS Jalakarta.
* **Inline Image Download Option**:
  * Mengingat gambar di dalam paragraf artikel (`<img src="...">`) bisa mati jika server WordPress lama ditutup, importer menyediakan opsional **"Download Inline Images to Local Storage"** yang mengunduh semua gambar dalam isi artikel ke MinIO Jalakarta dan meng-update URL `src`-nya secara otomatis.

---

## 8. Ringkasan Rencana Pelaksanaan (Roadmap Pengembangan)

1. **Fase 1 — Core Importer Engine**:
   * Pembuatan parser WXR XML (`lib/wordpress-xml-parser.ts`) dan REST API fetcher (`lib/wordpress-api-fetcher.ts`).
   * Pembuatan UI Import di `/{slug}/website/import-wordpress`.
2. **Fase 2 — Asset & Image Downloader**:
   * Integration worker pendownload gambar dari WP ke MinIO Storage (`media` table).
3. **Fase 3 — Custom Permalink Settings**:
   * Penambahan opsi Permalink di Website Settings dan integrasi Catch-All Routing di public layer.
4. **Fase 4 — WXR Exporter**:
   * Penambahan fitur unduh ekspor XML standar WordPress WXR di `/{slug}/website/posts`.

---

> **Dokumen ini dibuat tanpa melakukan perubahan kode sumber (sesuai instruksi). Dokumen ini menjadi acuan resmi sebelum implementasi teknis dimulai.**
