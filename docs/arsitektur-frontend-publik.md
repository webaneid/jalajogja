# Arsitektur Front-end Publik — Peta Dokumen

> **Dokumen ini adalah INDEKS, bukan sumber detail.** Front-end publik jalakarta sudah punya ~13
> dokumen arsitektur terpisah (header, footer, landing, post, card+section, SEO, gallery, image,
> direktori, akun, domain, dll) yang ditulis independen seiring modul dibangun — tidak pernah ada
> satu peta yang merangkai semuanya jadi satu alur utuh. Dokumen ini mengisi celah itu: merangkum
> tiap bagian dalam 3-5 baris + link ke dokumen detailnya, plus peta rute dan struktur file lintas
> modul yang tidak ada di dokumen manapun secara utuh.
>
> **Kalau detail teknis dibutuhkan** (schema, server action, keputusan desain, lessons learned) —
> selalu buka dokumen yang dirujuk, bukan dokumen ini. Kalau dokumen yang dirujuk basi/kontradiksi
> dengan kode aktual, percayai kode (lihat prinsip di CLAUDE.md § "Prinsip Penggunaan CLAUDE.md").

---

## 1. Peta Alur — Dari Request Sampai Render

```
Pengunjung buka {slug}.jalakarta.com/... ATAU jalakarta.com/{slug}/... ATAU {custom-domain}/...
  ↓
middleware.ts — resolve host → tenant slug, rewrite internal ke /{slug}/{path}
  (detail lengkap: docs/arsitektur-domain.md)
  ↓
app/(public)/[tenant]/layout.tsx — PublicLayout
  ├─ Fetch settings tenant (nav menu, logo, primary_color, font, header/footer design)
  ├─ Inject CSS variables tema tenant (lib/theme-palette.ts) + Google Fonts dinamis
  ├─ Render Header (2 desain: classic | flex) — § 2
  └─ Render {children} (halaman spesifik) + Footer (2 desain: dark | light) — § 2
  ↓
Halaman spesifik — salah satu dari:
  ├─ Homepage (page.tsx)         → render page dengan template="landing" → LandingTemplate — § 3
  ├─ Halaman CMS ([pageSlug])    → render sesuai template (default/landing/contact/about/linktree)
  ├─ Arsip + detail per modul    → Post, Produk, Event/Agenda, Campaign/Donasi — § 4, § 6
  ├─ Direktori publik            → Anggota, Pesantren, Usaha, Profesional, Statistik — § 7
  └─ Akun & auth publik          → Login, Register, /akun/*, /keranjang, /checkout, /invoice — § 8
```

**File pusat**: `app/(public)/[tenant]/layout.tsx` (PublicLayout). Semua halaman publik tenant
lewat sini — kalau ada bug lintas-halaman (branding, nav, font), cek di sini dulu.

---

## 2. Header & Footer

Tiga desain header (`classic-header.tsx`, `flex-header.tsx`, `pill-header.tsx`) dan tiga desain
footer (`dark-footer.tsx`, `light-footer.tsx`, `modern-footer.tsx`) — dipilih admin via
`/app/{slug}/settings/display`.
Semua dapat CSS variables tema tenant dari `PublicLayout` (bukan prop-drilling manual per
komponen). Katalog ini akan terus bertambah — lihat `design-refs/README.md` untuk alur kerja
menambah variasi desain baru dari referensi eksternal.

**File**: `components/website/public/layout/headers/`, `components/website/public/layout/footers/`
**Dokumen detail**: `docs/arsitektur-header-footer-publik.md`

Poin yang wajib diketahui:
- Nav menu dibangun via `<PublicLinkPicker>` (§ 9) — bisa arah ke halaman statis atau konten dinamis
- Baris atribusi "Jalakarta — developed with ❤️" **hanya tampil di domain sendiri**, disembunyikan
  total di custom domain tenant (`baseUrl !== ""` gate) — lihat `docs/arsitektur-domain.md` § 5.1
- User menu (dropdown login) render "Akun Saya" untuk semua user login, "Dashboard Admin" hanya
  untuk user yang punya `tenant.users` record (dicek client-side agar layout tetap ISR-safe)
- **Mobile shell** — header disembunyikan total di halaman single-item (post/agenda/campaign/
  produk detail + halaman generik), diganti overlay back+menu (`SingleMobileTopBar`); tab nav
  bawah (`BottomNav`) dirender terpisah dari header itu sendiri, setelah footer, via
  `FooterBottomNav`. Aturan lengkap + kelas bug "spacer harus jadi elemen terakhir di HALAMAN
  bukan di komponen" (sudah terbukti berulang 4× dalam satu sesi): **`docs/arsitektur-mobile-shell.md`**
  — WAJIB dibaca sebelum menambah elemen `fixed bottom-0` baru manapun di front-end publik.

---

## 3. Landing Page / Homepage — Section Builder

Homepage tenant (dan halaman CMS bertemplate `landing`) dibangun via **drag & drop section
builder** di dashboard (`@dnd-kit`) — admin susun section dari katalog (Hero, Posts, Products,
Events, Campaigns, Gallery, dan lainnya). Sebagian besar tipe section punya beberapa pilihan
**design** (mis. Posts Section punya 5 desain: Hero 3 Kolom, Klasik, Twin Columns, Trio Column,
Carousel; Hero section punya 2 desain: Klasik, Full-Bleed Modern — ditambahkan 2026-07-16, lihat
§ 4). Sisanya (Gallery, About, Features, CTA, Contact Info, Stats, Divider) masih 1 desain tetap.

**File kunci**:
```
components/website/landing-builder.tsx             → admin: drag & drop section list
components/website/public/landing-template.tsx     → publik: loop sections → render per type+variant
lib/page-templates.ts                               → daftar template halaman (default/landing/contact/about/linktree/terms/privacy)
```
**Dokumen detail**: `docs/arsitektur-website.md` (§ "Template: Landing Page — Section Builder")

Format data section (`LandingBody.sections: SectionItem[]`) dan render dispatch per tipe dijelaskan
lengkap di dokumen tsb — jangan duplikasi logic ini di tempat lain.

---

## 4. Sistem Card + Section — Pola Universal

**Satu arsitektur berlaku untuk SEMUA tipe konten publik yang berupa LISTING**: Post, Produk, Event,
Campaign/Donasi. Pola: `{Type}Section (fetch data)` → `{Type}Design N (layout grid/carousel/dll)`
→ `{Type}Card (render satu item)`. Kalau menambah tipe konten listing baru atau desain baru, ikuti
pola ini — jangan reinvent.

**Dokumen detail (pola umum)**: `docs/arsitektur-card-section.md`
**Dokumen detail per tipe**:
| Tipe | Card variants | Section designs | Dokumen |
|---|---|---|---|
| Post | 6 (klasik/list/overlay/ringkas/judul/ticker) | 5 | `docs/arsitektur-template-post-card.md` + `docs/arsitektur-section-post.md` |
| Produk | 3 (grid/list/ringkas) | 3 (Grid 4 kolom/Showcase 1+4/Carousel) | `docs/arsitektur-product.md` |
| Event | 3 (grid/list/ringkas) | 3 | `docs/arsitektur-event.md` |
| Campaign/Donasi | 3 (grid/list/ringkas) | 3 (Grid/Unggulan/Daftar) | `docs/arsitektur-donasi.md` |

`PostsSectionTitle` (heading + dashed line + "Lihat Semua ›") dipakai ulang oleh semua tipe — sudah
generik, jangan buat header section baru per tipe.

**Hero section pakai dispatcher yang sama (`{Type}Section → {Type}Design N`) tapi BUKAN listing** —
tidak ada konsep "Card" karena hero cuma satu banner, bukan daftar item berulang. 2 desain: `1`
Klasik (banner + 2 CTA + kartu mengambang event/berita), `2` Full-Bleed Modern (gambar penuh layar +
overlay gelap). File: `components/website/public/sections/hero/`, registry:
`lib/hero-section-designs.ts`. Ditambahkan 2026-07-16 — sebelumnya hero cuma 1 desain hardcoded
tanpa sistem variant sama sekali (satu-satunya section type yang belum ikut pola ini).

**Field `showModuleStrip` berarti berbeda per desain hero** (ditambahkan 2026-07-16) — di Desain 1
tetap berarti "tampilkan strip kartu modul" (4 item tetap: Donasi/Agenda/Dokumen/Anggota, dari
`HERO_MODULES`). Di Desain 2, field YANG SAMA berarti "tampilkan Funfact": statistik yang dihitung
live dari database (bukan diketik manual admin) — admin pilih maks 4 metrik dari katalog 10 pilihan
(`FUNFACT_CATALOG` di `lib/hero-section-designs.ts`), query per metrik ada di
`sections/hero/hero-section.tsx`. Desain 1 sama sekali tidak disentuh oleh perubahan ini.

**Section "Strip Modul" independen** (`modules`, ditambahkan 2026-07-16, 2 desain sejak
2026-07-17) — strip modul yang tadinya cuma bisa hidup di dalam hero sekarang jadi section landing
page tersendiri, admin pilih dari katalog 8 modul (4 modul lama + Usaha/Profesional/Pesantren/Toko
yang sebelumnya tidak pernah bisa ditonjolkan), 2 desain (Ikon / Foto dengan fallback foto
berlapis otomatis). **Dokumen detail penuh**: `docs/arsitektur-strip-modul.md` — katalog, kedua
desain, tabel fallback foto per modul, data model, editor, struktur file.

**Section CTA — tetap Design 1 tunggal, 4 axis sub-opsi** (ditambahkan 2026-07-22) — beda dari
Hero/Posts/Modules yang punya beberapa `variant` bernomor, CTA memilih tidak membelah jadi Design 2
karena variasinya (align teks, background secondary/primary, lebar full/boxed, posisi tombol
below/beside) adalah kombinasi bebas dalam satu layout, bukan struktur JSX berbeda. Tombol kedua
(baru, sebelumnya CTA cuma 1 tombol) pakai variant `PublicButton` baru `outline-light` (border
`currentColor`, bukan CSS var tetap). **Dokumen detail penuh**: `docs/arsitektur-cta-section.md`.

**Section Keunggulan/Layanan — tetap Design 1 tunggal, icon jadi picker sungguhan** (ditambahkan
2026-07-22) — pola sama CTA (sub-opsi flat field, bukan Design 2). Field icon per-item yang
sebelumnya `<Input>` emoji bebas diganti `<IconPicker>` (komponen baru, generik, siap dipakai
section lain) — searchable grid dari katalog kurasi ~120 icon `lucide-react` (`lib/icon-
catalog.ts`), BUKAN seluruh library (~1700+, terlalu berisik untuk konteks bisnis/layanan).
**Dokumen detail penuh**: `docs/arsitektur-keunggulan-section.md` — termasuk peringatan penting:
nama icon HARUS diverifikasi dulu terhadap `.d.ts` package yang terinstall, banyak nama populer
di versi lucide-react lama (`CheckCircle2`, `BarChart3`, `HelpCircle`) sudah di-rename di v1.8.0.

**Section Tentang Kami — tetap Design 1 tunggal, standar background BARU 5-opsi** (ditambahkan
2026-07-22) — SELALU 2 kolom 50/50 (perubahan struktural disengaja dari layout lama yang tidak
proporsional). Section PERTAMA yang pakai `lib/section-background.ts` (`none`/`light`/`primary`/
`secondary`/`dark`) — standar ini DIKUNCI untuk section BARU ke depan, TAPI sengaja TIDAK
diretrofit ke CTA/Keunggulan yang sudah lebih dulu selesai. Mode deskripsi teks-biasa atau
list-repeater (reuse `IconPicker`+tipe icon dari Keunggulan/Layanan, tanpa card/border — cuma
opsi garis pemisah). Tombol baru (section ini sebelumnya tidak punya tombol sama sekali). Rasio
gambar square/profile murni CSS `aspect-ratio` — TIDAK menambah variant baru ke pipeline gambar.
**Dokumen detail penuh**: `docs/arsitektur-tentang-kami-section.md`.

**Section Galeri Foto — title block + background standar, sekalian bug fix scroll-to-top**
(ditambahkan 2026-07-22) — pola sama Tentang Kami untuk title block+background (reuse
`lib/section-background.ts`). Editor dapat picker Kolom (3/4) dan Rasio Gambar (square/landscape)
— gap pre-existing ditutup sekalian (field `layout`/`columns` sudah DIBACA section tapi tidak
pernah ada UI-nya). Sekalian diperbaiki: bug shared component `<GalleryGrid>` (dipakai lintas
modul, bukan cuma landing) — thumbnail pakai `<a>` polos alih-alih `<Link scroll={false}>`,
menyebabkan halaman scroll ke atas tiap kali lightbox dibuka. **Dokumen detail penuh**:
`docs/arsitektur-gallery.md` § "Bug Fix" dan § "Status Implementasi".

**`<SectionTitleBlock>` — ekstraksi blok judul bersama** (ditambahkan 2026-07-22) — trio
eyebrow+judul+deskripsi yang identik persis di Keunggulan/Tentang Kami/Galeri (3 sesi terpisah,
disalin ulang tiap kali) diekstrak jadi satu komponen. Ukuran judul via `.section-title` (CSS
`clamp()` baru di `globals.css`, ganti Tailwind size utilities yang diulang 3×). Warna eyebrow
otomatis kontras terhadap background section (`resolveAccentTextClass()`, `opacity-70` di
background berwarna alih-alih `text-primary` yang hilang di atas `bg-primary`). Tombol "Lihat
Semua" `PostsSectionTitle` (Post/Produk/Campaign/Event) sekalian diganti gaya bordered-pill
(`<SectionSeeAllLink>`, komponen React berdiri sendiri — BUKAN menimpa `.btn-ghost` Public Button
System yang visualnya beda). CTA & Hero tidak ikut — judulnya sendiri menyamai ukuran Hero.
**Sweep lanjutan (sesi sama)** — `.section-title` diterapkan ke SEMUA judul section lain yang
tersisa: `PostsSectionTitle` (Post/Produk/Campaign/Event, semua design), Design "Hero 3 Kolom"
Post, Strip Modul Desain 2, "Info Kontak", dan Statistik (section ini SEBELUMNYA tidak punya
judul sama sekali — ditambahkan baru, opsional, default kosong = zero perubahan visual untuk
data existing). Judul ITEM/CARD (nama post/produk individual di dalam kartu) SENGAJA TIDAK ikut
disamakan — beda kelas dari judul section. **Perluasan (sesi berikutnya)** — `PostsSectionTitle`
(dipakai Post/Produk/Campaign/Event, 11 dari 14 design) direstrukturisasi total: reuse
`<SectionTitleBlock>` untuk trio eyebrow+judul+deskripsi (bukan render manual terpisah lagi),
tambah opsi posisi **HANYA 2** (left/center, beda dari Keunggulan/CTA yang 3 opsi) — "left" =
tombol "Lihat Semua" tetap sejajar kanan (default, tidak berubah), "center" = title block
terpusat + tombol pindah ke baris terpisah di bawah, juga terpusat. Design "Hero 3 Kolom" Post
dan sub-header per-kolom "Trio Column" Post sengaja tidak ikut (tidak memakai `PostsSectionTitle`
sebagai judul section). **Audit kelengkapan + perluasan lanjutan (sesi berikutnya lagi)** — dari
13 tipe section, ditemukan 3 gap: Strip Modul (belum tersentuh sama sekali — Design 1 pakai
`PostsSectionTitle` tapi tidak diwire eyebrow/desc/align, Design 2 raw `<h2>` tanpa
`SectionTitleBlock`), Galeri Foto dan Statistik (sudah punya eyebrow+judul+deskripsi tapi wrapper
di-hardcode center, tidak ada pilihan align). Ketiganya dibereskan sekaligus — Strip Modul Desain
2 (tombol scroll rail, bukan href "Lihat Semua") direstrukturisasi manual mengikuti pola yang
sama (title+panah 1 baris untuk left, title terpusat+panah di bawah untuk center). **Default
align Galeri/Statistik = `"center"`** (BUKAN `"left"` seperti Post/Produk/dst) — krusial untuk
backward-compat karena perilaku asli keduanya SUDAH SELALU center sebelum opsi ini ada. Keunggulan/
Layanan TETAP 3 opsi align (kiri/tengah/kanan) — bukan gap, desain awalnya sendiri, tidak
diseragamkan. Info Kontak dan Divider tetap tidak tersentuh (bukan gap — lihat dokumen detail).
**Dokumen detail penuh**: `docs/arsitektur-section-title-block.md` § 6–14.

---

## 5. Widget Area (Sidebar)

Named widget area — mirip `dynamic_sidebar()` WordPress. Admin susun section (Recent/Popular/
Category/Tag posts) via DnD builder di `/app/{slug}/website/pengaturan`; tampil via
`<WidgetArea id="default-sidebar" tenantSlug={slug} />` di sisi kanan arsip + detail post.

**File**: `components/website/public/widget-area.tsx`
**Dokumen detail**: `docs/arsitektur-sidebar.md`

---

## 6. Arsip & Detail per Modul

Setiap modul dengan konten publik (Post, Produk, Event, Campaign, Dokumen) punya pola URL:
`/{slug}/{modul}` (arsip, filter kategori/tag via query param) dan `/{slug}/{modul}/{itemSlug}`
(detail). Lihat § 10 untuk tabel URL lengkap.

| Modul | Dokumen |
|---|---|
| Post | `docs/arsitektur-website.md`, `docs/arsitektur-template-post-card.md` |
| Produk (Toko) | `docs/arsitektur-product.md` (+ Mitra: `docs/arsitektur-mitra.md`) |
| Event / Agenda | `docs/arsitektur-event.md` |
| Campaign / Donasi | `docs/arsitektur-donasi.md` (alur checkout: `docs/arsitektur-donasi-alur.md`) |
| Dokumen | `docs/arsitektur-document.md` |
| Surat (verifikasi publik) | `docs/arsitektur-tandatangan.md` (halaman `/verify/[hash]`, `/sign/[token]`) |

**Catatan URL**: `/event/{slug}` adalah redirect lama ke `/agenda/{slug}` (backward compat) — rute
kanonik event publik adalah `/agenda`, bukan `/event`.

---

## 7. Direktori Publik

Empat halaman yang menampilkan data IKPM ke pengunjung (tanpa login): Anggota, Pesantren, Usaha,
Profesional (masing-masing arsip + detail), dan satu halaman agregat: Statistik.

**Dokumen detail**: `docs/arsitektur-direktori-publik.md` (Anggota/Pesantren/Usaha/Statistik),
`docs/arsitektur-profesional.md` (Profesional — ditambahkan belakangan, pola sama)

Aturan visibilitas data (NIK, tanggal lahir, alamat detail, dll — apa yang boleh/tidak boleh
tampil) dikunci di dokumen tsb — **jangan ubah tanpa baca aturan itu dulu**, banyak field sensitif.

---

## 8. Akun Publik, Login, Cart & Checkout

- **Login/Register/Lupa Password/Dashboard Akun** (`/login`, `/register`, `/akun/*`) — tiga level
  akses (Pengurus/Anggota IKPM/Akun Publik), satu sistem. Dokumen: `docs/arsitektur-login-universal.md`,
  konsep dasar tiga-level di `docs/arsitektur-akun.md`.
- **Cart universal → Checkout → Invoice** (`/keranjang`, `/checkout`, `/invoice/[id]`) — satu
  infrastruktur dipakai Toko + Donasi + tiket Event. Dokumen: `docs/arsitektur-billing.md`.
- **Self-service data anggota** (`/akun/lengkapi`, `/akun/usaha`, `/akun/pesantren`,
  `/akun/profesional`, `/akun/media`, `/akun/mitra/*`) — masing-masing overlap dengan dokumen
  direktori/mitra terkait (§ 7, `docs/arsitektur-mitra.md`, `docs/arsitektur-medialibrary.md`).

---

## 9. Cross-Cutting: Dipakai di Banyak Tempat Sekaligus

Sistem berikut bukan "satu halaman", tapi infrastruktur yang dipakai lintas hampir semua halaman
publik di atas:

| Sistem | Dipakai di | Dokumen |
|---|---|---|
| **SEO** (meta, OG, JSON-LD, sitemap-ish) | Semua halaman publik dengan `generateMetadata` | `docs/arsitektur-seo.md` |
| **Gallery** (`<Gallery>`, Lightbox, Picker) | Event, Campaign, Tiptap editor, landing section | `docs/arsitektur-gallery.md` |
| **Image System** (variant WebP, crop) | Semua gambar di seluruh publik (cover, produk, galeri) | `docs/arsitektur-image.md` |
| **Public Link Picker** (autocomplete URL) | Nav menu builder, (belum semua) CTA section editor | `docs/arsitektur-public-link-picker.md` |
| **Domain & URL routing** (custom domain, baseUrl) | Middleware, semua `href` di komponen publik | `docs/arsitektur-domain.md` |
| **View Counter** | Post detail (badge "≥50 dilihat") | `docs/arsitektur-views-count.md` |

---

## 10. Peta Rute Lengkap (`app/(public)/[tenant]/`)

```
/{slug}/                          → homepage (template landing)
/{slug}/{pageSlug}                → halaman CMS statis (default/landing/contact/about/linktree)

/{slug}/post                      → arsip post (filter ?category=, ?tag=)
/{slug}/post/{slug}                → detail post

/{slug}/produk                    → arsip produk (filter kategori, search)
/{slug}/produk/kategori/{slug}    → arsip per kategori
/{slug}/produk/{productSlug}      → detail produk (varian, add to cart)

/{slug}/agenda                    → arsip event (filter kategori, toggle mendatang/semua)
/{slug}/agenda/{slug}             → detail event (tab Detail/Peserta/Statistik, form daftar)
/{slug}/event/{slug}              → [REDIRECT lama] → /agenda/{slug}

/{slug}/campaign                  → arsip donasi/qurban (filter tipe+kategori)
/{slug}/campaign/{slug}           → detail campaign (form donasi / pilih hewan qurban, tab Donatur)

/{slug}/dokumen                   → arsip dokumen publik
/{slug}/dokumen/view/{id}         → viewer PDF dokumen

/{slug}/anggota                   → direktori anggota (grid + popup detail)
/{slug}/anggota/{id}              → profil anggota (auth-protected, owner only)
/{slug}/pesantren                 → direktori pesantren
/{slug}/pesantren/{id}            → detail pesantren
/{slug}/usaha                     → direktori usaha anggota
/{slug}/usaha/{id}                → detail usaha
/{slug}/profesional               → direktori profesional
/{slug}/profesional/{id}          → detail profesional
/{slug}/statistik                 → dashboard statistik anggota/pesantren/usaha/profesional

/{slug}/login                     → login (email/password + WA OTP)
/{slug}/register                  → register (jalur IKPM vs publik)
/{slug}/forgot-password           → lupa password (email link / WA OTP)
/{slug}/reset-password            → set password baru via token
/{slug}/akun                      → dashboard akun (member/publik)
/{slug}/akun/profil               → edit profil
/{slug}/akun/transaksi            → riwayat transaksi
/{slug}/akun/lengkapi             → wizard lengkapi data anggota IKPM (3 step)
/{slug}/akun/usaha                → kelola data usaha sendiri
/{slug}/akun/pesantren            → kelola data pesantren sendiri
/{slug}/akun/profesional          → kelola data profesional sendiri
/{slug}/akun/media                → media library pribadi (member, global lintas tenant)
/{slug}/akun/mitra/*              → dashboard mitra (produk, pesanan)
/{slug}/akun/event                → event yang diikuti
/{slug}/akun-error                → dead-end page untuk akun tanpa identity (cegah redirect loop)

/{slug}/keranjang                 → cart universal
/{slug}/checkout                  → checkout (multi-step, shipping per seller)
/{slug}/invoice/{id}               → invoice publik (bayar, upload bukti, tracking)

/{slug}/invite                    → terima undangan jadi pengurus
/{slug}/sign/{token}               → tanda tangan surat via link (auth required)
/{slug}/verify/{hash}              → verifikasi keaslian tanda tangan surat (no auth)

/{slug}/admin, /{slug}/app/*      → BUKAN publik — lihat docs/arsitektur-domain.md § 7 (Admin-on-Custom-Domain)
```

**Prinsip URL yang dikunci**: tiap kali nama folder publik baru bentrok dengan nama modul dashboard
(`toko`→`produk`, `donasi`→`campaign`, `event`→`agenda`, `akun` dashboard→`accounts`), rename salah
satu — lihat lesson "URL Naming Pattern untuk Hindari Route Conflict" di CLAUDE.md.

---

## 11. Struktur File Lintas Modul

```
apps/web/
├── app/(public)/[tenant]/          → semua route di § 10
├── components/website/public/
│   ├── layout/headers/             → classic-header.tsx, flex-header.tsx
│   ├── layout/footers/             → dark-footer.tsx, light-footer.tsx
│   ├── landing-template.tsx        → dispatcher section landing
│   ├── default-template.tsx, contact-template.tsx, linktree-template.tsx
│   │     (template "about"/"terms"/"privacy" render DefaultTemplate juga — tidak ada file terpisah)
│   ├── post-cards/                 → 6 varian PostCard
│   ├── product-cards/              → 3 varian ProductCard
│   ├── event-cards/                → 3 varian EventCard
│   ├── campaign-cards/             → 3 varian CampaignCard
│   ├── sections/{posts,products,events,campaigns}/  → N desain per tipe
│   ├── widget-area.tsx             → sidebar named area
│   └── ui/                         → PublicButton, dan komponen kecil publik lain
├── components/gallery/              → Gallery, GalleryGrid, GalleryLightbox, GalleryPicker
├── lib/
│   ├── theme-palette.ts             → CSS variables tema tenant dari primary_color
│   ├── seo.ts, seo-defaults.ts      → helper + konstanta SEO
│   ├── tenant-seo.ts                → resolve base URL SEO per tenant (custom domain aware)
│   ├── page-templates.ts            → daftar template halaman CMS
│   ├── public-url-registry.ts       → daftar URL statis untuk Public Link Picker
│   ├── resolve-base-url.ts          → server helper baseUrl (custom domain aware)
│   ├── use-base-url.ts              → client hook baseUrl
│   └── is-own-host.ts               → single source of truth "host milik jalakarta"
└── middleware.ts                    → resolusi domain → tenant, lihat docs/arsitektur-domain.md
```

---

## 12. Aturan UI yang Berlaku di SEMUA Halaman Publik

Ringkas dari CLAUDE.md § "UI Standards" dan § "Public Button System" — detail lengkap di sana,
bukan di sini:

- **Container**: selalu `max-w-7xl mx-auto px-4` — header, footer, semua section. Tidak boleh
  `max-w-6xl`/`max-w-5xl` tanpa alasan desain eksplisit.
- **Border dekoratif**: selalu `border-l border-border` (dst) — jangan tanpa kelas warna.
- **Button/CTA**: selalu `<PublicButton>` atau CSS class `.btn` — tidak pernah Tailwind manual.
  Detail: CLAUDE.md § "Public Button System (Front-end Publik)".
- **`baseUrl` pattern**: tidak pernah hardcode `/${slug}/...` di komponen publik — selalu hitung via
  `resolveBaseUrl()` (server) / `useBaseUrl()` (client), lihat § 11. Konsisten di custom domain.
- **Mobile**: tidak boleh ada wrapper `<div className="min-h-screen bg-background">` ekstra di
  halaman detail — `PublicLayout` sudah menyediakannya. Lihat lesson "Mobile Layout Overflow" di
  CLAUDE.md.
- **Mobile shell — sticky bar & spacer**: `md:hidden` berarti "hidden MULAI md ke atas" (bukan
  "hidden di mobile") — kesalahan baca ini sumber bug berulang. Setiap spacer pasangan elemen
  `fixed bottom-0` WAJIB jadi elemen paling terakhir di HALAMAN (bukan cuma di komponen) — kalau
  ada konten lain yang render setelahnya, spacer nyangkut di tengah dan konten itu tidak
  terlindungi. Tiga pola fix + checklist lengkap: **`docs/arsitektur-mobile-shell.md`**.
- **Konten Tiptap JSON** (description/body/content): selalu lewat `renderBody()`
  (`lib/letter-render.ts`) sebelum ditampilkan — tidak pernah `dangerouslySetInnerHTML` langsung
  atau `.slice()` untuk SEO/preview.

---

## 13. Status Ringkas

Semua bagian di dokumen ini **✅ SELESAI** per commit terakhir yang tercatat di CLAUDE.md § "Status
Project", kecuali:
- Section editor CTA field belum semua pakai `<PublicLinkPicker>` (§ 9) — sebagian masih input URL manual
- Donasi Rutin (subscription) — front-end belum ada, ditunda (Phase R)
- Produk Variasi V8 (validasi stok server-side saat add to cart) — ditunda
- Gallery Phase 4 (masonry + carousel) — belum

Untuk status paling akurat, **selalu cek CLAUDE.md § "Status Project (terkini)" dan
`docs/lessons-learned.md`** langsung — dokumen ini adalah peta struktur, bukan tracker status
(yang cepat basi).
