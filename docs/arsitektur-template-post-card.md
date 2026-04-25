# Arsitektur Template Card Post — jalajogja

Dokumen ini mendefinisikan sistem **Template Card Post** — komponen card reusable untuk
menampilkan post/artikel di mana saja: blog archive, landing page section, search results,
related posts, dan semua tampilan lain yang membutuhkan list post.

Konsep analog WordPress: `get_template_part('content', 'klasik')` → di jalajogja ini menjadi
`<PostCard post={post} variant="klasik" tenantSlug={slug} />`.

---

## Masalah yang Diselesaikan

Sebelum sistem ini, setiap halaman/section yang menampilkan post punya card-nya sendiri:

```
landing-template.tsx  → PostsSection → card inline (tanpa cover, tanpa kategori)
blog/page.tsx         → card inline lain (dengan cover, dengan kategori)
```

Duplikasi markup, inkonsistensi data yang difetch, tidak bisa dipakai ulang.
Dengan sistem ini: **satu komponen, banyak tempat**.

---

## Naming Convention

| Term | Makna |
|------|-------|
| **Template Card Post** | Nama fitur/sistem ini |
| `PostCard` | Nama komponen wrapper utama |
| `PostCardVariant` | Type untuk pilihan desain: `"klasik" \| "list" \| "overlay"` |
| `PostCardData` | Type data minimal yang dibutuhkan semua variant |

---

## PostCardData — Unified Data Type

Semua variant card menerima type yang sama. Ini **kontrak data** antara halaman yang
fetch dari DB dan komponen yang render:

```typescript
// lib/post-card-templates.ts
export type PostCardData = {
  id:           string;
  title:        string;
  slug:         string;          // untuk URL: /{tenantSlug}/blog/{slug}
  excerpt:      string | null;
  coverUrl:     string | null;   // URL lengkap dari MinIO (sudah di-resolve dari coverId)
  categoryName: string | null;   // nama kategori (nullable — post tanpa kategori)
  publishedAt:  Date | null;
  isFeatured:   boolean;         // dari kolom is_featured di tabel posts — untuk styling/badge di design section
};
```

**Catatan**: `coverUrl` sudah berupa URL string — bukan `coverId`. Resolusi ID → URL dilakukan
di layer data fetching (page/section), bukan di dalam komponen card. Komponen card tidak perlu
tahu tentang DB.

---

## Registry

```typescript
// lib/post-card-templates.ts
export const POST_CARD_VARIANTS = ["klasik", "list", "overlay", "ringkas", "judul", "ticker"] as const;
export type PostCardVariant = typeof POST_CARD_VARIANTS[number];

export const POST_CARD_VARIANT_LABELS: Record<PostCardVariant, string> = {
  klasik:  "Klasik",
  list:    "List",
  overlay: "Overlay",
  ringkas: "Ringkas",
  judul:   "Judul",
  ticker:  "Ticker",
};

export const POST_CARD_VARIANT_DESCRIPTIONS: Record<PostCardVariant, string> = {
  klasik:  "Gambar di atas, judul dan ringkasan di bawah. Cocok untuk grid.",
  list:    "Horizontal: teks kiri, gambar kanan. Cocok untuk arsip panjang.",
  overlay: "Gambar penuh dengan teks overlay di bawah. Cocok untuk hero/featured.",
  ringkas: "Gambar di atas, judul dan tanggal saja. Tanpa ringkasan. Cocok untuk grid padat.",
  judul:   "Teks saja, tanpa gambar. Kategori + judul + tanggal. Cocok untuk sidebar atau daftar minimal.",
  ticker:  "Judul sebagai link saja. Untuk digunakan di section running text / marquee berita.",
};
```

---

## Struktur File

```
lib/
└── post-card-templates.ts           → PostCardVariant + PostCardData types + registry labels

components/website/public/post-cards/
├── post-card.tsx                    → wrapper: terima variant → render komponen yang sesuai
├── post-card-klasik.tsx             → variant klasik
├── post-card-list.tsx               → variant list (horizontal)
├── post-card-overlay.tsx            → variant overlay (gambar bg)
├── post-card-ringkas.tsx            → variant ringkas (gambar + judul, tanpa excerpt)
├── post-card-judul.tsx              → variant judul (teks saja, tanpa gambar)
└── post-card-ticker.tsx             → variant ticker (judul link minimal)
```

---

## Komponen Wrapper

```typescript
// components/website/public/post-cards/post-card.tsx
import type { PostCardData, PostCardVariant } from "@/lib/post-card-templates";
import { PostCardKlasik }  from "./post-card-klasik";
import { PostCardList }    from "./post-card-list";
import { PostCardOverlay } from "./post-card-overlay";
import { PostCardRingkas } from "./post-card-ringkas";
import { PostCardJudul }   from "./post-card-judul";
import { PostCardTicker }  from "./post-card-ticker";

type Props = {
  post:       PostCardData;
  variant:    PostCardVariant;
  tenantSlug: string;
};

export function PostCard({ post, variant, tenantSlug }: Props) {
  switch (variant) {
    case "list":    return <PostCardList    post={post} tenantSlug={tenantSlug} />;
    case "overlay": return <PostCardOverlay post={post} tenantSlug={tenantSlug} />;
    case "ringkas": return <PostCardRingkas post={post} tenantSlug={tenantSlug} />;
    case "judul":   return <PostCardJudul   post={post} tenantSlug={tenantSlug} />;
    case "ticker":  return <PostCardTicker  post={post} tenantSlug={tenantSlug} />;
    default:        return <PostCardKlasik  post={post} tenantSlug={tenantSlug} />;
  }
}
```

Menambah variant baru = buat satu file + satu case. Tidak ada perubahan di halaman yang menggunakannya.

---

## Enam Variant

### Variant 1: Klasik

Analog: `content-klasik.php` dari WordPress.

```
┌────────────────────────────┐
│ [Featured Image 16:9]      │  ← aspect-video, object-cover
│                            │
├────────────────────────────┤
│ [Kategori] · [Tanggal]     │  ← badge + meta
│ Judul Post Yang Panjang    │  ← line-clamp-2, font-semibold
│ Kutipan singkat post ini   │  ← line-clamp-3, text-sm muted
└────────────────────────────┘
```

- Dipakai untuk: grid blog archive, section Posts landing page (default)
- Tanpa cover → placeholder abu-abu dengan icon artikel
- Hover: border highlight + shadow ringan

### Variant 2: List

Analog: `content-list.php` dari WordPress.

```
┌────────────────────────────────────────────┐
│                              │ [Gambar]     │
│ [Kategori] · [Tanggal]       │ [Square      │
│ Judul Post Yang Cukup Panjang│  120x120]    │
│ Kutipan singkat...           │              │
└────────────────────────────────────────────┘
```

- Layout: flex row, teks kiri (flex-1), gambar kanan (120px × 120px, rounded)
- Tanpa cover → gambar tidak tampil, teks full width
- Dipakai untuk: arsip berita padat, search results, widget recent posts

### Variant 3: Overlay

Analog: `content-overlay.php` dari WordPress.

```
┌────────────────────────────┐
│                            │
│   [Featured Image]         │  ← full height, object-cover
│   sebagai background       │
│                            │
│████████████████████████████│  ← gradient overlay hitam bawah
│ [Kategori]                 │
│ Judul Post                 │  ← teks putih di atas gambar
│ [Tanggal]                  │
└────────────────────────────┘
```

- Tanpa cover → fallback ke background warna `primaryColor`
- Hover: scale gambar ringan
- Dipakai untuk: featured post, hero section, post highlight

---

### Variant 4: Ringkas

Analog: `content.php` dari WordPress.

```
┌────────────────────────────┐
│ [Featured Image 16:9]      │  ← aspect-video, object-cover
│                            │
├────────────────────────────┤
│ [Kategori] · [Tanggal]     │  ← badge + meta
│ Judul Post Yang Panjang    │  ← line-clamp-2, font-semibold
└────────────────────────────┘
```

- Seperti "klasik" tapi **tanpa excerpt** — lebih padat, cocok untuk grid dengan banyak item
- Karena tidak ada excerpt, judul mendapat lebih banyak ruang (`line-clamp-3` opsional)
- Tanpa cover → placeholder abu-abu
- Dipakai untuk: grid berita singkat, section "artikel terbaru" yang padat

---

### Variant 5: Judul

Analog: `content-list-title.php` dari WordPress.

```
┌──────────────────────────────────────────┐
│ [Kategori]  Judul Berita Yang Cukup Pjg  │
│             Tanggal, 26 April 2026       │
└──────────────────────────────────────────┘
```

- **Tanpa gambar sama sekali** — murni teks
- Layout: flex row, kategori badge kiri (shrink-0), teks judul + tanggal kanan
- Separator tipis antar item jika dirender dalam list
- Dipakai untuk: sidebar "berita terbaru", daftar padat, widget recent posts, halaman arsip teks

---

### Variant 6: Ticker

Analog: item dalam `content-top-header.php` dari WordPress.

```
[ • Judul Berita Pertama ]  [ • Judul Berita Kedua ]  [ • Judul Berita Ketiga ] ...
```

- **Paling minimal** — hanya judul sebagai `<a>` link, dengan bullet `·` di depan
- Tidak ada gambar, kategori, excerpt, maupun tanggal
- Komponen card-nya sendiri sangat sederhana: `<a href={url} className="...">· {title}</a>`
- **Behavior marquee/running text ada di SECTION yang memakainya**, bukan di card-nya
- Section yang memakai ticker menambahkan CSS `overflow-hidden` + animasi `translate-x` loop
- Dipakai untuk: running text breaking news, top bar berita terbaru, section ticker

**Catatan section ticker**: Section yang menampilkan variant `ticker` harus duplikasi list item
(render 2× list yang sama secara berurutan) agar animasi marquee seamless tanpa jeda.
Pattern ini identik dengan cara kerja `content-top-header.php`:
```html
<div class="news-items">{items}</div>
<div class="news-items">{items}</div>  ← duplikat untuk seamless loop
```

---

## Cara Penggunaan

### 1. Blog Archive (`/blog/page.tsx`)

```tsx
import { PostCard } from "@/components/website/public/post-cards/post-card";
import type { PostCardData } from "@/lib/post-card-templates";

// Data sudah di-fetch dari DB (termasuk coverUrl yang sudah di-resolve)
const cardData: PostCardData = {
  id: post.id, title: post.title, slug: post.slug,
  excerpt: post.excerpt, coverUrl: mediaMap.get(post.coverId ?? "") ?? null,
  categoryName: post.categoryName, publishedAt: post.publishedAt,
};

<PostCard post={cardData} variant="klasik" tenantSlug={slug} />
```

### 2. Landing Page Section Posts

Section data dari `SectionItem.data` menyimpan `cardVariant`:

```typescript
// Tambah ke type data section "posts" di lib/page-templates.ts
type PostsSectionData = {
  title:       string;
  count:       number;        // default 6
  cardVariant: PostCardVariant; // "klasik" | "list" | "overlay", default "klasik"
};
```

Di `landing-template.tsx`, update `PostsSection`:

```tsx
// Sebelum: card inline hardcoded
// Sesudah:
<PostCard post={cardData} variant={d.cardVariant ?? "klasik"} tenantSlug={tenantSlug} />
```

`fetchPosts()` di `landing-template.tsx` juga perlu diupdate untuk fetch `coverId` + `categoryName`
dan resolve URL, agar data sesuai `PostCardData`.

### 3. Search Results (`/api/search`)

```tsx
// Hasil search post dirender dengan variant "list" (lebih compact)
<PostCard post={searchResult} variant="list" tenantSlug={slug} />
```

### 4. Related Posts (future)

```tsx
// Di halaman detail post, di bagian bawah
<PostCard post={relatedPost} variant="klasik" tenantSlug={slug} />
```

---

## Integrasi dengan Section Editor (Dashboard)

Di `section-editors.tsx`, editor untuk section type `"posts"` perlu ditambah dropdown
pilih variant card:

```
┌────────────────────────────────────────┐
│  Edit Section: Postingan Terbaru       │
│                                        │
│  Judul section: [_________________]    │
│  Jumlah post:   [6 ▾]                  │
│  Tampilan card: [Klasik ▾]             │  ← BARU
│                   Klasik               │
│                   List                 │
│                   Overlay              │
└────────────────────────────────────────┘
```

Nilai disimpan ke `SectionItem.data.cardVariant` (JSONB di DB — tidak butuh schema change).

---

## Update yang Dibutuhkan di File Existing

| File | Perubahan |
|------|-----------|
| `lib/post-card-templates.ts` | Buat baru — types + registry |
| `components/website/public/post-cards/post-card.tsx` | Buat baru — wrapper |
| `components/website/public/post-cards/post-card-klasik.tsx` | Buat baru |
| `components/website/public/post-cards/post-card-list.tsx` | Buat baru |
| `components/website/public/post-cards/post-card-overlay.tsx` | Buat baru |
| `app/(public)/[tenant]/blog/page.tsx` | Ganti card inline → `<PostCard variant="klasik">` |
| `components/website/public/landing-template.tsx` | Update `PostsSection`: fetch data lengkap + `<PostCard>` |
| `lib/page-templates.ts` | Tambah `cardVariant` ke `PostsSectionData` type |
| `components/website/section-editors.tsx` | Tambah dropdown cardVariant di editor posts section |

---

## Aturan Penting

1. **Komponen card harus server component** — tidak ada `useState`, `useEffect`, interaksi. Hanya render HTML.
2. **URL sudah di-resolve sebelum masuk ke card** — card tidak fetch ke DB, tidak tahu tentang MinIO path.
3. **Semua field nullable ditangani** — card tidak crash jika `coverUrl`, `excerpt`, atau `categoryName` null.
4. **Hover state via pure CSS/Tailwind** — tidak perlu JavaScript untuk efek hover.
5. **Menambah variant baru** = satu file baru + satu baris di registry + satu case di wrapper. Tidak ada perubahan di halaman yang sudah ada.

---

## Keterkaitan dengan Dokumen Lain

| Dokumen | Keterkaitan |
|---------|-------------|
| `arsitektur-website.md` Bagian 3 | Section `posts` di landing builder menggunakan sistem ini untuk `cardVariant` |
| `CLAUDE.md` § Arsitektur Website | Status implementasi template card post diperbarui di sini |
| `arsitektur-header-footer-publik.md` | Pola registry yang sama dipakai untuk header/footer design |

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| `lib/post-card-templates.ts` | ✅ Selesai |
| `post-cards/post-card.tsx` (wrapper) | ✅ Selesai |
| `post-cards/post-card-klasik.tsx` | ✅ Selesai |
| `post-cards/post-card-list.tsx` | ✅ Selesai |
| `post-cards/post-card-overlay.tsx` | ✅ Selesai |
| `post-cards/post-card-ringkas.tsx` | ✅ Selesai |
| `post-cards/post-card-judul.tsx` | ✅ Selesai |
| `post-cards/post-card-ticker.tsx` | ✅ Selesai |
| Update `blog/page.tsx` → pakai PostCard | ⬜ Belum |
| Update `landing-template.tsx` → pakai PostCard + fetch coverUrl + categoryName | ✅ Selesai |
| Update `section-editors.tsx` → design picker di editor section posts | ✅ Selesai |

---

## Detail Visual per Variant (Implementasi Final)

### Klasik
- Tanpa border/shadow — clean card
- Gambar: `aspect-video`, `rounded-lg` (border radius kecil semua sisi)
- Text area: `pt-2` saja — tanpa padding horizontal, rapat ke tepi gambar
- Meta (kategori + tanggal): satu baris di atas judul
- Hover: `group-hover:text-primary` pada judul, `group-hover:scale-105` pada gambar

### List (Horizontal)
- Tanpa border/shadow, tanpa padding container
- Separator: `border-t border-border first:border-0` — border atas antar item, item pertama tanpa border
- Padding: `py-3` vertikal saja, hover: `bg-muted/40` dengan `px-2 -mx-2 rounded-lg`
- Thumbnail: 96×96px kanan, rounded-lg

### Judul
- Murni teks, tanpa gambar
- Layout: kolom — baris 1: kategori badge + tanggal; baris 2: judul
- Separator: `border-t border-border first:border-0` — sama dengan List
- Hover: `bg-muted/40` subtle

### coverUrl — Full URL
`coverUrl` di `PostCardData` harus berupa URL lengkap MinIO, bukan path bucket.
Fetch layer wajib memanggil `publicUrl(tenantSlug, media.path)` dari `lib/minio.ts`.
Path mentah `website/2026/04/uuid.jpg` akan menyebabkan error URL di `next/image`.
