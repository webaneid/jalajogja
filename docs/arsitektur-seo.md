# Arsitektur SEO — jalajogja

Dokumen ini mencakup:
1. **Arsitektur SEO saat ini** — file yang sudah ada dan perannya
2. **Bug yang ditemukan** — dua bug di `lib/seo.ts` yang perlu difix
3. **Rencana konten terkait** — Related Posts di halaman post detail
4. **Twitter Card** — perbaikan format gambar

---

## Bagian 1: Arsitektur SEO Saat Ini

### File utama

| File | Peran |
|------|-------|
| `apps/web/lib/seo.ts` | Helper `generateMetadata()` universal + JSON-LD generators |
| `apps/web/lib/seo-defaults.ts` | Konstanta: `TITLE_MAX_LENGTH`, `OG_IMAGE_WIDTH/HEIGHT`, `DEFAULT_OG_TYPE`, dll |
| `apps/web/lib/tenant-seo.ts` | `getTenantSeoBase(slug)` — baseUrl, siteName, description, logoUrl dari DB |
| `packages/db/src/helpers/settings.ts` | `getSettings()` / `getSetting()` — baca settings tenant |

### Pola `generateMetadata` di setiap halaman publik

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const base = await getTenantSeoBase(slug);
  return buildMetadata({
    title:        "...",
    description:  "...",
    siteName:     base.siteName,
    canonicalUrl: `${base.baseUrl}/post/${slug}`,
    ogImageUrl:   coverUrl ?? base.logoUrl,
    ogType:       "article",          // ← MASALAH: tidak dipakai (lihat Bug 1)
  });
}
```

### `getTenantSeoBase()` — resolver URL kanonik

Menentukan `baseUrl` berdasarkan status custom domain:
- `customDomainStatus === "active"` → `baseUrl = "https://{customDomain}"`
- Lainnya → `baseUrl = "{APP_URL}/{slug}"`

Ini memastikan canonical tag selalu menunjuk ke domain yang benar.

### Halaman publik yang sudah punya `generateMetadata`

| Halaman | URL | Canonical | ogType |
|---------|-----|-----------|--------|
| Home | `/{slug}` | ✅ | website |
| Post detail | `/{slug}/post/{slug}` | ✅ | article (tidak terpakai, lihat Bug 1) |
| Post arsip | `/{slug}/post` | ✅ | website |
| Produk detail | `/{slug}/produk/{slug}` | ✅ | — |
| Produk arsip | `/{slug}/produk` | ✅ | — |
| Produk kategori | `/{slug}/produk/kategori/{slug}` | ✅ | — |
| Campaign detail | `/{slug}/campaign/{slug}` | ✅ | — |
| Campaign arsip | `/{slug}/campaign` | ✅ | — |
| Agenda/event detail | `/{slug}/agenda/{slug}` | ✅ | — |
| Agenda arsip | `/{slug}/agenda` | ✅ | — |
| Halaman statis (`/[pageSlug]`) | — | ⬜ Belum ada |
| Halaman publik CMS (`/[slug]/page`) | — | ⬜ Belum ada |

---

## Bagian 2: Bug yang Ditemukan di `lib/seo.ts`

### Bug 1: `og:type` tidak pernah dirender

**File:** `apps/web/lib/seo.ts` baris 180–190

**Masalah:** Parameter `ogType` di-destructure dan memiliki default value `"website"`, tapi **tidak pernah dimasukkan ke dalam objek `openGraph`**. Akibatnya `og:type` tidak ada di HTML head → Facebook tidak bisa membaca tipe konten → share preview tidak menampilkan judul/gambar dengan benar.

**Kode saat ini (bermasalah):**
```typescript
openGraph: {
  title: resolvedOgTitle,
  ...(resolvedOgDesc && { description: resolvedOgDesc }),
  siteName,
  locale,
  ...(canonicalUrl && { url: canonicalUrl }),
  ...(ogImageUrl && {
    images: [{ url: ogImageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }],
  }),
  // ← `type: ogType` TIDAK ADA DI SINI
},
```

**Fix yang perlu dilakukan:**
```typescript
openGraph: {
  type: ogType,                          // ← TAMBAHKAN INI
  title: resolvedOgTitle,
  ...(resolvedOgDesc && { description: resolvedOgDesc }),
  siteName,
  locale,
  ...(canonicalUrl && { url: canonicalUrl }),
  ...(ogImageUrl && {
    images: [{ url: ogImageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }],
  }),
},
```

Next.js menerima `type` sebagai salah satu field `OpenGraph` dari `next/dist/lib/metadata/types/opengraph-types.d.ts`. Nilai yang valid: `"website"`, `"article"`, `"book"`, `"profile"`, dll.

**Dampak perbaikan:**
- Halaman post (yang memanggil `ogType: "article"`) akan render `<meta property="og:type" content="article" />`
- Facebook Debugger akan membaca tipe dengan benar → preview kartu lengkap
- Halaman lain tetap mendapat `og:type = "website"` (default)

---

### Bug 2: Twitter `images` format string, bukan object

**File:** `apps/web/lib/seo.ts` baris 193–195

**Masalah:** Next.js `Metadata.twitter.images` mengharapkan array of objects dengan properti `url`, `width`, `height`, dan `alt` — bukan array of strings. String diterima tapi tanpa dimensi dan alt text, sehingga Twitter (X) tidak bisa render preview gambar secara optimal.

**Kode saat ini (kurang lengkap):**
```typescript
twitter: {
  card: twitterCard,
  title: resolvedOgTitle,
  ...(resolvedOgDesc && { description: resolvedOgDesc }),
  ...(ogImageUrl && { images: [ogImageUrl] }),  // ← string, bukan object
},
```

**Fix yang perlu dilakukan:**
```typescript
twitter: {
  card: twitterCard,
  title: resolvedOgTitle,
  ...(resolvedOgDesc && { description: resolvedOgDesc }),
  ...(ogImageUrl && {
    images: [{
      url:    ogImageUrl,
      width:  OG_IMAGE_WIDTH,   // 1200
      height: OG_IMAGE_HEIGHT,  // 630
      alt:    resolvedOgTitle,
    }],
  }),
},
```

**Mengapa penting:**
- Twitter card validator membaca dimensi untuk memilih layout kartu
- `alt` text diperlukan untuk aksesibilitas dan Twitter screen readers
- `OG_IMAGE_WIDTH` (1200) + `OG_IMAGE_HEIGHT` (630) sudah ada di `seo-defaults.ts` — tinggal dipakai

---

## Bagian 3: Rencana Konten Terkait (Related Posts)

### Konteks

Halaman post detail saat ini berakhir di tombol "Kembali ke Blog" tanpa rekomendasi konten lain. Ini menyebabkan bounce rate tinggi — pembaca selesai baca langsung keluar.

### Logika prioritas (fallback chain)

```
1. PRIORITAS PERTAMA — post dengan minimal 1 tag sama
   Label: "Konten Terkait"
   Query: JOIN post_tag_pivot WHERE tagId IN (tagIds dari post ini)
          AND postId != currentPostId

2. PRIORITAS KEDUA — post dari kategori yang sama (jika hasil #1 kosong)
   Label: "Konten Lain"
   Query: WHERE categoryId = currentCategoryId
          AND id != currentPostId

3. FALLBACK — semua post terbaru (jika #1 dan #2 keduanya kosong)
   Label: "Konten Lain"
   Query: ORDER BY publishedAt DESC, no filter kategori/tag
```

**Aturan:**
- Maksimal 5 post
- Hanya status `published`
- Exclude self (post yang sedang dibuka)
- Label hanya `"Konten Terkait"` (ada tag sama) atau `"Konten Lain"` (fallback)
- Jika 0 post tersedia di semua sumber → section tidak dirender sama sekali

### Query plan di server

```typescript
async function getRelatedPosts(
  tenantClient: ReturnType<typeof createTenantDb>,
  currentPostId: string,
  tagIds: string[],
  categoryId: string | null,
): Promise<{ posts: PostCardData[]; label: "Konten Terkait" | "Konten Lain" }> {

  const { db: tenantDb, schema } = tenantClient;
  const LIMIT = 5;

  // Sumber 1: tag sama
  if (tagIds.length > 0) {
    const rows = await tenantDb
      .selectDistinct({
        id:          schema.posts.id,
        title:       schema.posts.title,
        slug:        schema.posts.slug,
        excerpt:     schema.posts.excerpt,
        coverId:     schema.posts.coverId,
        publishedAt: schema.posts.publishedAt,
        categoryName: schema.postCategories.name,
      })
      .from(schema.posts)
      .innerJoin(schema.postTagPivot, eq(schema.postTagPivot.postId, schema.posts.id))
      .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
      .where(and(
        eq(schema.posts.status, "published"),
        ne(schema.posts.id, currentPostId),
        inArray(schema.postTagPivot.tagId, tagIds),
      ))
      .orderBy(desc(schema.posts.publishedAt))
      .limit(LIMIT);

    if (rows.length > 0) {
      return { posts: await resolveCoversForRelated(tenantClient, rows), label: "Konten Terkait" };
    }
  }

  // Sumber 2: kategori sama
  if (categoryId) {
    const rows = await tenantDb
      .select({ ... })
      .from(schema.posts)
      .leftJoin(schema.postCategories, ...)
      .where(and(
        eq(schema.posts.status, "published"),
        ne(schema.posts.id, currentPostId),
        eq(schema.posts.categoryId, categoryId),
      ))
      .orderBy(desc(schema.posts.publishedAt))
      .limit(LIMIT);

    if (rows.length > 0) {
      return { posts: await resolveCoversForRelated(tenantClient, rows), label: "Konten Lain" };
    }
  }

  // Sumber 3: fallback global
  const rows = await tenantDb
    .select({ ... })
    .from(schema.posts)
    .leftJoin(schema.postCategories, ...)
    .where(and(
      eq(schema.posts.status, "published"),
      ne(schema.posts.id, currentPostId),
    ))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(LIMIT);

  if (rows.length === 0) return { posts: [], label: "Konten Lain" };
  return { posts: await resolveCoversForRelated(tenantClient, rows), label: "Konten Lain" };
}
```

**Catatan `resolveCoversForRelated`:**
- Helper internal untuk fetch `media.path + media.variants` per `coverId`
- Pakai `resolveMediaUrl()` — jangan langsung pakai path relatif (lihat lessons `media.variants`)
- Collect semua `coverId` → satu query `inArray` → Map untuk lookup cepat

### Data yang perlu di-fetch di `getPost()`

Tambah ke query post yang sudah ada:
1. **Tags** — join `post_tag_pivot` + `post_tags` untuk dapat `tagId[]` dan `tagName[]`
2. **`categoryId`** — sudah ada di `schema.posts.categoryId` tapi belum di-select

```typescript
// Dalam getPost(), setelah query post:
const tagRows = await tenantDb
  .select({ tagId: schema.postTagPivot.tagId })
  .from(schema.postTagPivot)
  .where(eq(schema.postTagPivot.postId, post.id));

const tagIds = tagRows.map(r => r.tagId);
```

### Render — posisi dan komponen

**Posisi:** Antara "Footer artikel" (baris `Diterbitkan oleh` + `Diperbarui`) dan tombol "Kembali ke Blog".

**Komponen:** `PostCard` variant `list` — sudah ada di `components/website/public/post-cards/post-card.tsx`. Tidak perlu komponen baru.

```tsx
{/* Konten Terkait — hanya render jika ada post */}
{relatedPosts.posts.length > 0 && (
  <section className="mt-12 pt-8 border-t border-border">
    <h2 className="text-lg font-semibold mb-4">{relatedPosts.label}</h2>
    <div className="space-y-4">
      {relatedPosts.posts.map(p => (
        <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} sessionType="none" />
      ))}
    </div>
  </section>
)}
```

**Note `sessionType`:** Related posts selalu render `sessionType="none"` — tidak perlu cek session hanya untuk daftar artikel terkait (tidak ada harga tier).

### Schema tabel yang dipakai

```
post_tags (id, name, slug, tenantId)
post_tag_pivot (postId, tagId) — pivot many-to-many
```

Keduanya sudah ada di `packages/db/src/schema/tenant/website.ts` sebagai:
- `schema.postTags`
- `schema.postTagPivot`

---

## Bagian 4: Twitter Card

Twitter (X) card memanfaatkan tag OG yang sudah ada + tag `twitter:*` khusus.

**Tag yang sudah dirender via `lib/seo.ts`:**
- `twitter:card = summary_large_image` (default)
- `twitter:title`
- `twitter:description`
- `twitter:image` — **bug: format string, bukan object** (lihat Bug 2 di atas)

**Setelah fix Bug 2,** Twitter Card akan merender gambar dengan dimensi yang benar (1200×630) dan alt text dari judul post. Tidak ada perubahan arsitektur lain yang diperlukan — Next.js sudah mengurus rendering `<meta name="twitter:image:*">` dari format object.

**Validator:** https://cards-dev.twitter.com/validator — bisa dipakai setelah deploy untuk verifikasi.

---

## Ringkasan Perubahan yang Perlu Dilakukan

### File yang perlu diubah: `apps/web/lib/seo.ts`

**Perubahan 1 — Bug ogType:**
Tambah `type: ogType` ke dalam objek `openGraph` di fungsi `generateMetadata()`.

**Perubahan 2 — Bug Twitter images:**
Ganti `{ images: [ogImageUrl] }` menjadi `{ images: [{ url: ogImageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: resolvedOgTitle }] }`.

### File yang perlu diubah: `apps/web/app/(public)/[tenant]/post/[slug]/page.tsx`

**Perubahan 1 — Fetch tag post:**
Tambah query `post_tag_pivot` untuk mendapat `tagIds[]` dan `categoryId` dari post.

**Perubahan 2 — Tambah `getRelatedPosts()`:**
Fungsi baru dengan fallback chain: tags → kategori → global.

**Perubahan 3 — Render Related Posts:**
Section baru di antara footer artikel dan tombol "Kembali ke Blog".

### TypeScript constraint
Setelah implementasi, jalankan `bun tsc --noEmit` di `apps/web/` dan pastikan 0 error sebelum commit.

---

## Status Implementasi

| Item | Status |
|------|--------|
| Bug `og:type` di `lib/seo.ts` | ⬜ Menunggu approval |
| Bug Twitter `images` format | ⬜ Menunggu approval |
| Related Posts — query + render | ⬜ Menunggu approval |
| Deploy ke VPS | ⬜ Setelah approval |
