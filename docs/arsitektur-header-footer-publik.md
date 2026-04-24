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
| Logo | Jika `logoUrl` ada → `<img>`, tanpa `siteName`. Jika tidak ada → inisial bulat berwarna `primaryColor` + `siteName` |
| Search | Input debounce 300ms → `GET /api/search?slug=&q=` → dropdown hasil |
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
- Separator tipis (`border-b`) antara TopBar dan NavBar

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

Footer tetap server component — tidak butuh session.

| Design ID | Label | Status |
|-----------|-------|--------|
| `dark` | Dark (default) | ✅ Sudah ada, dipindah ke `dark-footer.tsx` |
| `light` | Terang | ⬜ Perencanaan, belum dieksekusi |

Props universal footer:
```typescript
export type FooterProps = {
  tenantSlug:      string;
  siteName:        string;
  logoUrl:         string | null;
  tagline:         string | null;
  navMenu:         NavItem[];
  contactSettings: ContactSettings;
  primaryColor:    string;
};
```

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
| `footers/dark-footer.tsx` | ✅ Selesai |
| `footers/light-footer.tsx` | ⬜ Perencanaan |
| Refactor wrapper `public-header.tsx` + `public-footer.tsx` | ✅ Selesai |
| Update `PublicLayout` (+displaySettings, no session) | ✅ Selesai |
| `GET /api/search?slug=&q=` | ✅ Selesai |
| `/settings/website` section pilih desain + `saveDesignSettingsAction` | ✅ Selesai |
| `/(public)/[tenant]/login` + `/register` dummy | ✅ Selesai |
| Mobile bottom navigation bar | ✅ Selesai (dalam FlexHeader) |
| Notifikasi lonceng | ⬜ Menunggu Modul Pengumuman |

### Catatan Bug Fix

- `auth-client.ts` diubah dari `better-auth/client` → `better-auth/react` agar `useSession`
  tersedia sebagai React hook. Import lama menyebabkan `useSession` menjadi nanostores Atom
  yang tidak callable — TypeScript error TS2349.
- Events table pakai kolom `title` bukan `name` (berbeda dengan `event_categories`).
