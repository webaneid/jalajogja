# Arsitektur Header & Footer Publik — jalakarta

Dokumen ini mendefinisikan sistem header dan footer multi-desain untuk front-end publik tenant.
Merupakan perluasan dari **Bagian 5 `arsitektur-website.md`** (Public Layout) yang sebelumnya hanya
mencatat satu desain statis. Mulai dari implementasi ini, header dan footer dikelola via design registry.

---

## Konsep Utama: Design Registry

Header dan footer bukan komponen tunggal — melainkan **switcher** yang membaca `design_id` dari
settings lalu merender komponen desain yang sesuai.

```
PublicLayout (server, ISR-safe)
  ↓ baca header_design + footer_design dari settings (display group)
  ↓ baca nav_menu + homepage_slug dari settings (website group)
  ↓
public-header.tsx (wrapper)        public-footer.tsx (wrapper)
  ↓ lookup HEADER_DESIGNS            ↓ lookup FOOTER_DESIGNS
  ↓ render komponen terpilih         ↓ render komponen terpilih

FlexHeader | ClassicHeader | ...    DarkFooter | LightFooter | ...
```

**Menambah desain baru** = buat satu file komponen + satu baris di registry. Tidak ada perubahan
di layout, DB, atau settings schema.

---

## ⚠️ Keputusan ISR vs Session

**PublicLayout TIDAK boleh memanggil `headers()` atau `cookies()`.**

Alasan: memanggil `headers()` di server component membuat seluruh route segment menjadi **dynamic**
dan membatalkan ISR (`revalidate = 60`) di semua page children — semua halaman publik jadi full SSR
per-request, membebani server.

**Solusi**: session user diambil **client-side** di dalam FlexHeader menggunakan
`authClient.useSession()` dari Better Auth. Layout hanya fetch data statis (settings, nav menu).

```
PublicLayout (server)   → displaySettings + navMenu + contactSettings SAJA (ISR-safe)
FlexHeader ("use client") → authClient.useSession() untuk user avatar/dropdown
```

---

## Settings Store

Key di `settings` table:

```
key="header_design"   group="display"   value="flex"      ← default
key="footer_design"   group="display"   value="dark"      ← default
key="nav_menu"        group="website"   value=NavItem[]   ← sudah ada
key="homepage_slug"   group="website"   value=string      ← sudah ada
```

Tenant yang belum set → fallback ke `"flex"` (header) dan `"dark"` (footer) via nullish coalescing.

`saveDisplaySettingsAction` di `settings/actions.ts` **di-extend** (bukan buat action baru) untuk
handle key `header_design` dan `footer_design`.

---

## Struktur File

```
lib/
├── header-designs.ts        → HEADER_DESIGNS registry + HeaderDesignId type
└── footer-designs.ts        → FOOTER_DESIGNS registry + FooterDesignId type

components/website/public/layout/
├── public-header.tsx             → wrapper switcher (server, lookup registry → render)
├── public-footer.tsx             → wrapper switcher (server, lookup registry → render)
├── headers/
│   ├── classic-header.tsx        → desain lama (dipindah dari public-header.tsx)
│   └── flex-header.tsx           → desain baru 2-row ("use client", authClient.useSession)
└── footers/
    ├── dark-footer.tsx           → desain lama (dipindah dari public-footer.tsx)
    └── light-footer.tsx          → desain terang (perencanaan, belum dieksekusi)
```

---

## Props Universal Header

Semua komponen header menerima satu interface yang sama agar registry bisa swap tanpa
mengubah wrapper:

```typescript
export type HeaderProps = {
  tenantSlug:   string;
  siteName:     string;
  logoUrl:      string | null;
  navMenu:      NavItem[];
  primaryColor: string;
  // currentUser TIDAK ada di props — diambil client-side via authClient.useSession()
};
```

**Catatan**: `currentUser` tidak di-pass lewat props dari server karena membuat layout dynamic
(melanggar ISR). FlexHeader mengambil session sendiri via hook client-side.

---

## PublicUser Type

Dua tipe user yang bisa login di front-end publik (dipakai di FlexHeader client-side):

```typescript
// Didefinisikan di lib/header-designs.ts
export type PublicUser =
  | { type: "member";  name: string; email: string; memberNumber: string }
  | { type: "profile"; name: string; email: string }
  | null;
```

Avatar: tidak ada kolom `avatarUrl` di `public.members` maupun `public.profiles` saat ini.
Sementara pakai **inisial nama** (huruf pertama) sebagai fallback.

---

## Desain 1: Flex Header (Default Baru)

Dua row terpisah. Komponen ini `"use client"` — mengambil session via `authClient.useSession()`.

### Row Atas — TopBar

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]          [🔍 Search Field Text]          [🔔]  [Avatar] │
└─────────────────────────────────────────────────────────────────┘
```

| Elemen | Detail |
|--------|--------|
| Logo | Jika `logoUrl` ada → `<img class="h-12">` **tanpa teks nama**. Jika tidak ada → inisial bulat + `siteName` |
| Search | Input full-width, `border-gray-300` (terlihat jelas), background putih, debounce 300ms → `GET /api/search?slug=&q=` |
| Lonceng | Icon Bell — placeholder kosong. Tersambung ke Modul Pengumuman nanti |
| Avatar | Inisial nama jika belum login. Jika login → inisial dari session user. Klik → dropdown (Profil / Keluar) atau tombol "Masuk" |

### Row Bawah — NavBar

```
┌─────────────────────────────────────────────────────────────────┐
│  [Item 1]  [Item 2]  [Item 3]  ...                  [Masuk] [Daftar] │
└─────────────────────────────────────────────────────────────────┘
```

- Menu diambil dari `navMenu` prop (di-pass dari layout server)
- Kanan: "Masuk" + "Daftar" jika belum login, atau dropdown user jika sudah login
- Separator antara TopBar dan NavBar: `border-gray-200` (lebih terang dari search `border-gray-300`)

### Mobile — Bottom Navigation Bar (redesain 2026-07-20)

> Status sebelumnya ✅ Selesai (dalam FlexHeader) — REDESAIN total 2026-07-20, konten di bawah
> ini menggantikan versi lama sepenuhnya (wireframe + "Icons per NavItemType" lama dihapus,
> keduanya sudah basi sejak `NavItem` migrasi dari model `type`-based ke href-only, lihat
> `parseNavMenu` di `lib/nav-menu.ts`). Deskripsi di bawah adalah state FINAL setelah 2 putaran
> koreksi proporsi dari user (lihat CLAUDE.md § "Koreksi putaran 2/3" untuk riwayatnya) — bukan
> draft pertama, jangan ambil versi commit lama sebagai rujukan.

Header mobile tidak menampilkan NavBar. Sebagai gantinya: **fixed bottom navigation bar** dengan
tombol **Beranda melayang di tengah** (floating action button style — `bg-primary`, ikon putih,
HANYA ~15% tinggi elemennya yang menonjol di atas garis bar — bukan 50% — dikelilingi `ring-4
ring-white` sebagai halo pemisah).

```
┌────────────────────────────────────┐
│  [Logo]   [🔍]              [👤]   │  ← TopBar compact
└────────────────────────────────────┘

...konten halaman...

                 ╭──╮
        ┌────────┤🏠├────────┐         ← Beranda, cuma puncak kecil menonjol (~15%)
┌───────┴────────╰──╯────────┴────────┐
│  📰       🛒              🎫  ☰    │  ← bar rounded-t-3xl, shadow
│Berita    Toko            Event Lainnya│
└────────────────────────────────────────┘
```

- **Beranda** SELALU tampil sebagai tombol melayang di tengah — tidak diambil dari `nav_menu`
  (item `nav_menu` yang kebetulan juga menunjuk ke beranda otomatis difilter, cegah duplikat)
- **Maks 3 item menu ASLI** ditampilkan (bukan 4) — kiri 2, kanan 1. Slot ke-2 kanan SELALU
  direservasi untuk tombol "Lainnya" kalau masih ada sisa item — jadi kiri:kanan selalu ≤2:2,
  tidak pernah 2:3 (bug awal, sudah difix). Kalau item ≤3 total dan tidak ada sisa, "Lainnya"
  tidak dirender sama sekali (kanan bisa 0-1 item, wajar tidak simetris kalau memang kontennya
  sedikit)
- Tombol "Lainnya" → drawer slide-up berisi sisa menu, ikon per item tetap di-resolve (bukan
  generik lagi)
- Breakpoint: bottom nav aktif di `< md` (< 768px), NavBar aktif di `>= md`
- Bar: `bg-white rounded-t-3xl border-t border-border shadow-[0_-8px_24px_rgba(0,0,0,0.08)]`,
  tinggi `h-16` + `pt-3` (total 76px — spacer di `footer-bottom-nav.tsx` WAJIB `h-20`, bukan
  `h-14` lama, lihat `docs/arsitektur-mobile-shell.md`)

---

## Ikon Nav Item — Satu Sumber Kebenaran dengan `PublicLinkPicker`

**File**: `components/ui/public-link-icon.tsx` — dipakai BERSAMA oleh `PublicLinkPicker`
(`components/ui/public-link-picker.tsx`) dan `BottomNav` (`headers/flex-header.tsx`). Sebelumnya
setiap item bottom nav render ikon generik `Link2` — karena `NavItem` (`lib/nav-menu.ts`) hanya
menyimpan `{id, label, href, external, order}`, TIDAK ADA field `type` sejak migrasi dari model
lama `NAV_TYPE_ICONS` (yang didokumentasikan salah di versi lama section ini — field itu sudah
lama tidak eksis di kode).

**Dua cara resolve ikon, dari file yang sama**:
- `iconForType(type, group)` — dipakai `PublicLinkPicker`, `type` sudah pasti diketahui langsung
  dari respons `/api/ref/public-links` (§ lihat `docs/arsitektur-public-link-picker.md`).
- `iconForHref(href, baseUrl)` — dipakai `BottomNav`, infer tipe dari pola SEGMEN PERTAMA path
  (`/post` → Newspaper, `/agenda` → Calendar, `/produk` → ShoppingBag, dst — mengikuti pola
  builder `lib/public-url-registry.ts` secara terbalik). Bekerja untuk nav item hasil pilih dari
  picker MAUPUN yang diketik manual/item lama — tidak butuh migrasi data apa pun, karena inferensi
  murni dari string href yang sudah tersimpan.

**Fallback halaman CMS (`/{slug}/{pageSlug}`)**: rute ini TIDAK PUNYA prefix segmen tetap seperti
`post`/`agenda`/dst — jadi tidak pernah match tabel `SEGMENT_TYPE`/`SEGMENT_STATIC_ICON` manapun.
Karena ini SATU-SATUNYA rute wildcard 1-segmen di seluruh registry, `iconForHref` default-kan
href 1-segmen yang tidak dikenal ke ikon `FileText` (ikon Halaman) — bukan ikon generik `Link2`.
Href >1 segmen yang tidak dikenal, anchor `#...`, atau URL eksternal tetap fallback ke `Link2`.

**Aturan**: kalau menambah tipe konten baru ke `PublicLinkType` (lihat
`docs/arsitektur-public-link-picker.md`), WAJIB tambah entry ikonnya juga di
`public-link-icon.tsx` — SATU tempat, otomatis berlaku untuk picker DAN bottom nav sekaligus.
Jangan pernah menulis ulang tabel ikon terpisah di komponen lain.

---

## Desain 2: Classic Header (Lama)

Kode yang sudah ada dipindah ke `headers/classic-header.tsx` tanpa perubahan behavior.
Ini komponen server — tidak perlu session.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo + Nama]        [Nav Items]                  [☰ mobile]  │
└─────────────────────────────────────────────────────────────────┘
```

Props diupdate menerima `HeaderProps` (interface universal, tanpa currentUser) agar
kompatibel dengan registry.

---

## Desain 3: Pill Header (Modern)

> Ditambahkan 2026-07-16, sumber ide dari `design-refs/jalakarta-v2/` (lihat
> `design-refs/README.md` untuk alur kerja mengambil desain dari referensi eksternal — bukan
> disalin mentah, hanya diambil struktur/bahasanya, direkonstruksi jadi komponen React biasa
> memakai CSS variable tema tenant, bukan warna hardcoded dari sumbernya).

File: `headers/pill-header.tsx`. Client component (butuh session untuk `UserMenu`, sama seperti
FlexHeader).

```
┌─────────────────────────────────────────────────────────────────┐
│ [J] Nama    ( Nav Item · Nav Item · Nav Item )   (🔍)(🛒)(👤)  │
└─────────────────────────────────────────────────────────────────┘
```

- **Border Bottom Tipis Refined**: `border-b border-border/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]` — memberikan garis pembatas bawah yang halus, bersih, dan elegan.
- **Nav Menu Presisi di Tengah (Align Center)** — ✅ FIXED (2026-07-29): grid `md:grid-cols-[1fr_auto_1fr]`
  (BUKAN `md:grid-cols-3` — versi awal `grid-cols-3` membagi header jadi 3 kolom SAMA RATA, yang
  cuma benar kalau nav lebih sempit dari 1/3 lebar header; begitu ada beberapa item menu, nav
  meluber keluar kolomnya dan `mx-auto`-nya kolaps jadi 0 karena tidak ada ruang kosong tersisa
  untuk di-center-kan — nav jadi menempel ke kiri kolom tengah lalu meluber ke kanan, terlihat
  "mepet ke kanan"). Kolom tengah `auto` mengikuti lebar KONTEN nav apa adanya, dan kedua kolom
  `1fr` di kiri-kanan menyerap SISA ruang secara SAMA RATA — ini menjamin nav benar-benar center
  matematis terlepas berapa pun jumlah item menu atau lebar logo/action buttons. `mx-auto` di
  `<nav>` dihapus (sudah tidak relevan — kolom `auto` selalu pas dengan lebar nav itu sendiri).
- Logo mark: badge kotak `rounded-xl` (bukan lingkaran seperti Flex/Classic) — sinyal visual
  pembeda utama antar desain.
- **Teks nama tenant di sebelah logo HANYA fallback** — kalau `logoUrl` terisi, cuma logo yang
  tampil (tidak ada teks berdampingan). Teks (badge inisial + nama) baru muncul kalau tenant belum
  upload logo. Fix eksplisit user (2026-07-16, evaluasi desain) — sebelumnya logo dan teks selalu
  tampil bersamaan.
- Nav menu: kapsul (`bg-muted/60 rounded-full p-1`, tiap item `rounded-full`) — desktop only.
- Ikon bulat berbingkai (search, cart) — search membuka **overlay dialog terpusat** (bukan input
  inline seperti FlexHeader), reuse endpoint `/api/search` yang sama, debounce 300ms identik.
- Mobile: **overlay full-screen** (bukan bottom-nav seperti FlexHeader, bukan drawer seperti
  Classic) — nav item `text-[17px] font-normal` (bukan besar/bold — dikoreksi 2026-07-16 dari
  `text-2xl font-bold` awal yang dianggap terlalu berat), dibingkai `border-t` di atas list +
  `border-b` per item, `py-4` proporsional. Tombol Masuk/Daftar atau Akun Saya di bawah list.
- `CartButton` diberi prop `className="flex"` untuk override default `hidden md:flex` — desain ini
  sengaja menampilkan cart di semua ukuran layar (beda dari 2 desain lain). Prop `className`
  ditambahkan ke `CartButton` sebagai perubahan additive (default tetap `hidden md:flex` kalau
  tidak di-pass, jadi FlexHeader/ClassicHeader tidak terpengaruh).
- Warna sepenuhnya lewat `bg-primary`/`text-primary-foreground` (CSS variable tema tenant) — tidak
  ada hex hardcoded dari desain sumber. Font mengikuti `--font-heading`/`--font-body` tenant seperti
  header lain, tidak memaksa font "Archivo" dari sumber.

---

## Desain Footer

Footer adalah server component — tidak butuh session.

| Design ID | Label | Status |
|-----------|-------|--------|
| `dark` | Gelap (default) | ✅ Selesai — lihat § "Status Implementasi" |
| `light` | Terang | ✅ Selesai — struktur identik dark, hanya warna berbeda |
| `modern` | Modern (Melengkung) | ✅ Selesai (2026-07-16) — lihat § "Desain 3: Modern Footer (Melengkung)" |
| `forcreator` | Forcreator | 📝 Terencana (2026-07-29) — lihat § "Desain 4: Forcreator Footer" |

---

### Props Universal Footer

```typescript
export type FooterProps = {
  tenantSlug:       string;
  siteName:         string;
  logoUrl:          string | null;
  footerLogoUrl?:   string | null;   // Logo khusus footer di general settings (fallback ke logoUrl)
  tagline:          string | null;   // slogan + dipakai sebagai deskripsi pendek di footer
  description?:     string | null;
  navMenu:          NavItem[];
  contactSettings:  ContactSettings;
  primaryColor:     string;
  secondaryColor?:  string;          // Warna secondary untuk aksen Top Bar Marquee & label
  memberInstagrams?: string[];        // Array username Instagram anggota tenant untuk marquee
  baseUrl:          string;
};
```

**Catatan**: tidak ada field `description` terpisah. `tagline` sudah ada di settings general
dan di-pass dari `layout.tsx` — dipakai sebagai teks deskripsi di footer.
Jika di masa depan butuh deskripsi panjang terpisah, tambah key `site_description` ke settings general.

---

### Layout Default (Dark & Light)

Struktur HTML **identik** untuk kedua mode — hanya variabel warna yang berbeda.

```
┌─────────────────────────────────────────────────────────────────┐
│  SECTION 1 — Grid 2 kolom (gap-12)                             │
│                                                                 │
│  Kiri (~55%):                   Kanan (~45%):                  │
│  [Logo]                         STAY CONNECTED (label kecil)   │
│  NAMA TENANT (uppercase, kecil) Support Our Social Media       │
│                                 (heading bold besar)           │
│  Silaturahim, Sinergi, Berbagi  [deskripsi singkat]            │
│  (tagline — heading bold besar) [ikon sosial bulat berwarna]   │
│                                                                 │
│  [deskripsi singkat organisasi]                                 │
│  [ikon sosial bulat berwarna]                                   │
├───────────────────── border separator ──────────────────────────┤
│  SECTION 2 — Grid 2 kolom (gap-12)                             │
│                                                                 │
│  Kiri:                          Kanan:                         │
│  NAVIGATION (label kecil)       CONTACT (label kecil)          │
│  Useful Links (heading bold)    Contact Us (heading bold)       │
│                                                                 │
│  Menu 1    Menu 4               ALAMAT (sub-label kecil)       │
│  Menu 2    Menu 5               [alamat detail]                │
│  Menu 3    Menu 6               [email jika ada]               │
│                                 [telepon jika ada]             │
├─────────────── copyright bar (bg lebih gelap) ─────────────────┤
│  Copyright © {year} {siteName}. All rights reserved.           │
│                    Jalakarta v.0.0.1 developed with ❤️ by Webane │
└─────────────────────────────────────────────────────────────────┘
```

---

### Detail Tiap Elemen

#### Kolom Kiri Section 1 — Identitas Organisasi

| Elemen | Sumber Data | Catatan |
|--------|-------------|---------|
| Logo | `logoUrl` dari `settings.logo_url` | `<img class="h-14 w-auto object-contain">` |
| Nama tenant | `siteName` | Uppercase, huruf kecil (`text-xs tracking-widest uppercase`), tampil di bawah logo |
| Tagline / slogan | `tagline` | Heading bold besar (`text-2xl font-bold`), warna putih (dark) / abu gelap (light) |
| Deskripsi | `description` | Paragraf `text-sm`, warna `text-gray-400` (dark) / `text-gray-600` (light), maks 2–3 kalimat |
| Ikon sosial | `contactSettings.socials` | Bulat berwarna (brand color per platform), bukan emoji — lihat tabel ikon |

#### Kolom Kanan Section 1 — Social Media CTA

| Elemen | Konten | Catatan |
|--------|--------|---------|
| Label atas | "STAY CONNECTED" | `text-xs tracking-widest uppercase`, warna `text-gray-400` |
| Heading | "Support Our Social Media" | `text-2xl font-bold`, warna putih (dark) / gelap (light) |
| Deskripsi | "Ikuti kanal sosial kami untuk update berita, video, dan distribusi konten terbaru." | Teks statis / bisa dikonfigurasi |
| Ikon sosial | Sama dengan kiri | Bulat berwarna, ukuran lebih besar (`w-10 h-10`) |

#### Ikon Sosial — Brand Color Circles

**Lucide-react TIDAK menyertakan brand icons** (Facebook, Instagram, dll tidak ada).
Gunakan **SVG inline** per platform, bukan lucide.

| Platform | Background | SVG Path |
|----------|-----------|----------|
| facebook | `#1877F2` | path huruf "f" |
| youtube | `#FF0000` | path segitiga play |
| instagram | `#E1306C` | path kamera |
| tiktok | `#010101` | path "T" kustom |
| twitter/x | `#1DA1F2` | path burung / "X" |
| telegram | `#26A5E4` | path pesawat |
| whatsapp | `#25D366` | path gelembung WA |
| linkedin | `#0A66C2` | path "in" |

```tsx
// Pattern ikon sosial — SVG inline dalam lingkaran brand color:
<a
  href={url}
  target="_blank"
  rel="noopener noreferrer"
  className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
  style={{ backgroundColor: SOCIAL_BRAND_COLORS[platform] ?? "#6b7280" }}
>
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    {SOCIAL_SVG_PATHS[platform]}
  </svg>
</a>
```

#### Kolom Kiri Section 2 — Navigation

- Label: "NAVIGATION" (`text-xs tracking-widest uppercase text-gray-400`)
- Heading: "Useful Links" (`text-xl font-bold`)
- Menu: CSS grid 2 kolom (`grid grid-cols-2 gap-x-8 gap-y-2`)
- Jika menu ≤ 3 item → 1 kolom saja
- Setiap link: `text-sm`, warna `text-gray-400 hover:text-white` (dark) / `text-gray-600 hover:text-gray-900` (light)

#### Kolom Kanan Section 2 — Contact

- Label: "CONTACT" (`text-xs tracking-widest uppercase text-gray-400`)
- Heading: "Contact Us" (`text-xl font-bold`)
- Sub-label "ALAMAT": `text-xs tracking-widest uppercase text-gray-500 mt-4`
- Alamat: `text-sm font-semibold` (bold, seperti di screenshot)
- Email + telepon: `text-sm text-gray-400`, dengan link `mailto:` / `tel:`

#### Copyright Bar

Bar paling bawah — bg sedikit lebih gelap dari body footer:
- Dark mode: `bg-black/20` atau `border-t border-white/10`
- Light mode: `border-t border-gray-200`

```
Kiri:  © {year} {siteName}. All rights reserved.
Kanan: Jalakarta — developed with ❤️ by Webane
```

**Nama platform**: **Jalakarta** (folder/repo tetap `jalajogja` — nama internal, tidak pernah
tampil ke user; lihat CLAUDE.md § Identitas Project).

```tsx
<span>Jalakarta &mdash; developed with ❤️ by <span className="font-semibold">Webane</span></span>
```

**Custom domain**: baris atribusi ini disembunyikan sepenuhnya di custom domain tenant
(`{baseUrl !== "" && (...)}`) — "satu domain = satu identitas", custom domain tenant tidak boleh
menampilkan identitas Jalakarta sama sekali. Baris "© {year} {siteName}." tetap tampil di kedua
mode karena itu copyright tenant sendiri. Detail: `docs/arsitektur-domain.md` § 5.1.

---

## Desain 3: Modern Footer (Melengkung)

> Ditambahkan 2026-07-16, sumber ide dari `design-refs/jalakarta-v2/` (lihat `design-refs/README.md`
> untuk alur kerja mengambil desain dari referensi eksternal), diambil bersamaan dengan header
> "Pill (Modern)" — sama-sama satu sesi ekstraksi dari desain sumber yang sama, tapi dua design ID
> independen (bisa dipakai campur dengan header manapun, tidak dipaketkan jadi satu "tema").

File: `footers/modern-footer.tsx`. Server component (sama seperti Dark/Light — tidak butuh session).
Ekstraksi data (email/phone/whatsapp/address/socials) **identik** dengan `DarkFooter`/`LightFooter`
— fungsi `normalizePhone()` sengaja tetap diduplikasi (bukan di-share) mengikuti pola yang sama
sejak desain Dark/Light dulu (masing-masing file header/footer self-contained).

```
╭──────────────────────────────────────────────╮  ← sudut atas melengkung (rounded-t-[32px])
│ [J] Nama          NAVIGASI          KONTAK    │
│ deskripsi…        · Item             alamat   │
│ (●)(●)(●) sosmed  · Item             hp·email │
├──────────────────────────────────────────────┤
│ © {year} {siteName}    Jalakarta — dev by ... │
╰──────────────────────────────────────────────╯
```

**Beda dengan Dark/Light (bukan cuma warna)**:
- **Layout 1 baris 3-kolom** (`grid md:grid-cols-3`) — Dark/Light pakai 2 section 2-baris
  (identitas+social CTA lalu nav+kontak terpisah oleh separator). Modern lebih ringkas/padat.
- **Sudut atas melengkung** (`rounded-t-[32px] overflow-hidden`) — kesan "kartu mengambang" di atas
  konten sebelumnya, bukan footer persegi penuh lebar seperti 2 desain lain.
- Logo mark kotak `rounded-lg` (konsisten dengan badge kotak di `pill-header.tsx` — dua komponen ini
  dirancang match secara visual meski technically independen, boleh dipakai terpisah).
- **Teks nama tenant di sebelah logo HANYA fallback** — sama seperti `pill-header.tsx`: `logoUrl`
  terisi → cuma logo, teks disembunyikan. Kosong → badge inisial + teks tetap tampil. Fix eksplisit
  user (2026-07-16, evaluasi desain). Baris "© {year} {siteName}" TIDAK ikut disembunyikan — itu
  bukan pasangan logo.
- Kontak diringkas jadi 1 baris (`{phone} · {email}`), bukan list `<li>` bericon seperti Dark/Light.

**Warna/font tidak disalin dari sumber** — sama seperti header Pill, `bg-primary`/
`text-primary-foreground` untuk logo mark, tidak ada hex hardcoded dari mockup asli. Background
gelap (`bg-neutral-900`) sengaja hardcoded (bukan CSS variable tema) — konsisten dengan konvensi
`DarkFooter` yang juga hardcode `bg-gray-900`, bukan penyimpangan baru.

**Atribusi Jalakarta**: pattern `{baseUrl !== "" && (...)}` yang sama persis dengan Dark/Light —
lihat § "Custom domain" di atas dan `docs/arsitektur-domain.md` § 5.1.

---

## Desain 4: Forcreator Footer (Marquee + 2-Row Split Grid)

> Ditambahkan 2026-07-29. Berdasarkan desain spesifik `forcreator` (lihat gambar referensi user).
> File: `footers/forcreator-footer.tsx`. Server component.

```
┌─────────────────────────────────────────────────────────────────┐
│  ROW 1 — Top Bar Marquee (Running Text)                         │
│  bg: [secondaryColor] (--secondary)                             │
│  @akuninstagram @akuninstagram @akuninstagram @akuninstagram    │
├─────────────────────────────────────────────────────────────────┤
│  ROW 2 — Middle Section (bg-black / bg-neutral-950)             │
│                                                                 │
│  [Row Atas — Grid 2 Kolom]                                      │
│  Kiri:                                Kanan:                    │
│  [Logo Footer]                        [Ikon Sosmed Instagram/   │
│  (dari general settings                YouTube / WA / dll]      │
│   footer_logo_url, fallback logoUrl)   items-start              │
│                                                                 │
│  [Row Bawah — Grid 2 Kolom]                                     │
│  Kiri:                                Kanan:                    │
│  [Deskripsi Singkat Tenant]           Contact                   │
│                                       Contact Us (heading bold) │
│  Navigation                           Alamat                    │
│  useful Links (heading bold)          [Alamat detail tenant]    │
│  · Menu Item 1                        [Phone: +62...]           │
│  · Menu Item 2                        [Email: tenant@...]       │
│  · Menu Item 3                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ROW 3 — Copyright Bar (bg-black, border-t border-neutral-800)  │
│  © {year} {siteName}. All rights reserved.                      │
│  Jalakarta — developed with ❤️ by Webane (bukan custom domain)  │
└─────────────────────────────────────────────────────────────────┘
```

### Rincian Elemen Desain:

1. **Row 1 — Top Bar Marquee (Running Text)**:
   - **Background**: Menggunakan warna **Secondary** tenant (`secondaryColor` / `--secondary` dari Pengaturan Tampilan Admin).
   - **Running Text Ticker**: Marquee animasi horizontal yang menampilkan username Instagram anggota tenant (`memberInstagrams`), diformat `@username @username ...`.
   - **Fallback Ticker**: Jika belum ada data Instagram anggota, menampilkan pola marquee default `@siteName` / `@forcreator`.

2. **Row 2 — Middle Section**:
   - **Background**: Hitam pekat (`bg-black` / `bg-neutral-950`) dengan teks serba putih/kontras tinggi.
   - **Row Atas (Grid 2 Kolom)**:
     - **Kolom Kiri**: Logo Footer (`footerLogoUrl`). Mengambil setting `footer_logo_url` dari grup `general`. Jika kosong, fallback ke `logoUrl`.
     - **Kolom Kanan**: Ikon Sosial Media (Instagram, YouTube, Facebook, WhatsApp, dll) dengan `flex items-center justify-start md:justify-end gap-3 items-start`.
   - **Row Bawah (Grid 2 Kolom)**:
     - **Kolom Kiri**:
       - Deskripsi singkat tenant (`description` / `tagline`).
       - Sub-section **Navigation**: Sub-label `"Navigation"` (`text-xs tracking-wider uppercase font-medium` menggunakan warna `secondaryColor`), Heading `"useful Links"` (`text-xl font-bold text-white mb-3`). List navigasi (`navMenu`) tersusun vertikal.
     - **Kolom Kanan**:
       - Sub-section **Contact Us**: Sub-label `"Contact"` (warna `secondaryColor`), Heading `"Contact Us"` (`text-xl font-bold text-white mb-3`).
       - Sub-label `"Alamat"` (warna `secondaryColor`). Alamat lengkap tenant (`contact_address`).
       - Ikon Telepon + Nomor HP/Telepon tenant.
       - Ikon Email + Email resmi tenant.

3. **Row 3 — Copyright Bar**:
   - Standard copyright bar dengan separator `border-t border-neutral-800`.
   - Atribusi Jalakarta menyatu dengan aturan custom domain (`baseUrl !== ""`).

### Database & Settings Schema Updates:
1. **Setting Key Baru di `settings` (group `general`)**:
   - `footer_logo_url` (`string | null`): URL gambar logo khusus footer.
2. **Form Pengaturan Umum Admin (`/app/[tenant]/settings/general`)**:
   - Tambahkan input/uploader **Logo Footer** (`footerLogoUrl`) di bawah input Logo Utama (`logoUrl`).
   - Action `saveGeneralSettingsAction` di `settings/actions.ts` diperluas untuk menerima `footerLogoUrl`.

---

### Variabel Warna Dark vs Light

| Elemen | Dark | Light |
|--------|------|-------|
| Background footer | `bg-gray-900` | `bg-gray-50` |
| Background copyright bar | `bg-black/30` | `bg-gray-100` |
| Heading text | `text-white` | `text-gray-900` |
| Body text | `text-gray-400` | `text-gray-600` |
| Label kecil (uppercase) | `text-gray-500` | `text-gray-400` |
| Link hover | `hover:text-white` | `hover:text-gray-900` |
| Separator border | `border-white/10` | `border-gray-200` |

---

### Status Refactor

`dark-footer.tsx` saat ini masih layout **lama** (3 kolom datar). Perlu direfactor ke layout
4-bagian (Section 1 kiri/kanan + Section 2 kiri/kanan + copyright bar) sesuai dokumentasi ini.
`light-footer.tsx` dibuat sekalian saat refactor, struktur identik dengan dark.

### Rencana Eksekusi Footer Baru

```
Step 1 — lib/footer-designs.ts        Update registry description (hapus mention description field)
Step 2 — footers/dark-footer.tsx      Refactor total ke layout 2-section baru + SVG brand icons
Step 3 — footers/light-footer.tsx     Buat baru — layout identik dark, variabel warna berbeda
Step 4 — public-footer.tsx            Tambah case "light" ke switcher
Step 5 — settings/website             Update FOOTER_DESIGNS description di registry
Step 6 — tsc --noEmit                 0 errors
```

Setiap step: jalankan `tsc --noEmit` sebelum lanjut ke step berikutnya.

---

## Search API

**Path**: `GET /api/search?slug={tenantSlug}&q={query}` — konsisten dengan pola `/api/ref/*`.
**Bukan** `/api/[tenant]/search` (dynamic segment tidak konsisten dengan existing routes).

**Scope pencarian:**
- `posts` — judul + excerpt (status `published`)
- `pages` — judul (status `published`)
- `events` — nama event (status `published`)
- `products` — nama produk (status `active`)
- `members` — nama anggota (via `tenant_memberships`)

**Response:**
```typescript
{
  posts:    { title: string; slug: string; excerpt: string | null }[];
  pages:    { title: string; slug: string }[];
  events:   { name: string; slug: string }[];
  products: { name: string; slug: string; price: number }[];
  members:  { name: string; memberNumber: string }[];
}
```

Max 5 hasil per kategori. Query minimal 2 karakter. Endpoint publik (no auth).

---

## Halaman Login & Daftar Publik (Dummy)

Route group `(public)` — tidak butuh auth:

```
app/(public)/[tenant]/
├── login/page.tsx        → form email + password
└── register/page.tsx     → form nama + email + HP + password
```

Dummy — form ada tapi belum disambungkan penuh ke Better Auth client.
Tombol "Masuk" di NavBar mengarah ke `/{slug}/login`.

---

## Dashboard: Pilih Desain Header & Footer

Lokasi: `/settings/website` — section baru di bawah nav builder.

UI: grid kartu pilih desain. Kartu aktif diberi border berwarna `primaryColor`.

```
┌──────────────────────────────────────────────────────┐
│  Header Website                                      │
│  ┌──────────────┐   ┌──────────────┐                 │
│  │   Klasik     │   │  Flex  ✓    │  ← selected     │
│  └──────────────┘   └──────────────┘                 │
│  Footer Website                                      │
│  ┌──────────────┐   ┌──────────────┐                 │
│  │  Dark  ✓    │   │   Terang     │                 │
│  └──────────────┘   └──────────────┘                 │
└──────────────────────────────────────────────────────┘
```

Preview = wireframe CSS/Tailwind (skeleton) — tidak ada PNG.
Auto-save via `saveDisplaySettingsAction()` yang di-extend untuk key `header_design` + `footer_design`.

---

## Notifikasi Lonceng — Arsitektur (Placeholder)

Lonceng di TopBar saat ini **kosong**. Saat Modul Pengumuman dibangun:
- Tabel baru: `tenant_{slug}.announcements`
- `GET /api/search?slug=` → extend atau buat `/api/notifications?slug=&userId=`
- FlexHeader fetch notif count client-side (sudah client component)
- Badge merah jika count > 0

---

## Update PublicLayout

`app/(public)/[tenant]/layout.tsx` tambahan minimal (ISR-safe):

```typescript
// Fetch paralel — tambah displaySettings:
const [generalSettings, websiteSettings, contactSettings, displaySettings] = await Promise.all([
  getSettings(tenantClient, "general"),
  getSettings(tenantClient, "website"),
  getSettings(tenantClient, "contact"),
  getSettings(tenantClient, "display"),
]);

const headerDesign = (displaySettings.header_design as string | undefined) ?? "flex";
const footerDesign = (displaySettings.footer_design as string | undefined) ?? "dark";

// TIDAK ada auth.api.getSession() di sini — session diambil client-side di FlexHeader
```

---

## Urutan Eksekusi (Revisi Final)

```
Step 1  — lib/header-designs.ts + lib/footer-designs.ts         (registry + types)
           tambah NAV_TYPE_ICONS ke lib/nav-menu.ts
Step 2  — headers/classic-header.tsx                            (pindah kode lama)
Step 3  — headers/flex-header.tsx                               (2-row, "use client", authClient.useSession)
Step 4  — footers/dark-footer.tsx                               (pindah kode lama)
Step 5  — Refactor wrapper public-header.tsx + public-footer.tsx (switcher)
Step 6  — (public)/[tenant]/layout.tsx                          (+displaySettings, +headerDesign, +footerDesign)
Step 7  — app/api/search/route.ts                               (path: ?slug=&q=)
Step 8  — /settings/website/page.tsx + extend saveDisplaySettingsAction
Step 9  — (public)/[tenant]/login/page.tsx + /register/page.tsx (dummy)
Step 10 — tsc --noEmit → 0 errors
```

> Setiap step: jalankan `tsc --noEmit` setelah selesai. Jangan lanjut ke step berikutnya
> sebelum 0 errors.

---

## Keterkaitan dengan Dokumen Lain

| Dokumen | Keterkaitan |
|---------|-------------|
| `arsitektur-website.md` Bagian 5 | Bagian 5 merujuk ke dokumen ini untuk detail header/footer |
| `arsitektur-akun.md` | `PublicUser` type bergantung pada `public.profiles` |
| CLAUDE.md § Arsitektur Website | Status implementasi diperbarui di CLAUDE.md |

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| `lib/header-designs.ts` + `lib/footer-designs.ts` | ✅ Selesai |
| `NAV_TYPE_ICONS` di `lib/nav-menu.ts` | ✅ Selesai |
| `headers/classic-header.tsx` | ✅ Selesai |
| `headers/flex-header.tsx` (2-row, client, authClient.useSession) | ✅ Selesai |
| `footers/dark-footer.tsx` (layout baru 2-section + SVG brand icons) | ✅ Selesai |
| `footers/light-footer.tsx` | ✅ Selesai |
| Refactor wrapper `public-header.tsx` + `public-footer.tsx` | ✅ Selesai |
| Update `PublicLayout` (+displaySettings, no session) | ✅ Selesai |
| `GET /api/search?slug=&q=` | ✅ Selesai |
| `/settings/website` section pilih desain + `saveDesignSettingsAction` | ✅ Selesai |
| `/(public)/[tenant]/login` + `/register` dummy | ✅ Selesai |
| Mobile bottom navigation bar | ✅ Selesai (dalam FlexHeader) |
| `headers/pill-header.tsx` (Desain 3, § "Desain 3: Pill Header") | ✅ Selesai (2026-07-16) |
| `footers/modern-footer.tsx` (Desain 3, § "Desain 3: Modern Footer") | ✅ Selesai (2026-07-16) |
| Notifikasi lonceng | ⬜ Menunggu Modul Pengumuman |

### Catatan Bug Fix & UI Decisions

- `auth-client.ts` diubah dari `better-auth/client` → `better-auth/react` agar `useSession`
  tersedia sebagai React hook. Import lama menyebabkan `useSession` menjadi nanostores Atom
  yang tidak callable — TypeScript error TS2349.
- Events table pakai kolom `title` bukan `name` (berbeda dengan `event_categories`).

### UI: Logo, Search, Border (FlexHeader)

| Elemen | Keputusan | Alasan |
|--------|-----------|--------|
| Logo | Jika `logoUrl` ada → tampil logo saja (`h-12`), **tanpa teks nama** | Nama di sebelah logo redundant dan memenuhi ruang |
| Search | `border-gray-300`, bg-white, lebar full-width | Border transparan sebelumnya tidak terlihat; full-width mengisi ruang TopBar lebih baik |
| Border TopBar/NavBar | `border-gray-200` | Lebih terang dari search (`gray-300`) agar tidak mengalahkan search bar secara visual |

### UI: Logo Dark Footer — Putih via CSS Filter

Logo di `dark-footer.tsx` menggunakan filter Tailwind `brightness-0 invert` agar logo berwarna
apapun tampil **putih** di atas background gelap.

```tsx
<img
  src={logoUrl}
  alt={siteName}
  className="h-14 w-auto object-contain brightness-0 invert"
/>
```

- `brightness-0` → paksa semua piksel jadi hitam
- `invert` → balik hitam jadi putih
- Kombinasi ini bekerja untuk logo warna apapun selama ada area transparan (PNG/SVG)
- `light-footer.tsx` **tidak** pakai filter ini — logo tetap warna asli di background terang
