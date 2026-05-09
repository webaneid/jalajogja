# Arsitektur Card + Section System — jalajogja

Dokumen ini mendefinisikan sistem **Card + Section** yang berlaku untuk semua tipe konten
di front-end publik: Post, Produk, Event, dan Donasi/Campaign.

Prinsip: satu arsitektur, banyak tipe konten. Menambah tipe baru, card baru, atau section
design baru cukup mengikuti pola yang sudah ada — tanpa mengubah komponen lain.

---

## Prinsip Desain

1. **Dua lapisan terpisah** — Card = unit render individual. Section = fetch + layout.
2. **Satu arah** — Section memanggil Card. Card tidak tahu tentang Section.
3. **Data sudah siap di Card** — Card tidak fetch DB. Semua data datang dari Section wrapper.
4. **Section menentukan Card variant** — bukan admin, bukan config.
5. **Menambah design baru** = satu file + satu baris registry. Tidak ada perubahan lain.

---

## Hierarki Universal

```
Landing Page / Archive Page
        │
        ▼
  {Type}Section (wrapper — server component)
  ├── fetch data dari DB
  ├── resolve filter meta (kategori name + href)
  └── dispatch ke design berdasarkan variant
        │
        ▼
  {Type}Design1 / 2 / 3 / ...
  ├── susun layout (grid, featured, carousel, agenda, dll)
  ├── PostsSectionTitle (shared — dipakai semua tipe)
  └── memanggil <{Type}Card variant="..." />
              │
              ▼
        {Type}Card (wrapper)
        └── switch(variant) → {Type}CardGrid / List / Ringkas / ...
```

---

## Struktur File

```
lib/
├── post-card-templates.ts         → PostCardData + PostCardVariant          ✅
├── product-card-templates.ts      → ProductCardData + ProductCardVariant    ⬜
├── event-card-templates.ts        → EventCardData + EventCardVariant        ⬜
└── campaign-card-templates.ts     → CampaignCardData + CampaignCardVariant  ⬜

components/website/public/
│
├── post-cards/                    ✅ SELESAI
│   ├── post-card.tsx              → wrapper switch(variant)
│   ├── post-card-klasik.tsx
│   ├── post-card-list.tsx
│   ├── post-card-overlay.tsx
│   ├── post-card-ringkas.tsx
│   ├── post-card-judul.tsx
│   └── post-card-ticker.tsx
│
├── product-cards/                 ⬜ BELUM
│   ├── product-card.tsx
│   ├── product-card-grid.tsx
│   ├── product-card-list.tsx
│   └── product-card-ringkas.tsx
│
├── event-cards/                   ⬜ BELUM
│   ├── event-card.tsx
│   ├── event-card-grid.tsx
│   ├── event-card-list.tsx
│   └── event-card-ringkas.tsx
│
└── campaign-cards/                ⬜ BELUM
    ├── campaign-card.tsx
    ├── campaign-card-grid.tsx
    ├── campaign-card-list.tsx
    └── campaign-card-ringkas.tsx

components/website/public/sections/
│
├── posts/                         ✅ SELESAI
│   ├── posts-section.tsx
│   ├── posts-section-title.tsx    ← SHARED — dipakai semua tipe
│   ├── posts-design-1.tsx
│   ├── posts-design-2.tsx
│   ├── posts-design-3.tsx
│   ├── posts-design-4.tsx
│   └── posts-design-5.tsx
│
├── products/                      ⬜ BELUM
│   ├── products-section.tsx
│   ├── products-design-1.tsx      → Grid 4 kolom
│   ├── products-design-2.tsx      → Showcase: 1 featured besar + grid 4 kecil
│   └── products-design-3.tsx      → Carousel scroll horizontal
│
├── events/                        ⬜ BELUM
│   ├── events-section.tsx
│   ├── events-design-1.tsx        → Grid 3 kolom dengan badge tanggal
│   ├── events-design-2.tsx        → Featured: 1 event utama + list event lain
│   └── events-design-3.tsx        → Agenda: list vertikal, tanggal di kiri
│
└── campaigns/                     ⬜ BELUM
    ├── campaigns-section.tsx
    ├── campaigns-design-1.tsx     → Grid 3 kolom progress card
    ├── campaigns-design-2.tsx     → Featured: 1 campaign besar + 2 kecil
    └── campaigns-design-3.tsx     → Compact list vertikal
```

---

## Shared Component: PostsSectionTitle

`components/website/public/sections/posts/posts-section-title.tsx` dipakai SEMUA tipe konten
— sudah cukup generik (title + href + "Lihat Semua"). Tidak perlu dibuat ulang per tipe.

```typescript
// Import dari semua section type baru:
import { PostsSectionTitle } from "../posts/posts-section-title";
```

---

## Data Types per Tipe

### Post (sudah ada)

```typescript
// lib/post-card-templates.ts
export type PostCardData = {
  id:             string;
  title:          string;
  slug:           string;
  excerpt:        string | null;
  coverUrl:       string | null;
  coverVariants?: Record<string, string> | null;
  coverAlt?:      string | null;
  coverTitle?:    string | null;
  categoryName:   string | null;
  publishedAt:    string | null;   // ISO string — bukan Date
  isFeatured:     boolean;
};
```

### Produk

```typescript
// lib/product-card-templates.ts
export type ProductCardData = {
  id:             string;
  name:           string;          // bukan "title"
  slug:           string;
  description:    string | null;
  price:          string;          // numeric dari DB — format di card: "Rp 150.000"
  coverUrl:       string | null;   // dari images[0] JSONB → resolved MinIO URL
  coverVariants?: Record<string, string> | null;
  categoryName:   string | null;
  // tidak ada publishedAt — produk tidak punya tanggal terbit
};

export const PRODUCT_CARD_VARIANTS = ["grid", "list", "ringkas"] as const;
export type ProductCardVariant = typeof PRODUCT_CARD_VARIANTS[number];
```

### Event

```typescript
// lib/event-card-templates.ts
export type EventCardData = {
  id:             string;
  name:           string;
  slug:           string;
  description:    string | null;
  coverUrl:       string | null;
  coverVariants?: Record<string, string> | null;
  categoryName:   string | null;
  startsAt:       string | null;   // ISO string — serialize dari timestamp
  endsAt:         string | null;
  location:       string | null;
  lowestPrice:    string | null;   // null = gratis. MIN(price) dari event_tickets JOIN
  status:         string;
};

export const EVENT_CARD_VARIANTS = ["grid", "list", "ringkas"] as const;
export type EventCardVariant = typeof EVENT_CARD_VARIANTS[number];
```

### Campaign (Donasi)

```typescript
// lib/campaign-card-templates.ts
export type CampaignCardData = {
  id:              string;
  name:            string;
  slug:            string;
  description:     string | null;
  coverUrl:        string | null;
  coverVariants?:  Record<string, string> | null;
  categoryName:    string | null;
  targetAmount:    string | null;    // null = tanpa target
  collectedAmount: string | null;
  endsAt:          string | null;    // null = tanpa deadline
  progressPercent: number | null;    // pre-computed: collectedAmount/targetAmount*100
                                     // null jika targetAmount null
};

export const CAMPAIGN_CARD_VARIANTS = ["grid", "list", "ringkas"] as const;
export type CampaignCardVariant = typeof CAMPAIGN_CARD_VARIANTS[number];
```

---

## Card Variants per Tipe

### Post — 6 variant (✅ semua selesai)

| Variant | Deskripsi | Pakai di Section |
|---------|-----------|-----------------|
| `klasik` | Gambar atas, judul + excerpt bawah | Design 1 kolom kiri/kanan, default archive |
| `list` | Horizontal: teks kiri, thumbnail kanan | Design 2, 3, 4 — list padat |
| `overlay` | Gambar penuh, teks overlay bawah | Design 1 tengah (featured), Design 5 carousel |
| `ringkas` | Gambar + judul, tanpa excerpt | Grid padat |
| `judul` | Teks saja, tanpa gambar | Design 1 kiri/kanan (item 2–5), sidebar |
| `ticker` | Judul link minimal untuk marquee | Running text / ticker bar |

### Produk — 3 variant (⬜ belum)

| Variant | Deskripsi | Dipakai di |
|---------|-----------|-----------|
| `grid` | Gambar atas + nama + harga + kategori | Design 1 (Grid), Design 2 (bagian kecil) |
| `list` | Horizontal: thumbnail kiri, nama + harga kanan | Design 2 (list samping featured) |
| `ringkas` | Gambar + nama + harga saja, padat | Design 3 (Carousel) |

### Event — 3 variant (⬜ belum)

| Variant | Deskripsi | Dipakai di |
|---------|-----------|-----------|
| `grid` | Cover + nama + badge tanggal + lokasi + harga/gratis | Design 1, Design 2 (kecil) |
| `list` | Horizontal: thumbnail + info event | Design 3 (Agenda side items) |
| `ringkas` | Cover + nama + tanggal saja | Design 2 (featured besar pakai ini) |

### Campaign — 3 variant (⬜ belum)

| Variant | Deskripsi | Dipakai di |
|---------|-----------|-----------|
| `grid` | Cover + nama + progress bar + target + sisa hari | Design 1, Design 2 (kecil) |
| `list` | Horizontal: thumbnail + nama + progress mini | Design 3 (Compact list) |
| `ringkas` | Cover + nama + progress bar tipis | Design 2 (featured — pakai inline, bukan card ini) |

---

## Section Designs per Tipe

### Post — 5 design (✅ semua selesai)

Lihat `docs/arsitektur-section-post.md` untuk detail lengkap.

| Design | Label | Jenis | Deskripsi |
|--------|-------|-------|-----------|
| 1 | Hero 3 Kolom | hero | Tiga kolom asimetris: terkini kiri/kanan, unggulan tengah |
| 2 | Klasik | section | Featured 50/50 + 2 kolom list |
| 3 | Twin Columns | section | 2 kolom list sejajar |
| 4 | Trio Column | section | 3 kolom, tiap kolom filter sendiri |
| 5 | Post Carousel | section | Scroll horizontal overlay card portrait |

### Produk — 3 design (⬜ belum)

Semua section type (ada judul + "Lihat Semua"). Tidak perlu hero design.

| Design | Label | Deskripsi |
|--------|-------|-----------|
| 1 | Grid Produk | 4 kolom product-card-grid. Count default 8. |
| 2 | Showcase | 1 produk featured besar (inline) + 4 produk kecil (product-card-grid). Count 5. |
| 3 | Carousel Produk | Scroll horizontal, product-card-ringkas aspect 1:1. Count 8. |

### Event — 3 design (⬜ belum)

Semua section type.

| Design | Label | Deskripsi |
|--------|-------|-----------|
| 1 | Grid Event | 3 kolom event-card-grid dengan badge tanggal menonjol. Count default 6. |
| 2 | Event Utama | 1 event featured besar (inline + deskripsi) + list 3 event lain (event-card-list). |
| 3 | Agenda | List vertikal: tanggal di kolom kiri sebagai aksen, info di kanan. Count 5. |

### Campaign — 3 design (⬜ belum)

Semua section type.

| Design | Label | Deskripsi |
|--------|-------|-----------|
| 1 | Grid Donasi | 3 kolom campaign-card-grid dengan progress bar. Count default 6. |
| 2 | Campaign Unggulan | 1 campaign besar (inline + progress bar besar) + 2 kecil (campaign-card-grid). |
| 3 | Daftar Donasi | Compact list vertikal: thumbnail kecil + nama + progress mini. Count 5. Cocok untuk widget. |

---

## Section Data Types

Disimpan di `SectionItem.data` (JSONB di landing page). Tidak butuh schema change.

```typescript
// Post (sudah ada)
type PostsSectionData = {
  title: string; count: number; categoryId?: string | null; tagId?: string | null;
  onlyFeatured?: boolean; columns?: PostColumnConfig[];
};

// Produk (baru)
type ProductsSectionData = {
  title:      string;
  count:      number;          // default 8
  categoryId: string | null;
};

// Event (baru)
type EventsSectionData = {
  title:        string;
  count:        number;        // default 6
  categoryId:   string | null;
  upcomingOnly: boolean;       // default true: filter endsAt > NOW() OR endsAt IS NULL
};

// Campaign/Donasi (baru)
type CampaignsSectionData = {
  title:      string;
  count:      number;          // default 6
  categoryId: string | null;
};
```

---

## Fetch Strategy per Tipe

Semua mengikuti pola `fetchRecentPosts` dari posts-section.tsx.

| Tipe | Status publik | Cover | Hal khusus |
|------|--------------|-------|-----------|
| Post | `status = 'published'` | `coverId` FK → MinIO | `excludeFeatured` untuk hero design |
| Produk | `status = 'active'` | `images[0]` JSONB → MinIO | Helper `extractFirstImage(images: unknown)` |
| Event | `status = 'published'` + opsional `endsAt > NOW()` | `coverId` FK → MinIO | LEFT JOIN `event_tickets` → `MIN(price)` sebagai `lowestPrice` |
| Campaign | `status = 'active'` | `coverId` FK → MinIO | `progressPercent = ROUND(collected/target*100)` — pre-computed |

### Helper Produk: extractFirstImage

Produk tidak punya `coverId` — cover diambil dari `images` JSONB array:

```typescript
// Ambil URL gambar pertama dari images JSONB produk
function extractFirstImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as { url?: string };
  return typeof first?.url === "string" ? first.url : null;
}
```

---

## URL Publik

| Tipe | Archive | Detail |
|------|---------|--------|
| Post | `/{slug}/post` | `/{slug}/post/{postSlug}` |
| Produk | `/{slug}/toko` | `/{slug}/toko/{productSlug}` |
| Event | `/{slug}/event` | `/{slug}/event/{eventSlug}` ✅ sudah ada |
| Campaign | `/{slug}/donasi` | `/{slug}/donasi/{campaignSlug}` |

Filter di archive: `?category={slug}` — konsisten semua tipe.

---

## Integrasi Landing Page

`SectionItem.type` yang sudah ada di `lib/page-templates.ts`:

```typescript
// Tambah ke SectionType union:
type SectionType = "hero" | "posts" | "products" | "events" | "campaigns" | ...;
```

Contoh data di landing page JSONB:
```jsonc
{ "type": "products",  "variant": "1", "data": { "title": "Produk Terbaru", "count": 8, "categoryId": null } }
{ "type": "events",    "variant": "1", "data": { "title": "Event Mendatang", "count": 6, "categoryId": null, "upcomingOnly": true } }
{ "type": "campaigns", "variant": "1", "data": { "title": "Donasi & Infaq",  "count": 3, "categoryId": null } }
```

Di `landing-template.tsx`, tambah case di switch:
```typescript
case "products":  return <ProductsSection  data={...} variant={...} tenantClient={...} tenantSlug={...} />;
case "events":    return <EventsSection    data={...} variant={...} tenantClient={...} tenantSlug={...} />;
case "campaigns": return <CampaignsSection data={...} variant={...} tenantClient={...} tenantSlug={...} />;
```

---

## Cara Menambah Card Variant Baru

1. Buat file `{type}-card-{variant}.tsx` di folder `{type}-cards/`
2. Tambah variant ke `{TYPE}_CARD_VARIANTS` array di `lib/{type}-card-templates.ts`
3. Tambah `case "{variant}"` di switch di `{type}-card.tsx` wrapper

Tidak ada perubahan di Section atau di halaman yang sudah ada.

---

## Cara Menambah Section Design Baru

1. Buat file `{type}-design-N.tsx` di folder `sections/{type}/`
2. Tambah entry di `{TYPE}_SECTION_DESIGNS` di `lib/{type}-section-designs.ts`
3. Tambah `case "N"` di switch di `{type}-section.tsx` wrapper

Tidak ada perubahan di landing-template, section editor, atau DB.

---

## Cara Menambah Tipe Konten Baru (misal: Dokumen, Galeri)

1. Buat `lib/{type}-card-templates.ts` — data type + variant registry
2. Buat folder `components/website/public/{type}-cards/` — card components
3. Buat folder `components/website/public/sections/{type}/` — section wrapper + designs
4. Tambah `SectionType` di `lib/page-templates.ts`
5. Tambah `case "{type}"` di `landing-template.tsx`

---

## Status Implementasi

| Tipe | Card | Section | Archive Page | Detail Page |
|------|------|---------|-------------|------------|
| Post | ✅ 6 variant | ✅ 5 design | ✅ `/post` | ✅ `/post/[slug]` |
| Produk | ⬜ | ⬜ | ⬜ `/toko` | ⬜ `/toko/[slug]` |
| Event | ⬜ | ⬜ | ⬜ `/event` (listing) | ✅ `/event/[slug]` |
| Campaign | ⬜ | ⬜ | ⬜ `/donasi` | ⬜ `/donasi/[slug]` |

---

## Catatan Teknis

### coverUrl — selalu full URL MinIO
`media.path` dari DB adalah raw MinIO key. Wajib di-wrap `publicUrl(tenantSlug, path)`.
Raw path di `<img src>` akan invalid. Berlaku semua tipe.

### publishedAt / startsAt / endsAt — selalu string, bukan Date
Timestamp dari DB wajib di-serialize ke ISO string sebelum masuk ke CardData.
Alasan: client component (carousel, dll) tidak bisa menerima Date object via props.
Format: `timestamp.toISOString()`.

### cn() untuk className prop di card overlay
Gunakan `cn()` dari `@/lib/utils` (tailwind-merge) bila card menerima `className` prop
untuk override class Tailwind (misal aspect ratio). String concatenation biasa menyebabkan
class conflict yang tidak predictable.

### border — selalu border-border
`border-l`, `border-t` tanpa kelas warna eksplisit = warna default browser (hitam).
Wajib: `border-l border-border`, `border-t border-border`.
