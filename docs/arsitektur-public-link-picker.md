# Arsitektur Public Link Picker

Komponen autocomplete universal untuk memilih URL front-end publik.
Dipakai di mana saja admin perlu mengisi link ke halaman website organisasi (nav menu header/
footer, CTA landing section, dan tempat lain di masa depan).

> **Status: ✅ Selesai (2026-07-20)** — semua modul terakomodir (Post, Produk, Event, Campaign,
> Dokumen, Pages, Pesantren, Usaha, Profesional) + rute statis lengkap termasuk arsip Dokumen +
> field CTA Hero/CTA section sudah pakai picker ini + arsitektur custom domain sudah benar untuk
> SEMUA titik render (nav menu DAN section CTA). Riwayat sebelum tanggal ini: dokumen ini sempat
> jauh lebih dulu ditulis sebagai rencana (checklist § 8 lama semua `[ ]`) sebelum implementasi
> nav menu benar-benar dikerjakan — kalau nemu referensi lama yang bilang "belum dimulai", itu
> stale, ikuti dokumen ini.

---

## 1. Latar Belakang & Tujuan

Admin sering perlu memilih URL front-end — saat membangun nav menu, mengisi CTA landing section,
mengatur widget sidebar, atau mengisi link di mana saja. Tanpa alat bantu, admin harus hafal atau
mengetik URL manual, rawan typo, dan tidak tahu halaman/konten mana yang tersedia.

**`PublicLinkPicker`** adalah combobox autocomplete yang:
- Menampilkan semua URL front-end yang tersedia (statis + konten dari DB)
- Dapat dicari berdasarkan nama/judul konten (server-side search, bukan client-side filter)
- Mengelompokkan hasil berdasarkan tipe (Halaman, Postingan, Produk, dst)
- Mengembalikan URL siap pakai — **selalu dengan prefix `/{slug}`** (lihat § 9 untuk kenapa dan
  bagaimana ini tetap benar di custom domain)

---

## 2. Inventaris URL Front-end

### 2a. Rute Statis (tidak butuh DB, selalu tersedia)

| Label | URL Pattern | Grup |
|-------|-------------|------|
| Beranda | `/{slug}/` | Halaman Utama |
| Arsip Postingan | `/{slug}/post` | Halaman Utama |
| Agenda / Event | `/{slug}/agenda` | Halaman Utama |
| Direktori Produk | `/{slug}/produk` | Halaman Utama |
| Donasi & Campaign | `/{slug}/campaign` | Halaman Utama |
| Arsip Dokumen | `/{slug}/dokumen` | Halaman Utama |
| Direktori Anggota | `/{slug}/anggota` | Direktori |
| Direktori Pesantren | `/{slug}/pesantren` | Direktori |
| Direktori Usaha | `/{slug}/usaha` | Direktori |
| Direktori Profesional | `/{slug}/profesional` | Direktori |
| Statistik | `/{slug}/statistik` | Direktori |
| Keranjang Belanja | `/{slug}/keranjang` | Transaksi |
| Login | `/{slug}/login` | Akun |
| Register | `/{slug}/register` | Akun |
| Dashboard Akun | `/{slug}/akun` | Akun |
| Riwayat Transaksi | `/{slug}/akun/transaksi` | Akun |

### 2b. Konten Dinamis (difetch dari DB saat pencarian, `q` wajib diisi)

| Tipe Konten | URL Pattern | Search Field | Sumber DB |
|-------------|-------------|--------------|-----------|
| Halaman (Page) | `/{slug}/{pageSlug}` | title | `tenant.pages WHERE status='published'` |
| Post individual | `/{slug}/post/{postSlug}` | title | `tenant.posts WHERE status='published'` |
| Post by Kategori | `/{slug}/post?category={catSlug}` | category name | `tenant.post_categories` |
| Post by Tag | `/{slug}/post?tag={tagSlug}` | tag name | `tenant.post_tags` |
| Produk | `/{slug}/produk/{productSlug}` | name | `tenant.products WHERE status='active'` |
| Kategori Produk | `/{slug}/produk/kategori/{catSlug}` | name | `tenant.product_categories` |
| **Event individual** | `/{slug}/agenda/{eventSlug}` | title | `tenant.events WHERE status='published'` |
| **Event by Kategori** | `/{slug}/agenda?category={catSlug}` | category name | `tenant.event_categories` |
| Campaign / Donasi | `/{slug}/campaign/{campaignSlug}` | title | `tenant.campaigns WHERE status='active'` |
| **Campaign by Kategori** | `/{slug}/campaign?category={catSlug}` | category name | `tenant.campaign_categories` |
| **Dokumen individual** | `/{slug}/dokumen/view/{id}` | title | `tenant.documents WHERE visibility='public'` |
| **Dokumen by Kategori** | `/{slug}/dokumen?category={catId}` | category name | `tenant.document_categories` — **catatan: `id`, bukan `slug`, lihat § 2d** |
| Pesantren | `/{slug}/pesantren/{id}` | name | `public.member_owned_pesantren` (scope tenant via `tenant_memberships`) |
| Usaha / Bisnis | `/{slug}/usaha/{id}` | name | `public.member_businesses WHERE is_active=true` (scope tenant) |
| Profesional | `/{slug}/profesional/{id}` | title + professionType | `public.member_professionals WHERE is_active=true` (scope tenant) |

Baris **bold** adalah yang ditambahkan pada refactor 2026-07-20 — sebelumnya modul Event dan
Dokumen tidak terakomodir sama sekali (bahkan arsip statis Dokumen absen), dan Campaign belum
punya cara link ke kategori spesifik.

### 2c. Rute Sistem (tidak dimasukkan ke picker — token/ID dinamis yang tidak bisa "dicari")

| URL | Keterangan |
|-----|------------|
| `/{slug}/sign/{token}` | Halaman TTD surat — token unik per slot |
| `/{slug}/verify/{hash}` | Verifikasi TTD surat — hash unik per signature |
| `/{slug}/invite` | Terima undangan pengurus — hanya dari email |
| `/{slug}/invoice/{id}` | Invoice publik — ID unik per transaksi |
| `/{slug}/checkout` | Step alur transaksi — butuh cart state, tidak masuk akal jadi tujuan nav |
| `/{slug}/forgot-password`, `/reset-password` | Utilitas auth, bukan halaman konten |
| `/{slug}/anggota/{id}` | Profil pribadi anggota — auth-protected, owner only |
| `/{slug}/akun/...` (selain `/akun` dan `/akun/transaksi`) | Sub-halaman akun — tidak dilink dari nav |

### 2d. Kuirk teknis — kategori Dokumen pakai ID, bukan slug

`document_categories` **punya** kolom `slug` (unique) — tapi halaman `/dokumen` (`dokumen/page.tsx`)
memfilter dengan `eq(documents.categoryId, category)`, artinya query param `?category=` di
halaman itu harus diisi **UUID `id`** kategori, bukan slug-nya. Semua modul lain (post, event,
campaign) konsisten resolve slug→id di server sebelum filter. Dokumen adalah satu-satunya
pengecualian saat ini — builder `buildDocumentCategoryUrl()` WAJIB mengikuti perilaku nyata
halaman itu (pakai `id`), bukan konsisten-dipaksa ke pola slug seperti yang lain. Kalau nanti
`dokumen/page.tsx` direfactor untuk resolve-by-slug (menyamakan pola), builder ini ikut diupdate
bersamaan — jangan biarkan keduanya drift.

---

## 3. API Endpoint

### `GET /api/ref/public-links?slug={tenantSlug}&q={query}`

**Auth**: `getTenantAccess(slug)` — hanya admin tenant ini yang bisa cari konten tenant ini.
Return 401 kalau tidak ada akses valid.

**Query params:**
- `slug` (required) — tenant slug
- `q` (optional) — search query.

**Response:**
```typescript
type PublicLinksResponse = { links: PublicLink[] };
// TIDAK ada field `total` — cukup panjang array `links`.
```

**Logika pencarian — dua kelas konten, dua perilaku berbeda (dikunci 2026-07-20, lihat § 3a):**
1. **Rute statis** — selalu disertakan, difilter `label.toLowerCase().includes(q)` bila `q` ada
   (murni in-memory, tidak query DB).
2. **Konten "browsable"** (7 tabel: `pages`, `post_categories`, `post_tags`,
   `product_categories`, `event_categories`, `campaign_categories`, `document_categories`) —
   **SELALU di-query**, terlepas `q` kosong atau tidak. Kalau `q` kosong → `WHERE` diskip
   (`.where(q ? ilike(...) : undefined)`, atau untuk `pages` yang punya filter status tambahan:
   `q ? and(status, ilike) : status saja`), ambil SEMUA baris (sampai `BROWSE_LIMIT=50`). Kalau
   `q` ada → filter `ilike` seperti biasa.
3. **Konten yang bisa terus bertambah** (8 tabel: posts, products, events, campaigns, documents,
   pesantren, usaha, profesional) — **HANYA di-query kalau `q` ada** (`!q ? Promise.resolve([])
   : tdb.select(...)`) — listnya bisa panjang (ratusan post/produk), tidak masuk akal ditampilkan
   semua di awal.
4. Semua hasil digabung, TIDAK ada sorting/grouping tambahan di server — pengelompokan per
   `group` dilakukan di komponen (client-side, `Array.reduce`).

Catatan: dokumen sebelumnya di sini mengklaim ada parameter `types` (comma-separated filter) dan
respons `{links, total}` — **keduanya tidak pernah diimplementasikan**, dihapus dari dokumen ini
supaya tidak menyesatkan. Kalau kebutuhan filter-per-tipe muncul nanti (mis. picker khusus untuk
CTA yang cuma boleh link ke Post/Halaman), tambahkan `types` sungguhan saat itu — jangan asumsikan
sudah ada.

### 3a. Kenapa Halaman + Taksonomi "Selalu Tampil" tapi Konten Lain Tidak

**Perilaku awal** (sebelum diperbaiki): query kosong → HANYA rute statis, nol query DB — semua
konten dinamis (termasuk kategori/tag/halaman) baru muncul setelah user mengetik sesuatu yang
match nama kontennya persis. User melaporkan kebingungan nyata dalam 2 giliran terpisah: (1) buka
picker nav menu, klik cari "kategori"/"tag" (ekspektasi wajar: browsing semua kategori/tag yang
ada) → hasil kosong, karena pencarian mencocokkan `q` terhadap NAMA kategori/tag ("Berita",
"Olahraga"), bukan kata "kategori" itu sendiri; (2) setelah kategori/tag difix, user tanya lagi —
"halaman yang sudah dibuat juga tidak ada" — gap yang sama persis, cuma belum kepikiran di
putaran pertama.

**Perbaikan**: pisahkan konten dinamis jadi dua kelas berbeda perlakuan (bukan berdasar "jenisnya
apa", tapi "seberapa besar list-nya secara realistis"):
- **Browsable** (halaman CMS + SEMUA taksonomi kategori/tag lintas modul) — jumlahnya per tenant
  realistis KECIL (belasan sampai puluhan, bukan ratusan) dan bersifat kurasi admin (jarang
  berubah, dibuat sengaja satu-satu) — aman dan BERGUNA ditampilkan SEMUANYA begitu popover
  dibuka, persis seperti rute statis. `BROWSE_LIMIT=50` sebagai jaring pengaman, bukan mekanisme
  filter utama.
- **Wajib dicari** (post/produk/event/campaign/dokumen/pesantren/usaha/profesional) — jumlahnya
  BISA besar dan terus bertambah sebagai output rutin (artikel baru, produk baru, dst) — TETAP
  wajib `q` dulu, `LIMIT=6` tetap berlaku.

**Aturan untuk tipe baru ke depan**: kalau menambah tipe konten baru ke picker ini, tanya dulu —
"kalau tenant ini eksis 2 tahun, realistis list ini berjumlah puluhan (browsable) atau bisa
ratusan (wajib dicari)?" — BUKAN "ini konten atau taksonomi?" (halaman CMS bukan taksonomi tapi
tetap browsable, karena jumlahnya tetap kecil). Browsable masuk grup query "selalu tampil"
(`BROWSE_LIMIT`), sisanya masuk grup "wajib `q`" (`LIMIT`, gated `!q ? Promise.resolve([]) :
...`).

---

## 4. Komponen: `PublicLinkPicker`

**Lokasi:** `components/ui/public-link-picker.tsx`

```typescript
type Props = {
  slug:         string;
  value?:       string;
  onChange:     (url: string) => void;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
};
```

**UX Behavior:**
- Trigger adalah tombol yang menampilkan URL terpilih (atau placeholder) + ikon Globe + tombol X
  untuk clear.
- Klik → Popover terbuka, langsung fetch dengan query kosong — dapat rute statis + SEMUA halaman
  CMS + SEMUA taksonomi (kategori/tag lintas modul), lihat § 3a.
- Ketik → debounce 300ms → fetch `/api/ref/public-links?slug=&q=`.
- `Command shouldFilter={false}` — **TIDAK mengandalkan filter client-side `cmdk`**, semua
  matching dilakukan server-side. Ini penting: beda dengan `components/ui/combobox.tsx` (bug
  yang sudah difix 2026-07-20 — `CommandItem value` sempat diisi ID bukan label, membuat
  pencarian tidak pernah match) — `PublicLinkPicker` dari awal desainnya sudah kebal dari kelas
  bug itu karena `shouldFilter=false` membuat nilai `CommandItem.value` (diisi `link.url`, juga
  bukan label) tidak pernah dipakai untuk filtering sama sekali.
- Hasil dikelompokkan per `group` di client (`Array.reduce`), masing-masing render sebagai
  `CommandGroup` dengan heading.
- Ikon per tipe (lihat tabel di bawah) + `StaticIcon` khusus untuk rute statis (mapping by label).
- Ada input "Atau ketik URL manual..." di bagian bawah popover — untuk anchor (`#section`), URL
  eksternal, atau override manual. Tetap tersedia setelah refactor ini, tidak dihapus.

**Ikon per tipe** (`components/ui/public-link-picker.tsx`, fungsi `LinkIcon`):

| Type | Lucide Icon |
|------|-------------|
| static | (lihat `StaticIcon`, mapping per label) |
| page | `FileText` |
| post | `Newspaper` |
| post-category | `Tag` |
| post-tag | `Hash` |
| product | `ShoppingBag` |
| product-category | `Layers` |
| **event** | `Calendar` |
| **event-category** | `Tag` |
| campaign | `Heart` |
| **campaign-category** | `Tag` |
| **document** | `FileDown` |
| **document-category** | `Tag` |
| pesantren | `School` |
| usaha | `Briefcase` |
| profesional | `Briefcase` |

Baris **bold** = ditambah 2026-07-20.

---

## 5. File Structure

```
apps/web/
├── app/api/ref/public-links/route.ts   ← GET /api/ref/public-links?slug=&q=
├── lib/
│   ├── public-url-registry.ts          ← rute statis + PublicLinkType + URL builders
│   └── strip-tenant-prefix.ts          ← helper murni, lihat § 9
└── components/ui/public-link-picker.tsx ← komponen combobox
```

---

## 6. `lib/public-url-registry.ts`

```typescript
export type PublicLinkType =
  | "static" | "page" | "post" | "post-category" | "post-tag"
  | "product" | "product-category"
  | "event" | "event-category"
  | "campaign" | "campaign-category"
  | "document" | "document-category"
  | "pesantren" | "usaha" | "profesional";

export type PublicLink = {
  label: string;
  url:   string;
  group: string;
  type:  PublicLinkType;
};

// STATIC_ROUTES — 16 entries (lihat § 2a)
// getStaticLinks(slug, q?) — filter in-memory by label

// Builder URL konten dinamis — semua SELALU return path berprefix "/{slug}/..."
// (lihat § 9 kenapa ini benar meski tenant punya custom domain aktif)
buildPageUrl(slug, pageSlug)
buildPostUrl(slug, postSlug)
buildPostCategoryUrl(slug, catSlug)
buildPostTagUrl(slug, tagSlug)
buildProductUrl(slug, productSlug)
buildProductCategoryUrl(slug, catSlug)
buildEventUrl(slug, eventSlug)                    // → /{slug}/agenda/{eventSlug}
buildEventCategoryUrl(slug, catSlug)               // → /{slug}/agenda?category={catSlug}
buildCampaignUrl(slug, campaignSlug)
buildCampaignCategoryUrl(slug, catSlug)            // → /{slug}/campaign?category={catSlug}
buildDocumentUrl(slug, id)                         // → /{slug}/dokumen/view/{id}
buildDocumentCategoryUrl(slug, categoryId)         // → /{slug}/dokumen?category={categoryId} — ID, bukan slug (§ 2d)
buildPesantrenUrl(slug, id)
buildUsahaUrl(slug, id)
buildProfesionalUrl(slug, id)
```

---

## 7. Penggunaan

### Di nav menu builder (`/app/{slug}/settings/website`)

```tsx
// components/settings/website-settings-client.tsx → NavItemRow
<PublicLinkPicker slug={slug} value={item.href} onChange={(url) => u({ href: url })} />
```

### Di section editor CTA (Hero + CTA section) — ✅ selesai 2026-07-20

```tsx
// components/website/section-editors.tsx → HeroEditor, CtaEditor
<PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaUrl ?? ""} onChange={(url) => u("ctaUrl", url)} />
```

Sebelumnya field ini `<Input>` teks bebas — sekarang picker, TAPI tetap ada fallback "ketik URL
manual" di dalam popovernya sendiri (§ 4), jadi anchor (`#section`) dan URL eksternal tetap bisa
diisi persis seperti sebelumnya. Nilai yang tersimpan sekarang konsisten berprefix `/{slug}/...`
kalau dipilih dari daftar — makanya § 9 (stripping saat render) jadi wajib, bukan opsional.

### Widget area builder — belum ada field href

Phase 1 widget area (`docs/arsitektur-sidebar.md`) baru punya section type `posts` (filter
recent/popular/category/tag) — tidak ada field CTA/link manual sama sekali saat ini, jadi tidak
ada yang perlu diintegrasikan di sini. Kalau nanti section type baru butuh link (mis. CTA banner
di sidebar), pakai pola yang sama seperti § di atas.

---

## 8. Status Implementasi

| Fase | Item | Status |
|---|---|---|
| Data layer | `lib/public-url-registry.ts` — 16 rute statis + 15 tipe dinamis | ✅ |
| Data layer | `GET /api/ref/public-links` | ✅ |
| Komponen | `components/ui/public-link-picker.tsx` | ✅ |
| Integrasi | Nav menu builder (`/settings/website`) | ✅ |
| Integrasi | Section editor CTA (Hero 2 tombol + CTA section 1 tombol) | ✅ (2026-07-20) |
| Integrasi | Widget area builder | Tidak relevan — belum ada field href sama sekali (§ 7) |
| Cakupan modul | Post, Produk, Pages | ✅ sejak awal |
| Cakupan modul | Event (detail + kategori) | ✅ (2026-07-20, sebelumnya 0% — gap total) |
| Cakupan modul | Campaign (kategori) | ✅ (2026-07-20, detail sudah ada sebelumnya) |
| Cakupan modul | Dokumen (arsip statis + detail + kategori) | ✅ (2026-07-20, sebelumnya 0% — gap total) |
| Cakupan modul | Pesantren, Usaha, Profesional | ✅ sejak awal |
| Custom domain | Render-side stripping — nav menu | ✅ sejak lama (`layout.tsx`) |
| Custom domain | Render-side stripping — Hero/CTA section | ✅ (2026-07-20, sebelumnya BUG — lihat § 9) |

---

## 9. Custom Domain — Href Harus Di-strip di TITIK RENDER, Bukan di Titik Simpan

### Prinsip

`PublicLinkPicker` **selalu** menyimpan/mengembalikan URL berprefix `/{slug}/...` — ini benar dan
tidak berubah, karena admin selalu mengedit dari `jalakarta.com/app/{slug}/...` (dashboard admin
tidak pernah bisa diakses dari custom domain tenant, lihat `docs/arsitektur-domain.md` § "Custom
Domain Harus Diisolasi"). Jadi nilai yang tersimpan di DB (JSONB `nav_menu`, atau `section.data.
ctaUrl`) SELALU mengandung prefix `/{slug}`.

Masalahnya: kalau tenant itu **juga** punya custom domain aktif, saat website publiknya dirender
di `visikita.com` (bukan `jalakarta.com/visikita/...`), URL manapun yang masih membawa prefix
`/visikita/...` akan salah — linknya jadi `visikita.com/visikita/post/...` (dobel slug, 404).

**Prinsip yang dikunci**: stripping prefix `/{slug}` **TIDAK PERNAH** dilakukan di titik simpan
(picker/admin) — SELALU dilakukan di titik RENDER (server component publik), persis sesudah
`baseUrl`/`isCustomDomain` diketahui. Ini konsisten dengan pola `baseUrl` yang sudah dikunci di
seluruh front-end publik sejak lama (`docs/arsitektur-domain.md` § 5.2).

### Helper: `lib/strip-tenant-prefix.ts`

```typescript
// Pure function, aman dipakai client maupun server — tidak ada dependency Node/DB.
export function stripTenantPrefix(href: string, slug: string): string {
  if (href === `/${slug}`) return "/";
  if (href.startsWith(`/${slug}/`)) return href.slice(`/${slug}`.length);
  return href; // anchor "#...", URL eksternal, atau path yang memang tidak berprefix — dibiarkan
}
```

Fungsi ini AMAN dipanggil ke SEMUA jenis href tanpa perlu tahu dulu apakah nilainya berasal dari
picker atau diketik manual — kalau tidak match pola `/{slug}` atau `/{slug}/...`, dikembalikan
apa adanya (jadi anchor/URL eksternal tidak pernah rusak oleh fungsi ini).

### Titik-titik yang WAJIB memanggil ini (daftar kanonik — update kalau nambah integrasi baru)

| Titik render | File | Kondisi |
|---|---|---|
| Nav menu header/footer | `app/(public)/[tenant]/layout.tsx` | `isCustomDomain ? strip(href) : href` per item |
| Hero CTA (2 tombol) | `components/website/public/sections/hero/hero-section.tsx` | Strip `data.ctaUrl`/`data.ctaSecondaryUrl` sebelum diteruskan ke `HeroDesign1`/`HeroDesign2` — satu titik untuk kedua desain, tidak diulang di masing-masing file desain |
| CTA section (1 tombol) | `components/website/public/landing-template.tsx` (`CtaSection`) | Butuh `baseUrl` + `tenantSlug` sebagai props baru (sebelumnya cuma terima `data`) |

**Bug yang ditemukan+difix 2026-07-20**: sebelum ini, `CtaSection` dan Hero design components
memakai `d.ctaUrl`/`d.ctaSecondaryUrl` **mentah** tanpa stripping apa pun — `baseUrl` memang
sudah jadi prop di `HeroSection`, tapi cuma dipakai untuk membangun href kartu "Agenda Terbaru"/
"Berita Terbaru" (`fetchHeroCard`), TIDAK PERNAH dipakai untuk CTA button. Selama field CTA masih
`<Input>` bebas, ini "aman" secara kebetulan (admin biasanya isi manual tanpa prefix slug, hasil
kebetulan konsisten meski secara teknis salah di path-mode juga). Begitu field ini diganti
`PublicLinkPicker` (yang SELALU mengembalikan `/{slug}/...`), bug ini akan langsung nyata di
custom domain — makanya fix stripping ini WAJIB masuk BERSAMAAN dengan migrasi Hero/CTA ke
picker, bukan disusulkan nanti.

**Aturan untuk integrasi `PublicLinkPicker` berikutnya** (kalau ada field baru yang memakainya di
masa depan — widget area CTA, dsb): begitu field itu dirender di sisi publik, WAJIB tambah entry
baru ke tabel di atas + panggil `stripTenantPrefix()` di titik render-nya. Jangan asumsikan "URL
dari picker pasti sudah benar" — picker cuma menjamin URL itu benar untuk PATH MODE
(`jalakarta.com/{slug}/...`), custom domain selalu butuh strip eksplisit terpisah.
