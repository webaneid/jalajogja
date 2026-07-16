# Arsitektur Widget Area — jalakarta

Sistem **named widget area** — area konten yang bisa dikonfigurasi admin via
drag-and-drop section builder, dan bisa di-drop di mana saja di front-end publik
hanya dengan menyebut namanya.

Analogi WordPress: `dynamic_sidebar('default-sidebar')` atau `get_sidebar('footer')`.

**Instance pertama:** `default-sidebar` — tampil di sisi kanan halaman post (archive + detail).
Instance berikutnya bisa `post-bottom`, `homepage-banner`, `footer-widgets`, dll — tinggal
tambah config + drop `<WidgetArea id="..." />` di template yang sesuai.

---

## Konsep Utama

```
Admin konfigurasi widget area "default-sidebar":
  [Section: Berita Populer — filter: popular — limit: 5]
  [Section: Kategori Pilihan — filter: category → "Berita" — limit: 3]

Front-end publik cukup tulis:
  <WidgetArea id="default-sidebar" tenantSlug={slug} />

Komponen itu otomatis fetch config untuk area "default-sidebar",
render setiap section, di lokasi manapun ia diletakkan.
```

**Keunggulan naming approach ini:**
- Satu helper `fetchWidgetArea(id, tenantClient)` dipakai di semua template
- Nambah area baru = tidak butuh perubahan schema/DB
- Admin page bisa di-extend jadi "list semua widget area" di masa depan
- Testable secara independen — satu area, satu unit

---

## Schema Storage

Semua widget area disimpan dalam **satu key** di `tenant_{slug}.settings`:

```
key   = "widget_areas"
group = "website"
value = {
  "default-sidebar": [ SidebarSection, ... ],
  "post-bottom":     [ SidebarSection, ... ],   ← masa depan
  "footer-widgets":  [ SidebarSection, ... ],   ← masa depan
}
```

Satu key, satu JSON object, semua area ada di sana.

### Type: `WidgetAreas`

```typescript
// lib/widget-areas.ts

export type WidgetAreas = Record<string, SidebarSection[]>;

export type SidebarSection = {
  id:    string;               // nanoid(8) — stable key untuk DnD + React key
  type:  "posts";              // satu-satunya type Phase 1, extensible ke depan
  label: string;               // heading section, misal "Berita Populer"
  filter: {
    by:         "recent" | "popular" | "category" | "tag";
    categoryId: string | null;  // diisi jika by = "category"
    tagId:      string | null;  // diisi jika by = "tag"
  };
  limit: number;               // 1–10
};
```

**Extensibility `type`**: disiapkan untuk section jenis lain seperti `"html"`, `"banner"`,
`"social_links"`, dll. Renderer `WidgetArea` cukup tambah case baru tanpa ubah storage.

---

## Helper: `lib/widget-areas.ts`

```typescript
// apps/web/lib/widget-areas.ts
import { getSetting, upsertSetting } from "@jalajogja/db";
import type { TenantDb } from "@jalajogja/db";

export type SidebarSection = { ... };   // seperti di atas
export type WidgetAreas = Record<string, SidebarSection[]>;

const SETTINGS_KEY   = "widget_areas";
const SETTINGS_GROUP = "website";

/** Ambil semua widget areas dari settings. Return {} jika belum ada. */
export async function getWidgetAreas(tenantClient: TenantDb): Promise<WidgetAreas> {
  const raw = await getSetting(tenantClient, SETTINGS_KEY, SETTINGS_GROUP);
  return raw ? (JSON.parse(raw) as WidgetAreas) : {};
}

/** Ambil sections untuk satu area. Return null jika area belum dikonfigurasi. */
export async function fetchWidgetArea(
  id:           string,
  tenantClient: TenantDb,
): Promise<SidebarSection[] | null> {
  const areas = await getWidgetAreas(tenantClient);
  const sections = areas[id];
  return sections && sections.length > 0 ? sections : null;
}

/** Simpan sections untuk satu area (upsert — tidak overwrite area lain). */
export async function saveWidgetArea(
  id:           string,
  sections:     SidebarSection[],
  tenantClient: TenantDb,
): Promise<void> {
  const areas = await getWidgetAreas(tenantClient);
  areas[id]   = sections;
  await upsertSetting(tenantClient, SETTINGS_KEY, SETTINGS_GROUP, JSON.stringify(areas));
}
```

---

## Public Component: `<WidgetArea>`

```typescript
// components/website/public/widget-area.tsx — SERVER component

import { createTenantDb } from "@jalajogja/db";
import { fetchWidgetArea } from "@/lib/widget-areas";
import { fetchSidebarPosts } from "@/lib/widget-areas";
import { PostCardList } from "@/components/website/public/post-cards/post-card-list";

type Props = {
  id:          string;     // "default-sidebar", "post-bottom", dll
  tenantSlug:  string;
  className?:  string;
};

export async function WidgetArea({ id, tenantSlug, className }: Props) {
  const tenantClient = createTenantDb(tenantSlug);
  const sections     = await fetchWidgetArea(id, tenantClient);
  if (!sections) return null;

  const { db, schema } = tenantClient;

  // Fetch semua sections paralel
  const allPosts = await Promise.all(
    sections.map(s => fetchSidebarPosts(db, schema, s))
  );

  // Resolve covers batch (kumpulkan semua coverIds, satu query media)
  // ... resolveCovers logic sama seperti di posts-section.tsx

  return (
    <div className={className}>
      {sections.map((section, i) => (
        <div key={section.id} className="mb-8 last:mb-0">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-3 pb-2 border-b border-border">
            {section.label}
          </h3>
          {allPosts[i].map(post => (
            <PostCardList key={post.id} post={post} tenantSlug={tenantSlug} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Cara pakai di mana saja

```tsx
// Di post archive — sisi kanan
<aside className="w-72 shrink-0 hidden lg:block">
  <WidgetArea id="default-sidebar" tenantSlug={slug} />
</aside>

// Di bawah artikel — full width
<div className="mt-12 border-t border-border pt-8">
  <WidgetArea id="post-bottom" tenantSlug={slug} />
</div>

// Di homepage — kolom tertentu
<WidgetArea id="homepage-promo" tenantSlug={slug} className="col-span-1" />
```

---

## `fetchSidebarPosts` — di dalam `lib/widget-areas.ts`

```typescript
export async function fetchSidebarPosts(
  db:      ReturnType<typeof createTenantDb>["db"],
  schema:  ReturnType<typeof createTenantDb>["schema"],
  section: SidebarSection,
): Promise<PostCardData[]> {
  const baseSelect = {
    id:           schema.posts.id,
    title:        schema.posts.title,
    slug:         schema.posts.slug,
    excerpt:      schema.posts.excerpt,
    coverId:      schema.posts.coverId,
    publishedAt:  schema.posts.publishedAt,
    isFeatured:   schema.posts.isFeatured,
    categoryName: schema.postCategories.name,
  };

  switch (section.filter.by) {
    case "popular":
      return db.select(baseSelect)
        .from(schema.posts)
        .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
        .where(eq(schema.posts.status, "published"))
        .orderBy(desc(schema.posts.viewCount))   // ← memanfaatkan view counter
        .limit(section.limit);

    case "category":
      return db.select(baseSelect)
        .from(schema.posts)
        .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
        .where(and(
          eq(schema.posts.status, "published"),
          section.filter.categoryId
            ? eq(schema.posts.categoryId, section.filter.categoryId)
            : undefined,
        ))
        .orderBy(desc(schema.posts.publishedAt))
        .limit(section.limit);

    case "tag":
      return db.select(baseSelect)
        .from(schema.posts)
        .innerJoin(schema.postTagPivot, eq(schema.postTagPivot.postId, schema.posts.id))
        .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
        .where(and(
          eq(schema.posts.status, "published"),
          section.filter.tagId
            ? eq(schema.postTagPivot.tagId, section.filter.tagId)
            : undefined,
        ))
        .orderBy(desc(schema.posts.publishedAt))
        .limit(section.limit);

    default: // "recent"
      return db.select(baseSelect)
        .from(schema.posts)
        .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
        .where(eq(schema.posts.status, "published"))
        .orderBy(desc(schema.posts.publishedAt))
        .limit(section.limit);
  }
}
```

---

## Admin UI — `/website/pengaturan`

### Route & File

```
app/(dashboard)/[tenant]/website/
└── pengaturan/
    └── page.tsx            → server: fetch widget areas config + kategori + tag
                              render <WidgetAreaBuilder id="default-sidebar" ... />

components/website/
└── widget-area-builder.tsx → CLIENT: DnD + form per section untuk satu area
```

### `page.tsx` (server component)

```typescript
const tenantClient = createTenantDb(slug);
const areas        = await getWidgetAreas(tenantClient);
const sections     = areas["default-sidebar"] ?? [];

// Fetch untuk populate combobox
const categories = await db.select({ id: ..., name: ... }).from(schema.postCategories)...;
const tags       = await db.select({ id: ..., name: ... }).from(schema.postTags)...;

return (
  <div className="p-6 space-y-6">
    <h1 className="text-2xl font-bold">Pengaturan Website</h1>
    <div>
      <h2 className="text-lg font-semibold mb-4">Sidebar Default</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Tampil di halaman post (arsip & detail), sisi kanan pada layar lebar.
      </p>
      <WidgetAreaBuilder
        areaId="default-sidebar"
        slug={slug}
        initialSections={sections}
        categories={categories}
        tags={tags}
      />
    </div>
  </div>
);
```

### `WidgetAreaBuilder` (client component)

**Dependency**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`

```
┌─────────────────────────────────────────────────────┐
│  Sidebar Default                                    │
│  Tampil di: arsip post + detail post (layar lebar)  │
│                                                     │
│  ⠿  ┌─ Section ─────────────────────────────────┐  │
│     │  Label   [Berita Populer              ]    │  │
│     │  Filter  [Terpopuler ▼              ]      │  │
│     │  Jumlah  [ 5 ]                             │  │
│     │                          [× Hapus]         │  │
│     └────────────────────────────────────────────┘  │
│                                                     │
│  [+ Tambah Section]                                 │
│                                                     │
│  [Simpan]                                           │
└─────────────────────────────────────────────────────┘
```

**Filter options** (Combobox sesuai UI Standard — bukan plain `<select>`):
| Value | Label | Extra |
|-------|-------|-------|
| `recent` | Terbaru | — |
| `popular` | Terpopuler | — |
| `category` | Per Kategori | Combobox kategori muncul |
| `tag` | Per Tag | Combobox tag muncul |

### Server Action

```typescript
// website/actions.ts — tambah:
export async function saveWidgetAreaAction(
  slug:     string,
  areaId:   string,
  sections: SidebarSection[],
) {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Unauthorized" };

  const tenantClient = createTenantDb(slug);
  await saveWidgetArea(areaId, sections, tenantClient);
  revalidatePath(`/${slug}/website/pengaturan`);
  return { success: true };
}
```

---

## Integrasi ke Halaman Publik

### Default-sidebar di post pages

Layout post archive dan post detail menggunakan flex container + `<aside>`:

```tsx
// post/page.tsx dan post/[slug]/page.tsx
<div className="max-w-7xl mx-auto px-4 py-10 flex gap-8 items-start">
  <div className="flex-1 min-w-0">
    {/* konten utama */}
  </div>
  <aside className="w-72 shrink-0 hidden lg:block">
    <WidgetArea id="default-sidebar" tenantSlug={slug} />
    {/* WidgetArea return null jika belum dikonfigurasi — aside kosong tidak masalah */}
  </aside>
</div>
```

`WidgetArea` return `null` jika area belum dikonfigurasi → `<aside>` otomatis collapse
karena empty (tidak ada anak yang mengambil ruang).

**Atau** lebih eksplisit: fetch dulu, baru render `<aside>` kondisional:

```tsx
// Lebih eksplisit — aside tidak dirender jika kosong
const tenantClient = createTenantDb(slug);
const hasSidebar   = (await fetchWidgetArea("default-sidebar", tenantClient)) !== null;

// ...
{hasSidebar && (
  <aside className="w-72 shrink-0 hidden lg:block">
    <WidgetArea id="default-sidebar" tenantSlug={slug} />
  </aside>
)}
```

**Rekomendasi**: pakai pendekatan kedua — mencegah render `<aside>` kosong yang bisa
mengganggu layout flex bahkan saat tidak ada konten.

---

## Navigation Update

```typescript
// components/website/website-nav.tsx

const NAV_ITEMS = [
  { label: "Dashboard",   icon: LayoutDashboard, path: ""              },
  { label: "Posts",       icon: FileText,         path: "/posts"        },
  { label: "Halaman",     icon: FileStack,         path: "/pages"        },
  { label: "Kategori",    icon: Tag,               path: "/categories"   },
  { label: "Pesan",       icon: Inbox,             path: "/pesan"        },
  { label: "Pengaturan",  icon: Settings,          path: "/pengaturan"   }, // ← BARU (aktif)
  // Komentar dihapus — coming soon ditambah ke Pengaturan nanti
] as const;
```

---

## Dependency Baru

```bash
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

`@dnd-kit` dipilih karena:
- Accessibility-first (keyboard navigation bawaan)
- Tidak butuh `position: fixed` atau portal — safe di Next.js
- Client boundary hanya di builder, bukan di page
- Standard de facto untuk DnD di React ecosystem

---

## Urutan Eksekusi

```
Step 1 — Install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
Step 2 — Buat lib/widget-areas.ts:
         - Types: SidebarSection, WidgetAreas
         - Helpers: getWidgetAreas, fetchWidgetArea, saveWidgetArea, fetchSidebarPosts
Step 3 — Buat components/website/public/widget-area.tsx (server component)
Step 4 — Buat components/website/widget-area-builder.tsx (client, DnD)
Step 5 — Tambah saveWidgetAreaAction ke website/actions.ts
Step 6 — Buat app/(dashboard)/[tenant]/website/pengaturan/page.tsx
Step 7 — Update website-nav.tsx: ganti Komentar → Pengaturan (dengan icon Settings)
Step 8 — Update post/page.tsx: flex layout + <WidgetArea id="default-sidebar" />
Step 9 — Update post/[slug]/page.tsx: flex layout + <WidgetArea id="default-sidebar" />
Step 10 — TypeScript check (tsc --noEmit)
```

---

## Struktur File

```
apps/web/
├── lib/
│   └── widget-areas.ts                          → BARU: types + semua helpers
├── components/website/
│   ├── widget-area-builder.tsx                  → BARU: CLIENT, DnD builder admin
│   └── public/
│       └── widget-area.tsx                      → BARU: SERVER, render di publik
└── app/
    ├── (dashboard)/[tenant]/website/
    │   ├── website-nav.tsx                      → UPDATE: Komentar → Pengaturan
    │   ├── pengaturan/
    │   │   └── page.tsx                         → BARU: server, fetch + render builder
    │   └── actions.ts                           → UPDATE: tambah saveWidgetAreaAction
    └── (public)/[tenant]/
        ├── post/page.tsx                        → UPDATE: flex layout + WidgetArea
        └── post/[slug]/page.tsx                 → UPDATE: flex layout + WidgetArea
```

---

## Registri Widget Areas (Masa Depan)

Saat ada lebih dari satu area, admin page bisa tampilkan daftar semua area:

```
Pengaturan Website
├── Sidebar Default     → dipakai di: post archive, post detail
├── Bawah Artikel       → dipakai di: post detail (setelah konten)
├── Footer Kiri         → dipakai di: semua halaman
└── + Tambah Area       → custom label + id
```

Tidak perlu perubahan schema — sudah ditampung dalam satu JSONB object.

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| `lib/widget-areas.ts` | ⬜ Belum |
| `components/website/public/widget-area.tsx` | ⬜ Belum |
| `components/website/widget-area-builder.tsx` | ⬜ Belum |
| `saveWidgetAreaAction` di `website/actions.ts` | ⬜ Belum |
| `website/pengaturan/page.tsx` | ⬜ Belum |
| `website-nav.tsx` update | ⬜ Belum |
| Integrasi `post/page.tsx` | ⬜ Belum |
| Integrasi `post/[slug]/page.tsx` | ⬜ Belum |
