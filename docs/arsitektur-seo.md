# Arsitektur SEO — jalakarta

> Dokumen ini adalah peta lengkap cakupan SEO di seluruh aplikasi: apa yang sudah benar, apa yang
> masih hardcode/generic, dan bagaimana menutup celahnya. Ditulis 2026-07-21 sebagai hasil audit
> menyeluruh sebelum eksekusi — supaya setiap perbaikan berikutnya tinggal mengikuti pola yang
> sudah dipetakan di sini, bukan mendesain ulang tiap kali.
>
> Riwayat perbaikan lama (bug `og:type`, bug Twitter image, Related Posts) ada di § 8 — sudah
> selesai, dipertahankan sebagai catatan sejarah.

---

## 1. Tiga Kelas Halaman — Prinsip Inti

Setiap halaman publik masuk salah satu dari tiga kelas ini. Kelas menentukan **di mana field SEO
seharusnya hidup** — prinsip yang harus dipegang supaya SEO tidak jadi sistem terpisah yang
duplikatif dari UI admin yang sudah ada:

| Kelas | Ciri | Tempat field SEO | Contoh |
|---|---|---|---|
| **A — Konten bertabel** | Satu baris DB = satu halaman, admin SUDAH punya form create/edit untuk baris itu | Kolom SEO di tabel yang sama + `<SeoPanel>` di form yang sudah ada | Post, Halaman, Produk, Event, Campaign |
| **B — Taksonomi/kategori** | Satu baris DB (kategori/tag) menentukan tampilan HALAMAN ARSIP yang difilter — bukan halaman sendiri | Kolom SEO ringan di tabel kategori + field kecil di UI kategori yang sudah ada (biasanya inline/modal, bukan full page) | Kategori Post, Tag Post, Kategori Produk, Kategori Event, Kategori Campaign, Kategori Dokumen |
| **C — Halaman statis tanpa "rumah"** | Tidak ada baris DB yang bisa dianggap "pemilik" halaman ini — path tetap, tidak per-record | Tabel BARU `seo_page_overrides` (tenant-scoped) + halaman pengaturan admin BARU | Login, Register, arsip Post/Produk/Campaign/Agenda/Dokumen, Direktori Anggota/Usaha/Pesantren/Profesional, Statistik |

**Aturan yang tidak boleh dilanggar**: jangan pernah bikin halaman "Custom SEO" generik di
`/settings` untuk konten yang SUDAH punya form create/edit sendiri (Kelas A) — itu duplikasi UX,
admin akan bingung mengedit SEO post dari dua tempat berbeda. Halaman pengaturan SEO terpisah
(Kelas C) HANYA untuk halaman yang genuinely tidak punya "rumah" form.

---

## 2. Status Saat Ini — Hasil Audit Menyeluruh (2026-07-21)

### 2.1 Infrastruktur yang sudah ada (dipakai lintas ketiga kelas)

| File | Peran |
|---|---|
| `apps/web/lib/seo.ts` | `generateMetadata()` (helper universal, dipanggil sebagai `buildMetadata` di banyak caller) + JSON-LD generators (`generateArticleJsonLd`, `generateProductJsonLd`, `generateOrganizationJsonLd`, `generateBreadcrumbJsonLd`) + `tiptapToPlainText()` (ekstrak plain text dari konten Tiptap JSON — WAJIB dipakai untuk fallback description, jangan pernah `slice()` JSON mentah) |
| `apps/web/lib/seo-defaults.ts` | Konstanta: `TITLE_MAX_LENGTH=60`, `DESC_MAX_LENGTH=160`, `OG_IMAGE_WIDTH/HEIGHT=1200/630`, `SCHEMA_ORG_TYPES` (per `contentType`), preset robots.txt |
| `apps/web/lib/tenant-seo.ts` | `getTenantSeoBase(slug)` — `{siteName, logoUrl, tagline, description, appUrl, baseUrl}` untuk SLUG APAPUN (dipakai juga oleh `resolveAkunBranding`, lihat `docs/arsitektur-akun.md`) |
| `apps/web/components/seo/seo-panel.tsx` | Komponen editor SEO — 3 tab (SEO Dasar, Open Graph, Advanced), Google Snippet Preview, Social Preview, SEO Score |

**`SeoValues`** (tipe yang di-export `seo-panel.tsx`, 11 field):
```ts
metaTitle, metaDesc, focusKeyword, ogTitle, ogDescription, ogImageId, ogImageUrl,
twitterCard, canonicalUrl, robots, schemaType, structuredData
```
`SeoPanel` props: `slug, contentType ("post"|"page"|"product"|"campaign"|"event"), title, content?, values, onChange`. `contentType` HANYA dipakai untuk memilih opsi `schemaType` dari `SCHEMA_ORG_TYPES` — union type ini **tidak memuat** `"document"` atau tipe lain (lihat gap § 2.3).

### 2.2 Kelas A — SUDAH LENGKAP (5 tabel)

| Tabel | Form edit | Kolom SEO |
|---|---|---|
| `posts` | `post-form.tsx` | Lengkap (11 field) |
| `pages` | `page-form.tsx` | Lengkap |
| `products` | `product-form.tsx` | Lengkap |
| `events` | `event-form.tsx` | Lengkap |
| `campaigns` | `campaign-form.tsx` | Lengkap |

Kelima form sudah punya `<SeoPanel>` terpasang, kolom DB lengkap 11-field. **Tidak perlu disentuh.**

### 2.3 Kelas A — GAP (perlu diperluas)

- **Modul Dokumen** (`documents` table) — **TIDAK PUNYA kolom SEO sama sekali** (hanya
  `id, title, description, categoryId, currentVersionId, visibility, tags, createdBy, createdAt,
  updatedAt`), `dokumen-form.tsx` **tidak ada satu baris pun** kode terkait SEO — modul ini belum
  pernah diintegrasikan ke sistem SeoPanel bahkan di level tipe (`contentType` union tidak
  memuatnya). Halaman publik `dokumen/view/[id]/page.tsx` juga TIDAK punya `generateMetadata` —
  akibatnya dokumen yang di-share via URL langsung (surat, laporan, dsb — publik by design) tidak
  pernah tampil preview link yang layak.
- **Entitas milik-anggota** (`member_businesses`, `member_owned_pesantren`, `member_professionals`
  — `public` schema, self-service via `/akun/usaha`, `/akun/pesantren`, `/akun/profesional`) —
  halaman detail publiknya (`usaha/[id]`, `pesantren/[id]`, `profesional/[id]`) SUDAH dinamis
  (title dari `name`/`title`, description dari `description`) TAPI tidak ada kolom `metaTitle`/
  `metaDesc` terpisah, dan form self-service member TIDAK punya `<SeoPanel>`. Ini **beda kelas
  urgensi** dari dokumen — dibahas terpisah di § 5 (keputusan desain, bukan gap murni).

### 2.4 Kelas B — GAP TOTAL (6 tabel taksonomi, 0 kolom SEO)

Dikonfirmasi via grep skema — **tidak satu pun** dari 6 tabel kategori/taksonomi ini punya kolom
SEO:

| Tabel | Kolom saat ini | Konsumen (halaman yang baca filter kategori) |
|---|---|---|
| `post_categories` | `id, slug, name, parentId, createdAt` | `post/page.tsx` via query param `?category=` (SAMA halaman arsip, bukan route terpisah) |
| `post_tags` | `id, slug, name, createdAt` | `post/page.tsx` via query param `?tag=` |
| `product_categories` | `id, slug, name, parentId, createdAt` | `produk/kategori/[categorySlug]/page.tsx` (route TERPISAH, satu-satunya dari 6 ini yang begitu) |
| `event_categories` | `id, name, slug, sortOrder, createdAt` | `agenda/page.tsx` via query param `?category=` |
| `campaign_categories` | `id, name, slug, sortOrder, createdAt` | `campaign/page.tsx` via query param `?category=` |
| `document_categories` | `id, name, slug, parentId, sortOrder, createdAt` | `dokumen/page.tsx` via query param `?category={id}` (kuirk: pakai ID bukan slug, lihat `lib/public-url-registry.ts` komentar) |

**Pola routing penting**: hanya **produk** yang punya rute kategori terpisah
(`/produk/kategori/{slug}`, generateMetadata sendiri — sudah ada tapi title-nya format hardcode
`"{nama kategori} — Produk {siteName}"`, BUKAN dari kolom SEO kategori karena memang belum ada).
Post/Event/Campaign/Dokumen semua filter kategori di **halaman arsip yang sama** via query
param — jadi `generateMetadata` arsip itu perlu baca `searchParams` dan, kalau ada filter aktif,
timpa title/desc dengan punya kategori itu.

### 2.5 Kelas C — 11 halaman arsip/direktori dengan title HARDCODE

Semua ini SUDAH punya `generateMetadata`, tapi title-nya string literal tetap — tidak bisa diubah
admin, dan tidak spesifik per tenant selain nama site:

```
agenda/page.tsx          → "Agenda & Event"
anggota/page.tsx         → "Direktori Anggota"
campaign/page.tsx        → "Donasi & Infaq"
dokumen/page.tsx         → "Dokumen — {tenant.name}"  (bahkan TANPA description sama sekali)
pesantren/page.tsx       → "Direktori Pesantren"
post/page.tsx            → "Berita & Artikel"
produk/page.tsx          → "Produk"
produk/kategori/[slug]/page.tsx → "{kategori} — Produk {siteName}" (dinamis nama kategori, tapi format tetap)
profesional/page.tsx     → "Direktori Profesional"
statistik/page.tsx       → "Statistik Anggota"
usaha/page.tsx           → "Direktori Usaha"
```

### 2.6 Kelas C — 30 halaman TANPA `generateMetadata` sama sekali

Semua warisan title default dari `app/(public)/[tenant]/layout.tsx`:
`{ title: { default: siteName, template: "%s — {siteName}" } }` — **tanpa description apa pun**.
Karena tidak override, `<title>` di SEMUA halaman ini persis sama = nama site tenant.

**Grup 1 — Auth/onboarding (publik, sering diakses langsung/dishare link)**:
`login`, `register`, `forgot-password`, `reset-password`, `akun-error`

**Grup 2 — Transaksi (privat/session-based, prioritas rendah untuk SEO custom)**:
`checkout`, `keranjang`, `invoice/[id]`

**Grup 3 — Dashboard akun (privat, butuh login, TIDAK perlu SEO custom)**: 15 halaman
`akun/*` (profil, lengkapi, data, media, transaksi, usaha, pesantren, profesional, event, mitra/*)

**Grup 4 — Publik tanpa login, TAPI berbasis token/ephemeral (bukan konten evergreen)**:
`invite/page.tsx`, `sign/[token]/page.tsx`, `verify/[hash]/page.tsx` — ketiganya sengaja publik
(komentar kode eksplisit "PUBLIC, tanpa auth") tapi isinya adalah alat verifikasi/undangan
sekali-pakai, bukan artikel/produk yang perlu dioptimasi untuk pencarian.

**Grup 5 — Akan otomatis tertutup begitu § 2.3 (dokumen) selesai**: `dokumen/view/[id]/page.tsx`

---

## 3. Arsitektur yang Diusulkan

### 3.1 Prinsip A — Perluasan Modul Dokumen

Tambah 11 kolom SEO ke `documents` (identik pola `events`/`campaigns`), tambah `"document"` ke
union `contentType` di `SeoPanel` + `SCHEMA_ORG_TYPES` (nilai wajar: `["Article", "DigitalDocument"]`
atau `["WebPage"]` — dokumen bukan artikel, jadi jangan pilih `Article` sebagai default). Pasang
`<SeoPanel contentType="document">` di `dokumen-form.tsx`, wire `generateMetadata` di
`dokumen/view/[id]/page.tsx` (yang saat ini SAMA SEKALI tidak punya `generateMetadata`) mengikuti
pola persis `post/[slug]/page.tsx`. Migration `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` untuk
tenant existing (pola standar project ini).

### 3.2 Prinsip B — SEO Ringan untuk 6 Tabel Taksonomi

**Field yang ditambah — SENGAJA ringan, bukan 11-field penuh**: `meta_title TEXT`,
`meta_desc TEXT`. Alasan: kategori bukan konten utuh, admin cuma perlu override judul+deskripsi
singkat untuk halaman arsip terfilter — field seperti `focusKeyword`/`canonicalUrl`/
`structuredData`/`schemaType` tidak relevan untuk sebuah kategori. TIDAK reuse `<SeoPanel>` penuh
(overkill untuk form kategori yang biasanya inline/modal kecil) — cukup 2 input teks biasa
ditambahkan ke form kategori yang SUDAH ADA di masing-masing modul.

**Consumer wajib diupdate** — setiap `generateMetadata` di halaman arsip yang menerima
`searchParams` (post/agenda/campaign/dokumen — filter via query param) HARUS: kalau ada
`?category=`/`?tag=` aktif DAN kategori itu (row) punya `metaTitle`/`metaDesc` terisi → pakai itu;
kalau tidak (kategori ada tapi belum diisi admin, atau tidak ada filter sama sekali) → fallback ke
title hardcode yang sudah ada sekarang (`"Berita & Artikel"`, dst — TIDAK dihapus, jadi default).
`produk/kategori/[slug]/page.tsx` (satu-satunya rute terpisah) ikut pola sama: kalau
`product_categories.metaTitle` ada → pakai, kalau tidak → tetap format hardcode
`"{nama} — Produk {siteName}"` seperti sekarang.

### 3.3 Prinsip C — Tabel `seo_page_overrides` + Halaman Pengaturan Admin Baru

**Tabel baru** (tenant-scoped, `packages/db/src/schema/tenant/`):
```ts
export const seoPageOverrides = s.table("seo_page_overrides", {
  id:            uuid("id").primaryKey().defaultRandom(),
  pageKey:       text("page_key").notNull().unique(), // "login", "register", "post-archive", dst — BUKAN URL lengkap
  metaTitle:     text("meta_title"),
  metaDesc:      text("meta_desc"),
  ogTitle:       text("og_title"),
  ogDescription: text("og_description"),
  ogImageId:     uuid("og_image_id"),
  robots:        text("robots", { enum: ["index,follow","noindex","noindex,nofollow"] }),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```
**`pageKey` bukan URL** (URL berubah kalau custom domain/path mode beda) — pakai identifier stabil
per jenis halaman, daftar tetap (di kode, mirip `STATIC_TOP_SEGMENTS` di
`lib/mobile-route-checks.ts` — pola yang sudah dikunci di project ini untuk "daftar tetap yang
hidup di kode, bukan di DB").

**Daftar `pageKey`** — gabungan STATIC_ROUTES yang sudah ada (`lib/public-url-registry.ts`) +
tambahan yang belum terdaftar di situ:
```
login, register, forgot-password, reset-password, keranjang, checkout,
post-archive, produk-archive, campaign-archive, agenda-archive, dokumen-archive,
anggota-archive, usaha-archive, pesantren-archive, profesional-archive, statistik
```
(`akun-error`, `invite`, `sign`, `verify`, semua `akun/*`, `invoice/[id]` — SENGAJA TIDAK masuk
daftar ini, lihat § 3.4 kenapa.)

**Field yang dipilih — subset `SeoValues` (5 field, bukan 11)**: `metaTitle`, `metaDesc`,
`ogTitle`, `ogDescription`, `ogImageId`, `robots`. Alasan sama dengan § 3.2: `focusKeyword`/
`canonicalUrl`/`schemaType`/`structuredData`/`twitterCard` tidak relevan untuk halaman utility
(canonical URL untuk `/login` misalnya sudah otomatis benar dari `getTenantSeoBase`, tidak perlu
di-override manual).

**Halaman admin baru**: `/app/{slug}/settings/seo` (menu baru di sidebar Settings) — list semua
`pageKey` (label dari `STATIC_ROUTES` yang sudah ada + label manual untuk yang belum terdaftar di
situ), status "Sudah dikustomisasi" / "Pakai default" per baris, klik → dialog kecil dengan 5 field
di atas (bukan full `SeoPanel` 3-tab — form sederhana, konsisten dengan keputusan "5 field saja").

**Helper baru** `lib/get-page-seo-override.ts`:
```ts
export async function getPageSeoOverride(
  tenantClient: TenantDb, pageKey: string,
): Promise<{ metaTitle, metaDesc, ogTitle, ogDescription, ogImageUrl, robots } | null>
```
Dipanggil di `generateMetadata` SEMUA halaman Kelas C (11 arsip § 2.5 + 6 halaman Grup 1 § 2.6) —
merge dengan default yang sudah ada: `title: override?.metaTitle || "{title hardcode lama}"`, dst.
**Default hardcode TIDAK PERNAH dihapus** — jadi fallback permanen kalau admin belum kustomisasi.

### 3.4 Scope yang SENGAJA TIDAK dimasukkan ke sistem override

- **`akun/*` (15 halaman)** — privat, butuh login, Google tidak akan pernah bisa index-nya
  (redirect ke `/login` untuk crawler tanpa sesi). SEO custom di sini nol manfaat.
- **`invoice/[id]`** — data transaksi privat per-invoice. Tidak perlu title custom; cukup pastikan
  `robots: noindex` di level kode langsung (hardcode, bukan lewat sistem override) — ini
  perbaikan KECIL terpisah, bukan bagian dari Prinsip C.
- **`invite/[token]`, `sign/[token]`, `verify/[hash]`** — token sekali-pakai/ephemeral, bukan
  konten evergreen yang perlu dioptimasi pencarian. Kalau nanti dianggap perlu title yang lebih
  baik dari default generik, cukup title statis sederhana langsung di kode (`"Verifikasi Surat —
  {siteName}"`), BUKAN masuk sistem override yang bisa dikustomisasi admin — tidak ada alasan
  admin perlu mengedit teks halaman verifikasi tanda tangan digital.
- **`akun-error`** — halaman dead-end error, tidak relevan untuk SEO sama sekali.

---

## 4. Ringkasan File yang Akan Disentuh (untuk eksekusi nanti)

### Fase 1 — Prinsip A (Dokumen)
- `packages/db/src/schema/tenant/documents.ts` — 11 kolom baru
- `packages/db/src/helpers/create-tenant-schema.ts` — DDL kolom baru
- Migration baru `ALTER TABLE documents ADD COLUMN IF NOT EXISTS ...`
- `components/seo/seo-panel.tsx` — union `contentType` tambah `"document"`
- `lib/seo-defaults.ts` — `SCHEMA_ORG_TYPES.document`
- `components/dokumen/dokumen-form.tsx` — pasang `<SeoPanel>`
- `app/(public)/[tenant]/dokumen/view/[id]/page.tsx` — tambah `generateMetadata` (baru sama sekali)
- Admin action dokumen — terima+simpan field SEO

### Fase 2 — Prinsip B (Taksonomi)
- 6 tabel: `post_categories`, `post_tags`, `product_categories`, `event_categories`,
  `campaign_categories`, `document_categories` — tambah `meta_title`, `meta_desc`
- Migration baru per tabel (atau digabung 1 file, 6 `ALTER TABLE`)
- 6 form/CRUD kategori yang sudah ada — tambah 2 input teks
- 5 `generateMetadata` (post/agenda/campaign/dokumen archive + produk kategori) — baca
  `searchParams`, cek override kategori, merge dengan fallback

### Fase 3 — Prinsip C (Page Overrides, paling besar)
- Tabel baru `seo_page_overrides` (schema + DDL + migration)
- `lib/get-page-seo-override.ts` (helper baru)
- Halaman admin baru `/app/{slug}/settings/seo/` (page + actions + komponen dialog form)
- Nav item baru "SEO" di sidebar Settings
- 17 `generateMetadata` diupdate (11 arsip Kelas C § 2.5 sudah ada, tinggal tambah merge-logic +
  6 halaman Grup 1 § 2.6 yang BARU dibuatkan `generateMetadata` dari nol: login, register,
  forgot-password, reset-password, keranjang, checkout)

---

## 5. Keputusan Desain (dikonfirmasi user 2026-07-21)

1. **Urutan eksekusi**: **Fase 1 → 2 → 3 berurutan** (kecil ke besar), tiap fase diverifikasi
   (`tsc`+build) sebelum lanjut ke fase berikutnya — SOP standar project ini.
2. **`member_businesses`/`member_owned_pesantren`/`member_professionals`** (§ 2.3, entitas
   milik-anggota): **DIBIARKAN seperti sekarang** — title/desc otomatis dari `name`/`description`,
   TIDAK ditambah field SEO terpisah atau `SeoPanel`. Alasan yang dikonfirmasi: form ini dipakai
   anggota sendiri (self-service, non-teknis) — SeoPanel 3-tab akan membingungkan, tidak sepadan
   manfaatnya untuk konten self-reported.
3. **`robots: noindex` untuk `invoice/[id]`**: **dieksekusi sekalian** sebagai perbaikan kecil
   terpisah (hardcode langsung di `generateMetadata` halaman itu, bukan bagian sistem override
   Fase 3 — invoice tidak butuh title/desc custom, cukup dicegah ter-index).

---

## 6. Referensi Terkait

- `docs/arsitektur-akun.md` § "Resolusi Branding Kartu Anggota" — `getTenantSeoBase()` dipakai
  ulang untuk resolusi lintas-tenant, pola yang sama relevan kalau nanti Prinsip C perlu resolve
  OG image lintas tenant.
- `lib/public-url-registry.ts` — sumber `STATIC_ROUTES` yang dipakai ulang sebagai basis daftar
  `pageKey` di § 3.3.
- `lib/mobile-route-checks.ts` — pola "daftar tetap hidup di kode" (`STATIC_TOP_SEGMENTS`) yang
  ditiru untuk desain `pageKey`.

---

## 7. Status Implementasi

| Fase | Status |
|---|---|
| Audit menyeluruh (dokumen ini) | ✅ Selesai (2026-07-21) |
| Fase 1 — Dokumen | ✅ Selesai (2026-07-21) — migration `0037_documents_seo_columns.sql` |
| Fase 2 — Taksonomi | ⬜ Belum |
| Fase 3 — Page Overrides | ⬜ Belum |
| `invoice/[id]` noindex | ⬜ Belum |

---

## 8. Riwayat Perbaikan Lama (SELESAI — dipertahankan sebagai catatan sejarah)

### Bug `og:type` tidak pernah dirender
`lib/seo.ts` — parameter `ogType` di-destructure tapi tidak dimasukkan ke objek `openGraph`.
**Fix**: tambah `type: ogType` ke `openGraph`. ✅ SELESAI (commit `74b7f18`).

### Bug Twitter `images` format string, bukan object
`twitter.images` butuh array of object (`{url, width, height, alt}`), bukan array of string.
**Fix**: ganti ke format object lengkap. ✅ SELESAI (commit `74b7f18`).

### Related Posts (post detail)
Fallback chain: tag sama → kategori sama → global terbaru. Maks 5 post, status published, exclude
self. Render `PostCard variant="list"` antara footer artikel dan tombol "Kembali ke Blog".
✅ SELESAI (commit `e9e6a87`).

Deploy: `git pull` + `bun run build --filter=@jalajogja/web` + `pm2 restart jalajogja`.
