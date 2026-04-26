# Arsitektur Section Post — jalajogja

Dokumen ini mendefinisikan sistem **Section Post** — container yang menampilkan kumpulan
post dalam berbagai layout design, dengan filter kategori, dan menggunakan **Post Card Template**
sebagai unit rendernya.

Keterkaitan dokumen:
- `docs/arsitektur-template-post-card.md` — definisi PostCard (unit individual)
- `docs/arsitektur-website.md` Bagian 3 — Section Builder landing page (parent sistem ini)

---

## Dua Jenis Design: Hero vs Section Post

Seluruh design dibagi menjadi dua kategori yang berbeda secara fundamental:

| | Hero | Section Post |
|--|------|-------------|
| Data sumber | `posts` (non-featured) + `featuredPosts` (is_featured=true) | `posts` (semua published, bisa difilter kategori/tag) |
| Filter admin | Tidak ada — selalu menampilkan terbaru + unggulan | Combobox kategori atau tag |
| Judul section | Tidak ada header standar | **Wajib ada** — nama kategori/tag atau judul manual |
| "Lihat Semua" | Tidak ada | **Wajib ada** — link ke arsip post |
| Contoh design | Design 1 (Hero 3 Kolom), dan hero-hero berikutnya | Design 2, 3, 4, 5 |

Field `type: "hero" | "section"` di registry mengontrol perbedaan ini.

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
                  ├── PostsSectionTitle        ← header wajib untuk section type
                  ├── PostCard variant="klasik"    ← featured post (posisi 1)
                  └── PostCard variant="list"      ← item grid (posisi 2–N)
```

**Empat lapis yang terpisah:**

| Lapis | Tanggung jawab | File |
|-------|---------------|------|
| **SectionItem** | menyimpan config (title, count, categoryId, design variant) | DB JSONB |
| **PostsSection** | wrapper: fetch data → resolve filter meta → pilih design → render | `posts-section.tsx` |
| **PostsDesignN** | layout spesifik + komposisi card variant | `posts-design-N.tsx` |
| **PostCard** | render satu card | `post-card-*.tsx` |

---

## Prinsip Kunci

1. **Design menentukan card variant** — bukan admin. Design 2 sudah "tahu" bahwa posisi pertama
   pakai `klasik` dan sisanya `list`. Admin hanya pilih design + filter kategori.

2. **Data fetch terpusat di PostsSection** — setiap design menerima `PostCardData[]` yang
   sudah siap pakai. Design tidak fetch ke DB sendiri.

3. **Section type selalu punya title + "Lihat Semua"** — jika admin tidak isi `data.title`,
   gunakan `filterLabel` (nama kategori/tag). Jika keduanya kosong, fallback ke `"Berita Terbaru"`.

4. **"Lihat Semua" selalu ada untuk section type** — fallback ke `/${tenantSlug}/post`
   jika tidak ada filter kategori/tag aktif.

5. **Menambah design baru** = satu file + satu baris registry. Tidak ada perubahan di mana pun.

---

## Data Type

```typescript
// lib/posts-section-designs.ts

export type PostColumnConfig = {
  categoryId?: string | null;
  tagId?:      string | null;
  count?:      number;
};

export type PostsSectionData = {
  title:         string;           // judul manual — bisa kosong, fallback ke filterLabel → "Berita Terbaru"
  count:         number;           // jumlah post, default 6
  categoryId?:   string | null;    // UUID kategori — null = semua (untuk section type)
  tagId?:        string | null;    // UUID tag — filter alternatif
  onlyFeatured?: boolean;          // jarang dipakai, khusus design tertentu
  columns?:      PostColumnConfig[]; // Design 4 (Trio Column) — tiap kolom filter sendiri
};
```

`categoryId` dan `tagId` (level section) → satu filter untuk seluruh section (Design 2, 3, 5).
`columns` → tiap kolom filter independen (Design 4). Keduanya tidak dipakai bersamaan.

---

## Registry Design

```typescript
// lib/posts-section-designs.ts

export const POSTS_SECTION_DESIGN_IDS = ["1", "2", "3", "4", "5"] as const;
export type PostsSectionDesignId = typeof POSTS_SECTION_DESIGN_IDS[number];

export type PostsSectionDesignMeta = {
  label:             string;
  description:       string;
  minCount:          number;
  type:              "hero" | "section"; // hero = statis terbaru+unggulan; section = filter kategori/tag
  needsFeatured?:    boolean;            // hanya hero design: fetch featuredPosts query terpisah
  needsColumnData?:  boolean;            // Design 4: tiap kolom fetch sendiri-sendiri
};

export const POSTS_SECTION_DESIGNS: Record<PostsSectionDesignId, PostsSectionDesignMeta> = {
  "1": { label: "Hero 3 Kolom",   description: "Tiga kolom: terkini kiri-kanan, unggulan di tengah.", minCount: 5,  type: "hero",    needsFeatured: true },
  "2": { label: "Klasik",         description: "Featured atas (gambar + teks 50/50) + 2 kolom list.", minCount: 6,  type: "section" },
  "3": { label: "Twin Columns",   description: "Dua kolom sejajar, judul dari nama kategori/tag.",    minCount: 4,  type: "section" },
  "4": { label: "Trio Column",    description: "Tiga kolom, tiap kolom filter kategori/tag sendiri.", minCount: 3,  type: "section", needsColumnData: true },
  "5": { label: "Post Carousel",  description: "Sliding carousel overlay card, portrait 3:4.",        minCount: 3,  type: "section" },
};
```

> **Design 4** dieksekusi terakhir — kompleksitas section editor lebih tinggi dari Design 2, 3, 5.

Design ID menggunakan string `"1"`, `"2"`, dst — konsisten dengan field `SectionItem.variant`.

---

## Props Universal per Design

```typescript
// lib/posts-section-designs.ts

export type ColumnRenderData = {
  posts:        PostCardData[];
  filterLabel?: string;
  filterHref?:  string;
};

export type PostsSectionProps = {
  data:           PostsSectionData;
  posts:          PostCardData[];
  featuredPosts?: PostCardData[];          // hanya jika design.needsFeatured = true
  tenantSlug:     string;
  sectionTitle:   string;                  // sudah di-resolve: filterLabel ?? data.title ?? "Berita Terbaru"
  filterHref:     string;                  // sudah di-resolve: URL arsip — SELALU terisi untuk section type
  columnData?:    ColumnRenderData[];      // hanya Design 4+
};
```

`sectionTitle` dan `filterHref` **sudah di-resolve di wrapper** sebelum dikirim ke design.
Design tidak perlu lakukan fallback logic sendiri — tinggal render.

`filterHref` dijamin tidak kosong untuk section type:
- Ada `categoryId` → `/${tenantSlug}/post?category={slug}`
- Ada `tagId` → `/${tenantSlug}/post?tag={slug}`
- Tidak ada filter → `/${tenantSlug}/post`

---

## Struktur File

```
lib/
├── post-card-templates.ts          → PostCardData + PostCardVariant
└── posts-section-designs.ts        → PostsSectionDesignId + registry metadata + PostsSectionProps

components/website/public/sections/posts/
├── posts-section.tsx               → wrapper: fetch → resolve filter meta → pilih design → render
├── posts-section-title.tsx         → shared: heading + dashed line + "Lihat Semua" link
├── posts-design-1.tsx              → Hero 3 Kolom ✅ SELESAI
├── posts-design-2.tsx              → Klasik (pakai PostsSectionTitle)
├── posts-design-3.tsx              → Twin Columns (pakai PostsSectionTitle)
├── posts-design-4.tsx              → Trio Column — eksekusi terakhir
└── posts-design-5.tsx              → Post Carousel (pakai PostsSectionTitle)

components/website/
└── posts-section-wireframes.tsx    → CSS wireframe thumbnail per design (untuk section picker)
```

---

## PostsSection Wrapper

Fetch data + resolve filter meta + dispatch ke design:

```typescript
// components/website/public/sections/posts/posts-section.tsx

type Props = {
  data:         PostsSectionData;
  variant:      PostsSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
};

export async function PostsSection({ data, variant, tenantClient, tenantSlug }: Props) {
  const designMeta = POSTS_SECTION_DESIGNS[variant as PostsSectionDesignId];
  const { db, schema } = tenantClient;

  // Resolve nama + href dari categoryId atau tagId
  // Untuk section type: filterHref selalu terisi (fallback ke /post)
  async function resolveFilterMeta(categoryId?: string | null, tagId?: string | null) {
    if (categoryId) {
      const [row] = await db.select({ name: schema.postCategories.name, slug: schema.postCategories.slug })
        .from(schema.postCategories).where(eq(schema.postCategories.id, categoryId));
      return row
        ? { label: row.name, href: `/${tenantSlug}/post?category=${row.slug}` }
        : { label: null, href: `/${tenantSlug}/post` };
    }
    if (tagId) {
      const [row] = await db.select({ name: schema.postTags.name, slug: schema.postTags.slug })
        .from(schema.postTags).where(eq(schema.postTags.id, tagId));
      return row
        ? { label: row.name, href: `/${tenantSlug}/post?tag=${row.slug}` }
        : { label: null, href: `/${tenantSlug}/post` };
    }
    // Tidak ada filter → "Lihat Semua" tetap ada, tujuan ke arsip semua post
    return { label: null, href: `/${tenantSlug}/post` };
  }

  // Fetch berdasarkan jenis design
  const isHero = designMeta?.type === "hero";
  const columns = data.columns ?? [];

  const [posts, featuredPosts, filterMeta, ...columnResults] = await Promise.all([
    designMeta?.needsColumnData
      ? Promise.resolve([] as PostCardData[])
      : fetchRecentPosts(tenantClient, data, tenantSlug, { excludeFeatured: isHero }),
    designMeta?.needsFeatured
      ? fetchFeaturedPosts(tenantClient, data, tenantSlug)
      : Promise.resolve(undefined),
    resolveFilterMeta(data.categoryId, data.tagId),
    ...columns.map(async (col): Promise<ColumnRenderData> => {
      const [colPosts, meta] = await Promise.all([
        fetchRecentPosts(tenantClient, { ...data, categoryId: col.categoryId, tagId: col.tagId, count: col.count ?? 5 }, tenantSlug, {}),
        resolveFilterMeta(col.categoryId, col.tagId),
      ]);
      return { posts: colPosts, filterLabel: meta.label ?? undefined, filterHref: meta.href };
    }),
  ]);

  // Resolve sectionTitle — selalu ada untuk section type
  const sectionTitle = filterMeta.label ?? data.title ?? (isHero ? "" : "Berita Terbaru");
  const filterHref   = filterMeta.href;
  const columnData   = columnResults.length > 0 ? (columnResults as ColumnRenderData[]) : undefined;

  const props = { data, posts, featuredPosts, tenantSlug, sectionTitle, filterHref, columnData };

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

```typescript
// Helper: resolve coverUrl dari MinIO path (bukan raw path)
async function resolveCovers(
  db: TenantDb["db"],
  schema: TenantDb["schema"],
  rows: { coverId: string | null }[],
  tenantSlug: string,
): Promise<Map<string, string>> {
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  if (!coverIds.length) return new Map();
  return new Map(
    (await db.select({ id: schema.media.id, path: schema.media.path })
      .from(schema.media)
      .where(inArray(schema.media.id, coverIds)))
      .map(m => [m.id, publicUrl(tenantSlug, m.path)])   // ← wajib publicUrl, bukan raw path
  );
}

// Fetch recent posts
// excludeFeatured: true HANYA untuk hero design (sisi kiri/kanan tidak overlap kolom tengah)
// Semua section type design: excludeFeatured = false (tampilkan semua post published)
async function fetchRecentPosts(
  tenantClient: TenantDb,
  data: PostsSectionData,
  tenantSlug: string,
  opts: { excludeFeatured?: boolean } = {},
): Promise<PostCardData[]> {
  const { db, schema } = tenantClient;
  const count = data.count ?? 10;

  const clauses = [
    eq(schema.posts.status, "published"),
    ...(opts.excludeFeatured ? [eq(schema.posts.isFeatured, false)] : []),
    ...(data.categoryId ? [eq(schema.posts.categoryId, data.categoryId)] : []),
    ...(data.tagId ? [
      sql`EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = ${schema.posts.id} AND pt.tag_id = ${data.tagId})`
    ] : []),
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
    .where(and(...clauses))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(count);

  const mediaMap = await resolveCovers(db, schema, rows, tenantSlug);
  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    slug:         r.slug,
    excerpt:      r.excerpt,
    coverUrl:     r.coverId ? (mediaMap.get(r.coverId) ?? null) : null,
    categoryName: r.categoryName ?? null,
    publishedAt:  r.publishedAt ? r.publishedAt.toISOString() : null,  // serialize → string
    isFeatured:   r.isFeatured,
  }));
}

// Fetch featured posts (is_featured = true) — untuk kolom tengah Design 1 (hero)
async function fetchFeaturedPosts(
  tenantClient: TenantDb,
  data: PostsSectionData,
  tenantSlug: string,
): Promise<PostCardData[]> {
  const { db, schema } = tenantClient;

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
    .where(and(
      eq(schema.posts.status, "published"),
      eq(schema.posts.isFeatured, true),
      ...(data.categoryId ? [eq(schema.posts.categoryId, data.categoryId)] : []),
    ))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(5);

  const mediaMap = await resolveCovers(db, schema, rows, tenantSlug);
  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    slug:         r.slug,
    excerpt:      r.excerpt,
    coverUrl:     r.coverId ? (mediaMap.get(r.coverId) ?? null) : null,
    categoryName: r.categoryName ?? null,
    publishedAt:  r.publishedAt ? r.publishedAt.toISOString() : null,  // serialize → string
    isFeatured:   r.isFeatured,
  }));
}
```

### publishedAt: Date → string (wajib)

`PostCardData.publishedAt` harus `string | null`, bukan `Date | null`. Alasan:

1. **Serialization boundary**: Design 5 adalah client component. Next.js tidak menjamin `Date`
   object terserialisasi dengan benar saat di-pass sebagai props ke client component — bisa
   menjadi ISO string atau object kosong tergantung versi.

2. **Konsistensi**: Lebih mudah jika semua card component menerima tipe yang sama.

**Update yang diperlukan:**
- `lib/post-card-templates.ts`: ubah `publishedAt: Date | null` → `publishedAt: string | null`
- Semua card component: formatter berubah dari `new Intl.DateTimeFormat().format(date)` menjadi
  `new Intl.DateTimeFormat().format(new Date(date))` — atau gunakan helper `fmtDate(str: string | null)`

```typescript
// Pattern formatter di semua card component:
const fmt = (date: string | null) =>
  date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" })
         .format(new Date(date)) : "";
```

---

## Section Title Global — `PostsSectionTitle`

Semua design **kecuali Design 1 (hero)** wajib pakai komponen ini.

### Visual

```
Gallery IKPM Subang ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  Lihat Semua ›
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
(heading + garis bawah primary)  (dashed line flex-1)    (link — selalu ada)
```

- Heading di kiri: `font-bold`, underline `border-b-2 border-primary`
- Dashed line: `flex-1 border-t border-dashed` mengisi ruang di antara
- "Lihat Semua ›": **selalu tampil** untuk section type — `filterHref` dijamin terisi

### Props

```typescript
type Props = {
  title:      string;
  href:       string;          // wajib untuk section type — tidak pernah kosong
  linkLabel?: string;          // default "Lihat Semua"
  as?:        "h2" | "h3";    // default "h2" — Design 4 pakai "h3" per kolom
  className?: string;
};
```

### Implementasi

```typescript
// components/website/public/sections/posts/posts-section-title.tsx
import { cn } from "@/lib/utils";

type Props = {
  title:      string;
  href:       string;
  linkLabel?: string;
  as?:        "h2" | "h3";
  className?: string;
};

export function PostsSectionTitle({
  title,
  href,
  linkLabel = "Lihat Semua",
  as: Tag = "h2",
  className,
}: Props) {
  return (
    <div className={cn("flex items-center gap-3 mb-4", className)}>
      <Tag className="shrink-0 text-xl font-bold border-b-2 border-primary pb-1">
        {title}
      </Tag>
      <div className="flex-1 border-t border-dashed border-gray-300 self-end mb-1" />
      <a
        href={href}
        className="shrink-0 text-sm text-muted-foreground hover:text-primary
                   flex items-center gap-0.5 whitespace-nowrap"
      >
        {linkLabel}
        <span aria-hidden className="ml-0.5">›</span>
      </a>
    </div>
  );
}
```

`href` sekarang bukan optional — di-pass wajib dari wrapper yang sudah menjamin nilainya.

### Aturan Penggunaan

| Design | Pakai `PostsSectionTitle`? | Catatan |
|--------|---------------------------|---------|
| Design 1 — Hero 3 Kolom | ❌ Tidak | Hero tidak punya section header standar |
| Design 2 — Klasik | ✅ Ya | `title={sectionTitle}` `href={filterHref}` |
| Design 3 — Twin Columns | ✅ Ya | Sama dengan Design 2 |
| Design 4 — Trio Column | ✅ Ya | Per kolom: `as="h3"` + optional h2 di atas |
| Design 5 — Post Carousel | ✅ Ya | Sama dengan Design 2 |

---

## Integrasi dengan Landing Template

```typescript
// Di dalam switch case saat render section di landing-template.tsx:
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

---

## Integrasi dengan Section Editor (Dashboard)

Section editor `section-editors.tsx` untuk type `"posts"`:

- **Design picker**: 5 tombol design (variant) — sudah ada ✅
- **data.title**: input teks — judul manual section
- **data.count**: combobox 3/6/9/12
- **data.categoryId**: combobox pilih kategori (autocomplete)
- **data.tagId**: combobox pilih tag (autocomplete) — opsional, tambahan setelah kategori

```
┌──────────────────────────────────────────────┐
│  Edit Section: Postingan                     │
│                                              │
│  Judul section: [Berita Terkini__________]   │
│  Jumlah post:   [6 ▾]                        │
│  Filter kategori: [Semua kategori ▾]         │
│  Filter tag:      [Semua tag ▾]              │
└──────────────────────────────────────────────┘
```

Jika `data.title` kosong dan admin memilih kategori/tag → section otomatis menggunakan
nama kategori/tag sebagai judul. Admin tidak harus isi judul manual.

---

## Detail per Design

### Design 1 — Hero 3 Kolom ✅ SELESAI

```
┌─────────────────┬────────────────────┬─────────────────┐
│  KOLOM KIRI     │   KOLOM TENGAH     │  KOLOM KANAN    │
│  (5 terkini)    │  (5 unggulan)      │  (5 terkini)    │
│                 │                    │                 │
│ [klasik]        │ [overlay]          │ [klasik]        │
│ [judul]         │ [list]             │ [judul]         │
│ [judul]         │ [list]             │ [judul]         │
│ [judul]         │ [list]             │ [judul]         │
│ [judul]         │ [list]             │ [judul]         │
└─────────────────┴────────────────────┴─────────────────┘
```

| Kolom | Sumber Data | Posisi | Variant |
|-------|-------------|--------|---------|
| Kiri  | `posts[0]`   | pertama | `klasik` |
| Kiri  | `posts[1–4]` | kedua–kelima | `judul` |
| Tengah | `featuredPosts[0]` | pertama | `overlay` |
| Tengah | `featuredPosts[1–4]` | kedua–kelima | `list` |
| Kanan | `posts[5]`   | pertama | `klasik` |
| Kanan | `posts[6–9]` | kedua–kelima | `judul` |

- `excludeFeatured: true` di fetch kiri/kanan agar tidak overlap kolom tengah
- Jika `featuredPosts` kosong → kolom tengah fallback ke `posts.slice(0, 5)` dengan variant `list`
- Grid: `grid-cols-[1fr_1.4fr_1fr]` — tengah sedikit lebih lebar

---

### Design 2 — Klasik

```
┌──────────────────────────────────────────────────────────┐
│  Nama Kategori ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  Lihat Semua ›│
├──────────────────────────┬───────────────────────────────┤
│  [GAMBAR 50%]            │  [Kategori badge]             │
│                          │  Judul Post Besar (text-2xl)  │
│                          │  Ringkasan singkat...         │
│                          │  DD Bulan YYYY                │
├──────────────────────────┴──────────────────────────────-┤
│  KOLOM KIRI (5 posts)    │  KOLOM KANAN (5 posts)        │
│  [list card]             │  [list card]                  │
│  [list card]             │  [list card]                  │
│  [list card]             │  [list card]                  │
└──────────────────────────┴───────────────────────────────┘
```

| Posisi | Sumber | Render |
|--------|--------|--------|
| Featured (atas) | `posts[0]` | Inline — gambar 50% + teks 50%, judul `text-2xl`, tanpa `<PostCard>` |
| Kolom kiri | `posts[1–5]` | `<PostCard variant="list">` |
| Kolom kanan | `posts[6–10]` | `<PostCard variant="list">` |

- Featured **tidak** pakai `<PostCard>` — layout unik (gambar kiri 50%, judul besar, ada excerpt lengkap)
- Fetch: `fetchRecentPosts` count=11, `excludeFeatured=false`
- `sectionTitle` sudah di-resolve wrapper — tinggal di-pass ke `PostsSectionTitle`

```typescript
// components/website/public/sections/posts/posts-design-2.tsx
import { PostCard } from "@/components/website/public/post-cards/post-card";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

const fmtDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : "";

export function PostsDesign2({ data, posts, tenantSlug, sectionTitle, filterHref }: PostsSectionProps) {
  const featured   = posts[0];
  const leftPosts  = posts.slice(1, 6);
  const rightPosts = posts.slice(6, 11);

  return (
    <section className="w-full">
      <PostsSectionTitle title={sectionTitle} href={filterHref} />

      {featured && (
        <a href={`/${tenantSlug}/post/${featured.slug}`}
          className="flex gap-4 mb-6 group">
          <div className="w-1/2 shrink-0 aspect-video overflow-hidden rounded-lg bg-muted">
            {featured.coverUrl
              ? <img src={featured.coverUrl} alt={featured.title}
                     className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              : <div className="w-full h-full bg-muted" />}
          </div>
          <div className="w-1/2 flex flex-col gap-2">
            {featured.categoryName && (
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                {featured.categoryName}
              </span>
            )}
            <h3 className="text-2xl font-bold leading-tight line-clamp-3 group-hover:text-primary">
              {featured.title}
            </h3>
            {featured.excerpt && (
              <p className="text-sm text-muted-foreground line-clamp-3">{featured.excerpt}</p>
            )}
            {featured.publishedAt && (
              <p className="text-xs text-muted-foreground mt-auto">{fmtDate(featured.publishedAt)}</p>
            )}
          </div>
        </a>
      )}

      {leftPosts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 border-t pt-4">
          <div>
            {leftPosts.map(p => <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />)}
          </div>
          {rightPosts.length > 0 && (
            <div className="border-l pl-6">
              {rightPosts.map(p => <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

---

### Design 3 — Twin Columns

```
┌──────────────────────────────────────────── Lihat Semua ›┐
│  Nama Kategori / Tag                                     │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────┬───────────────────────────────┐
│  KOLOM KIRI (5 posts)    │  KOLOM KANAN (5 posts)        │
│  [list card]             │  [list card]                  │
│  [list card]             │  [list card]                  │
│  [list card]             │  [list card]                  │
└──────────────────────────┴───────────────────────────────┘
```

- Tidak ada featured post atas — langsung 2 kolom dari post pertama
- Kedua kolom lebar sama (`grid-cols-2`)
- Fetch: `fetchRecentPosts` count=10, `excludeFeatured=false`

```typescript
// components/website/public/sections/posts/posts-design-3.tsx
import { PostCard } from "@/components/website/public/post-cards/post-card";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

export function PostsDesign3({ posts, tenantSlug, sectionTitle, filterHref }: PostsSectionProps) {
  const leftPosts  = posts.slice(0, 5);
  const rightPosts = posts.slice(5, 10);

  return (
    <section className="w-full">
      <PostsSectionTitle title={sectionTitle} href={filterHref} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div>
          {leftPosts.map(p => <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />)}
        </div>
        {rightPosts.length > 0 && (
          <div className="border-l pl-6">
            {rightPosts.map(p => <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />)}
          </div>
        )}
      </div>
    </section>
  );
}
```

---

### Design 4 — Trio Column ⏳ EKSEKUSI TERAKHIR

Analog Design 3 tetapi **3 kolom** dengan **filter independen per kolom**.
Section editor membutuhkan 3 combobox kategori/tag — kompleksitas lebih tinggi.
Implementasi setelah Design 2, 3, 5 selesai dan diverifikasi.

```
┌───────────────┬───────────────┬───────────────┐
│ Berita  Semua›│ Opini   Semua›│ Pendidikan All›│
│ [list card]   │ [list card]   │ [list card]   │
│ [list card]   │ [list card]   │ [list card]   │
│ ... (5 item)  │ ... (5 item)  │ ... (5 item)  │
└───────────────┴───────────────┴───────────────┘
```

Data model:
```typescript
{
  title:   "",
  count:   5,
  columns: [
    { categoryId: "uuid-berita",     count: 5 },
    { categoryId: "uuid-opini",      count: 5 },
    { categoryId: "uuid-pendidikan", count: 5 },
  ]
}
```

---

### Design 5 — Post Carousel

```
┌──────────────────────────────────────── Lihat Semua ›┐
│  Gallery IKPM Subang                                 │
└──────────────────────────────────────────────────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──...
│ [gambar  │ │ [gambar  │ │ [gambar  │ │ [gambar  │ │
│  penuh   │ │  penuh   │ │  penuh   │ │  penuh   │ │
│  3:4]    │ │  3:4]    │ │  3:4]    │ │  3:4]    │ │
│ ████████ │ │ ████████ │ │ ████████ │ │ ████████ │ │
│ Judul    │ │ Judul    │ │ Judul    │ │ Judul    │ │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──...
← scroll horizontal →
```

| Breakpoint | Card terlihat |
|------------|---------------|
| Mobile | 1.5 card — peek di kanan |
| Tablet (sm) | 3 card |
| Desktop (lg) | 5 card |

- **`"use client"`** — butuh `useRef` untuk kontrol scroll tombol prev/next
- `PostsDesign5` menerima `PostCardData[]` dari server (sudah di-serialize)
- Karena `PostCardData.publishedAt` sudah `string | null`, aman di-pass ke client component

```typescript
// components/website/public/sections/posts/posts-design-5.tsx
"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PostCard } from "@/components/website/public/post-cards/post-card";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

export function PostsDesign5({ posts, tenantSlug, sectionTitle, filterHref }: PostsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });

  return (
    <section className="w-full">
      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <PostsSectionTitle title={sectionTitle} href={filterHref} className="mb-0" />
        </div>
        <div className="flex items-center gap-1 shrink-0 pb-1">
          <button type="button" onClick={() => scroll("left")} aria-label="Sebelumnya"
            className="p-1 rounded-full border hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => scroll("right")} aria-label="Berikutnya"
            className="p-1 rounded-full border hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-hide">
        {posts.map(p => (
          <div key={p.id}
            className="shrink-0 snap-start w-[72%] sm:w-[calc(33.333%-11px)] lg:w-[calc(20%-13px)]">
            <PostCard post={p} variant="overlay" tenantSlug={tenantSlug} className="aspect-[3/4]" />
          </div>
        ))}
      </div>
    </section>
  );
}
```

**`scrollbar-hide`** di Tailwind v4:
```css
@utility scrollbar-hide {
  &::-webkit-scrollbar { display: none; }
  scrollbar-width: none;
}
```

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
| `lib/post-card-templates.ts` | ✅ Selesai — `publishedAt: string \| null` |
| Semua card component (`fmt` function) | ✅ Selesai |
| `sections/posts/posts-section-title.tsx` | ✅ Selesai |
| `sections/posts/posts-section.tsx` (wrapper + fetch) | ✅ Selesai |
| `sections/posts/posts-design-1.tsx` | ✅ Selesai |
| `sections/posts/posts-design-2.tsx` | ✅ Selesai |
| `sections/posts/posts-design-3.tsx` | ✅ Selesai |
| `sections/posts/posts-design-5.tsx` | ✅ Selesai — auto-slide + pause on hover |
| Update `post-card-overlay.tsx` → `className?` prop | ✅ Selesai |
| `sections/posts/posts-design-4.tsx` | ✅ Selesai |
| `posts-section-wireframes.tsx` | ⬜ Belum |
| Refactor `landing-template.tsx` → pakai PostsSection | ⬜ Belum |
| Update `section-editors.tsx` → tagId combobox | ⬜ Belum |
| `app/api/ref/post-categories/route.ts` | ✅ Selesai |

---

## Catatan Implementasi

### resolveCovers — wajib `publicUrl(tenantSlug, path)`
`media.path` dari DB adalah raw MinIO key (contoh: `website/2026/04/uuid.jpg`).
Wajib di-wrap dengan `publicUrl(tenantSlug, path)` dari `lib/minio.ts`.
Tanpa ini, URL yang di-pass ke `<img>` atau `next/image` akan invalid.

### fetchRecentPosts — `excludeFeatured` hanya untuk hero design
Design 1 (hero) mengatur `excludeFeatured: true` agar kolom kiri/kanan tidak overlap dengan
kolom tengah yang pakai featured posts. Semua section-type design (2, 3, 4, 5) tidak perlu ini
— semua post published ditampilkan tanpa filter `isFeatured`.

### filterHref — selalu terisi untuk section type
`resolveFilterMeta` selalu mengembalikan `href` — jika tidak ada filter, fallback ke `/${tenantSlug}/post`.
`PostsSectionTitle` menerima `href` sebagai required prop (bukan optional), sehingga "Lihat Semua"
selalu tampil untuk section type.

### sectionTitle — tidak pernah kosong untuk section type
Urutan resolusi: `filterLabel` (nama kategori/tag) → `data.title` (judul manual admin) → `"Berita Terbaru"`.
Design tidak perlu handle kasus judul kosong.

### Design 5 — client component dan serialization
`PostsDesign5` adalah satu-satunya client component di sistem ini.
Data `PostCardData[]` di-pass sebagai props dari server (wrapper) → client (design).
`publishedAt: string | null` (bukan `Date`) memastikan serialization aman di boundary ini.

### Border — selalu pakai `border-border`, jangan `border` tanpa kelas warna
Tailwind `border-l`, `border-t` dll tanpa kelas warna eksplisit menggunakan warna default browser
(hitam), bukan token warna tema. Di dark mode atau tema kustom, hasilnya tidak konsisten.
**Aturan**: semua border dekoratif di section post wajib `border-border` secara eksplisit.
Contoh: `border-l border-border pl-4`, `border-t border-border pt-4`.

### Section count untuk Design 2 (Klasik) — set ke 11
Design 2 butuh 11 post: 1 featured + 5 kolom kiri + 5 kolom kanan.
Opsi `11` ditambahkan ke dropdown count di section editor.

### Design 5 — auto-slide + pause on hover
Carousel berjalan otomatis via `setInterval` (3 detik per slide).
Pause saat cursor masuk ke section via `onMouseEnter`/`onMouseLeave`.
Scroll dilakukan via `scrollLeft` imperatif — bukan CSS animation — agar bisa di-stop kapanpun.

### Section editor Design 4
Membutuhkan UI 3 combobox kategori/tag secara inline — berbeda dari Design 2/3 yang cukup
satu combobox. Ini sebabnya Design 4 dieksekusi terakhir setelah pattern section editor untuk
Design 2/3 sudah stabil.
