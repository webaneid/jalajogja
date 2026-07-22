# Arsitektur Gallery System — jalakarta

Sistem gallery universal yang dapat dipakai di mana saja: produk, event, donasi,
block editor (post/page), dan landing page section — tanpa implementasi ulang.

**Keterkaitan dokumen:**
- `docs/arsitektur-image.md` — sistem variant gambar (square, medium, large, dst.)
- `docs/arsitektur-card-section.md` — gallery sebagai section type di landing page
- `docs/arsitektur-product.md` — gallery produk reuse komponen ini
- `docs/arsitektur-section-title-block.md` — blok header (eyebrow+judul+deskripsi) section
  "Galeri Foto" di landing page dirender via `<SectionTitleBlock>`, komponen bersama dengan
  section Keunggulan/Layanan dan Tentang Kami (update 2026-07-22)

**Jawaban: apakah efisien?** Ya — satu implementasi lightbox, swipe, keyboard navigation,
dan layout grid berlaku untuk semua modul. Menambah gallery ke modul baru = satu baris:
`<Gallery items={galleryItems} />`.

---

## Prinsip Desain

1. **`GalleryItem` adalah kontrak universal** — semua modul memetakan data ke tipe ini
2. **Display dan picker terpisah** — `Gallery` untuk tampil, `GalleryPicker` untuk admin input
3. **Server + client split** — grid di-render server, lightbox jalan di client
4. **Storage per modul, rendering terpusat** — setiap modul simpan datanya sendiri,
   tapi semua merender lewat komponen yang sama

---

## Tipe Data Universal

```typescript
// lib/gallery.ts

export type GalleryItem = {
  id:       string;                           // media.id
  url:      string;                           // URL primary (large atau square-large)
  variants?: Record<string, string> | null;  // { square, medium, large, "square-large", ... }
  alt?:     string | null;                   // dari media.alt_text
  caption?: string | null;                   // keterangan gambar (opsional)
  order:    number;                           // urutan tampil, 0-based
};

export type GalleryLayout = "grid" | "masonry" | "carousel";

// Rasio thumbnail grid — "square" default (perilaku lama, hardcode sebelum 2026-07-22).
// "landscape" baru ditambah untuk section landing Galeri Foto, tapi field-nya di GalleryConfig
// (bukan section-specific) supaya modul lain (produk/event/donasi) bisa pakai juga nanti.
export type GalleryAspectRatio = "square" | "landscape";

export type GalleryConfig = {
  layout:       GalleryLayout;
  columns:      2 | 3 | 4;       // jumlah kolom (untuk grid + masonry)
  aspectRatio?: GalleryAspectRatio;  // default "square" — lihat GalleryGrid
};

export const DEFAULT_GALLERY_CONFIG: GalleryConfig = {
  layout:  "grid",
  columns: 3,
};

// Helper: konversi dari ProductImage[] ke GalleryItem[]
export function fromProductImages(
  images: Array<{ id: string; url: string; variants?: Record<string, string> | null; alt: string; order: number }>
): GalleryItem[] {
  return images.map((img) => ({
    id:       img.id,
    url:      img.url,
    variants: img.variants,
    alt:      img.alt,
    order:    img.order,
  }));
}
```

---

## Struktur File

```
lib/
└── gallery.ts                       → GalleryItem type + GalleryConfig + helper converters

components/gallery/
├── gallery.tsx                      → wrapper SERVER component: pilih layout, pass ke sub-komponen
├── gallery-grid.tsx                 → layout grid (server component)
├── gallery-masonry.tsx              → layout masonry (server component, CSS grid auto-rows)
├── gallery-carousel.tsx             → carousel horizontal (CLIENT component — butuh scroll ref)
├── gallery-lightbox.tsx             → lightbox overlay (CLIENT component — dialog + keyboard + swipe)
└── gallery-picker.tsx               → admin INPUT: MediaPicker multiple + reorder + caption editor

components/editor/
├── gallery-block-ext.ts             → Tiptap Node extension "galleryBlock"
└── gallery-block-view.tsx           → React NodeView — preview di editor + tombol edit
```

---

## Komponen Display

### `<Gallery>` — Wrapper (Server)

```tsx
// components/gallery/gallery.tsx

type Props = {
  items:       GalleryItem[];
  config?:     GalleryConfig;
  tenantSlug:  string;
  className?:  string;
};

export function Gallery({ items, config = DEFAULT_GALLERY_CONFIG, tenantSlug, className }: Props) {
  if (items.length === 0) return null;

  switch (config.layout) {
    case "masonry":  return <GalleryMasonry  items={items} columns={config.columns} tenantSlug={tenantSlug} className={className} />;
    case "carousel": return <GalleryCarousel items={items} tenantSlug={tenantSlug} className={className} />;
    default:         return <GalleryGrid     items={items} columns={config.columns} tenantSlug={tenantSlug} className={className} />;
  }
}
```

### `<GalleryGrid>` — Grid (Server)

Layout CSS grid responsif dengan lightbox trigger per gambar.
Menerima `columns` (2/3/4). Default: 3.

```
┌────────┐ ┌────────┐ ┌────────┐
│ Gambar │ │ Gambar │ │ Gambar │
│  1     │ │  2     │ │  3     │
└────────┘ └────────┘ └────────┘
┌────────┐ ┌────────┐
│ Gambar │ │ Gambar │
│  4     │ │  5     │
└────────┘ └────────┘
```

Setiap cell: `object-cover`, rasio `aspect-square` (default) atau `aspect-[4/3]` (`aspectRatio:
"landscape"`, ditambah 2026-07-22 — lihat § "Bug Fix" di bawah). Overlay hover (icon zoom).
Klik → trigger `GalleryLightbox` via URL state (`?gallery=mediaId`).

### `<GalleryLightbox>` — Lightbox (Client)

Dialog overlay yang menampilkan gambar satu per satu dengan navigasi.

```
┌──────────────────────────────────────────────┐
│                        ✕ Tutup               │
│                                              │
│        ◀         [Gambar Besar]         ▶   │
│                                              │
│              Caption gambar jika ada         │
│              3 / 5                          │
└──────────────────────────────────────────────┘
```

Fitur:
- Keyboard: `←` `→` navigate, `Escape` tutup
- Touch: swipe kiri/kanan
- URL state: `?gallery=id` → bisa di-share / di-bookmark
- Gambar: pakai `large` variant (1200×630) atau `square-large` (800×800) — tergantung konteks

```tsx
// components/gallery/gallery-lightbox.tsx
"use client";

// Membaca ?gallery=id dari URL untuk open state
// Menggunakan next/navigation useSearchParams + useRouter
// Gambar besar: items.find(i => i.id === openId)
// Keyboard handler: addEventListener di useEffect
// Touch handler: onTouchStart + onTouchEnd dengan delta
```

### Bug Fix (2026-07-22) — Buka Lightbox Scroll ke Atas

**Gejala**: klik thumbnail untuk buka lightbox → halaman lompat scroll ke posisi paling atas.
Navigasi INTERNAL lightbox (tombol prev/next/tutup, `gallery-lightbox.tsx`) sudah benar pakai
`router.replace(..., { scroll: false })` sejak awal — bukan itu penyebabnya.

**Root cause**: titik PEMBUKA lightbox (`gallery-grid.tsx`) memakai `<a href={openHref(item.id)}>`
— anchor HTML polos, BUKAN `next/link`'s `<Link>` dan tanpa `onClick` handler. Klik anchor polos
memicu navigasi native browser (bukan client-side routing Next.js), yang tidak mengenal opsi
`scroll: false` sama sekali — browser reset scroll ke atas sesuai perilaku navigasi native standar.

**Fix**: ganti `<a>` → `<Link href={...} scroll={false}>` (import dari `next/link`) di
`gallery-grid.tsx`. `<Link>` aman dipakai langsung di Server Component (`GalleryGrid` tidak perlu
jadi Client Component) — boundary client sudah dibungkus internal oleh `next/link`.

**Sekalian ditutup**: `param` lightbox di `GallerySection` (landing page) sebelumnya literal
tetap `"gallery"` — kalau admin taruh >1 section Galeri Foto di satu landing page, keduanya
berbagi query key yang sama (celah laten, belum pernah jadi bug nyata karena baru satu section
Gallery yang eksis di kebanyakan halaman). Diperbaiki: `param={`gallery-${section.id}`}` —
diturunkan dari ID section (unik per section), bukan literal tetap.

### `<GalleryCarousel>` — Carousel (Client)

Scroll horizontal — pola identik dengan `PostsDesign5`.
Pakai `square` (400×400) atau `square-large` (800×800) tergantung `aspectRatio`.

### `<GalleryMasonry>` — Masonry (Server)

CSS `grid-template-rows: masonry` (atau polyfill dengan `auto`).
Tampilkan gambar dengan rasio asli masing-masing (`aspect-auto`).

---

## Komponen Admin

### `<GalleryPicker>` — Input Admin

Komponen untuk admin memilih dan mengatur urutan gambar gallery.
Reuse pattern dari `ProductImages` di `product-form.tsx` — digeneralisasi.

```tsx
// components/gallery/gallery-picker.tsx
"use client";

type Props = {
  slug:     string;
  items:    GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
  module?:  string;   // "shop" | "website" | "event" | "general" — default "website"
  max?:     number;   // batas jumlah gambar (opsional)
};

export function GalleryPicker({ slug, items, onChange, module = "website", max }: Props)
```

Fitur:
- MediaPicker (multiple mode) untuk pilih banyak gambar sekaligus
- Grid thumbnail (3 kolom, `aspect-square`, `square` variant)
- Tombol naik/turun untuk reorder (swap adjacent)
- Tombol hapus per item
- Input caption inline per item (opsional, collapsible)
- Prevent duplicate via `items.some(i => i.id === media.id)`

**`ProductImages` di `product-form.tsx` akan direfactor menggunakan `GalleryPicker`**
setelah komponen ini selesai. Tidak ada perubahan fungsional, hanya code reuse.

---

## Tiptap Integration — GalleryBlock

Block gallery baru di editor post/page — di-insert via toolbar.

### Extension

```typescript
// components/editor/gallery-block-ext.ts

import { Node } from "@tiptap/core";
import type { GalleryItem, GalleryConfig } from "@/lib/gallery";

export const GalleryBlock = Node.create({
  name: "galleryBlock",
  group: "block",
  atom: true,   // leaf node — tidak bisa dimasuki kursor

  addAttributes() {
    return {
      items:  { default: [] },   // GalleryItem[]
      layout: { default: "grid" },
      columns:{ default: 3 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-gallery-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    // Render sebagai div dengan data attribute — konten di-handle NodeView
    return ["div", { "data-gallery-block": "", ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GalleryBlockView);
  },
});
```

### NodeView

```tsx
// components/editor/gallery-block-view.tsx

// Preview grid di dalam editor (editable=true)
// Tombol "Edit Gallery" → buka panel pilih gambar (GalleryPicker)
// Tampil: grid 3×3 thumbnail kecil, counter "X gambar", badge layout

┌─────────────────────────────────────────────────┐
│  📷 Gallery Block (5 gambar · Grid 3 kolom)     │
│  ┌──┐ ┌──┐ ┌──┐                                │
│  │  │ │  │ │  │  [+ Edit Gallery]  [✕ Hapus]   │
│  └──┘ └──┘ └──┘                                │
└─────────────────────────────────────────────────┘
```

### Server Render (letter-render.ts / front-end)

Saat Tiptap JSON di-render server-side:
- `renderNode` di `lib/letter-render.ts`: tambah case `galleryBlock` → render grid gambar sederhana (tanpa lightbox) untuk PDF
- Front-end public: render `<Gallery items={node.attrs.items} config={node.attrs} />`

---

## Storage per Modul

### Produk — Existing JSONB

```typescript
// products.images JSONB — sudah ada
// Type: GalleryItem[] (sama persis, backward compatible)
// Tidak ada perubahan schema
```

### Event — Tambah Kolom `gallery`

```sql
-- Tambah ke events table
ALTER TABLE "tenant_{slug}".events
  ADD COLUMN IF NOT EXISTS gallery JSONB;  -- GalleryItem[]
```

```typescript
// Drizzle schema update: events.ts
gallery: jsonb("gallery").$type<GalleryItem[]>(),
```

### Campaign (Donasi) — Tambah Kolom `gallery`

```sql
ALTER TABLE "tenant_{slug}".campaigns
  ADD COLUMN IF NOT EXISTS gallery JSONB;  -- GalleryItem[]
```

### Post/Page (Block Editor)

Disimpan inline di Tiptap JSON sebagai `galleryBlock` node.
Tidak ada perubahan schema — sudah masuk ke `posts.body` / `pages.body`.

### Landing Page Section

Tambah `type = "gallery"` ke `SectionType` di `lib/page-templates.ts`.
Data: `{ items: GalleryItem[], layout: GalleryLayout, columns: 2|3|4 }`
Render via `<Gallery>` di `landing-template.tsx`.

---

## Pemetaan Variant per Konteks

| Konteks | Thumbnail (grid/masonry) | Full (lightbox) |
|---------|--------------------------|-----------------|
| Produk | `square` (400×400) | `square-large` (800×800) |
| Event | `medium` (800×420) | `large` (1200×630) |
| Donasi | `medium` | `large` |
| Editor block preview | `thumbnail` (400×210) | `large` |
| Landing section | `medium` | `large` |

Helper di `lib/gallery.ts`:
```typescript
export function getGalleryThumb(item: GalleryItem, module: string): string {
  if (module === "shop") return item.variants?.square ?? item.url;
  return item.variants?.medium ?? item.variants?.large ?? item.url;
}

export function getGalleryFull(item: GalleryItem, module: string): string {
  if (module === "shop") return item.variants?.["square-large"] ?? item.url;
  return item.variants?.large ?? item.url;
}
```

---

## Integrasi Modul

### Cara Menambah Gallery ke Modul Baru

1. Tambah kolom `gallery JSONB` ke tabel modul (jika belum punya)
2. Tambah `<GalleryPicker>` ke form admin modul
3. Tambah `<Gallery>` ke halaman detail publik modul
4. Tidak ada perubahan di Gallery component itu sendiri

### Produk (Setelah GalleryPicker Selesai)

Refactor `ProductImages` di `product-form.tsx` → ganti dengan `<GalleryPicker module="shop" />`.
Type `ProductImage` → digantikan `GalleryItem` (backward compatible — field sama).

---

## Urutan Implementasi

```
Phase 1 — Core (minimal viable)
  Step 1: lib/gallery.ts — GalleryItem type + helpers
  Step 2: gallery-grid.tsx — server component, CSS grid, aspect-square
  Step 3: gallery-lightbox.tsx — client component, URL state, keyboard + touch
  Step 4: gallery.tsx — wrapper switch(layout)
  Step 5: gallery-picker.tsx — admin input (refactor dari ProductImages)

Phase 2 — Editor Block
  Step 6: gallery-block-ext.ts — Tiptap Node extension
  Step 7: gallery-block-view.tsx — React NodeView
  Step 8: Tambah ke tiptap-editor.tsx (toolbar + extension list)
  Step 9: Update letter-render.ts — case galleryBlock → plain HTML grid

Phase 3 — Modul Lain
  Step 10: Event — tambah gallery JSONB + GalleryPicker di form
  Step 11: Campaign — tambah gallery JSONB + GalleryPicker di form
  Step 12: Landing page section type "gallery"

Phase 4 — Layout Tambahan
  Step 13: gallery-masonry.tsx
  Step 14: gallery-carousel.tsx (reuse PostsDesign5 scroll pattern)
```

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| `lib/gallery.ts` — type + helpers | ✅ Selesai |
| `gallery-grid.tsx` — grid display | ✅ Selesai |
| `gallery-lightbox.tsx` — lightbox | ✅ Selesai |
| `gallery.tsx` — wrapper | ✅ Selesai |
| `gallery-picker.tsx` — admin input | ✅ Selesai |
| `gallery-block-ext.ts` — Tiptap | ✅ Selesai |
| `gallery-block-view.tsx` — NodeView | ✅ Selesai |
| Integrasi ke `tiptap-editor.tsx` | ✅ Selesai |
| `letter-render.ts` case galleryBlock | ✅ Selesai |
| Event: kolom `gallery` JSONB (Drizzle schema + DDL) | ✅ Selesai |
| Campaign: kolom `gallery` JSONB (Drizzle schema + DDL) | ✅ Selesai |
| Landing page section `"gallery"` pakai `<Gallery>` | ✅ Selesai |
| `gallery-masonry.tsx` | ⬜ Phase 4 |
| `gallery-carousel.tsx` | ⬜ Phase 4 |
| `GalleryConfig.aspectRatio` (square/landscape) | ✅ Selesai (2026-07-22) |
| Bug fix scroll-to-top saat buka lightbox | ✅ Selesai (2026-07-22) |
| Section landing Galeri Foto — title block + background standar | ✅ Selesai (2026-07-22) |
| Bug fix `aspectRatio` tidak pernah sampai ke `<GalleryGrid>` | ✅ Selesai (2026-07-22) |
| Tombol "Sisipkan Galeri Foto" di toolbar editor Post | ✅ Selesai (2026-07-22) |
| Post detail — render galeri via `<Gallery>` asli (lightbox), bukan grid statis `renderBody()` | ✅ Selesai (2026-07-22) |

**Catatan 2026-07-22 (Gallery di dalam Post — lengkapi "Step 8" yang setengah jadi):**
Node/schema/NodeView (`gallery-block-ext.ts`+`gallery-block-view.tsx`) dan ekstensi Tiptap sudah
lama terdaftar di `tiptap-editor.tsx` (dipakai juga oleh editor Post) — TAPI tidak pernah ada
entry point UI untuk memakainya (nol tombol toolbar, nol slash-command), jadi fitur ini sebenarnya
tidak pernah bisa dipakai admin sejak dibuat. User eksplisit minta scope SEMPIT: "cuma butuh
gallery di post, jangan meluas kemana-mana" — jawabannya TIDAK perlu tipe/format post baru sama
sekali (beda dari `pages.template`), editor tetap sama persis.

Dua bagian yang dikerjakan:
1. **Tombol toolbar** (`editor-toolbar.tsx`) — `handleInsertGallery()` manggil
   `editor.chain().focus().insertGallery({items:[], layout:"grid", columns:3}).run()`, pola
   identik tombol "Sisipkan Tabel" yang sudah ada. Sisipkan block KOSONG, admin lanjut isi lewat
   UI "Edit Gallery" yang SUDAH ADA di NodeView (tidak disentuh sama sekali) — picker gambar,
   preview thumbnail, dst, semua reuse murni.
2. **Render publik dengan lightbox** (`lib/post-body-segments.ts`, baru) — `renderBody()`'s
   `case "galleryBlock"` cuma grid `<table>` statis TANPA lightbox (server-safe pure string,
   di-share dengan render PDF surat — sengaja tidak diubah, resikonya lebih besar dari manfaatnya
   kalau disentuh). Solusinya: pecah body post JADI SEGMEN di level `post/[slug]/page.tsx` —
   node non-galeri dikumpulkan lalu tetap lewat `renderBody()` seperti biasa; node `galleryBlock`
   dirender via komponen React `<Gallery>` ASLI (dengan lightbox popup) yang di-selingi di antara
   segmen HTML. `splitPostBodySegments()` memanggil `renderBody()` sebagai black box per potongan
   (`JSON.stringify({type:"doc", content: buffer})`) — TIDAK mengekspor/mengubah apa pun dari
   `letter-render.ts`.

**Kolom SELALU dipaksa 3** (otomatis 2 di mobile via `GalleryGrid`'s `grid-cols-2 sm:grid-cols-3`
yang sudah ada) — sesuai permintaan eksplisit "otomatis 3 kolom, mobile 2 kolom, gitu aja". Dipaksa
di DUA titik: default insersi tombol toolbar (`columns:3`) DAN saat render publik
(`splitPostBodySegments` selalu construct gallery segment dengan `config={{layout:"grid",
columns:3}}` di caller, mengabaikan `layout`/`columns` apa pun yang tersimpan di node — walau
NodeView editornya sendiri masih punya UI untuk mengubah itu, TIDAK dihapus, cuma hasilnya tidak
pernah dipakai di publik — trade-off kecil yang diterima demi tidak menyentuh file NodeView sama
sekali, sesuai instruksi scope sempit).

**Catatan 2026-07-22 (bug fix `aspectRatio` tidak berpengaruh sama sekali):**
User laporkan pilih "Landscape" di editor tidak mengubah apa pun di front-end — foto tetap kotak.
Root cause: `<Gallery>` (wrapper, `components/gallery/gallery.tsx`) melakukan
`const { layout, columns } = { ...DEFAULT_GALLERY_CONFIG, ...config };` — HANYA menarik
`layout`+`columns` dari config gabungan, `aspectRatio` DIAM-DIAM TIDAK PERNAH ikut di-destructure
maupun diteruskan ke `<GalleryGrid>`. `GalleryGrid`'s default parameter `aspectRatio = "square"`
selalu jadi yang dipakai, terlepas apa pun yang admin pilih di editor — `GalleryGrid` sendiri
(logic `ASPECT[aspectRatio]`) dan `GallerySection` (landing-template.tsx, sudah benar kirim
`config={{..., aspectRatio: d.imageRatio ?? "square"}}`) SAMA-SAMA benar sejak awal; bug murni di
satu baris wrapper yang lupa meneruskan satu field. Fix: tambah `aspectRatio` ke destructuring +
prop `<GalleryGrid aspectRatio={aspectRatio} .../>`. Dicek: `<Gallery>` cuma punya SATU caller
nyata di seluruh app (`GallerySection`), jadi fix ini tidak berisiko memengaruhi konsumen lain.

**Catatan 2026-07-22 (title block + background section landing):**
`GallerySection` (landing page) dapat title block 3-field opsional (eyebrow/title/headerDesc,
pola sama section Keunggulan/Layanan dan Tentang Kami) dan background standar 5-opsi
(`lib/section-background.ts`, dikunci sejak section Tentang Kami). Editor (`GalleryEditor`)
dapat picker Kolom (3/4) dan Rasio Gambar (square/landscape) — sebelumnya field `layout`/`columns`
DIBACA oleh `GallerySection` tapi TIDAK PERNAH ada UI untuk mengaturnya di editor (gap
pre-existing, ditutup sekalian). Lihat `docs/arsitektur-frontend-publik.md` § 4 untuk pointer
singkat, dan lesson CLAUDE.md `[2026-07-22]` untuk detail lengkap keputusan.

**Catatan Phase 3:**
- GalleryItem type dipindah ke `packages/db/src/schema/tenant/website.ts` agar bisa dipakai DB schema
- `lib/gallery.ts` di web app re-export type yang kompatibel
- Form admin Event + Campaign (GalleryPicker di form) belum diimplementasi — menunggu refactor form tersebut
- Tenant existing perlu: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS gallery JSONB`
