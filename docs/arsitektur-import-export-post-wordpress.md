# Arsitektur Import & Export Post WordPress — Blueprint Perencanaan

> **Status Dokumen: 🟢 FASE 0 SELESAI 100% — FASE 1 SELESAI 100% — FASE 2 SELESAI 100% — FASE 3
> SELESAI 100% (WXR Exporter, dikerjakan+diverifikasi 2026-07-28, lihat § 8 poin Fase 3) —
> kecuali verifikasi visual browser sungguhan (tombol download) dan import-balik ke WordPress
> sungguhan yang belum dilakukan siapa pun**
> (ditulis 2026-07-26, DIKOREKSI+DILENGKAPI 2026-07-27 dalam 5 putaran audit murni dokumentasi,
> § 16 Fase 0 dieksekusi 2026-07-27, Fase 1 dimulai 2026-07-27 — urutan disepakati eksplisit
> dengan user: skema DB dulu, baru parser, baru UI. Parser WXR + REST fetcher selesai+teruji
> data real 2026-07-27. Mapping penulis + parse-simpan-draft actions SELESAI 2026-07-27.
> `commitImportChunkAction` — orchestrator paling berat (unduh gambar, `processImage()`, rewrite
> `data-media-id`, `generateJSON()`, insert posts/pages/media+legacy_url_redirects) — SELESAI
> 2026-07-27, diverifikasi lewat dua putaran tes end-to-end terhadap data real termasuk uji
> error-resilience (satu baris gagal tidak merusak baris lain dalam chunk). `archiveImportBatchAction`
> (soft bulk-archive, § 14.1) — SELESAI 2026-07-27, diverifikasi genuine parse→commit→archive
> end-to-end termasuk guard status, idempotency, dan konfirmasi `post_authors`/`media` tidak
> tersentuh. **UI** (`/{slug}/website/import-wordpress`) — SELESAI 2026-07-27, 4-view
> input→preview→committing→report, ditemukan+difix gap `review_needed` stuck permanen SAAT
> membangun UI (sebelum ditulis, bukan sesudah). **Fase 1 selesai 100%** — lihat § 8 poin Fase 1.
> **Fase 2 (dikerjakan 2026-07-27/28, dipecah 10 sub-fase 2.0–2.9)**: helper inti
> `lib/post-permalink.server.ts` (5 mode permalink) → 9 query-builder site ditambah `href` →
> ~12 consumer render site di-swap ke `post.href` (termasuk propagasi `baseUrl` lintas
> `PostsSection`→Design1-5→`PostCard` yang ternyata JAUH lebih luas dari estimasi awal) →
> `post/[slug]/page.tsx` (567 baris) diekstrak jadi `components/website/public/single/
> post-detail-view.tsx` (shared renderer, dipanggil 3 route berbeda) → `[pageSlug]/page.tsx`
> DIGANTI TOTAL jadi catch-all `[...slug]/page.tsx` (6-prioritas resolusi + legacy redirect
> 308 + notFound) → route nested BARU `post/[slug]/[postSlug]/page.tsx` untuk mode
> `category_name` (folder WAJIB bernama `[slug]/[postSlug]`, BUKAN `[category]/[slug]` — Next.js
> mewajibkan nama dynamic segment sama di kedalaman sama untuk sibling route, ditemukan via
> `next dev` yang menangkap conflict ini padahal `next build` biasa TIDAK) → validasi slug
> (`RESERVED_POST_SLUGS` 25 folder statis real + cross-collision post↔page, HANYA aktif saat
> permalink="post_name") → `commitOneRow` (WordPress import, Fase 1) dijadikan permalink-aware
> (sebelumnya hardcode `/post/{slug}`) → settings UI dropdown 5 opsi di `/website/pengaturan`.
> **Setiap sub-fase diverifikasi empiris** (bukan cuma `tsc`) — build produksi genuine setelah
> tiap perubahan routing, curl end-to-end untuk semua 5 mode permalink + legacy redirect (308 +
> Location header benar) + reserved-slug rejection (5 skenario via disposable script terhadap
> DB lokal nyata) + regresi sweep 12+ tipe rute publik lain (semua tetap 200, nol collateral
> damage dari catch-all baru). Detail lengkap tiap sub-fase: § 8 poin Fase 2.)
> **Tujuan**: Menjadi panduan teknis tunggal dan sumber kebenaran (*single source of truth*) dalam membangun modul Import/Export Post WordPress, kustomisasi Permalink/URL, kompatibilitas SEO (Yoast dan plugin lain), penanganan Timezone, serta migrasi Media & Editor pada platform Multi-Tenant **Jalakarta**.
>
> **⚠️ HASIL AUDIT 5 PUTARAN 2026-07-27**: Putaran 1-2 menemukan **11 temuan** (3 KRITIS: format
> konten harus Tiptap JSON bukan HTML; sistem Penulis/Editor tidak disebut; tidak ada preservasi
> URL lama/redirect 301) — semua dikoreksi inline + ringkasan **§ 9**. Putaran 3 menemukan **6
> pertanyaan baru** (SSRF, XXE, dependency belum ada, model eksekusi/timeout, rollback, scope
> Pages) — didaftar di **§ 10**. Putaran 4 (LENGKAP — semua 6 pertanyaan sekarang punya resolusi
> konkret, bukan cuma dicatat sebagai open question): **§ 11** (mitigasi SSRF), **§ 12**
> (mitigasi XXE + dependency baru), **§ 13** (model eksekusi chunked-commit, tanpa infra job
> baru), **§ 14** (rollback soft-archive + scope Pages diputuskan + DDL final
> `content_import_batches`). **Putaran 5 — verifikasi terhadap DATA REAL** (DUA file WXR export
> + REST API live, semuanya dari `forbis.id`, tenant Forum Bisnis IKPM Gontor yang JADI target
> migrasi sungguhan fitur ini) — **§ 15** (baru, § 15.1-15.2 sample pertama+REST, § 15.3 sample
> WXR kedua dengan block lebih variatif): 3 temuan KRITIS mengubah keputusan konkret — (1) REST
> API TIDAK menyediakan data SEO Yoast sama sekali, WXR jadi satu-satunya sumber SEO andal; (2)
> permalink struktur real situs (`/{kategori}/{tahun}/{bulan}/{slug}/`) tidak match 4 opsi § 5.1,
> ditambah opsi ke-5 `category_date_name`; (3) konversi gambar inline (§ 7.2) WAJIB langkah
> rewrite `data-media-id` sebelum `generateJSON()`, kalau tidak `MediaImage.mediaId` seluruh
> gambar hasil import `null` permanen. Plus beberapa koreksi/temuan lain (versi namespace WXR
> real 1.2 bukan 1.0, `_embedded.author` REST API bisa 404, galeri WordPress pecah jadi image
> individual — degradasi MVP yang diterima, dsb).
>
> **✅ FASE 0 DIEKSEKUSI PENUH 2026-07-27 (§ 16) — SEMUA 3 risiko teknis terbukti AMAN**:
> POC konversi `generateJSON()` (`@tiptap/html/server` + `happy-dom`, BUKAN `linkedom`) TERBUKTI
> bekerja server-side dengan extension custom project ini terhadap konten Gutenberg REAL, tanpa
> crash, round-trip lewat `renderBody()` ASLI sukses — risiko teknis TERBESAR di seluruh rencana
> ini SEKARANG TERBUKTI, bukan lagi asumsi. Test XXE terhadap `fast-xml-parser@5.10.1` juga
> LOLOS (parser menolak eksplisit, bukan cuma inert). Dependency final: `@tiptap/html@3.22.3`
> (PINNED, bukan `latest` — peer-dep mismatch dengan `@tiptap/core` terpasang), `happy-dom`,
> `fast-xml-parser` — ketiganya SUDAH terpasang di `apps/web/package.json` (sempat salah taruh
> di root, sudah diperbaiki). **Modul SSRF `lib/wordpress-import-security.ts` (§ 16.6) SEKARANG
> DIBANGUN PERMANEN** (bukan cuma POC) — `assertSafeExternalUrl()` + `safeFetch()`, diuji 33
> kasus nyata (DNS resolve sungguhan, redirect sungguhan via `httpbin.org`), 2 bug NYATA
> ditemukan+difix saat implementasi (bracket IPv6 tidak dilucuti sebelum DNS lookup; deteksi
> IPv4-mapped berbasis string gagal karena `URL` menormalisasi notasi). **Fase 0 sekarang 100%
> selesai.** Fase 1 (fitur sungguhan) BELUM dimulai, menunggu instruksi eksplisit.

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
 │  ┌───────┐  ┌─────────────────┐  ┌─────────────┐  ┌───────┐  ┌──────────────┐          │
 │  │ posts │  │ post_categories │  │ post_tags   │  │ media │  │ post_authors │          │
 │  └───────┘  └─────────────────┘  └─────────────┘  └───────┘  └──────────────┘          │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

> ⚠️ **Koreksi nama tabel (2026-07-27)**: nama tabel Drizzle ASLI adalah `posts`,
> `post_categories`, `post_tags`, `media` (tanpa prefix `website_` — dikonfirmasi ke
> `packages/db/src/schema/tenant/website.ts`, tidak ada satu pun literal `"website_..."` di kode
> nyata). Seluruh referensi `website_posts`/`website_categories`/`website_tags`/`website_pages`
> di dokumen ini WAJIB dibaca sebagai `posts`/`post_categories`/`post_tags`/`pages`.
> **`post_authors` ditambahkan ke diagram** — tabel BARU (selesai dibangun 2026-07-26,
> `docs/arsitektur-penulis-post.md`) yang TIDAK ADA sama sekali di draf awal dokumen ini,
> padahal krusial untuk mapping "Penulis WordPress" (§ 2.4, baru).

### 2.1. Metode Import 1: Upload File XML (WordPress WXR Format)

WordPress memiliki format ekspor standar beresktensi `.xml` bernama **WXR (WordPress eXtended RSS)**.

> ⚠️ **DIKOREKSI dari sample file real (§ 15.1)**: versi namespace WXR sungguhan yang dikirim
> user (`forbis.id`, 2026-07-27) adalah **`http://wordpress.org/export/1.2/`** dengan
> `<wp:wxr_version>1.2</wp:wxr_version>` — BUKAN `1.0` seperti draf pertama tulis. Root-element
> check (§ 12.1) HARUS **version-tolerant** (cek prefix `http://wordpress.org/export/` +
> `xmlns:wp` hadir, bukan cocokkan versi persis) — hardcode `1.0` akan menolak file WXR modern
> manapun (WordPress ekspor WXR 1.2 sejak versi lama, ini bukan kasus langka).

* **Struktur XML Parser (`fast-xml-parser`)**:
  * Root tag: `<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">` (versi bisa 1.0/
    1.1/1.2 tergantung umur situs sumber — validasi hanya prefix namespace, jangan cocokkan versi
    persis).
  * Item tag: `<item>`
  * Tipe Konten Filter: `<wp:post_type>post</wp:post_type>` (hanya ambil tipe `post` dan `page`, abaikan `attachment`, `nav_menu_item`, dll).
  * Status Filter: `<wp:status>` (`publish` → `published`, `draft` → `draft`, `trash`/`private` → `archived`).
* **Ekstraksi Data Per Item:**
  * **Judul**: `<title>`
  * **Slug**: `<wp:post_name>`
  * **Konten**: `<content:encoded>` (CData HTML / Gutenberg content — dikonfirmasi dari sample
    real: comment block `<!-- wp:paragraph -->`/`<!-- /wp:paragraph -->`, `<!-- wp:list
    {"ordered":true} -->`, dst, PERSIS pola yang diasumsikan § 7.2 Tahap A).
  * **Ringkasan (Excerpt)**: `<excerpt:encoded>`
  * **Tanggal Publish**: `<wp:post_date_gmt>` (UTC) atau `<wp:post_date>` (Local)
  * **Taksonomi**: `<category domain="category" nicename="slug">Name</category>` dan `<category domain="post_tag" nicename="slug">Name</category>`
  * **Penulis (username saja)**: `<dc:creator>` per `<item>` — dikonfirmasi dari sample real,
    ISI-nya cuma username (`forbisid`), bukan nama tampilan (§ 2.4).
  * **Featured Image ID**: Dipetik dari `<wp:postmeta>` di mana `<wp:meta_key>_thumbnail_id</wp:meta_key>`, yang kemudian mencocokkan ke `<item>` ber-`<wp:post_type>attachment</wp:post_type>` untuk mendapatkan URL gambar asli (`<wp:attachment_url>`).
    > ⚠️ **Dikonfirmasi WAJIB pakai `_thumbnail_id` cross-reference, BUKAN `wp:post_parent`**:
    > sample real menunjukkan `<item>` attachment (featured image post A) punya
    > `<wp:post_parent>` yang menunjuk ID post LAIN (bukan post A) — `post_parent` TIDAK BISA
    > diandalkan untuk pencocokan featured image, cuma `_thumbnail_id` (postmeta di item
    > post) ↔ `wp:post_id` (item attachment) yang benar. Implikasi arsitektur parser: **file
    > HARUS di-parse dua tahap** — Tahap 1, index SEMUA item attachment ke `Map<wp_post_id,
    > attachmentUrl>` di memori dulu; Tahap 2, baru proses item post/page dan lookup
    > `_thumbnail_id`-nya ke index itu. Bukan streaming satu-lintasan per item.
    > Gambar hasil `<wp:attachment_url>` di sample real ADALAH URL CDN pihak ketiga
    > (`cdn.webane.net`, pola umum plugin offload-media seperti WP Stateless/Google Cloud
    > Storage) — BUKAN domain situs itu sendiri. `assertSafeExternalUrl()` (§ 11) harus
    > domain-agnostic (evaluasi IP hasil resolve DNS, bukan whitelist domain) — sudah didesain
    > begitu, dikonfirmasi cocok dengan kasus nyata ini.
  * **Yoast SEO Meta**: Dipetik dari `<wp:postmeta>` dengan meta key `_yoast_wpseo_*` — lihat
    § 15.1 untuk daftar key yang dikonfirmasi ADA di sample real (dan yang TIDAK selalu ada,
    yang berarti "pakai default", bukan error).

### 2.2. Metode Import 2: Pull via WordPress REST API (`/wp-json/wp/v2/`)

Import langsung melalui jaringan HTTP tanpa perlu unduh file XML secara manual. Admin hanya memasukkan URL domain situs WordPress lama.

> ⚠️ **TEMUAN KRITIS dari verifikasi live (§ 15.2)**: `_embed=1` REST API **TIDAK menyertakan
> data SEO Yoast sama sekali** (dikonfirmasi fetch langsung ke `forbis.id/wp-json/wp/v2/posts` —
> nol field `yoast_head_json` atau meta SEO apa pun di respons). Ini berarti **metode REST API
> pull TIDAK BISA dipakai untuk migrasi yang butuh SEO lengkap** — hanya WXR upload (§ 2.1) yang
> menyertakan seluruh `<wp:postmeta>` (termasuk `_yoast_wpseo_*`) apa adanya. Reposisi metode:
> **WXR upload = metode utama/direkomendasikan untuk migrasi SEO-lengkap**; REST API pull =
> alternatif ringan "cepat, konten saja, tanpa jaminan SEO ikut" — harus dikomunikasikan
> eksplisit ke admin di UI (badge/peringatan) saat metode ini dipilih, bukan diam-diam.

* **Endpoints yang Dipanggil:**
  1. `/wp-json/wp/v2/posts?per_page=100&page=1&_embed=1` (Artikel + Media + Authors + Terms)
  2. `/wp-json/wp/v2/categories?per_page=100` (Daftar Kategori)
  3. `/wp-json/wp/v2/tags?per_page=100` (Daftar Tag)
* **Keunggulan `_embed=1`:**
  Setiap item post langsung menyertakan objek `_embedded['wp:featuredmedia']` (URL featured image)
  dan `_embedded['wp:term']` (kategori & tag, dikonfirmasi struktur lengkap: name/slug/link/
  taxonomy — bukan cuma array ID `categories`/`tags` polos), memangkas jumlah request HTTP
  hingga 80%.
  > ⚠️ **`_embedded['author']` TIDAK SELALU tersedia** — dikonfirmasi live: pada `forbis.id`,
  > embed author mengembalikan **error 404** (`rest_user_invalid_id`) — perilaku umum WordPress
  > saat REST User endpoint tidak publik (default untuk banyak konfigurasi keamanan/plugin
  > hardening). Desain § 2.4 yang mengasumsikan `_embedded['author'][0].name` SELALU ada perlu
  > fallback — lihat revisi § 2.4 di bawah.
* **Auto-Pagination**:
  Membaca header respons HTTP `X-WP-Total` (total artikel) dan `X-WP-TotalPages` (total halaman). Loop asynchronous memproses batch per 100 artikel.

### 2.3. Ekspor Data Jalakarta ke WordPress (WXR XML Generator)

Agar tenant tidak merasa terkunci (*vendor lock-in*), Jalakarta menyediakan tombol **Export ke WordPress WXR XML** di `/{slug}/website/posts`.
* Mengambil data dari `posts`, `post_categories`, `post_tags`, `post_authors`, dan `media`.
* Menyusun string XML berformat standar RSS 2.0 / WXR 1.2 yang dapat langsung di-import di situs WordPress mana pun via **Tools -> Import -> WordPress**.
* `<dc:creator>` di-isi dari `post_authors.name` (byline yang di-resolve, § 2.4) — BUKAN dari
  `posts.authorId` (internal, tidak relevan untuk konsumsi eksternal).

### 2.4. Mapping Penulis WordPress ➔ `post_authors` Jalakarta (BARU — Wajib, Sebelumnya Tidak Disebut Sama Sekali)

> **Ini gap paling signifikan di draf pertama dokumen ini**: sistem byline Penulis/Editor
> (`docs/arsitektur-penulis-post.md`, selesai dibangun 2026-07-26, SEBELUM audit dokumen ini)
> sama sekali tidak disinggung. Tanpa mapping ini, importer akan bingung mengisi kolom mana —
> atau lebih buruk, salah menimpa `posts.authorId` (yang seharusnya immutable, selalu berarti
> "admin yang menjalankan proses import ini", BUKAN penulis asli artikel dari WordPress).

**Prinsip yang WAJIB diikuti (lihat `docs/arsitektur-penulis-post.md` § 3 untuk detail penuh)**:
```
posts.authorId         → SELALU admin yang menjalankan import (access.tenantUser.id).
                          TIDAK PERNAH diisi dari data WordPress. Field ini murni audit trail
                          internal "siapa yang membuat baris ini di sistem kita", persis sama
                          seperti createPostDraftAction/createPostAction yang sudah ada.
posts.displayAuthorId  → hasil find-or-create post_authors dari penulis ASLI WordPress
                          (memberId = null, karena penulis WP hampir pasti bukan anggota IKPM
                          yang sudah punya profil di sistem kita).
posts.editorId         → SELALU dibiarkan NULL. WordPress tidak punya konsep "Editor" yang
                          setara secara standar via WXR maupun REST API (tidak ada field WXR/
                          REST resmi untuk ini) — keputusan sadar untuk tidak memaksakan mapping
                          yang tidak ada datanya, konsisten dengan keputusan serupa di
                          `docs/arsitektur-seo.md` § 6b.4 (Editor sengaja tidak masuk JSON-LD).
```

**Sumber data penulis per metode import:**
| Metode | Sumber Nama Penulis | Sumber Bio (opsional) | Sumber Foto (opsional) |
|---|---|---|---|
| WXR XML | `<dc:creator>{username}</dc:creator>` per `<item>` — WXR **hanya** kasih *username*, bukan nama tampilan lengkap. Perlu dicari juga tag `<wp:author><wp:author_login>`/`<wp:author_display_name>` di root file (WordPress menulis daftar penulis lengkap sekali di awal XML, terpisah dari tiap `<item>`) untuk resolve *display name* asli. | Tidak tersedia via WXR standar — biarkan kosong. | Tidak tersedia via WXR standar — biarkan kosong (fallback Gravatar dari email TIDAK bisa dipakai karena WXR juga tidak menyertakan email penulis). |
| REST API | `_embedded['author'][0].name` (sudah nama tampilan lengkap, bukan username — lebih baik dari WXR, KALAU tersedia). | `_embedded['author'][0].description` (field REST API user, sering kosong tapi tersedia kalau diisi admin WP). | `_embedded['author'][0].avatar_urls['96']` (WordPress selalu generate URL Gravatar bawaan, bahkan kalau user tidak upload foto — perlu dicek apakah ini "Gravatar mystery-person default" generik atau foto asli sebelum dipakai, supaya tidak mengimpor avatar placeholder sebagai foto sungguhan). |

> ⚠️ **Fallback WAJIB untuk REST API — `_embedded['author']` bisa gagal/404 (dikonfirmasi
> real case, § 2.2)**: kalau `_embedded['author']` tidak ada atau error, importer TIDAK PUNYA
> nama penulis sama sekali dari sumbernya (field `author` di object post cuma angka ID numerik
> WordPress, tidak berguna sebagai nama tampilan). Desain fallback dua-lapis:
> 1. **Input batch-level di UI review** (direkomendasikan) — admin diminta pilih/ketik SATU nama
>    penulis default untuk SELURUH batch REST-pull ini sebelum commit (mis. "Admin {nama
>    tenant}") — dipakai sebagai `displayAuthorId` untuk semua baris yang tidak resolve penulis
>    dari embed.
> 2. **Kalau admin skip pengisian itu juga** — `displayAuthorId` dibiarkan `null` untuk baris
>    tersebut, byline publik jatuh ke fallback default sistem yang sudah ada
>    (`docs/arsitektur-penulis-post.md` § 4 — tampilkan "Tim Redaksi" atau setara), BUKAN error
>    yang menggagalkan baris.
> Perilaku ini HANYA relevan untuk metode REST API — metode WXR (§ 2.1) selalu punya
> `<wp:author>` di level channel yang bisa di-resolve terlepas embed sukses/gagal (WXR bukan
> konsep "embed", datanya sudah menyatu di file).

**Find-or-create per-batch (WAJIB, cegah duplikat)** — pola SAMA PERSIS dengan
`syncAutoTenantMemberships`/`computeMemberMergeCandidate` di Importer Anggota (§ Prinsip 9):
satu artikel WordPress bisa jadi ratusan, tapi biasanya ditulis oleh segelintir penulis saja.
Kalau find-or-create dipanggil naif per-baris tanpa cache, penulis yang sama akan membuat
`post_authors` row BARU setiap kali (mirip bug duplikat yang pernah ditemukan+difix di Importer
Anggota untuk kasus serupa — lihat `docs/arsitektur-import-anggota.md` § 21). Solusi: `Map<string,
string>` (WP username/nama → `post_authors.id`) di-thread sepanjang loop parsing SATU file
import, dicek dulu sebelum panggil `createGuestPostAuthorAction()` — kalau nama itu sudah pernah
di-resolve dalam batch yang sama, pakai ID yang sudah ada, jangan create lagi. Action yang
di-reuse: `createGuestPostAuthorAction(slug, {name, bio, avatarUrl})` (SUDAH ADA,
`website/post-authors-actions.ts`) — TIDAK perlu action baru, importer cukup memanggilnya
dengan parameter yang di-resolve dari tabel di atas.

**Antar batch/upload berulang** (re-import file yang sama, atau lanjutan dari halaman lain)
— cek dulu apakah `post_authors` dengan nama yang PERSIS sama (tanpa `memberId`) sudah ada di
tenant ini dari import SEBELUMNYA, sebelum create baru — pola sama `findOrCreatePostAuthorFromMemberAction`
tapi key pencariannya `name` (bukan `memberId`, karena WP author tidak punya `memberId`).

---

## 3. Analisa Gap & Potensi Konflik Beserta Solusinya

| Potensi Konflik / Gap | Solusi Arsitektural Jalakarta |
|---|---|
| **1. Memory Exhaustion / Timeout**<br>File XML besar (50MB+, 10.000 artikel). | Menggunakan **Background Job Batching Pattern** — ⚠️ **DIKOREKSI**: BUKAN tabel `import_batches`/`import_batch_rows` yang sudah ada (itu skema PUBLIC yang spesifik untuk Importer Anggota — kolom `member_name`/`member_id` hardcode di `import_batch_rows`, tidak ada kolom diskriminator generik). Buat **tabel PARALEL** `content_import_batches`/`content_import_batch_rows` yang meniru POLA yang sama (draft-store, preview-then-commit, klaim atomic `UPDATE...WHERE status='draft' RETURNING id`) tapi kolomnya spesifik post (`post_title`, `wp_post_id`, dst — bukan `member_name`/`member_id`). Ini konsisten dengan instruksi "ikuti alur yang sudah stabil, beda source saja" — reuse POLA-nya, bukan tabel fisiknya (mengubah tabel member yang sudah stabil demi generalisasi berisiko tidak sepadan). File di-chunk per 200 baris. |
| **2. Broken Remote Image Link**<br>Gambar di server WordPress lama mati/404. | Pekerja latar belakang (MinIO Asset Downloader) mengecek HTTP status gambar. Jika 404/error, set `coverId = null` dan catat warning di log import tanpa menggagalkan import teks artikel. **Wajib lewat `processImage()` (`lib/image-processor.ts`) untuk gambar yang berhasil diunduh** — lihat § 7.1, TIDAK boleh insert baris `media` mentah tanpa variant Sharp. |
| **3. Duplikat Post (Re-import)**<br>Admin meng-upload file XML yang sama 2 kali. | Unique constraint pada `posts.slug` per tenant. Jika slug sudah ada di database tenant:<br>- *Mode Skip*: Abaikan artikel duplikat.<br>- *Mode Update*: Perbarui konten & SEO metadata artikel. |
| **4. Duplikat Kategori & Tag**<br>Kategori `"Kegiatan"` sudah ada di Jalakarta. | Pencocokan otomatis (*Upsert by slug/name*). Jika kategori/tag dengan slug yang sama sudah ada, gunakan ID yang sudah ada daripada membuat kategori duplikat. |
| **5. Partial Failure / Disconnected Network**<br>Koneksi terputus di tengah jalan saat download media. | Setiap baris di `content_import_batch_rows` menyimpan status — ⚠️ **DIKOREKSI**: pakai vokabuler status yang SUDAH established di `import_batch_rows` asli (`ready, review_needed, duplicate, error, inserted, skipped`), BUKAN istilah baru (`pending/success/failed`) yang diusulkan draf pertama — konsistensi penamaan lintas fitur import di project ini. Admin dapat menekan tombol **"Resume Import"** untuk melanjutkan baris yang belum `inserted`/`skipped`. |
| **6 (BARU). Format Konten SALAH ARAH — HTML vs Tiptap JSON (KRITIS, lihat § 7.2)** | `posts.content` WAJIB berisi **string JSON hasil serialize Tiptap editor state**, BUKAN HTML mentah (dikonfirmasi: `products.description` pakai pola sama, dan lesson `renderBody — prosemirror-model tidak server-safe`). Draf pertama dokumen ini menulis alur "WordPress HTML ➔ sanitasi ➔ selesai" — SALAH, akan menghasilkan setiap artikel ter-import tampil rusak/mentah di frontend. Perlu langkah TAMBAHAN: HTML bersih ➔ konversi ke struktur Tiptap JSON — infrastrukturnya belum ada sama sekali di codebase (dikonfirmasi grep `generateJSON` = 0 hasil, `@tiptap/html` bukan dependency). |
| **7 (BARU). SEO Bukan Cuma Yoast** | Draf pertama hanya memetakan `_yoast_wpseo_*` — padahal WordPress punya beberapa plugin SEO populer lain (Rank Math, All in One SEO, SEOPress) dengan konvensi meta key BERBEDA. Solusi: rancang sebagai **adapter per-plugin** (deteksi otomatis dari meta key yang ada di postmeta/REST API, bukan hardcode asumsi selalu Yoast) — detail § 4.3 (baru). |
| **8 (BARU). Permalink `post_name`/`date_name` Butuh Perubahan Routing yang Belum Ada** | `[pageSlug]/page.tsx` (single segment) perlu DIGANTI TOTAL jadi catch-all `[...slug]/page.tsx` — SAAT INI file itu hanya query `pages`, tidak pernah query `posts`, dan secara struktural tidak bisa menangkap path multi-segmen (`date_name` = 3 segmen). Detail § 5.4 (baru). |
| **9 (BARU, ditemukan dari pertanyaan user, BUKAN audit pertama). Tidak Ada Preservasi URL Lama — Risiko Kehilangan Nilai SEO Google** | Draf pertama maupun audit pertama SAMA SEKALI tidak membahas redirect dari URL WordPress lama ke URL Jalakarta baru. Tanpa ini, migrasi bisa menghasilkan RIBUAN 404 dari URL yang sudah lama terindeks Google — kehilangan ranking/traffic/otoritas domain yang terbangun bertahun-tahun. Solusi: tabel baru `legacy_url_redirects` + wiring 301 redirect di catch-all routing. Detail § 5.5 (baru). |

---

## 4. Arsitektur SEO: Pemetaan SEO WordPress ke Jalakarta

Jalakarta telah memiliki skema database SEO yang kaya di tabel `posts` & `pages` (bukan
`website_posts`/`website_pages` — lihat koreksi § 2). Metadata SEO dari WordPress dipetakan
1-to-1 ke kolom database Jalakarta — **§ 4.1 adalah pemetaan untuk plugin Yoast SEO** (yang
paling umum dipakai), TAPI lihat **§ 4.3 (baru)** untuk plugin lain — jangan asumsikan sumber
WordPress selalu pakai Yoast.

> ⚠️ **Sinkron dengan `docs/arsitektur-seo.md`, khususnya § 6b**: kolom-kolom di tabel § 4.1
> (`metaTitle`, `metaDesc`, `focusKeyword`, `ogTitle`, `ogDescription`, `ogImageId`,
> `canonicalUrl`, `robots`, `schemaType`) SEMUANYA dikonfirmasi cocok persis dengan skema
> Drizzle asli (2026-07-27, tidak ada koreksi diperlukan di sini). Yang PERLU disambungkan:
> `schemaType` hasil import langsung dipakai `generateArticleJsonLd()` (rencana Fase 7B,
> `arsitektur-seo.md` § 6b.5) — begitu Fase 7B itu dikerjakan, artikel HASIL IMPORT otomatis
> ikut tampil sebagai Article JSON-LD dengan `author` dari `post_authors` (§ 2.4 dokumen ini)
> tanpa kerja tambahan, KARENA keduanya membaca kolom yang sama (`displayAuthorId`,
> `schemaType`). Jangan bangun jalur JSON-LD terpisah khusus untuk post hasil import.

### 4.1. Tabel Pemetaan Metadata SEO (Yoast Meta Key ➔ Jalakarta Schema)

| Meta Key Yoast SEO (WP) | Kolom Database Jalakarta | Penanganan & Normalisasi |
|---|---|---|
| `_yoast_wpseo_title` | `posts.metaTitle` | Mengganti variabel WP (seperti `%%title%%`, `%%sitename%%`) dengan nilai asli. |
| `_yoast_wpseo_metadesc` | `posts.metaDesc` | Teks murni meta description (maks 160 karakter). |
| `_yoast_wpseo_focuskw` | `posts.focusKeyword` | Kata kunci utama artikel. |
| `_yoast_wpseo_opengraph-title` | `posts.ogTitle` | Judul saat dibagikan ke Media Sosial / WhatsApp. |
| `_yoast_wpseo_opengraph-description` | `posts.ogDescription` | Deskripsi saat dibagikan ke Media Sosial / WhatsApp. |
| `_yoast_wpseo_opengraph-image` | `posts.ogImageId` | ⚠️ **DIKOREKSI**: URL di-download, TAPI wajib lewat `processImage()` (Sharp variant, sama seperti Featured Image § 7.1) sebelum insert ke `media` dan dapat `media.id` — bukan "simpan sebagai media.id" langsung tanpa proses. |
| `_yoast_wpseo_canonical` | `posts.canonicalUrl` | URL kanonisasi asli. |
| `_yoast_wpseo_meta-robots-noindex` | `posts.robots` | Jika `1` ➔ set `"noindex"`, jika `0`/kosong ➔ `"index,follow"`. |
| `_yoast_wpseo_meta-robots-nofollow` | `posts.robots` | Jika `1` ➔ set `"noindex,nofollow"`. |
| `_yoast_wpseo_schema_article_type` | `posts.schemaType` | Dipetakan ke `"Article"`, `"NewsArticle"`, atau `"BlogPosting"`. |

> **Tambahan dari verifikasi sample real (§ 15.1) — di luar 8 kolom inti di atas:**
> - `_yoast_wpseo_primary_category` (ID kategori) → dipakai sebagai TIE-BREAKER saat post punya
>   LEBIH DARI SATU kategori (`<category domain="category">` bisa muncul berkali-kali per item)
>   untuk menentukan mana yang jadi kategori utama Jalakarta (`posts` biasanya hanya simpan satu
>   `categoryId` utama + relasi many-to-many tag) — kalau key ini tidak ada, fallback ke
>   kategori PERTAMA yang ditemukan di urutan `<category>` dalam item.
> - `_wp_attachment_image_alt` (postmeta pada item **attachment**, bukan item post) →
>   `media.altText` — dikonfirmasi ada di sample real, sebelumnya tidak disebut sama sekali di
>   dokumen ini. Berlaku untuk Featured Image DAN gambar inline hasil download (§ 7.1/§ 7.2).
> - **(Opsional, nice-to-have, BUKAN blocker)** Beberapa plugin penghitung tayangan menulis
>   postmeta seperti `wpb_post_views_count` atau `musi_views` (dikonfirmasi keduanya ADA
>   bersamaan di sample real dengan nilai berbeda — kemungkinan dua plugin views-counter aktif
>   sekaligus di situs sumber, atau satu total vs satu per-periode) — kalau ditemukan, bisa
>   di-map ke `posts.viewCount` (kolom sudah ada, `lib/view-counter.ts`) untuk mempertahankan
>   sinyal popularitas lama saat migrasi. Ambil nilai TERBESAR kalau ada lebih dari satu key
>   view-count yang cocok. Key lain yang tidak dikenali (`_edit_last`, `slide_template`,
>   `sm_cloud`, `_wp_attachment_metadata`, `litespeed-optimize-*`, `_yoast_wpseo_linkdex`,
>   `_yoast_wpseo_content_score`, `_yoast_wpseo_estimated-reading-time-minutes`, dst)
>   **diabaikan diam-diam** — bukan error, bukan warning, murni tidak relevan untuk Jalakarta.
> - **(Opsional, ditemukan dari sample kedua § 15.3)** `ane_news_utama` (ACF plugin field, nilai
>   `"1"`/`"0"`, penanda "berita utama/headline" di situs sumber) → dipetakan ke
>   `posts.isFeatured` (kolom sudah ada, checkbox "Berita Unggulan" di sidebar editor Jalakarta —
>   `docs/arsitektur-penulis-post.md` menyebutnya, lihat juga CLAUDE.md § Post Card). Key
>   pasangannya `_ane_news_utama` (menyimpan ACF internal field key seperti
>   `field_5dfb9658927a3`) diabaikan — itu housekeeping ACF, bukan data.

### 4.2. XML Sitemap & Robots.txt Dinamis di Jalakarta

* **Dynamic XML Sitemap (`/{slug}/sitemap.xml`)**:
  * Mengompres dan mempublikasikan sitemap XML otomatis yang menggabungkan:
    * Posts yang ber-status `published` dan `robots != 'noindex'`.
    * Pages yang ber-status `published` dan `robots != 'noindex'`.
    * Kategori post & Produk toko.
* **Dynamic Robots.txt (`/{slug}/robots.txt`)**:
  * Mengarahkan Googlebot ke URL sitemap resmi tenant: `Sitemap: https://{domain}/sitemap.xml`.
  * ⚠️ **Bergantung Fase 5/6 `docs/arsitektur-seo.md`, BELUM dibangun** — dan § 6c dokumen itu
    menemukan kemungkinan bug live: route singular `app/robots.ts`/calon `app/sitemap.ts` di
    ROOT tidak kompatibel dengan custom domain (`middleware.ts` rewrite semua path non-admin/
    api ke `/{slug}${pathname}`). Kalau importer WP ini dikerjakan LEBIH DULU dari Fase 5/6 SEO,
    jangan asumsikan sitemap/robots.txt sudah otomatis "menangkap" post hasil import — cek
    status Fase 5/6 dulu.

### 4.3. SEO Bukan Cuma Yoast — Adapter Per-Plugin (BARU)

> Ditambahkan 2026-07-27 atas permintaan eksplisit: *"salah satu yg di export kan seo dari
> yoast, tapi bisa seo lain juga"*. Draf pertama dokumen ini HANYA memetakan meta key Yoast
> (§ 4.1) — kalau situs sumber pakai plugin SEO lain (Rank Math, All in One SEO, SEOPress —
> tiga yang paling umum setelah Yoast), meta key-nya BEDA TOTAL dan pemetaan § 4.1 tidak akan
> match sama sekali, hasilnya SEO tidak ter-import tanpa peringatan apa pun ke admin.

**Prinsip rancangan — deteksi otomatis, bukan pilihan manual admin**: parser XML/REST scan
`<wp:postmeta>` (atau field REST API custom) mencari salah satu prefix meta key yang dikenal
(`_yoast_wpseo_*`, `rank_math_*`, `_aioseo_*`, dst) — plugin manapun yang meta key-nya paling
banyak ditemukan di file/situs sumber itulah yang dipakai sebagai adapter aktif untuk SELURUH
batch import (bukan per-artikel, karena satu situs biasanya cuma pakai SATU plugin SEO).

**⚠️ Kejujuran teknis — jangan hardcode meta key plugin selain Yoast tanpa verifikasi
sungguhan**: penulis dokumen ini (dan sesi audit 2026-07-27) TIDAK 100% yakin nama-nama meta
key persis untuk Rank Math (`rank_math_title`, `rank_math_description`, dst — pola umum yang
diketahui, tapi belum diverifikasi terhadap file WXR sungguhan) dan All in One SEO (versi 4+
migrasi penyimpanan dari postmeta ke tabel dedicated `wp_aioseo_posts`, yang artinya untuk
AIOSEO v4+ HTML export biasa mungkin TIDAK menyertakan datanya sama sekali di file WXR standar
— perlu dicek langsung terhadap contoh export nyata sebelum Fase 1 implementasi, bukan ditebak
dari ingatan). **Rekomendasi**: implementasikan adapter Yoast dulu (paling umum + paling pasti
mekanismenya, karena hampir semuanya lewat `<wp:postmeta>` standar) — adapter plugin lain
ditambahkan SATU PER SATU begitu ada sample file WXR sungguhan untuk diverifikasi polanya,
jangan bangun sekaligus dari asumsi.

---

## 5. Perencanaan Custom URL / Permalink Structure di Website Settings

Untuk mengakomodasi fleksibilitas WordPress, admin tenant dapat memilih struktur URL postingan di Halaman **Website Settings** (`/{slug}/website/pengaturan`).

### 5.1. Opsi Permalinks yang Disediakan (`settings` key: `website_permalink_structure`)

> ✅ **DIIMPLEMENTASIKAN (Fase 2.1+2.9)** — semua 5 opsi di bawah persis sesuai desain ini,
> termasuk pattern URL-nya masing-masing (dikonfirmasi via curl end-to-end untuk kelima mode,
> § 8 Fase 2). Satu penyesuaian kecil dari draf: key setting ASLI yang diimplementasikan adalah
> `key="permalink_structure", group="website"` (bukan `website_permalink_structure` sebagai
> satu key flat) — mengikuti konvensi `key`+`group` terpisah yang SUDAH established di seluruh
> `tenant.settings` table (lihat pola `key="timezone", group="general"` dkk), bukan pola baru.
> UI dropdown + preview URL live: `/{slug}/website/pengaturan`, komponen
> `PermalinkStructureForm`.

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
5. **`category_date_name` (BARU, ditambahkan dari verifikasi data real § 15) — Mirip WordPress
   `/%category%/%year%/%monthnum%/%postname%/`**:
   * Pattern: `/{tenant}/{categorySlug}/{year}/{month}/{postSlug}`
   * Contoh: `jalakarta.com/ikpm-jogja/kegiatan/2026/07/berita-silaturahmi`
   * **Kenapa ditambahkan**: dikonfirmasi dari DUA sumber independen situs `forbis.id` (target
     migrasi sungguhan) — URL WXR lama (2019) `https://forbis.id/wawancara/2019/03/...` DAN
     URL REST API live (2026) `https://forbis.id/kabar/2026/07/...` SAMA-SAMA berpola
     `/{categorySlug}/{tahun}/{bulan}/{slug}/` — TIDAK cocok dengan opsi 1-4 di atas. Ini
     struktur permalink WordPress standar `%category%/%year%/%monthnum%/%postname%/`, cukup
     umum dipakai situs berita/majalah — kalau tidak ditambahkan sebagai opsi eksplisit, tenant
     yang migrasi dari struktur ini TIDAK BISA membuat URL barunya identik dengan URL lama
     (memaksa SEMUA path lama masuk `legacy_url_redirects` § 5.5 walau sebenarnya bisa
     dipertahankan 1:1 kalau tenant memilih opsi ini).

### 5.2. Interaksi dengan Multi-Tenant Domain Routing

> ⚠️ **DIKOREKSI 2026-07-27**: Fase 2 (Subdomain) **BELUM AKTIF** — UI-nya sengaja disembunyikan
> ("Segera hadir — subdomain belum bisa diaktifkan", lihat CLAUDE.md `[2026-07-16] Eksekusi
> Roadmap Domain Fase 2`). Draf pertama menulis seolah ketiga fase sama-sama berlaku sekarang —
> yang benar-benar live HANYA Fase 1 (path-based) dan Fase 3 (custom domain).

* **Fase 1 (Path-based, LIVE)**: `jalakarta.com/{tenant}/{permalink}`
* **Fase 2 (Subdomain, BELUM AKTIF)**: `{tenant}.jalakarta.id/{permalink}` — abaikan dulu untuk
  perencanaan permalink ini, tidak ada tenant yang benar-benar diakses lewat mode ini sekarang.
* **Fase 3 (Custom Domain, LIVE)**: `ikpmjogja.com/{permalink}` — **PENTING**: custom domain
  diakses TANPA prefix `{tenant}` sama sekali (middleware yang menambahkan prefix secara
  internal via rewrite) — permalink apa pun yang dipilih admin harus tetap benar dalam dua
  bentuk sekaligus (dengan prefix untuk path-based, tanpa prefix untuk custom domain) — pola
  `baseUrl`/`stripTenantPrefix()` yang sudah established di seluruh front-end publik WAJIB
  dipakai di sini juga, jangan hardcode `/${slug}/...` di generator permalink.

### 5.3. Pencegahan Tabrakan Rute Sistem (Reserved System Routes & Catch-All Routing)

Jika tenant menggunakan opsi **`post_name` (`/{tenant}/{slug}`)**, slug postingan berpotensi bertabrakan dengan **Rute Statis Sistem** (seperti `toko`, `event`, `donasi`, `surat`, `akun`, `login`, `register`, `admin`, `api`).

#### Solusi 2-Lapis Pencegahan Tabrakan:

1. **Lapis 1 — Validasi Input Slug Admin (Blacklist Check)**:
   Saat admin membuat/meng-edit post atau page, sistem mencocokkan slug dengan daftar kata terlarang (`RESERVED_TENANT_SLUGS`).
   > ⚠️ **DIKOREKSI**: daftar di bawah ini adalah CONTOH/DRAF, BUKAN daftar final — sudah ada
   > daftar SERUPA `STATIC_TOP_SEGMENTS` (`apps/web/lib/mobile-route-checks.ts`) untuk keperluan
   > lain (deteksi mobile shell), isinya BEDA dan TIDAK LENGKAP untuk tujuan blacklist ini
   > (mis. tidak ada `toko`/`surat`/`admin`/`platform`/`settings`). **Jangan reuse
   > `STATIC_TOP_SEGMENTS` apa adanya** (tujuannya beda, driftnya sudah ada) — DAN jangan hanya
   > salin daftar di bawah ini mentah-mentah. Sumber kebenaran yang benar: `ls
   > apps/web/app/(public)/[tenant]/` (folder top-level RIIL) digabung dengan semua rute
   > `(dashboard)` yang mungkin collision (`api`, `app`, `platform`, `admin`) — daftar folder
   > publik riil per 2026-07-27: `agenda, akun, akun-error, anggota, campaign, cart, checkout,
   > dokumen, event, forgot-password, gabung, invite, invoice, keranjang, login, pesantren,
   > post, produk, profesional, register, reset-password, sign, statistik, usaha, verify` — DAN
   > tambahan segmen non-tenant (`api`, `app`, `platform`, `admin`) dari `middleware.ts`. Audit
   > ulang daftar ini SETIAP kali ada folder rute publik baru ditambahkan ke `app/(public)/[tenant]/`
   > — draf `RESERVED_TENANT_SLUGS` di bawah sudah basi sejak ditulis (mis. tidak menyertakan
   > `campaign`/`profesional`/`pesantren`/`usaha`/`gabung` yang sudah ada sekarang).
   ```typescript
   export const RESERVED_TENANT_SLUGS = new Set([
     "toko", "produk", "event", "agenda", "donasi", "campaign", "surat",
     "letters", "members", "anggota", "akun", "login", "register", "admin",
     "dashboard", "api", "platform", "settings", "pengaturan", "keranjang",
     "transaksi", "pesantren", "usaha", "statistik", "sitemap.xml", "robots.txt"
   ]);
   ```
   > ✅ **DIIMPLEMENTASIKAN (Fase 2.7, 2026-07-28)** — `apps/web/lib/reserved-post-slugs.ts`,
   > `RESERVED_POST_SLUGS` (25 folder statis riil, VERBATIM daftar yang dikoreksi di atas —
   > TANPA `app`/`platform`/`api`/`admin`/`dashboard`/`settings`/`sitemap.xml`/`robots.txt`,
   > dikonfirmasi via reasoning eksplisit: itu semua reserved untuk TENANT SLUG di
   > `middleware.ts`'s `TENANT_SLUG` regex — beda konsep sama sekali dari POST SLUG di dalam
   > SATU tenant, karena `/{tenant}/app` tidak collide dengan `/app/{tenant}/...` sama sekali,
   > segmen pertamanya tenant slug bukan literal "app"). Dipanggil dari
   > `validateSlugForPostNameMode()` di `website/actions.ts`, HANYA aktif kalau
   > `getTenantPermalink()==="post_name"`. Detail lengkap: § 8 poin Fase 2, sub-fase 2.7.
2. **Lapis 2 — Fallback Catch-All Matching di Next.js App Router**:
   > ⚠️ **DIKOREKSI — nama file DAN perilaku sekarang salah, lihat § 5.4 untuk detail lengkap**.
   File nyata adalah `app/(public)/[tenant]/[pageSlug]/page.tsx` (dynamic segment TUNGGAL,
   BUKAN catch-all `[...slug]`), dan urutan yang diklaim di bawah **TIDAK ADA di kode
   sekarang** — file itu HANYA query tabel `pages`, TIDAK PERNAH query `posts` sama sekali.
   ```
   1. Cek Rute Statis Sistem (Toko/Event/Donasi) ──► Render Modul Sistem   [BENAR — via folder terpisah]
   2. Cek `pages` WHERE slug = {slug}            ──► Render Page Template  [BENAR — sudah ada]
   3. Cek `posts` WHERE slug = {slug}            ──► Render Post Template  [❌ TIDAK ADA — perlu ditambahkan, § 5.4]
   4. Jika Semua Tidak Ditemukan                 ──► Render 404 Page       [BENAR — sudah ada]
   ```

### 5.4. Perubahan Kode yang Diperlukan untuk Opsi Permalink `post_name` (BARU)

> Fitur permalink `post_name` (§ 5.1 opsi 2) TIDAK BISA berfungsi tanpa mengubah
> `[pageSlug]/page.tsx` — ini bukan detail implementasi kecil, ini PRASYARAT fitur.

> ⚠️ **Diperbarui lagi setelah § 5.5 (redirect legacy URL) ditambahkan** — poin 1 di bawah
> awalnya menulis "perluas `[pageSlug]`" seolah cukup extend fungsi query-nya saja. Ternyata
> TIDAK CUKUP begitu opsi permalink `date_name` (§ 5.1 opsi 3, `/{year}/{month}/{postSlug}` —
> 3 segmen) dan kebutuhan redirect URL legacy WordPress (§ 5.5, bisa berapa pun segmen) ikut
> dipertimbangkan — keduanya butuh MENANGKAP path multi-segmen, yang secara struktural TIDAK
> BISA dilakukan oleh `[pageSlug]` (dynamic segment TUNGGAL, hanya cocok 1 segmen — Next.js
> App Router bahkan tidak akan pernah meneruskan path 2+ segmen ke file ini sama sekali, request
> akan 404 di level routing SEBELUM kode kita sempat jalan).

1. **`[pageSlug]/page.tsx` (single segment) diganti TOTAL jadi `[...slug]/page.tsx` (catch-all
   multi-segmen)** — bukan sekadar "diperluas". Logic di dalamnya menjadi (urutan prioritas):
   ```
   segments   = params.slug           // array, mis. ["kontak"] atau ["2024","05","artikel"]
   joinedPath = "/" + segments.join("/")

   1. segments.length === 1 → coba resolve sebagai Page slug (perilaku EXISTING, dipertahankan)
   2. segments.length === 1 DAN permalink tenant = "post_name" → coba resolve sebagai Post slug
   3. segments.length === 3 DAN permalink tenant = "date_name" → resolve Post via slug (abaikan
      year/month di path, itu murni kosmetik SEO — post tetap dicari by slug unik)
   4. segments.length === 4 DAN permalink tenant = "category_date_name" (§ 5.1 opsi 5, BARU) →
      resolve Post via slug SAJA (segmen terakhir) — category/year/month di path murni kosmetik
      SEO, sama prinsipnya dengan opsi 3 (post tetap dicari by slug unik, bukan by kombinasi
      kategori+tanggal — kalau kategori di URL sudah tidak sesuai kategori post saat ini karena
      admin ganti kategori belakangan, request TETAP resolve benar, hanya URL-nya jadi tidak
      "cantik" lagi sampai link diperbarui manual — trade-off yang diterima demi kesederhanaan
      lookup, bukan mengunci re-kategorisasi).
   5. Tidak ketemu di 1-4 → cek `legacy_url_redirects` WHERE old_path = joinedPath (§ 5.5)
      → kalau ketemu → 301 redirect ke redirect_to
   6. Semua gagal → notFound()
   ```
   Mengganti ke catch-all ini AMAN untuk semua tenant existing (bukan cuma yang pakai fitur
   import WP) — Next.js App Router SELALU prioritaskan folder statis eksplisit (`post/`,
   `produk/`, dst) di atas catch-all, jadi tenant yang tidak pernah pakai permalink custom atau
   import WP tidak akan terpengaruh sama sekali (langkah 1 tetap identik perilaku lama).
   > ✅ **DIIMPLEMENTASIKAN PERSIS SESUAI DESAIN INI (Fase 2.5, 2026-07-27/28)** —
   > `app/(public)/[tenant]/[...slug]/page.tsx`. Diverifikasi empiris (build produksi genuine
   > + curl end-to-end) untuk SEMUA 6 langkah, termasuk konfirmasi langsung bahwa folder statis
   > tetap prioritas di atas catch-all (bukan cuma diasumsikan dari dokumentasi Next.js). Detail:
   > § 8 poin Fase 2, sub-fase 2.5.
2. **Kolisi slug Page vs Post**: kalau tenant punya PAGE dan POST dengan slug yang sama persis
   (mis. page "kontak" dan post "kontak"), Page menang (dicek lebih dulu) — post itu jadi TIDAK
   BISA DIAKSES via permalink `post_name` sampai slug-nya diubah. Perlu validasi eksplisit saat
   admin simpan post/page baru: cek slug tidak bentrok dengan tipe KONTEN LAIN juga (sekarang
   `resolveSlug()` di `website/actions.ts` hanya cek unik terhadap tabel yang sama — posts vs
   posts, pages vs pages — TIDAK cek silang).
   > ✅ **DIIMPLEMENTASIKAN (Fase 2.7)** — `validateSlugForPostNameMode()` di `website/
   > actions.ts`, diwire ke SEMUA 6 fungsi create/update post/page, cek dua arah (post↔page).
   > Detail: § 8 poin Fase 2, sub-fase 2.7.
3. Perubahan ini HARUS diverifikasi tidak merusak: SEO canonical URL, breadcrumb JSON-LD
   (rencana `arsitektur-seo.md` § 6b), dan link internal "Baca Juga" (`docs/arsitektur-editor.md`
   — pakai `stripTenantPrefix()`/`PublicLinkPicker`, yang ASUMSI-nya URL post selalu
   `/{slug}/post/{postSlug}` — kalau permalink berubah jadi `post_name`, generator link ini
   juga perlu tahu permalink structure tenant, bukan hardcode `/post/`).
   > ✅ **DIKONFIRMASI AMAN** — SEO canonical URL untuk halaman POST sudah benar (§ 8 Fase
   > 2.2/2.4/2.5, `getPostDetailMetadata()` selalu pakai `resolvePostHrefs()`). Link internal
   > "Baca Juga" (Tiptap block `RelatedLinkBlock`, `docs/arsitektur-editor.md`) JUGA sudah aman
   > — mengonsumsi `/api/ref/public-links` (via `PublicLinkPicker`), yang sudah di-fix di § 8
   > Fase 2.2 untuk pakai `resolvePostHrefs()` (bukan `buildPostUrl()` lama yang hardcode
   > `/post/{slug}`, yang sudah dihapus total sebagai dead code). Breadcrumb JSON-LD
   > (`arsitektur-seo.md` § 6b) BUKAN concern nyata — fitur itu sendiri BELUM PERNAH
   > diimplementasikan di app ini sama sekali (dikonfirmasi grep `application/ld+json` = nol
   > hasil, lihat CLAUDE.md lesson "Rencana SEO Fase 7B"), jadi tidak ada breadcrumb existing
   > yang bisa "rusak" oleh perubahan permalink ini.

### 5.5. Preservasi Nilai SEO — Redirect 301 dari URL WordPress Lama (BARU, GAP YANG TERLEWAT DI AUDIT PERTAMA)

> Ditambahkan 2026-07-27 dari pertanyaan langsung user: **"apakah ini sudah terintegrasi dengan
> konteks SEO? apakah ada setting URL yang sesuai dengan URL sebelumnya di WordPress, agar
> tidak kehilangan nilai URL dari Google?"** — jawaban jujur saat ditanya: **TIDAK, draf pertama
> maupun audit pertama sama sekali tidak membahas ini** — celah yang genuinely terlewat, bukan
> "sudah ditangani implisit". Ini krusial: kalau ribuan URL WordPress yang sudah lama
> terindeks Google tiba-tiba 404 setelah migrasi, situs kehilangan ranking/traffic organik/
> otoritas domain yang terbangun bertahun-tahun — bukan cuma kosmetik SEO, ini kerugian nyata.

**Prinsip**: setiap URL WordPress lama yang PERNAH terindeks Google harus tetap merespons
(dengan **301 Permanent Redirect**, bukan 302) ke URL Jalakarta yang baru — bukan 404 — bahkan
kalau slug/struktur URL berubah total saat migrasi.

> ✅ **DIIMPLEMENTASIKAN (Fase 2.5, 2026-07-28)** — via `permanentRedirect()` dari
> `next/navigation` di catch-all `[...slug]/page.tsx`. **Koreksi kecil dari desain**: Next.js
> App Router TIDAK mengekspos kontrol untuk memilih persis 301 vs 308 — `permanentRedirect()`
> SELALU menghasilkan **HTTP 308** (dikonfirmasi via curl langsung: `HTTP/1.1 308 Permanent
> Redirect`), bukan 301. Ini BUKAN masalah SEO — 308 adalah versi modern dari 301 (mempertahankan
> HTTP method, semantik "permanent" yang sama) dan Google mengonfirmasi memperlakukan 308
> setara dengan 301 untuk transfer link equity. Diverifikasi end-to-end: insert baris test ke
> `legacy_url_redirects`, curl path lama → 308 + header `Location` yang benar, hapus baris test.

**Skema baru — `tenant.legacy_url_redirects`**:
```sql
CREATE TABLE tenant_{slug}.legacy_url_redirects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_path    TEXT NOT NULL UNIQUE,  -- path relatif TANPA domain, TANPA prefix slug tenant,
                                     -- mis. "/2024/05/artikel-lama" atau "/artikel-lama"
  redirect_to TEXT NOT NULL,         -- path baru Jalakarta, relatif, mis. "/post/artikel-baru"
  post_id     UUID,                  -- opsional, referensi longgar (tanpa FK constraint keras,
                                     -- pola sama import_batch_rows.member_id — housekeeping saja)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
**Kenapa TANPA domain**: domain LAMA WordPress hampir selalu JADI custom domain Jalakarta yang
baru (skenario migrasi paling umum — organisasi pindah platform tapi tetap pakai domain yang
sama) — jadi hanya PATH yang relevan untuk dicocokkan, domain-nya otomatis benar via mekanisme
custom-domain routing yang sudah ada.

**Populate saat import** (WXR ATAU REST API — keduanya punya field ini):
- WXR: tag `<link>` di tiap `<item>` — URL lengkap lama (mis.
  `https://situs-lama.com/2024/05/artikel-lama/`). Ekstrak PATH-nya saja (buang domain+scheme).
- REST API: field `link` di tiap post object — sama.
- Setelah post baru selesai dibuat dengan slug BARU (bisa beda dari slug lama karena sanitasi/
  dedup), insert baris `legacy_url_redirects` yang memetakan path lama → path final post itu
  sesuai permalink structure tenant (`/post/{newSlug}` untuk default, atau bentuk lain sesuai
  § 5.1). **Skip insert kalau path lama == path baru** (permalink `date_name`/`post_name` yang
  dipilih tenant kebetulan identik strukturnya dengan WordPress) — hindari redirect loop
  percuma dan baris database yang tidak perlu.

**Wiring ke routing** — titik cek redirect adalah LANGKAH 4 di alur `[...slug]/page.tsx` yang
baru (§ 5.4) — SETELAH page/post gagal ditemukan, SEBELUM `notFound()`. Response HARUS
`redirect(newPath, "permanent")` (Next.js `redirect()` dari `next/navigation`, atau
`NextResponse.redirect(url, 301)` kalau di level route handler) — bukan sekadar render ulang
konten di URL lama (itu akan membuat Google melihat DUA URL untuk konten yang sama, masalah
duplicate-content baru).

**Konsekuensi untuk sitemap & canonical (sinkron dengan `docs/arsitektur-seo.md`)**:
- Sitemap (Fase 5, `arsitektur-seo.md` § 4/§ 6c) HANYA boleh berisi URL BARU/final — URL lama
  di `legacy_url_redirects` TIDAK PERNAH masuk sitemap (praktik SEO standar: sitemap adalah
  daftar URL kanonik, bukan daftar semua URL yang pernah ada).
- `canonicalUrl` post (kolom yang sudah ada, § 4.1) untuk artikel hasil import HARUS di-set ke
  URL BARU Jalakarta — BUKAN dibiarkan kosong lalu default ke diri sendiri secara otomatis, dan
  BUKAN diisi dari `_yoast_wpseo_canonical` WordPress apa adanya (nilai lama itu menunjuk ke
  domain/path LAMA yang sudah tidak ada — kalau di-import mentah, Google malah diberi tahu
  "URL kanonik yang sebenarnya adalah tempat lain", situasi lebih buruk dari tanpa redirect).

---

## 6. Analisa Timezone & Penanganan Gap Waktu saat Import

### 6.1. Perbedaan Format Penyimpanan Waktu

| Sistem | Tipe Data & Format | Sifat Timezone |
|---|---|---|
| **WordPress DB** | `post_date` (`datetime`) | Local Server/WP Timezone (Tanpa timezone offset, misal `2026-07-26 14:30:00`) |
| **WordPress GMT** | `post_date_gmt` (`datetime`) | UTC Timezone (`2026-07-26 07:30:00`) |
| **Jalakarta DB** | `timestamp with time zone` (`timestamptz`) | Disimpan murni sebagai **UTC ISO 8601** (`2026-07-26T07:30:00.000Z`) |

### 6.2. Potensi Bug / Gap Waktu & Solusinya

> ⚠️ **DIKOREKSI 2026-07-27**: `dayjs` **BUKAN dependency project ini** (dikonfirmasi cek
> `package.json` — nol hasil). Project SUDAH punya helper timezone sendiri yang WAJIB
> di-reuse — `apps/web/lib/tenant-timezone.ts` (pure, client-safe) +
> `apps/web/lib/tenant-timezone.server.ts` (`getTenantTimezone()`, server-only) — dipakai
> konsisten di modul Event/Invoice/Cicilan setelah serangkaian bug tanggal WIB/UTC yang sudah
> berkali-kali ditemukan+difix di project ini (lihat `docs/lessons-learned.md` — ""Hari ini" via
> new Date().toISOString() selalu salah jam 00:00-06:59 WIB..."). JANGAN tambah `dayjs` sebagai dependency baru hanya
> untuk fitur ini — akan jadi cara KEDUA menangani timezone di codebase yang sama, sumber bug
> inkonsistensi di masa depan.

* **Kasus 1: `post_date_gmt` bernilai `0000-00-00 00:00:00`**
  * *Penyebab*: Database WordPress tua atau post draft sering kali memiliki nilai GMT nol/invalid.
  * *Solusi*: Jika `post_date_gmt` invalid, ambil `post_date` lokal WP lalu konversikan ke UTC
    menggunakan `getTenantTimezone(tenantClient)` (fetch timezone tenant yang sesungguhnya,
    BUKAN hardcode `"Asia/Jakarta"`) + `localDatetimeToUtcIso(post_date, timezone)` — dua
    fungsi yang SUDAH ADA di `lib/tenant-timezone.ts`/`.server.ts`, bukan ditulis ulang.
* **Kasus 2: Pergeseran Jam Publikasi di Frontend (+7 Jam / -7 Jam)**
  * *Penyebab*: String tanggal lokal tanpa timezone offset dianggap sebagai UTC oleh JavaScript `new Date()` — persis kelas bug yang sudah berulang kali ditemukan di modul Event/Cicilan project ini (lihat `docs/lessons-learned.md`, entri-entri soal "Hari ini"/timezone WIB).
  * *Solusi*: `localDatetimeToUtcIso(dateString, tenantTimezone)` — SUDAH menangani fixed-offset
    Indonesia (WIB/WITA/WIT, tanpa DST) dengan benar, TIDAK butuh `dayjs` atau library timezone
    apa pun. Ganti seluruh referensi `dayjs.tz(...)` di draf pertama dengan fungsi ini.

---

## 7. Migrasi Featured Image & Sanitasi Editor (HTML ➔ Tiptap)

### 7.1. Migrasi Featured Image (Cover Artikel)

> ⚠️ **DIKOREKSI 2026-07-27, dua kesalahan**: (1) `media` adalah tabel **TENANT-scoped**
> (`tenant_{slug}.media`), BUKAN `public.media` — draf pertama salah menyebut skema; (2) insert
> ke `media` TIDAK BOLEH langsung dari buffer gambar mentah — WAJIB lewat `processImage()`
> (`lib/image-processor.ts`), yang men-generate variant Sharp (`large`/`medium`/`thumbnail`/dst,
> WebP quality 85) dan mengisi kolom `variants` JSONB. Dikonfirmasi: **satu-satunya** caller
> insert ke `schema.media` di seluruh codebase (`app/api/media/upload/route.ts`) SELALU
> memanggil `processImage()` dulu — tidak ada preseden "insert mentah tanpa variant" di mana
> pun. Kalau importer WP melakukan insert manual tanpa variant, gambar hasil import akan rusak
> di semua tempat yang mengandalkan `resolveMediaUrl()`/fallback variant (card produk, post,
> campaign, dst — semua sudah mengasumsikan `variants` terisi).

> ⚠️ **BUG DITEMUKAN+DIFIX 2026-07-28 (dari laporan user, bukan dari desain aslinya)** —
> `PATH_PRIORITY` (konstanta penentu variant mana jadi "path utama"/URL default gambar) di
> `lib/wordpress-image-import.server.ts` (dan 2 file lain: `app/api/media/upload/route.ts`,
> `app/api/akun/media/upload/route.ts` — SEMUANYA duplikat konstanta yang sama, bukan hanya
> WordPress importer) sebelumnya urutan `["large", "square-large", "square", "profile",
> "original"]` — loncat langsung dari `large` (1200×630) ke variant KOTAK (`square`/
> `square-large`, 1:1) tanpa mempertimbangkan `medium`(800×420)/`thumbnail`(400×210) yang SAMA
> rasio aspek (1.91:1) sebagai fallback antara. Gambar dari `the_content()`/gallery WordPress
> biasanya ~700-800px lebar (WordPress jarang embed resolusi penuh di isi artikel) — gagal fit
> untuk `large` (butuh ≥1200px) tapi `medium`/`thumbnail` BERHASIL dibuat — namun urutan lama
> sama sekali tidak menyebut keduanya, jadi loncat ke `square` yang JUGA berhasil dibuat,
> memotong paksa gambar landscape jadi kotak. **Fix**: urutan baru
> `["large", "medium", "thumbnail", "square-large", "square", "profile", "original"]` di
> ketiga file — diverifikasi empiris dengan 3 gambar sintetis (800×450/1600×900/350×350) via
> Sharp sungguhan: 800×450 sebelumnya salah pilih `square`, sekarang benar pilih `medium`;
> 1600×900 dan 350×350 hasilnya identik lama/baru (nol regresi). Lihat `docs/lessons-learned.md`
> — "Meng-copy pola/konstanta 'karena sama persis' tidak berarti polanya sendiri sudah benar"
> untuk detail penuh.
> **Tidak retroaktif** — hanya berlaku upload/import BARU setelah fix ini.

1. **MinIO Asset Downloader Worker**:
   * Ambil URL gambar eksternal dari WordPress (misal `https://wp-lama.com/wp-content/uploads/2024/05/foto.jpg`).
   * Unduh gambar via HTTP stream di background job (buffer, bukan langsung upload mentah).
   * **Panggil `processImage(buffer, variantKeys, {module: "website"})`** — pola dan modul yang
     SAMA persis dengan upload Featured Image manual dari UI post editor sekarang. Hasil
     `allVariants` (path per variant) di-upload ke MinIO Self-Hosted Storage Jalakarta di
     bucket `tenant-{slug}`, path `/website/{year}/{month}/...` (pola path existing, BUKAN
     folder baru `/website/posts/imported/` yang diusulkan draf pertama — tidak perlu folder
     terpisah, gambar hasil import tidak berbeda perlakuannya dari upload manual admin).
   * Insert record baru ke `tenant_{slug}.media` (bukan `public.media`) dengan `variants` JSONB
     terisi hasil `processImage()`, lalu set `posts.coverId = media.id`.
2. **Fallback Gambar Rusak (404 / Server Lama Mati)**:
   * Jika gambar lama 404 atau koneksi terputus, `coverId` di-set `null`. Artikel tetap berhasil di-import tanpa menggagalkan proses.

### 7.2. Konversi Konten Editor — WordPress HTML ➔ Tiptap JSON (DITULIS ULANG TOTAL, Gap KRITIS)

> ⚠️ **INI PERBAIKAN PALING PENTING DI SELURUH DOKUMEN — draf pertama salah arah secara
> fundamental.** `posts.content` di database Jalakarta WAJIB berisi **string JSON hasil
> serialize Tiptap editor state** (pola yang sama dengan `products.description` — dikonfirmasi
> lesson CLAUDE.md), BUKAN string HTML. Draf pertama menulis alur "bersihkan HTML → sanitasi →
> selesai" seolah HTML bersih itu sendiri yang disimpan — **kalau dieksekusi apa adanya, SETIAP
> artikel hasil import akan tampil rusak/mentah di frontend publik** (persis gejala bug lama
> yang sudah pernah terjadi dan didokumentasikan: `renderBody()` — `lib/letter-render.ts` —
> mengharapkan struktur node Tiptap JSON, bukan string HTML, dan TIDAK PERNAH memakai
> `@tiptap/core`/`prosemirror-model` karena fungsi itu crash di server — lihat lesson
> "[2026-04] renderBody — prosemirror-model tidak server-safe").

**Alur yang benar — DUA tahap, bukan satu:**

**Tahap A — Sanitasi HTML** (bagian draf pertama yang MASIH BENAR, dipertahankan):
* Hapus comment Gutenberg Block (`<!-- wp:paragraph -->`/`<!-- /wp:paragraph -->`) via regex.
* Konversi shortcode WordPress (`[caption]`, `[gallery]`, dst) ke tag HTML standar
  (`<figure>`/`<img>`) atau buang kalau tidak ada padanan.
* Sanitasi HTML (DOMPurify/Cheerio) — buang `<script>`, iframe tidak terdaftar, inline style
  yang merusak tata letak Tailwind.
* Inline Image Download (opsional) — sama seperti draf pertama, tapi gambar yang diunduh JUGA
  WAJIB lewat `processImage()` (§ 7.1), bukan disimpan sebagai URL mentah di dalam HTML.

> ⚠️ **Temuan KRITIS baru dari sample WXR kedua (§ 15.3) — urutan operasi antara Tahap A dan
> Tahap B HARUS disisipi langkah tambahan, bukan langsung A → B**: dikonfirmasi baca
> `components/editor/media-image-ext.ts` — Jalakarta punya `image` node CUSTOM (`MediaImage`,
> extend `@tiptap/extension-image`) dengan attribute tambahan `mediaId` (`parseHTML: element =>
> element.getAttribute("data-media-id")`). Base `<img src="...">` polos dari WordPress TETAP
> ter-parse jadi node `image` (inherit `parseHTML` bawaan `Image`), TAPI `mediaId`-nya akan
> `null` — image tersebut TIDAK PERNAH terhubung ke `tenant.media` DB sama sekali, `src`-nya
> masih menunjuk URL LAMA (WordPress/CDN pihak ketiga, bukan MinIO sendiri). Ini **silent
> degradation**, bukan error — gambar tetap TAMPIL (browser fetch apa pun yang ada di `src`),
> tapi mengkhianati tujuan migrasi (mandiri dari infra lama) DAN membuat gambar itu tidak pernah
> muncul di Media Library Jalakarta/tidak ikut ke-resolve variant. **Wajib ada langkah
> tambahan di antara Tahap A dan Tahap B**: setelah semua gambar inline diunduh+`processImage()`
> (§ 7.1), HTML bersih HARUS di-rewrite dulu — setiap `<img src="...">` diganti `src` ke URL
> MinIO baru DAN ditambah atribut `data-media-id="{media.id baru}"` — BARU SETELAH ITU
> `generateJSON()` dipanggil. Kalau langkah rewrite ini dilewati, `mediaId` seluruh gambar hasil
> import akan `null` selamanya (tidak ada mekanisme "isi belakangan" seperti byline § 2.4).

**Tahap B — Konversi HTML Bersih ➔ Tiptap JSON (TIDAK ADA di draf pertama, infrastrukturnya
BELUM ADA sama sekali di codebase — dikonfirmasi grep `generateJSON` = 0 hasil, `@tiptap/html`
bukan dependency manapun):**
* ✅ **DIBUKTIKAN BEKERJA (§ 16, POC 2026-07-27)** — `@tiptap/html/server`'s `generateJSON(html,
  extensions, options?)` (async, butuh `happy-dom` sebagai peer dependency — BUKAN `linkedom`/
  `jsdom` seperti dugaan awal) dites langsung terhadap konten Gutenberg REAL dari kedua sample
  WXR + extension ASLI project ini (termasuk yang import komponen React di dalamnya, `GalleryBlock`/
  `EmbedBlock`) — TIDAK crash, hasil JSON benar, dan berhasil di-render balik via `renderBody()`
  ASLI tanpa masalah. Kekhawatiran awal (pola sama dengan bug lama `generateHTML`/
  `prosemirror-model` yang crash gara-gara `window.document`) TERBUKTI TIDAK TERJADI di arah
  konversi ini (HTML→JSON, beda dari JSON→HTML yang dulu bermasalah) — `happy-dom` menyediakan
  DOM lengkap tanpa perlu browser sungguhan. Detail versi dependency yang WAJIB dipakai (bukan
  `latest`) ada di § 16.2.
  > ⚠️ **KOREKSI (2026-07-28, ditemukan dari laporan user pengguna sungguhan, BUKAN dari POC)**:
  > klaim "TIDAK crash" di atas BENAR untuk eksekusi via `bun run` script disposable (bare
  > runtime, tanpa transform apa pun) — TAPI TERNYATA SALAH untuk eksekusi lewat halaman Next.js
  > sungguhan (`/{slug}/website/import-wordpress`). Root cause: `EmbedBlock`/`GalleryBlock`/
  > `RelatedLinkBlock` versi LIVE (`components/editor/*-ext.ts`) meng-import
  > `ReactNodeViewRenderer` dari `@tiptap/react` (paket browser-only, butuh `react-dom`) untuk
  > `addNodeView()` — sesuatu yang `generateJSON()` TIDAK PERNAH butuh (cuma perlu schema:
  > attrs/parseHTML/renderHTML). Begitu `wordpress-tiptap-extensions.server.ts` mengimpor versi
  > LIVE ketiga extension itu, Next.js's bundler (Turbopack) mencoba mem-bundle `@tiptap/react`
  > ke dalam bundle Server Action `import-wordpress/actions.ts` — crash runtime **"Class extends
  > value undefined is not a constructor or null"** saat modul `embed-block-ext.ts` dievaluasi,
  > TAPI HANYA saat benar-benar diakses lewat halaman Next.js (butuh session login sungguhan
  > untuk memicu render `<ImportWordPressClient>` yang mereferensikan server action-nya) — bukan
  > lewat `bun run` script biasa (yang tidak melakukan transform RSC/server-bundle-aware sama
  > sekali). **Pelajaran kritis**: verifikasi "berhasil dijalankan via `bun run` disposable
  > script" TIDAK EKUIVALEN dengan "aman di-bundle Next.js sungguhan" — keduanya kelas
  > verifikasi yang BERBEDA, dan yang pertama tidak menjamin yang kedua untuk kode yang
  > menyentuh package browser-only. **Fix**: `lib/wordpress-import-tiptap-nodes.server.ts`
  > (baru) — duplikasi SCHEMA-ONLY (attrs/parseHTML/renderHTML, TANPA `addNodeView()`/import
  > `@tiptap/react` sama sekali) untuk ketiga extension itu, dipakai `wordpress-tiptap-
  > extensions.server.ts` menggantikan versi live. `MediaImageExtension`/`EnhancedBlockquote`
  > TIDAK perlu diganti — keduanya dikonfirmasi tidak pernah import `@tiptap/react`. Diverifikasi:
  > grep `@tiptap/react` di seluruh module graph `wordpress-*.ts` = 0 hasil non-komentar (root
  > cause genuinely dihilangkan, bukan ditambal), `@tiptap/html`'s `package.json` dikonfirmasi
  > `peerDependencies` HANYA `happy-dom`/`@tiptap/core`/`@tiptap/pm` (nol dependency ke
  > `@tiptap/react` di level package itu sendiri), `tsc`+`bun run build` bersih. **Belum
  > diverifikasi ulang oleh user via browser sungguhan setelah fix ini** — analisis root cause
  > sangat kuat (import chain problematik dihilangkan total dari akarnya) tapi belum ada
  > konfirmasi visual baru.
* Ekstensi yang dipakai untuk `generateJSON()` HARUS PERSIS SAMA dengan daftar ekstensi yang
  dipasang di `components/editor/tiptap-editor.tsx` (StarterKit + ekstensi custom project ini:
  `RelatedLinkBlock`, `EnhancedBlockquote`, `EmbedBlock`, dst — lihat
  `docs/arsitektur-editor.md`) — kalau tidak, hasil parse HTML akan kehilangan/salah-petakan
  elemen yang harusnya jadi node/mark custom (mis. `<blockquote>` WordPress harus jadi node
  `EnhancedBlockquote`, bukan `blockquote` polos bawaan StarterKit, supaya tampil konsisten
  dengan artikel yang ditulis native di Jalakarta).
* **Fallback kalau parsing gagal untuk suatu artikel**: JANGAN biarkan seluruh import batch
  gagal — tandai baris itu `status='error'` (§ 3 tabel gap, vokabuler status yang sudah ada) +
  simpan HTML mentah di kolom `data` (JSONB preview, bukan `posts.content` langsung) supaya
  admin bisa review manual/retry, bukan silent corruption ke database production.
* **Gutenberg Gallery block (`<!-- wp:gallery -->`) TIDAK otomatis jadi `galleryBlock` node
  Jalakarta — keputusan MVP, degradasi yang diterima** (temuan § 15.3): `GalleryBlock`
  (`components/editor/gallery-block-ext.ts`) `parseHTML()` HANYA mengenali
  `div[data-type="gallery-block"]`, bukan struktur asli WordPress
  (`<figure class="wp-block-gallery">` berisi beberapa `<figure class="wp-block-image">` nested).
  Tanpa deteksi/transformasi khusus, `generateJSON()` akan memecah galeri WP jadi BEBERAPA node
  `image` terpisah berurutan (bukan satu node `galleryBlock` dengan grid/lightbox Jalakarta) —
  gambar tetap ter-import semua, cuma tidak "dikelompokkan" secara visual seperti galeri asli.
  **Diterima sebagai MVP** — deteksi wrapper `wp-block-gallery` + rekonstruksi jadi satu
  `galleryBlock` (kumpulkan URL semua `<img>` di dalamnya jadi `GalleryItem[]`) adalah enhancement
  lanjutan, BUKAN prasyarat Fase 1.
* **Comment block Gutenberg BISA nested** (dikonfirmasi § 15.3: `<!-- wp:list-item -->` di
  dalam `<ol>` yang belum ditutup, `<!-- wp:image ... -->` di dalam `<!-- wp:gallery -->` yang
  belum ditutup) — regex strip comment TETAP AMAN untuk kasus ini selama polanya
  `<!--\s*/?wp:[\w-]+[^>]*-->` (cocokkan sampai karakter `-->` pertama, ABAIKAN isi payload JSON
  atribut sepenuhnya — JANGAN coba parse JSON balanced-braces-nya, tidak perlu dan lebih rawan
  salah kalau payload JSON punya object nested seperti `{"lightbox":{"enabled":true},...}`).
  Comment hanya OVERLAY di atas HTML yang sudah valid dan well-formed (`<ol><li>`,
  `<figure><img>`) — menghapusnya tidak pernah merusak struktur tag di baliknya.

---

## 8. Ringkasan Rencana Pelaksanaan (Roadmap Pengembangan)

> ⚠️ **Urutan DIKOREKSI 2026-07-27** — draf pertama menaruh konversi konten sebagai detail kecil
> di dalam Fase 1. Karena Gap KRITIS § 7.2 (Tiptap JSON) belum ada infrastrukturnya SAMA SEKALI,
> proof-of-concept konversi HARUS dibuktikan bekerja SEBELUM Fase 1 "selesai" diklaim — kalau
> tidak, seluruh artikel yang di-import di Fase 1 akan perlu di-re-import ulang begitu masalah
> konversi ketahuan belakangan (lebih mahal daripada dicek di awal).

0. **Fase 0 — Proof-of-Concept + Prasyarat Keamanan (prasyarat sebelum Fase 1 dianggap mulai)**:
   * ✅ **SELESAI (§ 16)** — Dependency baru ditambah: `fast-xml-parser@^5.10.1`,
     `@tiptap/html@3.22.3` (PINNED persis, BUKAN `latest`/`3.29.0` — peer-dep mismatch, § 16.2),
     `happy-dom@^20.8.9` (BUKAN `linkedom` seperti dugaan awal). Semua di
     `apps/web/package.json` — sempat salah taruh di root via `bun add --filter=`, sudah
     dipindah manual (§ 16.2, bug yang SAMA dengan insiden `recharts` lama).
   * ✅ **DIBUKTIKAN — `@tiptap/html/server`'s `generateJSON()` bekerja server-side** dengan
     ekstensi custom project ini (`RelatedLinkBlock`, `EnhancedBlockquote`, `EmbedBlock`,
     `GalleryBlock`, `MediaImageExtension`) tanpa crash, terhadap konten Gutenberg REAL dari
     kedua sample WXR (§ 7.2, § 16.1) — round-trip lewat `renderBody()` ASLI sukses.
   * ✅ **DIBUKTIKAN — `fast-xml-parser@5.10.1` AMAN dari XXE** (§ 12.1, § 16.1): payload uji
     dengan external entity SYSTEM ditolak eksplisit (`"External entities are not supported"`),
     bukan cuma inert-diam-diam. Smoke test parse kedua file WXR real juga sukses (<3ms,
     `_thumbnail_id`↔attachment matching benar).
   * ✅ **SELESAI (§ 16.6)** — `lib/wordpress-import-security.ts` (`assertSafeExternalUrl()` +
     `safeFetch()`, § 11) DIBANGUN PERMANEN (bukan POC disposable) dan dites terhadap 33 kasus
     nyata: IP privat/reserved (IPv4+IPv6+IPv4-mapped), redirect-ke-internal via `httpbin.org`
     sungguhan. 2 bug nyata ditemukan+difix saat implementasi (bracket IPv6 tidak dilucuti
     sebelum DNS lookup; deteksi IPv4-mapped berbasis string gagal karena `URL` menormalisasi
     notasi sebelum kode sempat melihatnya). **Fase 0 sekarang 100% selesai** — ketiga item
     checklist terbukti, Fase 1 siap dimulai kapan pun ada instruksi eksplisit.
1. **Fase 1 — Core Importer Engine**:
   * ✅ **SELESAI (2026-07-27) — Skema DB**: `content_import_batches`/`content_import_batch_rows`
     (§ 14.2 — DDL persis, tabel PARALEL bukan reuse `import_batches` Importer Anggota) DIBANGUN
     di `packages/db/src/schema/public/content-import.ts` + migration
     `packages/db/migrations/0050_content_import_wordpress.sql` (dijalankan+diverifikasi lokal).
     Kolom `import_batch_id` (§ 14.1, nullable, TANPA FK) ditambahkan ke `posts`/`pages`/`media`
     (Drizzle `packages/db/src/schema/tenant/website.ts` + DDL tenant baru
     `create-tenant-schema.ts` + migration untuk tenant existing, ketiganya konsisten). `tsc
     --noEmit` 0 error di `packages/db` dan `apps/web`.
   * ✅ **SELESAI (2026-07-27) — Parser WXR XML**: `apps/web/lib/wordpress-xml-parser.server.ts`
     (`import "server-only"`) + `apps/web/lib/wordpress-import-mapping.ts` (helper murni
     client-safe: `decodeHtmlEntities`, `extractPathFromUrl`, `mapYoastSeo`,
     `resolvePrimaryCategory`, tipe `ParsedWordPressItem`). Dua-tahap `_thumbnail_id`↔attachment
     index (§ 2.1), Yoast SEO (§ 4.1, HANYA Yoast sesuai § 4.3), tanggal via
     `post_date_gmt`→fallback `post_date`+`localDatetimeToUtcIso()` reuse dari
     `lib/tenant-timezone.ts` (§ 6.2, tidak ada dependency timezone baru), legacy path (§ 5.5),
     deteksi duplikat slug (1 query per row ke `posts`/`pages` tenant). **Diuji terhadap KEDUA
     file WXR sample real** (`contoh-xml.xml` + `wordpress-xml-forbis.xml`) — semua field
     terverifikasi benar (judul, slug, tanggal, taksonomi, penulis, featured image, SEO,
     legacy path), TERMASUK status `duplicate` diuji POSITIF (insert baris tes manual dengan
     slug yang sama → status berubah jadi `duplicate` dengan benar, dihapus lagi setelah
     verifikasi). `tsc --noEmit` 0 error di `apps/web` dan `packages/db`. **Sengaja TIDAK**
     mengunduh gambar/konversi Tiptap/insert DB (§ 13 — itu tugas `commitImportChunkAction`).
   * ✅ **SELESAI (2026-07-27) — REST API Fetcher**: `apps/web/lib/wordpress-api-fetcher.server.ts`
     (`import "server-only"`) — `fetchWordPressContent(siteUrl, opts)`, pagination otomatis via
     header `X-WP-TotalPages` (cap lokal 200 halaman/tipe konten — bukan pengganti budget 5.000
     per batch § 11 poin 3, itu tetap tanggung jawab `commitImportChunkAction`), fetch KEDUA
     `/posts` dan `/pages` (§ 14.2 — Pages ikut, infrastruktur sama). SEMUA fetch eksternal lewat
     `safeFetch()` (§ 11) — tidak ada `fetch()` manual di file ini. Taksonomi dari
     `_embedded['wp:term']` (bucket per field `taxonomy`, bukan index posisi — tahan kalau
     kosong/urutan berubah). SEO diisi `emptySeoFields()` (REST API TIDAK punya Yoast sama
     sekali, dikonfirmasi § 15.2 — bukan kegagalan ekstraksi). Fallback author kalau
     `_embedded.author` 404 (catatan di `notes[]`, resolusi batch-level ditunda ke commit).
     `findExistingContentBySlug()` DIEKSPOR dari parser WXR dan DIPAKAI ULANG di sini (query
     identik untuk kedua metode import, sengaja tidak diduplikasi — beda dari pola "duplikasi
     demi isolasi" project ini karena risiko divergen justru berbahaya di sini).
     **Diuji LIVE terhadap `https://forbis.id` sungguhan** (bukan sample statis) — 480 baris
     nyata (450 post + 30 page hierarkis, mis. `/susunan-pengurus/periode-2024-2029/`),
     pagination lintas 5+ halaman terbukti benar, featured image 444/480, kategori 450/480
     (0 untuk pages — sesuai ekspektasi, Pages tidak punya taksonomi di WP core, bukan bug),
     legacy path 480/480, SEO null 480/480 (mengonfirmasi ulang temuan § 15.2 di skala penuh,
     bukan cuma 1 sample), penulis 0/480 ditemukan (`_embedded.author` 404 site-wide,
     dikonfirmasi konsisten untuk SEMUA item bukan cuma 1 post sample). **Status `duplicate`
     ditemukan GENUINE 2× tanpa direkayasa** — `kebijakan-privasi` dan `home`, dua page yang
     kebetulan sama persis slug-nya dengan page yang SUDAH ADA di tenant `pc-ikpm-jogjakarta`
     (legal singleton bawaan sistem + halaman Home tenant) — bukti deteksi duplikat bekerja
     benar di data lintas-tenant nyata, bukan cuma tes artifisial. Cross-check silang dengan
     parser WXR juga terbukti konsisten: post row #1 hasil REST API ("Cetak Srikandi Pengusaha
     Hafidzoh...") adalah post YANG SAMA dengan yang sudah diverifikasi via WXR di § 15.3 —
     judul/tag/legacy path identik di kedua metode ekstraksi.
   * ✅ **SELESAI (2026-07-27) — "Parse & Simpan Draft" Actions** (gap yang ditemukan SAAT
     eksekusi, bukan direncanakan eksplisit sebagai bullet terpisah sebelumnya — `commitImportChunkAction`
     butuh baris `content_import_batch_rows` yang SUDAH ADA untuk dibaca, dan tidak ada yang
     menulisnya sebelum ini): `app/(dashboard)/app/[tenant]/website/import-wordpress/actions.ts`
     (BARU, `"use server"`) — `importWxrFileAction(slug, formData)` (upload+parse+simpan) dan
     `importRestApiAction(slug, siteUrl)` (fetch+simpan), pola SAMA PERSIS
     `parseImportFileAction` Importer Anggota. Keduanya digate `getTenantAccess()`+
     `hasFullAccess(...,"website")`, panggil parser/fetcher yang sudah ada, lalu
     `persistDraftBatch()` (private helper) tulis ke `content_import_batches`+
     `content_import_batch_rows` (data JSONB = `ParsedWordPressItem` utuh).
   * ✅ **SELESAI (2026-07-27) — Mapping Penulis WordPress ➔ `post_authors`** (§ 2.4) — private
     helper `resolveOrCreateAuthor()` di file yang sama (BUKAN server action sendiri, tidak
     di-export — dipanggil `commitImportChunkAction` nanti). Cache-first (dedup per-batch) →
     lookup cross-batch (`lower(name)=lower(x) AND member_id IS NULL`, SENGAJA bukan `ilike()`
     supaya karakter `%`/`_` di nama penulis WP tidak disalahartikan wildcard SQL) → REUSE
     `createGuestPostAuthorAction()` yang sudah ada kalau belum ketemu (TIDAK reimplementasi
     insert `post_authors`). `posts.authorId` TIDAK PERNAH disentuh fungsi ini, `editorId`
     selalu null untuk konten hasil import — sesuai prinsip § 2.4.
   * ✅ **SELESAI (2026-07-27) — Asset & Image Downloader** (Fase 2 lama, dikerjakan lebih awal
     karena `commitOneRow()` butuh ini langsung, bukan modul terpisah) —
     `apps/web/lib/wordpress-image-import.server.ts` (`import "server-only"`):
     `downloadAndImportImage()` (`assertSafeExternalUrl()`/`safeFetch()` § 11 → validasi
     content-type+ukuran → `processImage()` module="website" § 7.1 → upload variant ke MinIO →
     insert `media` dengan `importBatchId` — pola PERSIS `app/api/media/upload/route.ts` asli,
     bukan simplifikasi) dan `rewriteInlineImages()` (`happy-dom`, cari semua `<img>`, dedup by
     src, rewrite `src`+`data-media-id` untuk yang sukses, SISAKAN APA ADANYA untuk yang gagal —
     § 15.3, non-destructive). `apps/web/lib/wordpress-tiptap-extensions.server.ts` (duplikasi
     SENGAJA — bukan share — dari daftar extension `components/editor/tiptap-editor.tsx` live,
     supaya `generateJSON()` hasilnya konsisten dengan editor sungguhan, § 7.2) +
     `apps/web/lib/wordpress-tiptap-convert.server.ts` (`convertHtmlToTiptapJson()`, return
     `null` bukan throw kalau gagal — baris ditandai `error`, tidak menggagalkan chunk).
   * ✅ **SELESAI (2026-07-27) — Skema `legacy_url_redirects`** (Fase 3 lama, dibangun lebih awal
     karena `commitOneRow()` langsung insert ke sini — § 5.5): tabel baru per-tenant
     `legacy_url_redirects` (`old_path` UNIQUE, `redirect_to`, `post_id` tanpa FK — pola
     cross-reference longgar project ini) di `packages/db/src/schema/tenant/website.ts` + DDL
     tenant baru (`create-tenant-schema.ts`) + migration
     `packages/db/migrations/0051_legacy_redirects_and_processing_status.sql` untuk tenant
     existing (dijalankan+diverifikasi lokal, dikonfirmasi ada di `pc-ikpm-jogjakarta` DAN
     `forcreator`). **Wiring 301 redirect di catch-all routing (§ 3, item Fase 3 di bawah)
     TETAP belum dikerjakan** — tabel+data-nya sudah ada dan terisi saat commit, tinggal dibaca.
   * ✅ **SELESAI (2026-07-27) — `commitImportChunkAction`** (§ 13) — orchestrator utama di
     `import-wordpress/actions.ts`: klaim atomic 2-langkah (SELECT kandidat `status='ready'` →
     UPDATE guarded jadi `'processing'`, bukan raw SQL `FOR UPDATE SKIP LOCKED`), loop per-baris
     panggil `commitOneRow()` (try/catch per baris — gagal SATU baris tidak menghentikan/merusak
     baris lain dalam chunk yang sama, ditandai `status='error'`+`errorMessage`), hitung ulang
     counter (`processedRows`/`insertedRows`/`errorRows`) dari status TERKINI semua baris,
     transisi status batch (`committing`→`committed`+`committedAt` saat `remaining=0`). Kolom
     `content_import_batch_rows.status` diperluas tambah `'processing'` (migration 0051 di atas
     + Drizzle schema `packages/db/src/schema/public/content-import.ts`) — dibutuhkan supaya
     klaim atomic tidak diproses ganda kalau dua panggilan chunk tumpang tindih.
     `commitOneRow()` sendiri: featured image DAN OG image sebagai **dua aset gambar terpisah**
     (§ 15.2), Tahap A (`sanitizeGutenbergHtml`) → `rewriteInlineImages` → Tahap B
     (`convertHtmlToTiptapJson`, throw kalau gagal → baris `error`), kategori dari
     `categories[0]` (parser sudah reorder primary saat parse), penulis via
     `resolveOrCreateAuthor()`, `canonicalUrl`/`finalPath` dihitung FRESH dari slug BARU (BUKAN
     dari nilai Yoast lama yang sudah rusak — § 5.5), insert `legacy_url_redirects` kalau path
     lama ≠ path baru (skip kalau sama, cegah redirect loop percuma).
     **Verifikasi**: karena `getTenantAccess()`/`headers()` genuinely tidak bisa dites di luar
     Next.js request scope (lihat catatan di bawah), strategi verifikasi yang dipakai adalah
     menguji LOGIC INTI langsung — `commitOneRow()` dan replika persis
     `commitImportChunkAction`'s body (setelah guard auth) dipanggil dengan objek `access` yang
     dikonstruksi dari nilai DB nyata (`tenant.id`+`tenantUser.id` sungguhan), BUKAN dari sesi
     Better Auth palsu. Dua putaran tes end-to-end terhadap data REAL:
     (1) 1 post dari `contoh-xml.xml` — post tercipta benar (title/slug/status/coverId/
     metaTitle/canonicalUrl/displayAuthorId/editorId=null/authorId=admin-importer/
     importBatchId/categoryId/isFeatured/viewCount semua benar), **`content` dikonfirmasi
     Tiptap JSON VALID** (bukan HTML mentah — syarat paling kritis § 7.2, `JSON.parse()` sukses
     dengan `type:"doc"` + node pertama `paragraph`), 1 tag pivot + 1 legacy redirect tercipta
     benar, media cover benar-benar ada dengan variant lengkap.
     (2) 3 post dari `wordpress-xml-forbis.xml`, `chunkSize=2` (< total 3, uji progress
     bertahap) + 1 baris SENGAJA digagalkan (title marker) untuk uji error-resilience: panggilan
     pertama `processed=2, done=false, status batch='committing'`; panggilan kedua
     `processed=3, done=true, status batch='committed'+committedAt terisi`; counter
     `insertedRows=2, errorRows=1` tepat; baris gagal-sengaja ditandai `error` dengan
     `errorMessage` terisi TANPA `createdContentId`, dan post untuk baris itu DIKONFIRMASI
     TIDAK tercipta di DB — sementara 2 baris lain berhasil normal (post+slug keduanya
     dikonfirmasi ada). Kedua putaran tes membersihkan seluruh data buatan sendiri, diverifikasi
     bersih via query independen setelahnya. File disposable dihapus semua.
     `tsc --noEmit` 0 error di kedua package + `bun run build --filter=@jalajogja/web` sukses.
   * ✅ **SELESAI (2026-07-27) — `archiveImportBatchAction`** (§ 14.1) — soft bulk-archive:
     `UPDATE posts/pages SET status='archived' WHERE import_batch_id=$1 AND status != 'archived'`
     (KEDUA tabel — `status='archived'` sudah valid di `CONTENT_STATUSES` existing, tidak perlu
     ALTER constraint). Guard: hanya batch `status='committed'` yang boleh diarsipkan (batch
     masih `draft`/`committing` ditolak dengan pesan jelas — belum ada konten untuk diarsipkan).
     `post_authors` dan `media` yang terhubung batch ini **TIDAK PERNAH disentuh** (resource
     shared/tetap valid meski post-nya archived) — sesuai § 14.1. Batch's OWN `status` TETAP
     `'committed'` (TIDAK ada nilai `'archived'` baru ditambah ke enum batch) — kolom baru
     `archived_at` (nullable timestamp, migration `packages/db/migrations/
     0052_content_import_batch_archived_at.sql`, pola PERSIS `committed_at`) jadi penanda
     "kapan rollback ini terakhir dijalankan" — penambahan kecil di luar yang eksplisit ditulis
     dokumen tapi konsisten dengan pola audit-trail yang sudah dikunci di tabel yang sama.
     **Verifikasi**: tes end-to-end genuine parse→commit→archive (bukan dummy data) terhadap
     `contoh-xml.xml` — commit dulu sampai `status='committed'` (reuse `commitChunkCore` dari
     verifikasi sebelumnya), lalu: (1) guard ditolak untuk batch `draft` dengan pesan jelas;
     (2) archive batch committed → `archivedPosts=1, archivedPages=0`, post berubah jadi
     `status='archived'`, batch TETAP `'committed'`, `archivedAt` terisi; (3) `post_authors`
     DAN `media` (cover image) dikonfirmasi masih ada utuh, tidak tersentuh sama sekali;
     (4) idempotency — archive KEDUA KALINYA pada batch yang sudah archived sukses tanpa error,
     `archivedPosts=0` (tidak diproses ulang). Semua data test dibersihkan+diverifikasi bersih
     via query independen. `tsc --noEmit` 0 error kedua package + `bun run build
     --filter=@jalajogja/web` sukses (dev server dimatikan+`.next` dibersihkan+direstart).

   > ⚠️ **Temuan penting saat implementasi**: `importWxrFileAction`/`importRestApiAction`,
   > `commitImportChunkAction` (wrapper auth-nya sendiri), dan `resolveOrCreateAuthor()` (jalur
   > "buat baru" via `createGuestPostAuthorAction()`) SEMUANYA bergantung `getTenantAccess()` →
   > `headers()` dari `next/headers` — TIDAK BISA dites via `bun run` biasa di luar konteks
   > request Next.js (beda dari masalah `server-only` sebelumnya — `"use server"` sendiri cuma
   > directive kosmetik, TIDAK bermasalah; masalahnya `headers()` yang genuinely butuh Next.js
   > request scope). **Keputusan verifikasi yang diambil**: `getTenantAccess()`+`hasFullAccess()`
   > adalah infrastruktur established yang sudah dipakai puluhan action lain di codebase ini
   > (termasuk `importWxrFileAction`/`importRestApiAction` sendiri yang SAMA PERSIS memakainya) —
   > risiko genuinely baru HANYA ada di LOGIC BARU di baliknya (klaim atomic, loop, per-row
   > commit, counter, error-resilience), dan logic itu SUDAH diverifikasi menyeluruh dengan data
   > real seperti dijelaskan di atas. Verifikasi genuine via browser+session sungguhan (klik
   > tombol commit di UI nyata) BELUM dilakukan — akan tercakup natural begitu UI dibangun dan
   > dicoba manual oleh user, bukan langkah terpisah yang perlu disengaja lagi.
   * ✅ **SELESAI (2026-07-27) — UI Import** `/{slug}/website/import-wordpress` —
     `page.tsx` (server, auth guard `getTenantAccess`+`hasFullAccess(...,"website")`, pola
     PERSIS `members/import/page.tsx`) + `import-wordpress-client.tsx` (client, 4 view state
     `input → preview → committing → report`, pola diadaptasi dari `ImportClient` Importer
     Anggota — bedanya: dua metode input (tab Upload WXR / Tarik URL REST) bukan satu, dan
     commit dipecah chunked dengan progress bar (bukan satu panggilan sinkron) sesuai § 13.
     Nav item baru "Import WP" ditambah ke `website-nav.tsx`.
     **Gap ditemukan+difix SAAT membangun UI, sebelum kode ditulis** (bukan sesudahnya) —
     `commitImportChunkAction`'s candidate query HANYA klaim `status='ready'`, padahal baris
     `'review_needed'` (tanggal publish tidak valid, `notes` eksplisit bilang "perlu diisi
     manual SETELAH import" — bukan blocker) genuinely aman ikut di-commit dan seharusnya
     TIDAK stuck permanen. Fix: `claimableStatuses = ["ready","review_needed"]` dipakai di
     KEDUA query (SELECT kandidat + UPDATE klaim) DAN formula `remaining` (counter `done`).
     **Sengaja TIDAK diklaim**: `'duplicate'` — tidak ada strategi "merge" untuk konten (beda
     dari member di Importer Anggota), slug yang sama berarti genuinely sudah ada, dibiarkan
     sebagai status terminal informational (admin lihat di preview, tidak diproses otomatis).
     **Diuji terpisah dengan disposable test**: 1 baris disimulasikan `status='review_needed'`
     (`publishedAtIso: null`) → dikonfirmasi ikut ter-commit (`processed=1, done=true`), post
     benar-benar tercipta dengan `publishedAt` fallback ke `NOW()` sesuai desain. Data test
     dibersihkan+diverifikasi bersih.
     Action baru ditambah (belum ada sebelumnya, dibutuhkan laporan akhir per-baris):
     `getBatchRowsAction(slug, batchId)` — query read-only `content_import_batch_rows`
     terkini (auth-gated sama seperti action lain), dipanggil SEKALI setelah `done:true` untuk
     menampilkan status final+`errorMessage` per baris di View Report (bukan cuma agregat
     count) — supaya admin tahu PERSIS baris mana yang gagal dan kenapa, bukan cuma angka.
     `tsc --noEmit` 0 error kedua package + `bun run build --filter=@jalajogja/web` sukses
     genuine (47 detik, bukan cache-hit — rute `/website/import-wordpress` 5.11 kB terkonfirmasi
     di output) + curl endpoint tanpa sesi → 307 redirect (bukan crash 500, guard auth bekerja).
     **Belum diverifikasi visual/interaktif di browser sungguhan** (upload file WXR nyata,
     lihat progress bar berjalan, klik archive — semua itu belum dicoba end-to-end oleh siapa
     pun) — keterbatasan environment sesi ini (tidak ada browser), user perlu coba langsung.

   **Fase 1 SELESAI 100%** — semua item (skema, parser WXR, REST fetcher, mapping penulis,
   image downloader, legacy redirect, `commitImportChunkAction`, `archiveImportBatchAction`,
   UI) sudah dibangun+diverifikasi (kecuali verifikasi visual browser yang dicatat eksplisit di
   atas). Lanjut ke Fase 2 kapan pun user memberi sinyal.
2. **Fase 2 — Custom Permalink Settings + Preservasi URL Lama — ✅ SELESAI 100% (2026-07-27/28)**
   *(Fase 2 lama "Asset & Image Downloader" sudah tercakup di Fase 1 di atas — dikerjakan lebih
   awal karena `commitOneRow()` butuh langsung, bukan modul terpisah)*.

   Dipecah 10 sub-fase (2.0–2.9), tiap sub-fase diverifikasi `tsc --noEmit` KEDUA package +
   (untuk perubahan routing) build produksi genuine + curl end-to-end sebelum lanjut ke sub-fase
   berikutnya — pola SOP yang sama persis dengan Fase 0/1.

   * **2.0 — Setting + migration** — `SETTING_GROUPS` sudah punya `"website"` (tidak perlu
     migration baru untuk group-nya), migration `legacy_url_redirects` (skema Fase 1) sudah
     jalan lokal, dikonfirmasi ulang.
   * **2.1 — Helper inti `lib/post-permalink.server.ts`** — `PERMALINK_STRUCTURES` (5 mode:
     `default`/`post_name`/`date_name`/`category_name`/`category_date_name`), `PERMALINK_LABELS`
     (label+contoh URL per mode, dipakai ulang oleh settings UI di 2.9), `getTenantPermalink()`,
     `buildPostPath()` (pure, semua cabang fallback ke `/post/{slug}` kalau data prasyarat
     kosong), `resolvePostHrefs<T>()` (SATU fungsi dipanggil SEMUA query-builder post di seluruh
     app — fetch permalink+timezone tenant SEKALI, tambahkan `href` relatif ke tiap baris,
     `year`/`month` via `utcIsoToLocalDatetime()` yang sudah ada, bukan `new Date()` mentah).
     Diverifikasi via disposable test: 20 kombinasi (5 permalink × 4 kondisi data) semua lulus.
   * **2.2 — 9 query-builder site** — `app/api/search/route.ts`, `app/api/ref/public-links/
     route.ts` (+ hapus `buildPostUrl()` lama yang jadi dead code), `hero-section.tsx`,
     `lib/widget-areas.ts`, `posts-section.tsx` (2 fetcher), `post/page.tsx`, `post/[slug]/
     page.tsx` (query related-posts + query post utama) — semua ditambah `categorySlug` ke
     SELECT + panggil `resolvePostHrefs`. Ditemukan+diperbaiki bug recurring class ke-sekian
     kali di project ini SAAT mengerjakan `app/api/search/route.ts`: sempat mengirim `tenantDb`
     (raw destructure) ke `resolvePostHrefs` alih-alih `tenantClient` (objek `TenantDb` penuh) —
     ketangkap SEBELUM `tsc`, langsung dikoreksi.
   * **2.3 — ~12 consumer render site** — SEJAUH INI penaksiran awal ("6 post card + posts-
     design-2.tsx") TERBUKTI JAUH kurang dari kenyataan: `tsc` (setelah rename `PostsSectionProps.
     tenantSlug`→`baseUrl`) menemukan LIMA file `posts-design-1..5.tsx` semuanya memanggil
     `<PostCard>` dengan prop lama — ternyata `baseUrl` sama sekali belum pernah di-propagate
     dari `landing-template.tsx`→`PostsSection`→Design1-5→`PostCard`/6 varian (`post-card-
     klasik/list/overlay/ringkas/judul/ticker.tsx`, semua rename `tenantSlug`→`baseUrl` sekaligus
     fix href jadi `${baseUrl}${post.href}`). Drive-by fix custom-domain: beberapa card pakai
     `tenantSlug` mentah (bukan `baseUrl`) untuk href — sekalian dibetulkan karena baris itu
     sudah disentuh untuk swap `post.href`. `widget-area.tsx` (2 caller) dan header search
     (`pill-header.tsx`, `flex-header.tsx` ×2 titik) juga ikut di-swap. Diverifikasi via curl:
     post detail, arsip, homepage, produk/agenda/campaign (regresi check) semua 200 dengan href
     benar.
   * **2.4 — Ekstrak post detail jadi shared renderer (PALING BERISIKO)** — `post/[slug]/
     page.tsx` (567 baris: `formatPostDate`, `getPost`, `getRelatedPosts`, `generateMetadata`,
     `BlogDetailPage`) diekstrak MURNI (pure code motion, zero perubahan logic) ke
     `components/website/public/single/post-detail-view.tsx` (`getPostDetailMetadata()` +
     `PostDetailView()`, keduanya diekspor). `post/[slug]/page.tsx` jadi wrapper tipis 15 baris.
     Diverifikasi via curl end-to-end (bukan cuma `tsc`): title, canonical tag, og:type, kedua
     h1 (mobile+desktop), related-posts links, breadcrumb, "Kembali ke Blog" — semua identik
     dengan sebelum ekstraksi. Regresi check ke produk/agenda/campaign juga 200.
   * **2.5 — Catch-all `[...slug]/page.tsx`** — `[pageSlug]/page.tsx` (single-segment, HANYA
     query `pages`, tidak bisa tangkap path multi-segmen) **DIGANTI TOTAL**. `actions.ts`
     (Server Action `submitContactFormAction`, dipakai `ContactTemplate`) ikut dipindah ke
     folder baru, 1 import path diperbaiki. 6-prioritas resolusi: (1) 1-segmen → coba Page dulu
     (perilaku default dipertahankan persis), (2) 1-segmen + permalink="post_name" → coba Post,
     (3) 3-segmen + permalink="date_name" → Post via segmen ke-3, (4) 4-segmen + permalink=
     "category_date_name" → Post via segmen ke-4 (category segmen MURNI KOSMETIK, tidak dipakai
     lookup), (5) tidak ketemu → cek `legacy_url_redirects`, `permanentRedirect()` (308) kalau
     ketemu, (6) semua gagal → `notFound()`. **Diverifikasi EMPIRIS lewat build produksi genuine
     + curl end-to-end untuk SEMUA skenario**: static folder routes (post/produk/agenda/
     campaign) tetap prioritas di atas catch-all (dikonfirmasi, bukan diasumsikan — Next.js App
     Router SELALU cocokkan folder statis dulu), Page resolusi via catch-all (default+terms
     template), homepage (0 segmen, terpisah dari catch-all) tidak terpengaruh, 404 untuk slug
     tidak ada, legacy redirect (308 + Location header benar, test row insert+curl+delete),
     DAN 3 dari 4 mode permalink yang bisa dites via catch-all (`post_name`, `date_name`,
     `category_date_name`) semua resolve dengan canonical tag yang benar — termasuk konfirmasi
     Page tetap menang atas Post meski permalink="post_name" (prioritas #1 dipertahankan).
   * **2.6 — Route nested untuk `category_name`** — **Bug ditemukan via `next dev` (BUKAN
     `next build`, yang tidak menangkap ini sama sekali)**: folder awal `post/[category]/[slug]/
     page.tsx` gagal start dengan error eksplisit *"You cannot use different slug names for the
     same dynamic path ('category' !== 'slug')"* — Next.js App Router mewajibkan SATU nama
     dynamic segment yang sama di kedalaman yang sama untuk SEMUA route sibling; `post/[slug]/
     page.tsx` (mode default) sudah menetapkan nama `slug` di posisi pertama, jadi route nested
     WAJIB pakai nama yang sama di posisi itu. **Fix**: folder di-rename jadi `post/[slug]/
     [postSlug]/page.tsx` — segmen pertama (`slug`, murni kosmetik, mewakili category) TIDAK
     dipakai untuk lookup, cuma segmen kedua (`postSlug`) yang dipakai. Diverifikasi: build
     sukses DAN dev server restart tanpa error (pengujian penentu — production build TIDAK
     menangkap konflik ini, hanya dev server Turbopack yang menangkapnya). Curl: nested route
     resolve dengan category segmen sembarang (kosmetik tervalidasi), sibling `/post/{slug}`
     (default) dan `/post` (arsip) tidak regresi.
   * **2.7 — Validasi slug (reserved + cross-collision)** — `lib/reserved-post-slugs.ts`
     (`RESERVED_POST_SLUGS`, 25 folder statis REAL saat ini di `app/(public)/[tenant]/`, bukan
     disalin dari draft dokumen basi — TIDAK termasuk `app`/`platform`/`api`/`admin`, itu
     reserved untuk TENANT SLUG di `middleware.ts`, beda konsep sama sekali dari POST SLUG di
     dalam satu tenant). Helper baru `validateSlugForPostNameMode()` di `website/actions.ts` —
     HANYA aktif kalau permalink tenant="post_name" (mode lain tidak berisiko collision), cek
     reserved-word DAN cross-table (post vs page) kedua arah. Diwire ke SEMUA 6 fungsi create/
     update post/page (`createPostAction`, `createPostDraftAction`, `updatePostAction`,
     `createPageAction`, `createPageDraftAction`, `updatePageAction`) — hard-reject dengan pesan
     jelas (bukan auto-suffix silent seperti pola dedup lama, disengaja karena collision di
     sini lebih konsekuensial: post bisa jadi permanently unreachable). Diverifikasi via
     disposable script (5 skenario terhadap DB lokal real): default mode selalu lolos,
     post_name mode reserved-word ditolak (post DAN page), slug bebas lolos, cross-collision
     post→page dan page→post keduanya ditolak — semua PERSIS sesuai ekspektasi.
   * **2.8 — `commitOneRow` jadi permalink-aware** — `finalPath` (WordPress import, Fase 1)
     sebelumnya HARDCODE `/post/{slug}` untuk semua post, terlepas permalink tenant. Sekarang
     panggil `resolvePostHrefs()` yang sama dipakai semua halaman publik lain — tenant yang
     pilih `category_date_name` (motivasi utama SELURUH fitur import ini, meniru struktur URL
     `forbis.id`) sekarang benar-benar dapat `canonicalUrl`/`legacyUrlRedirects.redirectTo`
     sesuai mode yang dipilih. `findOrCreateTaxonomy()` diperluas return `{id, slug}` (bukan
     cuma `id`) supaya `categorySlug` tersedia untuk `resolvePostHrefs`. Diverifikasi via
     disposable test terfokus (reuse `resolvePostHrefs` yang sudah teruji, bukan re-test
     seluruh pipeline import yang sudah teruji ekstensif sesi lalu): `category_date_name` mode
     menghasilkan `finalPath` PERSIS sesuai ekspektasi.
   * **2.9 — Settings UI** — Section baru "Struktur URL Artikel" di `/{slug}/website/
     pengaturan` (dropdown 5 opsi via `Combobox` + preview contoh URL live, komponen client
     baru `PermalinkStructureForm`) + `savePermalinkStructureAction` (validasi terhadap
     `PERMALINK_STRUCTURES`, `revalidatePath` ke settings page + tenant root + arsip post).
     `setTenantPermalink()` ditambah ke `lib/post-permalink.server.ts` (simetris dengan
     `getTenantPermalink()`, satu sumber kebenaran untuk key/group setting — bukan hardcode
     string di dua tempat). Diverifikasi via build produksi genuine (route 6.4 kB muncul) +
     curl (307 redirect tanpa sesi, bukan crash 500).

   **Verifikasi akhir Fase 2**: regresi sweep 12+ tipe rute publik (homepage, post, produk,
   agenda, campaign, anggota, pesantren, usaha, profesional, statistik, login, register,
   keranjang) — semua tetap 200, nol collateral damage dari seluruh perubahan routing. `tsc
   --noEmit` bersih di KEDUA package sebagai gate final. **Semua data test (setting permalink,
   baris legacy redirect, file disposable) sudah dibersihkan+diverifikasi bersih di setiap
   sub-fase** — tidak ada sisa state test di database lokal.

   **Belum di-commit ke git, belum dijalankan di VPS, belum diverifikasi visual/interaktif di
   browser sungguhan** (klik dropdown permalink di UI settings, lihat hasilnya di halaman
   publik — belum dicoba siapa pun) — keterbatasan environment sesi ini (tidak ada browser),
   user perlu coba langsung sebelum deploy produksi.
3. **Fase 3 — WXR Exporter — ✅ SELESAI 100% (2026-07-28)**:
   * `lib/wordpress-wxr-export.server.ts` (baru) — `generateWxrExport(slug)`, cermin terbalik
     dari `wordpress-xml-parser.server.ts` (Fase 1). Ambil data dari `posts`, `post_categories`,
     `post_tags`, `post_authors`, `media` — SESUAI PERSIS scope § 2.3 (Pages/Produk/Donasi/Event
     sengaja TIDAK diekspor, konsisten fokus post-only yang sudah dikonfirmasi user untuk
     seluruh fitur import/export ini).
   * Semua status post (draft/published/archived) diikutkan — bukan cuma published — konsisten
     prinsip anti vendor lock-in (§ 2.3): admin harus bisa membawa SEMUA datanya. `archived` →
     dipetakan WP `draft` (WordPress tidak punya status "archived" native).
   * `<dc:creator>` diisi dari `post_authors.name` via `displayAuthorId` — TEPAT SESUAI § 2.3,
     BUKAN dari `posts.authorId` (internal/immutable). Post tanpa `displayAuthorId` → fallback
     username sintetis `"admin"` + `<wp:author>` block sintetis (author_id=0) yang HANYA
     dideklarasikan kalau benar-benar ada post yang memakainya. `posts.editorId` TIDAK diekspor
     sama sekali (keputusan sadar, konsisten `docs/arsitektur-seo.md` § 6b.4 — WordPress tidak
     punya konsep byline Editor yang setara).
   * Reuse infrastruktur Fase 2 (`resolvePostHrefs` untuk `<link>` yang menghormati
     `permalink_structure` tenant) dan `getTenantSeoBase` (baseUrl absolut custom-domain-aware
     untuk `<link>`/`<wp:base_site_url>`) — TIDAK reimplementasi href-building sendiri.
   * `renderBody()` (`lib/letter-render.ts`, SUDAH ADA sejak modul Surat) di-reuse langsung
     untuk konversi Tiptap JSON → HTML `<content:encoded>` — arah KEBALIKAN dari Fase 0's
     `generateJSON()` (HTML→Tiptap), TIDAK perlu library baru.
   * Mapping SEO ke Yoast postmeta keys: `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`,
     `_yoast_wpseo_opengraph-title`, `_yoast_wpseo_opengraph-description`, `_yoast_wpseo_focuskw`,
     `_yoast_wpseo_primary_category` (term_id sintetis kategori), `_yoast_wpseo_meta-robots-noindex`
     + `_yoast_wpseo_meta-robots-nofollow` (keduanya, untuk round-trip lossless status
     `noindex,nofollow` — awalnya cuma 1 key, DITEMUKAN+DIFIX lewat round-trip test terhadap
     importer sendiri), `wpb_post_views_count`, `_yoast_wpseo_opengraph-image` (URL string,
     BUKAN attachment ID — key ini di Yoast memang berisi URL). `posts.canonicalUrl` SENGAJA
     TIDAK diekspor ke `_yoast_wpseo_canonical` — canonical lama menunjuk situs Jalakarta asal,
     mewariskannya ke situs WordPress tujuan lebih membingungkan daripada membiarkan Yoast
     hitung canonical sendiri di situs baru.
   * Featured image (`coverId`) → `<item post_type="attachment">` terpisah + postmeta
     `_thumbnail_id` (pola WXR standar, term_id/post_id sintetis dengan counter SHARED antara
     posts+attachments, dimulai dari 1000 — meniru gaya penomoran WordPress asli).
   * Tag TIDAK dideklarasikan sebagai `<wp:tag>` di level channel — dikonfirmasi dari 2 sample
     WXR real (`docs/template/*.xml`) bahwa WordPress sendiri tidak selalu melakukan ini; cukup
     inline `<category domain="post_tag" nicename="...">` per item, importer WordPress standar
     otomatis membuat term baru dari deklarasi ini.
   * Kategori mendukung hierarki (`parentId` → `category_parent` nicename induk) — DIUJI dengan
     kategori bertingkat sungguhan.
   * **Keterbatasan V1 yang diterima**: link internal "Baca Juga" (RelatedLinkBlock) yang
     tersimpan path-mode (`/{slug}/post/...`) TIDAK di-absolute-kan saat render body
     (`RenderContext` tidak diberi `tenantSlug`/`baseUrl`, murni `imageBaseUrl` untuk gambar) —
     konten utama (isi artikel + gambar) tetap benar, cuma blok "Baca Juga" (fitur minor) yang
     jadi path relatif tanpa domain di file exported.
   * **Route**: `GET /api/website/export-wxr?slug={slug}` (baru) — auth via `getTenantAccess`+
     `hasFullAccess(...,"website")` (pola sama `/api/members/import/template`), return
     `Content-Type: application/xml` + `Content-Disposition: attachment` — trigger download
     native browser, TANPA JS. Tombol "Export ke WordPress" ditambahkan di
     `/{slug}/website/posts` (halaman existing, cukup 1 `<a href>` di sebelah tombol "Tambah
     Post").
   * **Verifikasi empiris menyeluruh** (bukan cuma `tsc`) — data test disposable disisipkan ke
     tenant lokal `pc-ikpm-jogjakarta` (17 post real + 2 post test: 1 draft kaya-fitur dengan
     kategori bertingkat/tag/2 penulis/SEO lengkap/robots noindex,nofollow/OG image beda dari
     cover, 1 archived minimal tanpa penulis untuk uji fallback "admin"):
     1. `XMLValidator.validate()` (`fast-xml-parser`) → **VALID**, XML well-formed.
     2. Parse+inspeksi struktur: channel meta benar, 3 `<wp:author>` benar (termasuk fallback
        admin), 3 `<wp:category>` benar (termasuk parent nicename kategori bertingkat), 36 item
        (19 post + 17 attachment unik — dedup `Set` coverMediaIds terbukti bekerja), SEMUA
        `<dc:creator>` di SEMUA 19 post (bukan cuma yang ditest) resolve ke `wp:author_login`
        yang benar-benar dideklarasikan — nol mismatch.
     3. **Round-trip test** — file yang di-export dijalankan BALIK lewat
        `wordpress-xml-parser.server.ts` (importer Fase 1 sendiri, sudah battle-tested terhadap
        WordPress real) — title/slug/status(`duplicate`, benar karena slug memang sudah ada)/
        kategori bertingkat/tag/author(username+displayName)/SEO(metaTitle/metaDesc/
        focusKeyword/robots/ogImageUrl)/featuredImageUrl/content/excerpt/publishedAtIso/
        legacyPath — SEMUA cocok 1:1 dengan data asal. Inilah yang menemukan bug robots
        single-key di atas (ketahuan dari `seo.robots` round-trip jadi `"noindex"` bukan
        `"noindex,nofollow"`, bukan ditebak).
   * `tsc --noEmit` bersih di `apps/web` (2×, sebelum dan sesudah fix robots) + `bun run build
     --filter=@jalajogja/web` genuine 2× (dev server dimatikan+`.next` dibersihkan+direstart
     setelah) — route `/api/website/export-wxr` terkonfirmasi 352 B di output build. Semua data
     test (5 baris DB + 8 file disposable) dibersihkan+diverifikasi bersih (`total_posts_now=17`
     kembali ke baseline).
   * **Belum di-commit ke git, belum dijalankan di VPS, belum diverifikasi visual di browser
     (klik tombol, unduh file sungguhan), dan belum diverifikasi dengan import BALIK ke instance
     WordPress sungguhan** — keterbatasan environment sesi ini (tidak ada browser, tidak ada
     WordPress test instance) — user perlu coba end-to-end sebelum dianggap production-ready
     penuh untuk kasus WordPress real (round-trip lewat importer sendiri adalah bukti kuat tapi
     bukan pengganti tes WordPress sungguhan).

---

## 9. Ringkasan Audit 2026-07-27 — Semua Koreksi dalam Satu Tempat

> Diminta eksplisit: verifikasi arsitektur dokumen ini terhadap kode SUNGGUHAN sebelum diuji,
> khususnya sinkronisasi Featured Image/Penulis/Tanggal/Block Editor/SEO dengan arsitektur post
> yang sudah ada, dan alur mengikuti pola Importer Anggota yang sudah stabil (beda sumber saja).
> Putaran KEDUA: user tanya spesifik soal preservasi URL lama — ditemukan gap yang TERLEWAT di
> audit putaran pertama (temuan #11).

| # | Temuan | Severity | Lokasi Koreksi |
|---|---|---|---|
| 1 | Nama tabel salah (`website_posts` dkk, prefix tidak ada di kode) | Kosmetik | § 2, § 2.3, § 4 |
| 2 | **Sistem Penulis/Editor (`post_authors`) sama sekali tidak disebut** — risiko `authorId` internal tertimpa data WordPress | **KRITIS** | § 2.4 (baru) |
| 3 | **Format konten — dokumen asumsikan HTML, padahal `posts.content` WAJIB Tiptap JSON** — tanpa fix ini semua artikel hasil import akan tampil rusak | **KRITIS** | § 7.2 (ditulis ulang total) |
| 4 | Featured Image/OG Image insert manual tanpa lewat `processImage()`, dan salah skema (`public.media` vs `tenant.media`) | Tinggi | § 7.1, § 4.1 |
| 5 | `import_batches`/`import_batch_rows` diklaim "reuse" padahal skemanya spesifik member (kolom `member_name`/`member_id` hardcode, tanpa diskriminator) | Tinggi | § 3 Gap 1, § 8 Fase 1 |
| 6 | Helper timezone mengusulkan `dayjs` baru padahal project sudah punya `lib/tenant-timezone.ts`/`.server.ts` established | Sedang | § 6.2 |
| 7 | Routing catch-all — nama file salah (`[...slug]` vs `[pageSlug]` asli) DAN klaim "sudah cek posts" padahal belum ada sama sekali | Tinggi | § 5.3, § 5.4 (baru) |
| 8 | `RESERVED_TENANT_SLUGS` sudah basi sejak ditulis (tidak menyertakan rute publik yang sudah ada: `campaign`, `profesional`, `pesantren`, `usaha`, `gabung`, dll) | Sedang | § 5.3 |
| 9 | Fase 2 Subdomain domain routing diklaim aktif, padahal disembunyikan/belum live | Sedang | § 5.2 |
| 10 | SEO hardcode asumsi Yoast, padahal user eksplisit minta pluggable untuk plugin SEO lain | Sedang | § 4.3 (baru) |
| 11 | **Tidak ada preservasi URL lama (redirect 301) — risiko kehilangan nilai SEO Google yang sudah terbangun bertahun-tahun** — TERLEWAT di audit putaran pertama, baru ketahuan dari pertanyaan langsung user | **KRITIS** | § 3 Gap 9, § 5.4 (revisi — `[pageSlug]`→`[...slug]`), § 5.5 (baru), § 8 Fase 3 |

**Yang SUDAH sinkron dari draf pertama (tidak perlu koreksi)**: seluruh 8 nama kolom SEO di
§ 4.1 (metaTitle/metaDesc/focusKeyword/ogTitle/ogDescription/ogImageId/canonicalUrl/robots/
schemaType) match persis skema Drizzle asli — bagian terkuat dari dokumen ini sejak draf
pertama.

**Catatan proses (kejujuran, bukan formalitas)**: temuan #11 seharusnya sudah tertangkap di
audit putaran pertama — "preservasi URL/redirect saat migrasi" adalah pertanyaan SEO standar
untuk migrasi platform apa pun, bukan sesuatu yang eksotis. Baru muncul karena user bertanya
langsung, bukan karena audit pertama benar-benar tuntas. Pelajaran: untuk dokumen migrasi/
import konten dari platform LAIN, checklist audit ke depan wajib eksplisit mencakup
"preservasi URL/redirect" sebagai satu item tersendiri — jangan andalkan audit umum
"sinkron dengan arsitektur X" untuk otomatis menangkap kebutuhan spesifik migrasi seperti ini.

---

## 10. Putaran Ketiga (Pra-Eksekusi) — 6 Pertanyaan, SEKARANG SUDAH DIJAWAB

> **Status: ✅ SEMUA 6 POIN SUDAH PUNYA RESOLUSI KONKRET (2026-07-27, putaran ke-4)** — user
> minta arsitektur untuk keenamnya dilengkapi sebelum eksekusi. Desain lengkap ada di section
> BARU § 11-§ 14 di bawah. Daftar asli 6 pertanyaan dipertahankan di bawah ini APA ADANYA
> (sebagai catatan proses "apa yang ditanyakan"), masing-masing sekarang ditandai dengan
> pointer ke section resolusinya — JANGAN dibaca sebagai "masih terbuka", baca section yang
> ditunjuk untuk desain final.

1. **SSRF** — ✅ Diresolusi di **§ 11** (validasi skema+DNS+IP privat, redirect manual-check,
   timeout+budget per batch).
2. **XXE** — ✅ Diresolusi di **§ 12.1** (test wajib di Fase 0, cek konfigurasi `fast-xml-parser`,
   cap ukuran file, validasi root element sebelum full parse).
3. **`fast-xml-parser` bukan dependency** — ✅ Diresolusi di **§ 12.2** (action item konkret,
   bagian dari checklist Fase 0).
4. **Model eksekusi/background job** — ✅ Diresolusi di **§ 13** (KEPUTUSAN: TIDAK menambah
   infrastruktur job baru — reuse pola chunked-commit client-driven, natural fit dengan
   pagination REST API WordPress sendiri).
5. **Rollback/undo batch** — ✅ Diresolusi di **§ 14.1** (KEPUTUSAN: soft bulk-archive sebagai
   default MVP, BUKAN hard-delete — lebih aman, konsisten prinsip "lebih suka aksi reversibel").
6. **Scope Pages ambigu** — ✅ Diresolusi di **§ 14.2** (KEPUTUSAN: Pages IKUT diimpor dengan
   infrastruktur SAMA — SEO, gambar, konversi Tiptap — TAPI TANPA byline Penulis/Editor, sesuai
   scope asli `docs/arsitektur-penulis-post.md` § 9). DDL lengkap `content_import_batches`/
   `content_import_batch_rows` (yang sebelumnya cuma rasional tanpa skema tertulis) juga ada di
   § 14.2 — nama tabel diubah dari `post_import_batches` jadi `content_import_batches` karena
   sekarang eksplisit menangani Post DAN Page.

Lihat § 11-§ 14 di bawah untuk desain lengkap keenam resolusi ini.

---

## 11. Mitigasi SSRF — Validasi URL Eksternal (Resolusi Poin 1, § 10)

> ✅ **DIIMPLEMENTASIKAN NYATA 2026-07-27** (§ 16.6) — bagian ini dulu berisi sketsa/stub kode
> (fungsi `isPrivateOrReservedIp` kosong, cuma komentar rencana). Sekarang mendeskripsikan
> implementasi SUNGGUHAN di `apps/web/lib/wordpress-import-security.ts`, sudah diuji dengan
> 33 test case real (DNS resolve sungguhan + redirect sungguhan via httpbin.org, § 16.6) — 2
> bug NYATA ditemukan+difix saat implementasi (bukan cuma teori, lihat § 16.6).

Semua permintaan HTTP KELUAR yang dipicu oleh input admin — URL situs WordPress lama (§ 2.2),
URL gambar featured/inline (§ 7.1/§ 7.2) — WAJIB lewat satu gerbang validasi yang sama SEBELUM
fetch pertama dilakukan.

**Modul**: `apps/web/lib/wordpress-import-security.ts` — dua fungsi diekspor:

- **`assertSafeExternalUrl(rawUrl)`** — validasi SATU URL (skema http/https, DNS resolve
  sungguhan, tolak kalau salah satu IP hasil resolve privat/reserved). Return
  `{ok:true, url:URL} | {ok:false, reason:string}`. **TIDAK** mengikuti redirect — itu tanggung
  jawab `safeFetch`.
- **`safeFetch(rawUrl, init?)`** — wrapper `fetch()` yang aman dari SSRF-via-redirect:
  `redirect:"manual"`, validasi ULANG setiap hop (termasuk hop pertama) via
  `assertSafeExternalUrl()` sebelum benar-benar fetch, maksimal 3 hop, timeout 10 detik per hop.
  **Ini fungsi yang WAJIB dipakai** untuk semua fetch eksternal fitur ini (bukan
  `assertSafeExternalUrl` + `fetch()` manual terpisah) — satu titik gerbang, cegah drift.

Cek IP privat/reserved (`isPrivateOrReservedIp`, tidak diekspor, internal modul) menangani:
- **IPv4**: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8 (loopback), 169.254.0.0/16
  (link-local, termasuk target klasik cloud metadata `169.254.169.254`), 0.0.0.0/8.
- **IPv6**: `::1` (loopback), `fc00::/7` (unique local), `fe80::/10` (link-local).
- **IPv6 IPv4-mapped (`::ffff:0:0/96`)** — TIDAK ada di daftar asli dokumen ini, ditambahkan
  saat implementasi setelah ditemukan sebagai bypass nyata (§ 16.6) — evaluasi 4 octet IPv4
  yang di-embed di 2 grup 16-bit terakhir memakai aturan IPv4 yang sama di atas.

**Aturan tambahan (WAJIB, bukan opsional, SEMUA sudah diimplementasikan di `safeFetch`):**
1. **Redirect TIDAK diikuti otomatis** — `fetch(url, { redirect: "manual" })`. Kalau respons
   3xx, ambil header `Location`, jalankan `assertSafeExternalUrl()` LAGI terhadap target
   redirect (karena URL awal yang lolos validasi bisa saja redirect ke IP internal — celah
   klasik SSRF-via-redirect) — maksimal **3 hop**, lebih dari itu tolak.
2. **Timeout per-request**: `AbortSignal.timeout(10_000)` (10 detik) — sama pola yang sudah
   dipakai `middleware.ts`'s `resolveCustomDomainSlug()` untuk fetch internal, konsisten gaya.
3. **Budget per batch**: cap jumlah total fetch eksternal per batch import (mis. maks 5.000 —
   generous untuk "ribuan artikel" tapi tetap ada batas keras) — cegah batch yang secara tidak
   sengaja (atau sengaja disalahgunakan) memicu puluhan ribu request keluar tanpa henti. ⚠️
   **BELUM diimplementasikan** — ini state PER-BATCH (butuh counter terikat sesi import), tidak
   masuk akal hidup di modul security stateless ini — jadi tanggung jawab Fase 1 (engine
   pemroses batch), bukan modul ini. Dicatat eksplisit supaya tidak terlupa saat Fase 1 ditulis.
4. **Berlaku untuk SEMUA fetch eksternal fitur ini** — bukan cuma URL WordPress utama:
   featured image (§ 7.1), inline image (§ 7.2), REST API pagination (§ 2.2) SEMUA WAJIB lewat
   `safeFetch()` yang sama — bukan setiap titik fetch menulis validasi/redirect-loop sendiri.

---

## 12. Mitigasi XXE + Dependency Baru (Resolusi Poin 2 & 3, § 10)

### 12.1. Keamanan Parser XML

`fast-xml-parser` adalah parser JS murni (bukan berbasis `libxml`) — secara desain TIDAK
memproses `<!DOCTYPE>`/external entity sama sekali (beda dari parser XML berbasis C/libxml yang
historically rentan XXE). **Ini klaim umum tentang library-nya, BUKAN sesuatu yang sudah
diverifikasi terhadap versi yang benar-benar terinstall di project ini** — WAJIB dibuktikan,
bukan diasumsikan dari nama/reputasi library:

**Test wajib masuk checklist Fase 0** (bersama POC Tiptap, § 7.2): siapkan 1 file WXR uji berisi
```xml
<?xml version="1.0"?>
<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<rss>...<content:encoded>&xxe;</content:encoded>...</rss>
```
Parse dengan `fast-xml-parser` memakai opsi konfigurasi yang akan benar-benar dipakai importer
— hasil yang DITERIMA: parse error, ATAU `&xxe;` muncul sebagai teks literal tidak ter-resolve.
Hasil yang GAGAL (harus dicegah sebelum Fase 1 lanjut): isi file `/etc/passwd` sungguhan bocor
ke output parse.

**Mitigasi tambahan (independen dari hasil test di atas, defense-in-depth):**
- Cap ukuran file upload WXR: **tolak file > 200 MB** sebelum parser bahkan dipanggil (cek
  `file.size` dari FormData langsung — operasi murah, cegah memory exhaustion dari file yang
  terlalu besar terlepas dari isinya).
- Validasi root element via regex/string-check CEPAT pada beberapa KB pertama file SEBELUM full
  parse — tolak dini kalau file yang diupload jelas bukan WXR (bukan XML sama sekali, atau XML
  tapi bukan format WordPress). **Version-tolerant** (dikoreksi § 2.1/§ 15.1 — sample real pakai
  `1.2`, bukan `1.0`): cek prefix `xmlns:wp="http://wordpress.org/export/` HADIR (versi apa pun
  di belakangnya, 1.0/1.1/1.2), JANGAN cocokkan string versi persis.

### 12.2. Dependency Baru yang Perlu Ditambahkan

Dikonfirmasi BUKAN dependency saat ini (`package.json` — nol hasil grep untuk kedua nama):
```bash
bun add fast-xml-parser --filter=@jalajogja/web   # parser WXR (§ 2.1)
bun add @tiptap/html@3.22.3 happy-dom --filter=@jalajogja/web  # konversi HTML→Tiptap JSON (§ 7.2, hasil § 16)
```
**WAJIB di `apps/web/package.json`, BUKAN root `package.json`** — lesson lama project ini
("dependency WAJIB dideklarasikan di workspace yang benar-benar mengimpornya") berulang kali
jadi sumber bug deploy VPS ketika dilanggar.

---

## 13. Model Eksekusi — Chunked Commit, BUKAN Infrastruktur Job Baru (Resolusi Poin 4, § 10)

**Keputusan**: TIDAK menambah Redis/BullMQ/queue worker apa pun. Project ini murni PM2+Next.js
tanpa infrastruktur job sama sekali — menambah itu untuk SATU fitur adalah keputusan infra
besar yang tidak sepadan. Solusi yang dipakai: **commit berjalan per-chunk, didorong oleh
client**, bukan satu pemanggilan Server Action yang memproses semua baris sekaligus.

**Untuk metode Upload WXR (§ 2.1)** — parse SELURUH file jadi baris `content_import_batch_rows`
(§ 14.2) di SATU panggilan (ini murni CPU/parsing, ringan, tidak ada I/O eksternal — aman
sinkron meski filenya besar, sama seperti pola `parseImportFileAction` Importer Anggota). Commit
(tahap BERAT — gambar+Sharp+Tiptap per baris) dipecah:
```typescript
// Client memanggil berulang sampai processed_rows === total_rows, menampilkan progress bar
export async function commitImportChunkAction(
  slug: string, batchId: string, chunkSize = 10  // KECIL — setiap baris berat (gambar+Sharp+Tiptap)
): Promise<{ processed: number; total: number; done: boolean }>
```
Setiap panggilan: klaim atomic N baris berikutnya (`UPDATE ... WHERE status='ready' ... LIMIT
10 RETURNING id` — pola sama `commitImportAction` Importer Anggota), proses satu-satu (download
gambar → `processImage()` → Tiptap convert → insert post/page), update `processed_rows`,
kembalikan progress. Client (mirip UX "Generate Semua PDF"/pola fire-loop yang sudah ada di
modul Surat) memanggil lagi otomatis sampai `done: true`.

**Untuk metode Pull REST API (§ 2.2)** — chunk boundary MENGIKUTI pagination WordPress sendiri
(sudah 100 post per halaman) — TIDAK perlu logic chunking terpisah: fetch 1 halaman → proses
halaman itu (insert ke `content_import_batch_rows` sebagai draft, ATAU langsung commit per-item
tergantung mode UI) → kembalikan progres ke client → client minta halaman berikutnya. Natural
fit, tidak ada penambahan mekanisme baru.

**Estimasi waktu & mitigasi timeout (defense-in-depth, JANGAN cuma andalkan satu lapis)**:
worst-case ~3-5 detik/baris (download+Sharp+Tiptap) × `chunkSize=10` ≈ 30-50 detik per
panggilan — DI BAWAH default Nginx `proxy_read_timeout` (60s), tapi mepet. Mitigasi ganda:
(1) `chunkSize` default **10, bukan 50** (lebih kecil dari draf awal di § 10 karena kerja
per-baris disini jauh lebih berat dari member import); (2) naikkan `proxy_read_timeout`/
`fastcgi_read_timeout` untuk route import ini secara spesifik di config Nginx ke ~180 detik
sebagai margin aman tambahan — dua-duanya dilakukan BERSAMA, bukan salah satu saja.

---

## 14. Rollback & Scope Pages (Resolusi Poin 5 & 6, § 10)

### 14.1. Rollback — Soft Bulk-Archive, BUKAN Hard-Delete

**Keputusan**: batch yang sudah commit bisa di-"undo" via **`archiveImportBatchAction(slug,
batchId)`** — set `status='archived'` untuk SEMUA post/page yang berasal dari batch itu.
**TIDAK PERNAH hard-DELETE** — konsisten prinsip "lebih suka aksi reversibel" (§ instruksi
sistem tentang blast-radius aksi) dan lebih aman untuk kasus admin sudah sempat edit sebagian
post secara manual setelah import (hard-delete akan menghilangkan edit itu juga; archive
tidak — post tetap ada, cuma disembunyikan dari publik, bisa di-`published` lagi manual).
`post_authors` yang di-find-or-create SELAMA batch itu **TIDAK PERNAH disentuh** oleh rollback
— resource yang genuinely shared, bisa dipakai post lain di luar batch ini.

Traceability: kolom baru `import_batch_id UUID` (nullable, TANPA FK constraint — pola sama
semua cross-reference longgar di project ini) ditambahkan ke `posts`, `pages`, DAN `media`
(tenant schema) — diisi saat insert dari import, dipakai `archiveImportBatchAction` untuk
`UPDATE ... SET status='archived' WHERE import_batch_id = $1`.

Hard-delete PENUH (kalau suatu saat benar-benar dibutuhkan, mis. admin ingin re-import bersih
total) SENGAJA TIDAK dibangun sekarang — di luar scope MVP, butuh konfirmasi UI destruktif
terpisah (ketik nama batch untuk konfirmasi, pola yang sudah ada di aksi hapus lain aplikasi
ini) kalau nanti diminta.

### 14.2. Scope Pages — Diputuskan MASUK, Tanpa Byline — + DDL Final `content_import_batches`

**Keputusan**: WordPress `Page` (`<wp:post_type>page</wp:post_type>`) IKUT diimpor di Fase 1
yang sama, menggunakan infrastruktur SAMA PERSIS dengan Post — SEO mapping (§ 4.1, `pages`
punya kolom SEO identik), image pipeline (§ 7.1), konversi Tiptap (§ 7.2, Fase 0 POC berlaku
untuk keduanya, bukan cuma post). **Satu-satunya bedanya**: Pages TIDAK dapat mapping
Penulis/Editor (§ 2.4) — `pages.authorId` cukup diisi admin yang menjalankan import (pola sama
`posts.authorId`), TIDAK ADA `displayAuthorId`/`editorId` untuk Pages sama sekali, karena byline
system sengaja Post-only sejak awal (`docs/arsitektur-penulis-post.md` § 9 — keputusan lama
yang TETAP berlaku, bukan diperluas diam-diam oleh fitur import ini).

**Konsekuensi nama tabel**: karena sekarang genuinely content-type-agnostic (Post + Page),
nama `post_import_batches`/`post_import_batch_rows` (§ 3 Gap 1, § 8 Fase 1) **diubah** jadi
`content_import_batches`/`content_import_batch_rows` — DDL lengkap (sebelumnya cuma rasional
tanpa skema tertulis, § 10 poin 6):

```sql
-- public schema — pola sama import_batches (Importer Anggota), tapi generik content-type
CREATE TABLE public.content_import_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source              text NOT NULL CHECK (source IN ('wxr_upload', 'rest_api_pull')),
  source_url          text,   -- URL situs WP lama, kalau source='rest_api_pull'
  file_name           text,   -- nama file WXR, kalau source='wxr_upload'
  imported_by_user_id text NOT NULL,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'committing', 'committed')),
  total_rows          integer NOT NULL DEFAULT 0,
  processed_rows      integer NOT NULL DEFAULT 0,  -- untuk progress bar chunked commit (§ 13)
  inserted_rows       integer NOT NULL DEFAULT 0,
  skipped_rows        integer NOT NULL DEFAULT 0,
  error_rows          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  committed_at        timestamptz
);

CREATE TABLE public.content_import_batch_rows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL REFERENCES public.content_import_batches(id) ON DELETE CASCADE,
  row_number      integer NOT NULL,
  content_type    text NOT NULL CHECK (content_type IN ('post', 'page')),  -- BARU, kunci § 14.2
  title           text,
  wp_post_id      integer,            -- ID asli WordPress, untuk traceability/debug
  status          text NOT NULL
                    CHECK (status IN ('ready', 'review_needed', 'duplicate', 'error', 'inserted', 'skipped')),
  created_content_id uuid,            -- diisi setelah insert sukses (posts.id / pages.id) — tanpa FK, cross-schema
  data            jsonb NOT NULL,     -- payload lengkap hasil parse (dipakai commit + retry)
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```
Kolom `import_batch_id` (§ 14.1) ditambahkan ke `tenant.posts`, `tenant.pages`, `tenant.media`
via migration terpisah saat Fase 1 dikerjakan (nullable, tanpa FK — pola sama kolom
cross-reference longgar lain di project ini).

---

## 15. Putaran Kelima — Verifikasi Terhadap Data REAL (WXR + REST API `forbis.id`)

> User mengirim SATU file WXR export sungguhan (`docs/template/contoh-xml.xml`, dari `forbis.id`
> — Forum Bisnis IKPM Gontor, tenant yang SUDAH aktif dibahas di sesi-sesi lain project ini,
> jadi ini bukan sample generik melainkan target migrasi nyata) DAN satu URL REST API live
> (`https://forbis.id/wp-json/wp/v2/posts`) untuk diverifikasi terhadap seluruh asumsi § 1-14 di
> atas — bukan cuma dibaca, tapi benar-benar diverifikasi butir per butir. Seluruh koreksi
> konkret sudah disisipkan inline di section masing-masing (§ 2.1, § 2.2, § 2.4, § 4.1, § 5.1,
> § 5.4, § 12.1) — section ini adalah RINGKASAN + detail yang tidak cukup ringkas untuk disisip
> inline.

### 15.1. Temuan dari File WXR Real (`docs/template/contoh-xml.xml`)

| # | Temuan | Dampak ke Dokumen |
|---|---|---|
| 1 | `xmlns:wp="http://wordpress.org/export/1.2/"` (`<wp:wxr_version>1.2</wp:wxr_version>`), BUKAN `1.0` seperti draf awal. | § 2.1, § 12.1 — validasi root element dibuat version-tolerant. |
| 2 | Konten memakai comment Gutenberg block PERSIS seperti diasumsikan (`<!-- wp:paragraph -->`, `<!-- wp:list {"ordered":true} -->`) — Tahap A § 7.2 (strip comment) dikonfirmasi relevan/perlu, bukan spekulasi. | Tidak ada perubahan — asumsi § 7.2 Tahap A TERBUKTI benar. |
| 3 | `<dc:creator>` per-item hanya berisi **username** (`forbisid`), TIDAK ADA nama tampilan di situ — tapi `<wp:author>` di level CHANNEL (bukan per-item) berisi `<wp:author_display_name>` ("Admin Forbis") yang bisa dipetakan dari username yang sama. | Mengonfirmasi desain § 2.4 SUDAH BENAR sejak ditulis (tabel sudah menyebut perlu cek `<wp:author>` root file) — tidak perlu perubahan, hanya dikonfirmasi. |
| 4 | Item `attachment` (featured image) di sample punya `<wp:post_parent>` yang menunjuk **post ID LAIN** (1572), bukan post yang benar-benar memakainya sebagai featured image (post utama di sample ber-ID 1320, ter-link via `_thumbnail_id`, bukan `post_parent`). | Mengonfirmasi keras: `_thumbnail_id` adalah SATU-SATUNYA mekanisme pencocokan featured image yang andal, `post_parent` TIDAK BOLEH dipakai/dipercaya. Menambah keharusan **parsing dua tahap** (index attachment dulu, baru resolve post) — dicatat sebagai catatan arsitektur baru di § 2.1. |
| 5 | Gambar (`<wp:attachment_url>`) di-hosting di CDN pihak ketiga `cdn.webane.net` (pola plugin offload media, terindikasi dari postmeta `sm_cloud` yang menyebut Google Cloud Storage) — BUKAN domain `forbis.id` sendiri. | Mengonfirmasi `assertSafeExternalUrl()` (§ 11) HARUS domain-agnostic (evaluasi IP hasil DNS resolve, bukan whitelist domain tertentu) — desain sudah begitu, tidak perlu perubahan, hanya dikonfirmasi cocok kasus nyata. |
| 6 | `_yoast_wpseo_opengraph-image-id` (1322) BEDA dari `_thumbnail_id` (1912) pada post yang sama — OG image dan Featured Image adalah DUA aset berbeda pada post real ini. | Mengonfirmasi desain § 4.1 (OG image di-download+`processImage()` independen dari Featured Image) sudah benar — dua pipeline terpisah, tidak boleh disatukan/dedup berdasarkan asumsi "biasanya sama". |
| 7 | Beberapa key Yoast yang didokumentasikan di § 4.1 (`_yoast_wpseo_canonical`, `_yoast_wpseo_meta-robots-noindex`) **TIDAK ADA** di postmeta post sample ini (Yoast hanya menulis key kalau field-nya di-customize eksplisit oleh admin WP, defaultnya tidak menulis apa-apa). | Konfirmasi: **key postmeta yang tidak ada = pakai default Jalakarta**, BUKAN error/warning. Perlu ditegaskan eksplisit di implementasi parser (§ 4.1 catatan tambahan). |
| 8 | Key baru yang ditemukan, belum pernah didokumentasikan: `_yoast_wpseo_primary_category` (ID kategori utama), `_wp_attachment_image_alt` (alt text gambar), `wpb_post_views_count` + `musi_views` (dua plugin views-counter berbeda aktif sekaligus, nilai berbeda). | Ditambahkan sebagai mapping baru di § 4.1 (primary_category → tie-breaker kategori, image_alt → `media.altText`, views → opsional `posts.viewCount`). |
| 9 | Real permalink lama: `https://forbis.id/wawancara/2019/03/ada-yang-beda-dengan-forbis-...` — pola `/{categorySlug}/{year}/{month}/{slug}/`, TIDAK cocok opsi permalink § 5.1 manapun (1-4). | **Ditambahkan opsi permalink ke-5** (`category_date_name`) di § 5.1 + logic catch-all § 5.4 diperluas 4-segmen. |
| 10 | Postmeta attachment sangat besar/berat (`_wp_attachment_metadata`, `sm_cloud` — blob PHP-serialized panjang) — bukan cuma konten post yang bisa besar, postmeta pun bisa bengkak per attachment. | Memperkuat alasan cap ukuran file 200MB (§ 12.1) — bukan cuma proteksi generik, ada bukti nyata potensi bengkak dari postmeta plugin pihak ketiga. |

### 15.2. Temuan dari REST API Live (`https://forbis.id/wp-json/wp/v2/posts?per_page=1&_embed=1`)

| # | Temuan | Dampak ke Dokumen |
|---|---|---|
| 1 | **`yoast_head_json` TIDAK ADA di respons** — field custom di object post hanya `_acf_changed` dan `footnotes` (plugin lain, tidak relevan). | **KRITIS** — hipotesis di sesi sebelumnya (REST API punya jalan pintas SEO via `yoast_head_json`) TERBUKTI SALAH untuk situs real ini. § 2.2 diperbarui: REST API pull method DIREPOSISI jadi "cepat tapi tanpa jaminan SEO", WXR upload jadi metode utama untuk migrasi SEO-lengkap. |
| 2 | `content.rendered` berisi HTML dengan class Gutenberg langsung di tag (`<p class="wp-block-paragraph">`, `<h2 class="wp-block-heading">`, `<figure class="wp-block-image size-full">`) — gaya Gutenberg lebih baru (block-supports classes) dibanding comment-based di WXR sample lama, TAPI dua-duanya harus ditangani Tahap A § 7.2 (strip/abaikan class `wp-block-*`, bukan error). | Tidak butuh perubahan desain — HTML parser standar (Cheerio/DOMPurify) sudah otomatis mengabaikan `class` sebagai atribut biasa; dicatat sebagai konfirmasi bahwa DUA gaya Gutenberg (comment-based lama, class-based baru) sama-sama harus lolos sanitasi. |
| 3 | `_embedded.author` mengembalikan **error 404** (`rest_user_invalid_id`) — REST User endpoint tidak publik di situs ini. | **KRITIS** — desain § 2.4 untuk REST API mengasumsikan `_embedded.author` SELALU tersedia; ditambahkan fallback dua-lapis (batch-level author override manual, atau `displayAuthorId = null`) di § 2.4. |
| 4 | `_embedded['wp:featuredmedia']` lengkap: `source_url`, `media_details` (width/height/filesize/sizes bawaan WP), `alt_text`, `caption`. | Konfirmasi desain § 2.2 SUDAH BENAR — tidak perlu perubahan. |
| 5 | `categories`/`tags` di object utama cuma array ID — tapi `_embedded['wp:term']` punya data taksonomi lengkap (name/slug/link/taxonomy). | Konfirmasi desain § 2.2 SUDAH BENAR — parser REST WAJIB baca dari `_embedded['wp:term']`, bukan cuma ID mentah. |
| 6 | Permalink live (2026, post BARU dibuat hari ini): `https://forbis.id/kabar/2026/07/cetak-srikandi-...` — pola SAMA (`/{slug-mirip-kategori}/{year}/{month}/{slug}`) dengan sample WXR 2019, mengonfirmasi struktur permalink situs ini KONSISTEN dari 2019 sampai sekarang, bukan kebetulan satu artikel lama. | Memperkuat keputusan menambahkan opsi permalink ke-5 (`category_date_name`) di § 5.1 — bukan struktur langka/usang, tapi struktur AKTIF dan KONSISTEN dipakai situs target migrasi sungguhan. |
| 7 | `date_gmt`/`modified_gmt` tersedia terpisah dari `date`/`modified` lokal, format ISO 8601 tanpa offset eksplisit (mis. `"2026-07-18T11:01:21"` untuk GMT). | Konfirmasi desain § 6 (pakai varian `_gmt` sebagai sumber UTC otoritatif, bukan re-interpretasi versi lokal) SUDAH BENAR — tidak perlu perubahan. |

### 15.3. Verifikasi Kedua — File WXR Kedua (`docs/template/wordpress-xml-forbis.xml`, Blok Lebih Variatif)

> File WXR KEDUA dari situs `forbis.id` yang SAMA (16 `<item>`: 3 post + 13 attachment) —
> diminta user secara eksplisit untuk cek variasi block yang lebih kaya. Salah satu post di
> file ini (`wp:post_id 7837`, "Cetak Srikandi Pengusaha Hafidzoh...") adalah **post yang SAMA
> PERSIS** dengan yang diverifikasi via REST API di § 15.2 — kebetulan berguna, memberi
> kesempatan cross-check dua representasi format berbeda untuk satu konten real yang identik.

| # | Temuan | Dampak ke Dokumen |
|---|---|---|
| 1 | Variasi block yang ditemukan: `paragraph` (29×), `image` (9×, dengan `sizeSlug` full/medium/large, opsional `<figcaption>`), `heading` (5×, level 2/3, boleh berisi inline `<strong>`), `list`+`list-item` (1 ordered list, 4 item), `gallery` (1×, berisi 2 nested `image` block di dalam satu wrapper). **Tidak ditemukan** sama sekali: embed, quote, table, columns, button, video, code — jenis block yang ekstensi custom Jalakarta (`EmbedBlock`, `EnhancedBlockquote`) dirancang menangani TIDAK PERNAH muncul di kedua sample real yang diberikan. | Dicatat jujur: fallback StarterKit standar untuk block yang tidak dikenal (§ 7.2 desain awal) jadi jalur yang PALING SERING terpakai di kenyataan, bukan custom extension mapping — desain fallback itu sendiri sudah benar/cukup, tidak perlu perubahan. |
| 2 | **Gallery block WordPress TIDAK match `parseHTML()` `GalleryBlock` Jalakarta** (hanya kenal `div[data-type="gallery-block"]`, bukan struktur asli `<figure class="wp-block-gallery">`). | Ditambahkan sebagai keputusan MVP eksplisit di § 7.2 — galeri WP pecah jadi image individual berurutan saat import, bukan galeri Jalakarta native. Rekonstruksi penuh = enhancement lanjutan. |
| 3 | **`MediaImage` (image node custom Jalakarta) butuh `data-media-id` attribute untuk terhubung ke `tenant.media`** — `<img>` polos WordPress TETAP ter-parse jadi node `image` (inherit `parseHTML` bawaan), tapi `mediaId: null` selamanya kalau HTML tidak di-rewrite dulu sebelum `generateJSON()`. | **Temuan paling penting dari sample kedua** — ditambahkan langkah wajib baru di § 7.2 (rewrite `<img src>` + tambah `data-media-id` SETELAH download+`processImage()`, SEBELUM `generateJSON()`) yang sebelumnya tidak eksplisit disebutkan urutannya. |
| 4 | Comment Gutenberg bisa NESTED (`<!-- wp:list-item -->` di dalam `<ol>` yang belum ditutup; `<!-- wp:image -->` di dalam `<!-- wp:gallery -->` yang belum ditutup). | Dikonfirmasi AMAN untuk regex strip sederhana (`<!--\s*/?wp:[\w-]+[^>]*-->`, tanpa perlu parse JSON balanced-braces) — comment murni overlay di atas HTML valid, tidak pernah merusak struktur tag. Ditambahkan sebagai catatan implementasi di § 7.2. |
| 5 | Postmeta Yoast di 3 post sample ini JAUH LEBIH SEDIKIT dari sample pertama (§ 15.1) — HANYA `_yoast_wpseo_primary_category`, `_yoast_wpseo_focuskw`, `_yoast_wpseo_metadesc` yang relevan Jalakarta; tidak ada `_yoast_wpseo_title`, `-opengraph-*`, `-canonical`, `-meta-robots-*` sama sekali untuk post-post ini. | Memperkuat (bukan mengubah) prinsip "key tidak ada = pakai default" — variasi antar-post di situs yang SAMA saja bisa signifikan, importer harus 100% graceful terhadap kombinasi key apa pun yang hadir/tidak hadir. |
| 6 | Key ACF baru ditemukan: `ane_news_utama`/`_ane_news_utama` (penanda "berita utama") — dikonfirmasi Jalakarta PUNYA kolom setara (`posts.isFeatured`, "Berita Unggulan"). | Ditambahkan mapping baru di § 4.1 (opsional). |
| 7 | Post yang sama (`7837`) di WXR ini vs REST API (§ 15.2) — konten, judul, tanggal, kategori/tag, permalink konsisten di kedua representasi (cross-check berhasil, tidak ada perbedaan mengejutkan). | Tidak ada perubahan — validasi tambahan bahwa dua metode ekstraksi data yang direncanakan (§ 2.1 vs § 2.2) akan menghasilkan data post yang setara untuk konten yang sama, sesuai desain. |

### 15.5. Kesimpulan Putaran 5 — Apakah Arsitektur Berubah Signifikan?

**Tidak ada perubahan STRUKTURAL besar** — sebagian besar temuan MENGONFIRMASI desain yang
sudah ada di § 1-14 (Tahap A sanitasi Gutenberg, `_thumbnail_id` matching, `assertSafeExternalUrl`
domain-agnostic, timezone `_gmt`, `_embedded['wp:term']`). **Tiga temuan mengubah keputusan
konkret** (dari 2 sample file + 1 fetch live, semuanya `forbis.id`): (1) REST API tidak bisa
diandalkan untuk SEO — WXR dipromosikan jadi metode utama; (2) permalink situs real butuh opsi
ke-5 (`category_date_name`) yang sebelumnya belum ada; (3) **konversi gambar inline WAJIB
langkah rewrite `data-media-id` di antara Tahap A dan Tahap B** (§ 7.2) — tanpa ini,
`MediaImage.mediaId` seluruh gambar hasil import akan `null` permanen, terputus dari Media
Library Jalakarta meski secara visual tetap tampil. Selebihnya adalah PELENGKAP mapping (alt
text, primary category, view count, `isFeatured`), PENGERASAN validasi (versi namespace
tolerant, fallback author REST), dan SATU keputusan degradasi MVP yang diterima sadar (galeri
WordPress pecah jadi image individual, bukan `galleryBlock` native). Dokumen ini SEKARANG sudah
diverifikasi terhadap DUA file WXR real + satu fetch REST API live (bukan cuma asumsi/
dokumentasi WordPress generik) untuk tenant yang benar-benar akan memakai fitur ini — termasuk
satu post yang sama diverifikasi silang di dua format sekaligus (§ 15.3 temuan #7), hasilnya
konsisten. **Fase 0 (§ 8) — proof-of-concept Tiptap dan test XXE — TETAP belum dieksekusi**, ini
masih murni pekerjaan arsitektur/dokumentasi, menunggu instruksi eksplisit untuk mulai menulis
kode.

---

## 16. Fase 0 — Hasil Proof-of-Concept (DIEKSEKUSI 2026-07-27)

> **INI PERTAMA KALI DOKUMEN INI BERISI KODE YANG SUNGGUH DIJALANKAN** (bukan cuma rencana) —
> atas persetujuan eksplisit user ("ya lanjut") setelah 5 putaran audit murni dokumentasi.
> Scope disepakati SEMPIT: script POC disposable (ditulis+dijalankan+DIHAPUS, bukan bagian
> permanen fitur) + instalasi 3 dependency baru (perubahan nyata ke `package.json`/`bun.lock`).
> **Nol kode FITUR permanen ditulis** — POC ini murni membuktikan/menyangkal risiko teknis di
> § 7.2 dan § 12.1, hasilnya didokumentasikan di sini untuk dipakai Fase 1 nanti.

### 16.1. Hasil POC 1 — Konversi Tiptap (Risiko Teknis TERBESAR — TERBUKTI AMAN)

Script sekali-pakai (`apps/web/_poc-wxr-import.ts`, dihapus setelah run) meng-import LANGSUNG
5 extension custom project ini dari lokasi aslinya (`components/editor/{media-image,embed-block,
gallery-block,related-link,enhanced-blockquote}-ext.ts`) + seluruh extension standar persis
sama dengan `tiptap-editor.tsx`, memanggil `generateJSON()` dari `@tiptap/html/server` terhadap
2 potongan HTML Gutenberg REAL (disalin verbatim dari kedua file WXR — satu berisi
heading+image+figcaption+gallery, satu berisi ordered list dengan comment nested), lalu
me-render-balik hasil JSON via `renderBody()` **ASLI** (`lib/letter-render.ts`, TIDAK dimodifikasi
untuk POC ini).

**Hasil — SEMUA lolos, tanpa satu crash pun**:
- `generateJSON()` tidak crash meski meng-import extension yang secara internal me-`import`
  komponen React (`GalleryBlockView`, `EmbedBlockView` via `ReactNodeViewRenderer`) — kekhawatiran
  awal (pola sama bug lama `generateHTML`/`prosemirror-model` yang crash server-side karena
  sentuh `window.document`) TIDAK TERJADI di arah konversi ini. Alasan: `generateJSON()` tidak
  pernah memanggil `addNodeView()` (itu murni concern rendering interaktif editor, bukan schema
  generation) — `happy-dom` cukup menyediakan DOM untuk parsing HTML ke node ProseMirror.
- Tipe node top-level yang dihasilkan sesuai ekspektasi: `paragraph, heading, image, paragraph,
  heading, paragraph, image, image` (test 1) dan `paragraph, orderedList, paragraph` (test 2) —
  struktur nested `<ol><li>` dan gallery `<figure>` dalam `<figure>` ter-parse benar setelah
  comment Gutenberg di-strip.
- **Dikonfirmasi EMPIRIS (bukan cuma teori) 2 keputusan yang sudah ditulis di § 7.2/§ 15.3**:
  (a) ketiga node `image` hasil parse SEMUA punya `mediaId: null` (karena `<img>` WordPress tidak
  pernah punya `data-media-id`) — memvalidasi keharusan langkah rewrite sebelum `generateJSON()`;
  (b) `<!-- wp:gallery -->` WordPress TIDAK menghasilkan node `galleryBlock` — pecah jadi 2 node
  `image` terpisah persis seperti diprediksi.
- Hasil JSON (`JSON.stringify()`, PERSIS bentuk yang akan disimpan ke `posts.content`) berhasil
  di-render balik ke HTML valid via `renderBody()` ASLI tanpa error, untuk KEDUA test case.

**Kesimpulan**: risiko teknis terbesar di seluruh rencana ini (§ 7.2, ditandai KRITIS sejak
audit putaran pertama) **SEKARANG TERBUKTI, bukan lagi asumsi**. Fase 1 boleh dibangun di atas
pendekatan ini dengan percaya diri.

### 16.2. Koreksi Dependency — `happy-dom` Bukan `linkedom`, Versi HARUS Pinned

> Ditemukan SAAT instalasi, sebelum sempat menjalankan POC — dicek dulu ke npm registry
> langsung (bukan dipercaya dari draf awal dokumen).

- **`@tiptap/html`'s peer dependency SEBENARNYA adalah `happy-dom`, BUKAN `linkedom`** yang
  disebut draf awal § 7.2 (asumsi dari konvensi komunitas Tiptap yang generik, ternyata tidak
  cocok untuk package versi yang benar-benar dipakai project ini). Dikonfirmasi dari
  `package.json` package itu sendiri: `peerDependencies: {"happy-dom": "^20.8.9", "@tiptap/core":
  ..., "@tiptap/pm": ...}` — nol mention `linkedom` di mana pun.
- **`@tiptap/html@latest` (3.29.0) peer-dep ke `@tiptap/core`/`@tiptap/pm` versi 3.29.0 PERSIS
  (exact-pin, bukan range)** — project ini terpasang `@tiptap/core@^3.22.3`. Dicek satu-per-satu
  versi 3.x di registry npm: `@tiptap/html@3.22.3` (versi lama, MASIH ADA di registry) peer-dep
  ke `@tiptap/core: "^3.22.3"` — RANGE yang cocok persis dengan yang terpasang. **Keputusan:
  pakai `@tiptap/html@3.22.3` (pinned exact), BUKAN `latest`** — menghindari upgrade paksa
  seluruh ekosistem Tiptap v3 project ini (`core`/`pm`/`react`/`starter-kit`/9 extension package
  lain) hanya demi 1 fitur baru, risiko regresi ke editor LIVE yang sudah dipakai admin
  sehari-hari (CLAUDE.md sudah punya sejarah "Tiptap v3 banyak breaking change" — upgrade minor
  di dalam v3 pun berpotensi mengejutkan).
- Instalasi akhir: `@tiptap/html@3.22.3` + `happy-dom@^20.8.9` + `fast-xml-parser@^5.10.1`
  (tidak ada isu versi untuk yang terakhir ini, dependency baru murni).
- **Bug berulang ditemukan**: `bun add ... --filter=@jalajogja/web` KEMBALI salah menaruh
  ketiga dependency ini di root `package.json`, bukan `apps/web/package.json` — persis kelas bug
  yang sudah didokumentasikan sebelumnya untuk `recharts` (`docs/lessons-learned.md` — "Date
  object di raw sql template lolos tsc+build, crash cuma saat runtime"). Diperbaiki manual: 3 entri dipindah dari root ke `apps/web/package.json` (posisi
  alfabetis yang benar), `bun install` ulang untuk sinkronkan lockfile, dikonfirmasi ulang ketiga
  dependency tetap resolve dari `apps/web` (`bun -e 'import(...)'` per paket, semua OK). **Aturan
  lama ditegaskan lagi**: `--filter=` TIDAK BOLEH dipercaya buta — SELALU `git diff package.json`
  (root) setelah `bun add` apa pun, sebelum lanjut — ini kejadian KEDUA di project ini dengan
  root cause identik.

### 16.3. Hasil POC 2 — Keamanan XXE `fast-xml-parser` (TERBUKTI AMAN, LEBIH BAIK dari Ekspektasi)

Payload uji persis sesuai § 12.1 (`<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file://...">]>`,
menunjuk file penanda sungguhan yang ditulis lebih dulu ke `/tmp` lalu dihapus setelah test)
dijalankan terhadap `fast-xml-parser@5.10.1` (versi yang benar-benar terpasang).

**Hasil**: parser **MENOLAK EKSPLISIT** dengan error `"External entities are not supported"` —
lebih baik dari kriteria minimum § 12.1 (yang menerima "parse error ATAU teks literal tidak
ter-resolve" sebagai hasil AMAN) — di sini bukan cuma inert diam-diam, tapi benar-benar
melempar error yang jelas. Test kontrol (XML normal tanpa DOCTYPE) tetap parse sukses seperti
biasa — konfirmasi penolakan ini SPESIFIK untuk external entity, bukan parser yang rusak/terlalu
ketat secara umum.

**Smoke test tambahan** (di luar checklist asli § 12.1, dilakukan sebagai validasi praktis):
kedua file WXR REAL (25.9 KB dan 110.1 KB) di-parse penuh — waktu parse <3ms untuk keduanya
(bukan masalah performa sama sekali di skala ini), jumlah `<item>`/post/attachment terdeteksi
benar, dan `_thumbnail_id` (postmeta di item post) berhasil di-cross-reference ke `wp:post_id`
attachment yang benar — memvalidasi mekanisme 2-tahap yang didesain di § 2.1 benar-benar bisa
diimplementasikan dengan library ini.

**Kesimpulan**: `fast-xml-parser@5.10.1` aman dipakai sebagai parser WXR, tanpa konfigurasi
tambahan apa pun di luar default. Cap ukuran file 200MB (§ 12.1) dan validasi root element
version-tolerant (§ 2.1/§ 12.1) tetap dipertahankan sebagai defense-in-depth, meski XXE-nya
sendiri sudah terbukti tidak jadi celah.

### 16.4. Temuan Baru — Entitas HTML di Dalam CDATA Butuh Decode Terpisah

> Ditemukan TIDAK SENGAJA saat smoke test parsing (§ 16.3) — bukan bagian checklist awal manapun.

`<title>` (dan kemungkinan besar `<excerpt:encoded>` — pola sama) di WXR **disimpan WordPress
sendiri dengan HTML entity SUDAH di-encode DI DALAM CDATA** (mis. `<![CDATA[...Summit &amp;
Expo 2026...]]>`) — bukan bug `fast-xml-parser`, ini kuirk WXR/WordPress: CDATA MEMANG tidak
pernah di-decode entity oleh spesifikasi XML manapun (CDATA artinya "ambil verbatim"), tapi
WordPress tetap menulis `&amp;` alih-alih karakter `&` mentah di dalamnya — jadi field yang keluar
dari parser masih literal berisi `&amp;`, `kemungkinan besar juga &#8217;`/`&#8216;` (kutip
miring), `&#8211;`/`&#8212;` (dash) untuk situs yang pakai smart-quotes.

**Dampak**: judul/excerpt hasil import akan tampil `Summit &amp; Expo` mentah di UI kalau tidak
di-decode — bug kosmetik yang MUDAH lolos QA visual sekilas (terlihat "hampir benar"). **Perlu
langkah decode HTML entity terpisah** untuk field `title`/`excerpt` SEBELUM disimpan ke
`posts.title`/`posts.excerpt` — TIDAK cukup diandalkan ke proses sanitasi HTML (§ 7.2 Tahap A,
yang cuma berlaku untuk `content:encoded`, bukan field judul/excerpt yang disimpan sebagai teks
polos). Kandidat solusi: dependency kecil `he` (npm, battle-tested HTML entity encode/decode) —
BELUM ditambahkan/diverifikasi, dicatat sebagai item baru untuk Fase 1, bukan Fase 0 (bukan
risiko teknis besar, cuma detail implementasi yang mudah dilewatkan kalau tidak dicatat sekarang).

### 16.5. Temuan Sampingan (Di Luar Scope, TIDAK Disentuh) — Duplikasi Extension `underline`

POC memunculkan warning runtime: `[tiptap warn]: Duplicate extension names found: ['underline']`.
Dikonfirmasi BUKAN disebabkan POC — `@tiptap/starter-kit@3.22.3` (versi yang benar-benar
terpasang) SEKARANG membundel `@tiptap/extension-underline` secara default (Tiptap v3 lebih
"batteries-included" dari v2), sementara `tiptap-editor.tsx` (editor LIVE project ini) SECARA
TERPISAH juga meng-import+mendaftarkan `Underline` lagi setelah `StarterKit.configure({...})` —
menghasilkan registrasi ganda yang SAMA PERSIS terjadi di editor production sekarang, bukan
sesuatu yang baru diperkenalkan sesi ini. **Tidak diperbaiki** — di luar scope fitur import WP
(menyentuh editor LIVE yang dipakai semua admin, bukan bagian rencana ini), dicatat sebagai
temuan minor untuk sesi cleanup terpisah kalau diminta (fix sepele: hapus `Underline` dari
daftar eksplisit KARENA `StarterKit` sudah menyertakannya, ATAU set `StarterKit.configure({
underline: false })` untuk mempertahankan `Underline` custom eksplisit).

### 16.6. Hasil POC 3 — Modul SSRF `apps/web/lib/wordpress-import-security.ts` (DIBANGUN PERMANEN, BUKAN Disposable)

> **Beda dari § 16.1-16.5** (yang semuanya script POC disposable, ditulis-jalankan-hapus) —
> item ini adalah **file permanen** (`apps/web/lib/wordpress-import-security.ts`), bagian dari
> checklist Fase 0 yang eksplisit tertulis "Bangun `lib/wordpress-import-security.ts`" (§ 10
> poin 1, § 8 roadmap) — bukan cuma dibuktikan lewat POC lalu dibuang. Diuji dengan 33 test case
> lewat script disposable terpisah (DIHAPUS setelah lolos, sesuai pola POC).

**Implementasi**: 2 fungsi diekspor — `assertSafeExternalUrl(rawUrl)` (validasi 1 URL: skema,
DNS resolve, cek IP privat/reserved) dan `safeFetch(rawUrl, init?)` (wrapper `fetch()` dengan
`redirect:"manual"`, re-validasi tiap hop, maks 3 hop, timeout 10 detik/hop) — PERSIS mengikuti
signature dan aturan yang sudah ditulis di § 11, tidak ada penyimpangan dari rencana.

**2 bug NYATA ditemukan+difix SAAT implementasi** (bukan dugaan, ditemukan lewat testing
sungguhan terhadap DNS real + `httpbin.org` real):

1. **Bracket IPv6 tidak dilucuti sebelum `dns.lookup()`** — `URL.hostname` untuk literal IPv6
   MEMPERTAHANKAN tanda kurung (`"[::1]"`, bukan `"::1""`) sesuai spesifikasi WHATWG URL, tapi
   `dns.lookup()` Node TIDAK memahami notasi kurung — tanpa fix, SETIAP URL ber-IPv6-literal
   (baik yang privat maupun publik) gagal resolve dan tertolak untuk alasan yang SALAH (dianggap
   "domain tidak bisa di-resolve", bukan benar-benar diperiksa apakah privat). Ditemukan lewat
   test yang awalnya "lolos" untuk alasan salah (private IPv6 tertolak, tapi karena DNS gagal,
   bukan karena logic prefix-check-nya bekerja) — baru ketahuan setelah test PUBLIK IPv6 juga
   ikut tertolak (seharusnya lolos). Fix: `url.hostname.replace(/^\[|\]$/g, "")` sebelum
   `dns.lookup()`.
2. **Deteksi IPv4-mapped IPv6 (`::ffff:127.0.0.1`) berbasis string tidak bekerja** — `new
   URL("http://[::ffff:127.0.0.1]/")` MENORMALISASI notasi dotted-quad jadi hex groups murni
   SEBELUM kode sempat melihatnya (`hostname` jadi `"[::ffff:7f00:1]"`, bukan
   `"[::ffff:127.0.0.1]"`) — dikonfirmasi lewat pengujian langsung, bukan diasumsikan. Deteksi
   "string mengandung titik" yang ditulis pertama kali TIDAK PERNAH match karena titiknya sudah
   hilang duluan di level parsing URL. Fix: deteksi prefix `::ffff:0:0/96` secara NUMERIK dari
   grup 16-bit yang sudah di-expand (`groups[0..4] === 0 && groups[5] === 0xffff`), lalu
   rekonstruksi 4 octet IPv4 dari 2 grup terakhir untuk dicek ulang pakai aturan IPv4 yang sama.

**33 test case, semua lolos setelah kedua fix** — dijalankan terhadap DNS resolve SUNGGUHAN
(bukan mock) dan `httpbin.org` SUNGGUHAN (bukan simulasi lokal):
- IPv4: 10 alamat privat/reserved (semua 5 range didokumentasikan + batas persis di tepi
  masing-masing range) ditolak; 3 alamat TEPAT DI LUAR batas range (`172.15.255.255`,
  `172.32.0.1`, `11.0.0.1`) lolos; 2 IP publik nyata (`8.8.8.8`, `1.1.1.1`) lolos.
- IPv6: `::1`, `fc00::/7` (2 sample), `fe80::/10` (2 sample), IPv4-mapped privat (2 sample)
  ditolak; IPv6 publik nyata (Cloudflare) DAN IPv4-mapped publik (`::ffff:8.8.8.8`) lolos.
- Hostname: `localhost` (resolve ke loopback) ditolak; `example.com` (domain publik nyata via
  DNS sungguhan) lolos; domain fiktif yang tidak bisa di-resolve ditolak.
- `safeFetch` via redirect SUNGGUHAN `httpbin.org`: redirect legit 2-hop sukses; redirect 5-hop
  (melebihi limit 3) ditolak dengan pesan yang benar; **redirect ke `127.0.0.1` (SSRF-via-
  redirect klasik) ditolak di hop kedua** — membuktikan re-validasi per-hop benar-benar
  berjalan, bukan cuma validasi hop pertama; redirect ke `169.254.169.254` (target klasik
  cloud metadata credential theft) juga ditolak dengan mekanisme yang sama.
- Satu kegagalan TRANSIEN (timeout) sempat terjadi di percobaan pertama pada test redirect
  5-hop — didiagnosis terpisah (dites ulang sendirian, sukses cepat) sebelum disimpulkan
  sebagai flakiness jaringan publik `httpbin.org`, BUKAN bug — bukan diabaikan tanpa investigasi.

**Yang BELUM dari checklist § 11**: budget-per-batch (poin 3, aturan tambahan) — state ini
melekat ke SESI IMPORT (butuh counter per-batch), tidak masuk akal hidup di modul security
stateless — secara eksplisit didorong jadi tanggung jawab Fase 1 (lihat § 11 update).

**Kesimpulan**: Fase 0 sekarang **100% SELESAI** — ketiga item checklist (§ 10 poin 1) semuanya
terbukti: POC konversi Tiptap (§ 16.1), keamanan XXE (§ 16.3), dan modul SSRF (§ 16.6) — dengan
2 bug nyata ditemukan+difix untuk yang terakhir. Fase 1 (fitur sungguhan) siap dimulai kapan
pun ada instruksi eksplisit, tanpa risiko teknis besar yang belum terbukti tersisa.

---

> **Dokumen ini dibuat tanpa melakukan perubahan kode FITUR sumber** (sesuai instruksi di setiap
> putaran audit murni dokumentasi § 1-15). **§ 16 adalah pengecualian yang disetujui eksplisit**
> ("ya lanjut") — instalasi 3 dependency (perubahan nyata) + script POC disposable (ditulis,
> dijalankan, dihapus) + SATU file permanen (`lib/wordpress-import-security.ts`, § 16.6, bagian
> eksplisit dari checklist Fase 0) untuk membuktikan/menyangkal 3 risiko teknis terbesar
> sebelum Fase 1.
> Dokumen ini menjadi acuan resmi sebelum implementasi teknis Fase 1 dimulai — Fase 1 BELUM
> dimulai, menunggu instruksi eksplisit. Satu item Fase 0 tersisa: `assertSafeExternalUrl()`
> (§ 11) belum ditulis/dites.
