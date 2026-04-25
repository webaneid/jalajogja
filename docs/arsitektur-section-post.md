# Arsitektur Section Post — jalajogja

Dokumen ini mendefinisikan sistem **Section Post** — container yang menampilkan kumpulan
post dalam berbagai layout design, dengan filter kategori, dan menggunakan **Post Card Template**
sebagai unit rendernya.

Keterkaitan dokumen:
- `docs/arsitektur-template-post-card.md` — definisi PostCard (unit individual)
- `docs/arsitektur-website.md` Bagian 3 — Section Builder landing page (parent sistem ini)

---

## Hirarki Lengkap

```
Landing Page
└── SectionItem (type="posts", variant="2")
      │
      ├── data: { title, count, categoryId }   ← konfigurasi admin
      │
      └── PostsSection wrapper
            └── PostsDesign2                   ← layout spesifik
                  ├── PostCard variant="overlay"   ← item featured (posisi 1)
                  └── PostCard variant="ringkas"   ← item grid (posisi 2–5)
```

**Tiga lapis yang terpisah:**

| Lapis | Tanggung jawab | File |
|-------|---------------|------|
| **SectionItem** | menyimpan config (title, count, categoryId, design variant) | DB JSONB |
| **PostsSection** | wrapper: fetch data → pilih design → render | `posts-section.tsx` |
| **PostsDesignN** | layout spesifik + komposisi card variant | `posts-design-N.tsx` |
| **PostCard** | render satu card | `post-card-*.tsx` |

---

## Prinsip Kunci

1. **Design menentukan card variant** — bukan admin. Design 2 sudah "tahu" bahwa posisi pertama
   pakai `overlay` dan sisanya `ringkas`. Admin hanya pilih design, bukan konfigurasi card per posisi.

2. **Data fetch terpusat di PostsSection** — setiap design menerima `PostCardData[]` yang
   sudah siap pakai. Design tidak fetch ke DB sendiri.

3. **Menambah design baru** = satu file + satu baris registry. Tidak ada perubahan di mana pun.

4. **Category filter di level data** — `categoryId` disimpan di `SectionItem.data`, dipakai
   saat fetch. Design tidak perlu tahu tentang filter.

---

## Data Type

```typescript
// Tambahkan ke lib/page-templates.ts
export type PostsSectionData = {
  title:          string;         // judul section, misal "Berita Terkini"
  count:          number;         // jumlah post, default 6
  categoryId?:    string | null;  // UUID kategori — null = semua kategori
  onlyFeatured?:  boolean;        // true = hanya tampilkan post is_featured=true
};
```

`categoryId` disimpan sebagai UUID (bukan slug) agar tetap valid jika admin rename kategori.

`onlyFeatured` dipakai oleh design yang punya kolom khusus "featured center" — design akan fetch
dua query terpisah: `featuredPosts` (is_featured=true) + `recentPosts` (published, non-featured).

---

## Registry Design

```typescript
// lib/posts-section-designs.ts
export const POSTS_SECTION_DESIGN_IDS = ["1", "2", "3", "4", "5"] as const;
export type PostsSectionDesignId = typeof POSTS_SECTION_DESIGN_IDS[number];

export type PostsSectionDesignMeta = {
  label:          string;
  description:    string;
  // minCount: jumlah post minimum yang dibutuhkan design ini agar tampil optimal
  minCount:       number;
  // needsFeatured: true = design ini butuh query featuredPosts terpisah di PostsSection wrapper
  needsFeatured?: boolean;
};

export const POSTS_SECTION_DESIGNS: Record<PostsSectionDesignId, PostsSectionDesignMeta> = {
  "1": { label: "Hero 3 Kolom",     description: "Tiga kolom: terkini kiri-kanan, unggulan di tengah.", minCount: 5, needsFeatured: true },
  "2": { label: "Featured + Grid",  description: "Satu card besar di atas, grid kecil di bawah.",       minCount: 4 },
  "3": { label: "List Vertikal",    description: "Daftar panjang horizontal per baris.",                 minCount: 3 },
  "4": { label: "Ticker / Marquee", description: "Running text judul berita terbaru.",                   minCount: 5 },
  "5": { label: "Magazine",         description: "Layout majalah: besar + kolom samping.",               minCount: 5 },
  // Design berikutnya ditambah di sini
};
```

Design ID menggunakan string `"1"`, `"2"`, dst — konsisten dengan field `SectionItem.variant`
yang sudah ada di sistem landing builder (`lib/page-templates.ts`).

---

## Props Universal per Design

Semua design komponen menerima props yang identik:

```typescript
// lib/posts-section-designs.ts
export type PostsSectionProps = {
  data:           PostsSectionData;
  posts:          PostCardData[];          // recent posts — sudah di-resolve: coverUrl string
  featuredPosts?: PostCardData[];          // hanya ada jika design.needsFeatured = true
  tenantSlug:     string;
};
```

`PostCardData` berasal dari `lib/post-card-templates.ts` — URL cover sudah di-resolve
di layer fetch, design tidak tahu tentang DB atau MinIO.

Design yang punya `needsFeatured: true` (saat ini: Design 1) menerima dua array terpisah:
- `posts` → recent posts (is_featured=false) — untuk kolom kiri dan kanan
- `featuredPosts` → curated posts (is_featured=true) — untuk kolom tengah

---

## Struktur File

```
lib/
├── post-card-templates.ts          → PostCardData + PostCardVariant (sudah diarsitekturkan)
└── posts-section-designs.ts        → PostsSectionDesignId + registry metadata

components/website/public/sections/posts/
├── posts-section.tsx               → wrapper: fetch → pilih design → render
├── posts-design-1.tsx              → Hero 3 Kolom (referensi visual sudah ada)
├── posts-design-2.tsx              → Featured + Grid
├── posts-design-3.tsx              → List Vertikal
├── posts-design-4.tsx              → Ticker / Marquee
└── posts-design-5.tsx              → Magazine

components/website/
└── posts-section-wireframes.tsx    → CSS wireframe thumbnail per design (untuk section picker)
```

---

## PostsSection Wrapper

Fetch data + dispatch ke design yang sesuai:

```typescript
// components/website/public/sections/posts/posts-section.tsx
import { eq, desc, and } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import type { PostsSectionData, PostsSectionDesignId } from "@/lib/posts-section-designs";
import type { PostCardData } from "@/lib/post-card-templates";
import { PostsDesign1 } from "./posts-design-1";
import { PostsDesign2 } from "./posts-design-2";
// ... import semua design

type Props = {
  data:       PostsSectionData;
  variant:    PostsSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug: string;
};

export async function PostsSection({ data, variant, tenantClient, tenantSlug }: Props) {
  const designMeta = POSTS_SECTION_DESIGNS[variant as PostsSectionDesignId];

  // Dua query terpisah hanya untuk design yang butuh kolom featured (needsFeatured: true)
  const [posts, featuredPosts] = await Promise.all([
    fetchRecentPosts(tenantClient, data),
    designMeta?.needsFeatured ? fetchFeaturedPosts(tenantClient, data) : Promise.resolve(undefined),
  ]);

  const props = { data, posts, featuredPosts, tenantSlug };

  switch (variant) {
    case "2": return <PostsDesign2 {...props} />;
    case "3": return <PostsDesign3 {...props} />;
    case "4": return <PostsDesign4 {...props} />;
    case "5": return <PostsDesign5 {...props} />;
    default:  return <PostsDesign1 {...props} />;
  }
}
```

---

## Fetch Terpusat

Dua fungsi fetch — design biasa pakai `fetchRecentPosts`, design dengan kolom featured
(needsFeatured=true) memanggil keduanya secara paralel:

```typescript
// Helper internal: resolve coverUrl dari MinIO path
async function resolveCovers(
  db: TenantDb["db"],
  schema: TenantDb["schema"],
  rows: { coverId: string | null }[],
): Promise<Map<string, string>> {
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  if (!coverIds.length) return new Map();
  return new Map(
    (await db.select({ id: schema.media.id, path: schema.media.path })
      .from(schema.media)
      .where(inArray(schema.media.id, coverIds)))
      .map(m => [m.id, m.path])
  );
}

// Fetch recent posts (is_featured = false) — untuk kolom kiri/kanan Design 1, atau semua post di design lain
async function fetchRecentPosts(
  tenantClient: TenantDb,
  data: PostsSectionData,
): Promise<PostCardData[]> {
  const { db, schema } = tenantClient;
  const count = data.count ?? 10;

  const baseClauses = [
    eq(schema.posts.status, "published"),
    eq(schema.posts.isFeatured, false),   // hanya non-featured di query ini
    ...(data.categoryId ? [eq(schema.posts.categoryId, data.categoryId)] : []),
  ];

  const rows = await db
    .select({
      id:           schema.posts.id,
      title:        schema.posts.title,
      slug:         schema.posts.slug,
      excerpt:      schema.posts.excerpt,
      coverId:      schema.posts.coverId,
      isFeatured:   schema.posts.isFeatured,
      categoryName: schema.postCategories.name,
      publishedAt:  schema.posts.publishedAt,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(and(...baseClauses))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(count);

  const mediaMap = await resolveCovers(db, schema, rows);
  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    slug:         r.slug,
    excerpt:      r.excerpt,
    coverUrl:     r.coverId ? (mediaMap.get(r.coverId) ?? null) : null,
    categoryName: r.categoryName ?? null,
    publishedAt:  r.publishedAt,
    isFeatured:   r.isFeatured,
  }));
}

// Fetch featured posts (is_featured = true) — untuk kolom tengah Design 1
async function fetchFeaturedPosts(
  tenantClient: TenantDb,
  data: PostsSectionData,
): Promise<PostCardData[]> {
  const { db, schema } = tenantClient;

  const baseClauses = [
    eq(schema.posts.status, "published"),
    eq(schema.posts.isFeatured, true),
    ...(data.categoryId ? [eq(schema.posts.categoryId, data.categoryId)] : []),
  ];

  const rows = await db
    .select({
      id:           schema.posts.id,
      title:        schema.posts.title,
      slug:         schema.posts.slug,
      excerpt:      schema.posts.excerpt,
      coverId:      schema.posts.coverId,
      isFeatured:   schema.posts.isFeatured,
      categoryName: schema.postCategories.name,
      publishedAt:  schema.posts.publishedAt,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(and(...baseClauses))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(5);   // kolom tengah selalu 5

  const mediaMap = await resolveCovers(db, schema, rows);
  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    slug:         r.slug,
    excerpt:      r.excerpt,
    coverUrl:     r.coverId ? (mediaMap.get(r.coverId) ?? null) : null,
    categoryName: r.categoryName ?? null,
    publishedAt:  r.publishedAt,
    isFeatured:   r.isFeatured,
  }));
}
```

**Catatan**: design selain Design 1 tidak membedakan featured/non-featured — query `fetchRecentPosts`
mengembalikan semua non-featured. Jika suatu design ingin tampilkan semua post tanpa filter,
hapus kondisi `eq(schema.posts.isFeatured, false)` dari `baseClauses`.

---

## Integrasi dengan Landing Template

Di `landing-template.tsx`, ganti `PostsSection` inline yang ada sekarang:

```typescript
// Sebelum: monolithic PostsSection function hardcoded di landing-template.tsx
// Sesudah:
import { PostsSection } from "@/components/website/public/sections/posts/posts-section";

// Di dalam switch case saat render section:
case "posts":
  return (
    <PostsSection
      key={section.id}
      data={section.data as PostsSectionData}
      variant={(section.variant ?? "1") as PostsSectionDesignId}
      tenantClient={tenantClient}
      tenantSlug={tenantSlug}
    />
  );
```

`tenantClient` sudah ada di `landing-template.tsx` (sudah di-pass dari `PublicLayout`).

---

## Integrasi dengan Section Editor (Dashboard)

Section editor untuk type `"posts"` di `section-editors.tsx` mengatur **data** saja
(title, count, categoryId). Pemilihan **design** (variant) dilakukan via tombol "Ganti Design"
di landing builder — sudah ada mekanismenya.

```
┌──────────────────────────────────────────────┐
│  Edit Section: Postingan                     │
│                                              │
│  Judul section: [Berita Terkini__________]   │
│  Jumlah post:   [6 ▾]                        │
│                   3 / 6 / 9 / 12            │
│  Filter kategori: [Semua kategori ▾]         │
│                    ─────────────────         │
│                    Semua kategori            │
│                    Politik                   │
│                    Ekonomi                   │
│                    Olahraga                  │
└──────────────────────────────────────────────┘
```

Kategori di-fetch dari `schema.postCategories` saat editor dibuka.
Disimpan sebagai UUID di `SectionItem.data.categoryId`.

---

## Wireframe untuk Section Picker

Setiap design punya wireframe CSS untuk ditampilkan di picker "Ganti Design" dan
picker "Tambah Section". Wireframe di-definisikan di `posts-section-wireframes.tsx`:

```typescript
export const POSTS_SECTION_WIREFRAMES: Record<PostsSectionDesignId, React.ReactNode> = {
  "1": <WireframeGrid3 />,
  "2": <WireframeFeaturedGrid />,
  "3": <WireframeListVertical />,
  "4": <WireframeTicker />,
  "5": <WireframeMagazine />,
};
```

Wireframe = skeleton Tailwind (div abu-abu), tidak ada gambar PNG — konsisten dengan
pola wireframe section lain di `section-wireframes.tsx`.

---

## Detail per Design

### Design 1 — Hero 3 Kolom

Referensi visual: sudah ada (screenshot 3-kolom koran).

```
┌─────────────────┬────────────────────┬─────────────────┐
│  KOLOM KIRI     │   KOLOM TENGAH     │  KOLOM KANAN    │
│  (5 terkini)    │  (5 unggulan)      │  (5 terkini)    │
│                 │                    │                 │
│ ┌─────────────┐ │ ┌────────────────┐ │ ┌─────────────┐ │
│ │ [gambar]    │ │ │                │ │ │ [gambar]    │ │
│ │ [ringkas]   │ │ │ [gambar penuh] │ │ │ [ringkas]   │ │
│ │ kat · tgl   │ │ │ overlay        │ │ │ kat · tgl   │ │
│ └─────────────┘ │ │ kat + judul    │ │ └─────────────┘ │
│                 │ │ + tgl          │ │                 │
│ ┌─────────────┐ │ └────────────────┘ │ ┌─────────────┐ │
│ │ [judul]     │ │                    │ │ [judul]     │ │
│ │ kat · tgl   │ │ ┌────────────────┐ │ │ kat · tgl   │ │
│ └─────────────┘ │ │ [gambar kecil] │ │ └─────────────┘ │
│ ┌─────────────┐ │ │  list          │ │ ┌─────────────┐ │
│ │ [judul]     │ │ │ kat + judul    │ │ │ [judul]     │ │
│ │ kat · tgl   │ │ └────────────────┘ │ │ kat · tgl   │ │
│ └─────────────┘ │ (×4 list item)     │ └─────────────┘ │
│ (×2 lagi judul) │                    │ (×2 lagi judul) │
└─────────────────┴────────────────────┴─────────────────┘
```

**Komposisi card per kolom:**

| Kolom | Sumber Data | Posisi | Variant Card |
|-------|-------------|--------|--------------|
| Kiri  | `posts[0]`  | pertama | `klasik` — gambar rounded + meta + judul, tanpa border |
| Kiri  | `posts[1–4]`| kedua–kelima | `judul` — meta satu baris, judul di bawah, border-t separator |
| Tengah | `featuredPosts[0]` | pertama | `overlay` — gambar penuh + teks di bawah |
| Tengah | `featuredPosts[1–4]` | kedua–kelima | `list` — tanpa border, border-t separator antar item |
| Kanan | `posts[5]`  | pertama | `klasik` |
| Kanan | `posts[6–9]`| kedua–kelima | `judul` |

**Data requirements:**
- `posts`: 10 non-featured posts terbaru (kiri 0–4, kanan 5–9)
- `featuredPosts`: 5 featured posts terbaru (diisi oleh `fetchFeaturedPosts`)
- `data.count` untuk Design 1 sebaiknya ≥ 10 (default 10)

**Graceful degradation:**
- Jika `featuredPosts` kosong → kolom tengah tampil sebagai daftar 5 post terkini dengan variant `list`
- Jika `posts` < 10 → kanan tampilkan sisanya saja; jika < 5 → kolom kanan tidak tampil
- Jika `posts[0]` atau `posts[5]` tidak ada → kolom kiri/kanan tampil judul saja

**Implementasi komponen:**

```typescript
// components/website/public/sections/posts/posts-design-1.tsx
import { PostCard } from "@/components/website/public/post-cards/post-card";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

export function PostsDesign1({ data, posts, featuredPosts = [], tenantSlug }: PostsSectionProps) {
  const leftPosts  = posts.slice(0, 5);
  const rightPosts = posts.slice(5, 10);
  const center     = featuredPosts.length > 0 ? featuredPosts : posts.slice(0, 5);

  return (
    <section className="w-full">
      {data.title && <h2 className="text-xl font-bold mb-4">{data.title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_1fr] gap-4">

        {/* Kolom kiri */}
        <div className="flex flex-col gap-3">
          {leftPosts[0] && <PostCard post={leftPosts[0]} variant="ringkas" tenantSlug={tenantSlug} />}
          {leftPosts.slice(1).map(p => (
            <PostCard key={p.id} post={p} variant="judul" tenantSlug={tenantSlug} />
          ))}
        </div>

        {/* Kolom tengah — featured */}
        <div className="flex flex-col gap-3">
          {center[0] && <PostCard post={center[0]} variant="overlay" tenantSlug={tenantSlug} />}
          {center.slice(1).map(p => (
            <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />
          ))}
        </div>

        {/* Kolom kanan */}
        <div className="flex flex-col gap-3">
          {rightPosts[0] && <PostCard post={rightPosts[0]} variant="ringkas" tenantSlug={tenantSlug} />}
          {rightPosts.slice(1).map(p => (
            <PostCard key={p.id} post={p} variant="judul" tenantSlug={tenantSlug} />
          ))}
        </div>

      </div>
    </section>
  );
}
```

**Grid ratio**: `1fr_1.4fr_1fr` — tengah sedikit lebih lebar untuk menampilkan overlay dengan baik.

---

### Design 2–5

Referensi visual belum tersedia. Dokumentasi menyusul saat referensi dikirim.

---

## Cara Menambah Design Baru

1. Buat `posts-design-6.tsx` — implementasi layout + komposisi PostCard variant
2. Tambah satu entry di `POSTS_SECTION_DESIGNS` di `lib/posts-section-designs.ts`
3. Tambah `case "6"` di switch `PostsSection` wrapper
4. Buat `<WireframeDesign6 />` di `posts-section-wireframes.tsx`

Tidak ada perubahan di `landing-template.tsx`, section editor, atau DB.

---

## Keterkaitan dengan Dokumen Lain

| Dokumen | Keterkaitan |
|---------|-------------|
| `arsitektur-template-post-card.md` | PostsDesignN menggunakan `<PostCard>` dari sistem ini |
| `arsitektur-website.md` Bagian 3 | Section `posts` adalah salah satu `SectionType` di landing builder |
| `CLAUDE.md` § Arsitektur Website | Status implementasi diperbarui di sini |

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| `lib/posts-section-designs.ts` | ✅ Selesai |
| `sections/posts/posts-section.tsx` (wrapper + fetch) | ✅ Selesai |
| `sections/posts/posts-design-1.tsx` | ✅ Selesai — Hero 3 Kolom |
| `sections/posts/posts-design-2.tsx` | ⬜ Belum — menunggu referensi visual |
| `sections/posts/posts-design-3.tsx` | ⬜ Belum — menunggu referensi visual |
| `sections/posts/posts-design-4.tsx` | ⬜ Belum — menunggu referensi visual |
| `sections/posts/posts-design-5.tsx` | ⬜ Belum — menunggu referensi visual |
| `posts-section-wireframes.tsx` | ⬜ Belum — menunggu semua design ada |
| Refactor `landing-template.tsx` → pakai PostsSection | ✅ Selesai |
| Update `section-editors.tsx` → design picker (variant) + count | ✅ Selesai |

---

## Catatan Implementasi

### resolveCovers — wajib `tenantSlug`
`resolveCovers(db, schema, rows, tenantSlug)` mengembalikan Map berisi URL lengkap MinIO
via `publicUrl(tenantSlug, m.path)`. Tanpa `tenantSlug`, path mentah seperti
`website/2026/04/uuid.jpg` akan menyebabkan error `URL constructor` di `next/image`.

### Section Editor — Design Picker
`section-editors.tsx` PostsEditor kini menampilkan daftar 5 design layout yang bisa dipilih.
Pilihan design mengubah `section.variant` (bukan `section.data`) via `onVariantChange` prop
yang diteruskan dari `LandingBuilder` → `SectionEditDialog` → `SectionEditor` → `PostsEditor`.
