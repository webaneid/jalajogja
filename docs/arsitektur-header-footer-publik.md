# Arsitektur Header & Footer Publik — jalajogja

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

### Mobile — Bottom Navigation Bar

Header mobile tidak menampilkan NavBar. Sebagai gantinya: **fixed bottom navigation bar**.

```
┌────────────────────────────────────┐
│  [Logo]   [🔍]              [👤]   │  ← TopBar compact
└────────────────────────────────────┘

...konten halaman...

┌────────────────────────────────────┐
│  🏠       📰       🛒      ☰      │  ← Bottom nav fixed
│ Home    Berita    Toko    Lainnya  │
└────────────────────────────────────┘
```

- Maks 3 item pertama dari `nav_menu` + slot "Lainnya" (icon Menu)
- Tombol "Lainnya" → drawer slide-up berisi sisa menu
- Breakpoint: bottom nav aktif di `< md` (< 768px), NavBar aktif di `>= md`
- Icons pakai **lucide-react** (bukan emoji) via mapping `NAV_TYPE_ICONS` di `lib/nav-menu.ts`

---

## Icons per NavItemType

Mapping di `lib/nav-menu.ts` (lucide-react):

```typescript
import { FileText, Newspaper, Calendar, ShoppingBag, Heart, Link2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const NAV_TYPE_ICONS: Record<NavItemType, LucideIcon> = {
  page:   FileText,
  blog:   Newspaper,
  event:  Calendar,
  toko:   ShoppingBag,
  donasi: Heart,
  custom: Link2,
};
```

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

## Desain Footer

Footer adalah server component — tidak butuh session.

| Design ID | Label | Status |
|-----------|-------|--------|
| `dark` | Gelap (default) | ⚠️ Ada — layout LAMA (3 kolom datar), perlu refactor ke layout baru |
| `light` | Terang | ⬜ Belum dieksekusi — layout identik dark, hanya warna berbeda |

---

### Props Universal Footer

```typescript
export type FooterProps = {
  tenantSlug:      string;
  siteName:        string;
  logoUrl:         string | null;
  tagline:         string | null;   // slogan + dipakai sebagai deskripsi pendek di footer
  navMenu:         NavItem[];
  contactSettings: ContactSettings;
  primaryColor:    string;
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

**Nama platform**: **Jalakarta** (bukan jalajogja — sedang dalam proses rebranding).

```tsx
<span>Jalakarta &mdash; developed with ❤️ by <span className="font-semibold">Webane</span></span>
```

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
