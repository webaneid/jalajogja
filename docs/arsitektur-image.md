# Arsitektur Global Image System — jalajogja

Dokumen ini mendefinisikan sistem gambar global: konversi WebP, auto-crop ke variant standar,
penyimpanan di MinIO, dan pembersihan file original.

Berlaku untuk **semua modul** — posts, pages, donasi, event, produk, anggota, media library.

**Entry point tunggal**: semua upload gambar di seluruh aplikasi melalui
`POST /api/media/upload?tenant={slug}&module={module}` — tidak ada jalur upload lain.

---

## Dasar Riset: Ukuran yang Disukai Google

| Platform | Rekomendasi | Rasio |
|----------|-------------|-------|
| Google Search (structured data Article/NewsArticle) | min 1200×630 | 1.91:1 |
| Google Discover | min 1080px lebar, ideal 1200×630 | 1.91:1 |
| Open Graph (`og:image`) — dipakai Google Search preview | 1200×630 | 1.91:1 |
| Google Merchant Center / Shopping | min 400×400, ideal 1200×1200 | 1:1 (square) |
| Twitter/X Card summary_large_image | 1200×675 | 16:9 |

**Kesimpulan riset:**
- Untuk **konten/artikel/berita**: rasio **1.91:1** pada lebar 1200px adalah standar universal
  yang memuaskan Google Search, Google Discover, dan OG preview sekaligus.
- Untuk **produk** (Google Shopping): **square 1:1** minimal 400×400.
- Untuk **foto profil**: **portrait 3:4** adalah standar identitas resmi (KTP, paspor, ID card).

---

## Enam Variant Standar

```
┌─────────────┬────────┬────────┬────────┬──────────────────────────────────┐
│ Variant     │ Lebar  │ Tinggi │ Rasio  │ Dipakai untuk                    │
├─────────────┼────────┼────────┼────────┼──────────────────────────────────┤
│ original    │ as-is  │ as-is  │ as-is  │ Backup — WebP tanpa crop         │
│ large       │ 1200px │  630px │ 1.91:1 │ Featured image, OG meta, Discover│
│ medium      │  800px │  420px │ 1.91:1 │ Card list, section preview       │
│ thumbnail   │  400px │  210px │ 1.91:1 │ Grid kecil, widget, admin list   │
│ square      │  400px │  400px │  1:1   │ Produk, avatar, icon             │
│ profile     │  300px │  400px │   3:4  │ Foto profil anggota IKPM         │
└─────────────┴────────┴────────┴────────┴──────────────────────────────────┘
```

**Pola dimensi**: `large → medium → thumbnail` adalah satu keluarga rasio yang sama (1.91:1),
ukurannya setengah dari sebelumnya. `square` dan `profile` adalah variant terpisah.

---

## Pemetaan Variant per Modul

| Modul / Konteks | Variant Utama | Fallback | Catatan |
|-----------------|---------------|----------|---------|
| Posts — featured image | `large` | `original` | OG meta wajib pakai `large` |
| Pages — featured image | `large` | `original` | |
| Donasi — featured image | `large` | `original` | |
| Event — featured image | `large` | `original` | |
| Produk — foto utama | `square` | `large` | Google Shopping standard |
| Produk — foto tambahan | `square` | `large` | |
| Anggota — foto profil | `profile` | `square` | Portrait 3:4 |
| Post card `klasik`/`ringkas` | `medium` | `large` | Aspect 16:9 via CSS |
| Post card `list` (gambar kecil) | `thumbnail` | `medium` | 120×90px display |
| Post card `overlay` | `medium` | `large` | |
| Post Carousel (Design 5) | `medium` | `large` | CSS override ke aspect-[3/4] |
| Admin media library grid | `thumbnail` | `path` | Lebih cepat untuk grid 6 kolom |
| Admin media picker thumbnail | `thumbnail` | `path` | 120px display |

**Catatan logo/favicon:** Logo dan favicon saat ini diisi via URL manual di Settings —
belum ada upload pipeline khusus. Saat diimplementasikan nanti, logo sebaiknya
di-bypass (simpan as-is sebagai PNG/SVG), bukan diproses ke 6 variant.
Bypass berbasis **MIME type**: `image/svg+xml` selalu bypass. PNG untuk logo
ditandai via `module=general` + ukuran file kecil (belum ada mekanisme eksplisit — catat sebagai open question).

---

## Format File: WebP Wajib

Semua gambar yang diproses **harus disimpan sebagai WebP**, kecuali file yang di-bypass:
- SVG (`image/svg+xml`) → simpan as-is, tidak diproses
- File non-gambar (PDF, video) → simpan as-is, tidak diproses

**Alasan WebP**: ukuran 25–35% lebih kecil dari JPEG dengan kualitas yang sama.
Ringan di server, lebih cepat di browser, didukung semua browser modern sejak 2022.

**Quality setting**: `quality: 85` untuk semua variant.

**MAX_SIZE**: 20 MB per file (bukan 10 MB) — input 20 MB menghasilkan 6 variant WebP
dengan ukuran total yang jauh lebih kecil. 10 MB terlalu ketat untuk foto resolusi tinggi.

---

## Pipeline Pemrosesan

```
[User upload via MediaShell / MediaPicker]
         │
         ▼
[POST /api/media/upload?tenant={slug}&module={module}]
         │
         ▼
[1. Auth check + tenant access check]
         │
         ▼
[2. Validasi MIME + ukuran file (max 20 MB)]
         │
         ▼
[3. Deteksi bypass: SVG atau non-gambar?]
         ├── Ya → simpan as-is ke MinIO, insert DB (processingStatus="bypass"), return
         └── Tidak → lanjut pipeline
         │
         ▼
[4. processImage(buffer) via Sharp — generate 6 variant]
   ├── original.webp  ← konversi saja, tanpa crop/resize
   ├── large.webp     ← resize + center crop ke 1200×630
   ├── medium.webp    ← resize + center crop ke 800×420
   ├── thumbnail.webp ← resize + center crop ke 400×210
   ├── square.webp    ← resize + center crop ke 400×400
   └── profile.webp   ← resize + center crop ke 300×400
         │
         ▼
[5. Upload semua variant ke MinIO — path: {module}/{year}/{month}/{uuid}_{suffix}.webp]
   Gunakan Promise.all — jika ada yang gagal, catch error, cleanup variant yang sudah terupload
         │
         ▼
[6. Insert row ke media table]
   path = variantPaths.large  (backward compat — kode lama yang belum pakai variants tetap bekerja)
   variants = { original, large, medium, thumbnail, square, profile } (path MinIO, bukan URL)
   processingStatus = "done"
   originalExpiresAt = NOW() + 10 hari
         │
         ▼
[7. Return response]
   { id, url, path, filename, originalName, mimeType, size, variants: { ...resolved URLs } }
         │
         ▼ (10 hari kemudian via cron job)
[8. Hapus file original (_ori) dari MinIO]
```

**Auto-crop strategy**: Sharp `fit: 'cover'`, `position: 'center'` — crop dari tengah.

**Rollback jika upload variant gagal**: jika salah satu `Promise.all` MinIO upload gagal,
hapus variant yang sudah terupload sebelum throw error (cleanup partial upload).

---

## Naming Convention File di MinIO

```
{module}/{year}/{month}/{uuid}_{suffix}.webp

Contoh:
website/2026/04/a1b2c3d4_ori.webp      ← original (WebP, no crop)
website/2026/04/a1b2c3d4_lg.webp       ← large
website/2026/04/a1b2c3d4_md.webp       ← medium
website/2026/04/a1b2c3d4_th.webp       ← thumbnail
website/2026/04/a1b2c3d4_sq.webp       ← square
website/2026/04/a1b2c3d4_pf.webp       ← profile

Untuk bypass (SVG, PDF, video):
general/2026/04/uuid.svg               ← as-is, no suffix
```

**Bucket per tenant**: `tenant-{slug}` — sudah ada di `lib/minio.ts` via `tenantBucket(slug)`.

---

## Perubahan Schema DB

Tambah 4 kolom baru ke `tenant_{slug}.media`:

```sql
-- Jalankan via create-tenant-schema.ts untuk tenant baru
-- Jalankan manual ALTER TABLE untuk tenant existing

ALTER TABLE "tenant_{slug}".media
  ADD COLUMN IF NOT EXISTS variants            JSONB,
  ADD COLUMN IF NOT EXISTS processing_status  TEXT NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS original_mime      TEXT,
  ADD COLUMN IF NOT EXISTS original_expires_at TIMESTAMPTZ;

-- processing_status: 'pending' | 'processing' | 'done' | 'failed' | 'bypass'
```

**Kolom `path` existing**: tetap diisi dengan path `large` (atau path as-is untuk bypass).
Ini menjaga backward compatibility dengan kode yang belum diupdate ke sistem variant.

**Struktur `variants` JSONB** (path MinIO, bukan URL — URL di-generate runtime via `publicUrl()`):

```json
{
  "original":  "website/2026/04/a1b2c3d4_ori.webp",
  "large":     "website/2026/04/a1b2c3d4_lg.webp",
  "medium":    "website/2026/04/a1b2c3d4_md.webp",
  "thumbnail": "website/2026/04/a1b2c3d4_th.webp",
  "square":    "website/2026/04/a1b2c3d4_sq.webp",
  "profile":   "website/2026/04/a1b2c3d4_pf.webp"
}
```

---

## Drizzle Schema Update

```typescript
// packages/db/src/schema/tenant/website.ts — createMediaTable()

export type ImageVariants = {
  original?:  string;
  large?:     string;
  medium?:    string;
  thumbnail?: string;
  square?:    string;
  profile?:   string;
};

// Tambah di dalam s.table("media", { ... }):
variants:             jsonb("variants").$type<ImageVariants>(),
processingStatus:     text("processing_status", {
  enum: ["pending", "processing", "done", "failed", "bypass"]
}).notNull().default("done"),
originalMime:         text("original_mime"),
originalExpiresAt:    timestamp("original_expires_at", { withTimezone: true }),
```

---

## lib/image-processor.ts

```typescript
// apps/web/lib/image-processor.ts
import sharp from "sharp";
import type { ImageVariants } from "@jalajogja/db"; // atau import lokal dari schema

export const IMAGE_VARIANTS = {
  large:     { width: 1200, height: 630  },
  medium:    { width: 800,  height: 420  },
  thumbnail: { width: 400,  height: 210  },
  square:    { width: 400,  height: 400  },
  profile:   { width: 300,  height: 400  },
} as const;

const WEBP_QUALITY = 85;

export type ProcessedVariants = {
  original:  Buffer;
  large:     Buffer;
  medium:    Buffer;
  thumbnail: Buffer;
  square:    Buffer;
  profile:   Buffer;
};

export function shouldBypass(mime: string): boolean {
  return mime === "image/svg+xml";
}

export async function processImage(inputBuffer: Buffer): Promise<ProcessedVariants> {
  const original = await sharp(inputBuffer)
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // Proses per-key, bukan positional destructuring — urutan Object.entries tidak dijamin
  const [large, medium, thumbnail, square, profile] = await Promise.all([
    sharp(inputBuffer).resize(1200, 630,  { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(800,  420,  { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(400,  210,  { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(400,  400,  { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(300,  400,  { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
  ]);

  return { original, large, medium, thumbnail, square, profile };
}
```

---

## lib/image-url.ts

```typescript
// apps/web/lib/image-url.ts
import { publicUrl } from "@/lib/minio";
import type { ImageVariants } from "@jalajogja/db"; // atau import lokal dari schema

export type ImageVariant = "original" | "large" | "medium" | "thumbnail" | "square" | "profile";

/**
 * Resolve URL lengkap untuk variant gambar tertentu.
 * Fallback chain: variant diminta → large → original → path lama (backward compat)
 */
export function getImageUrl(
  media: { path: string; variants?: ImageVariants | null },
  tenantSlug: string,
  variant: ImageVariant = "large",
): string | null {
  if (media.variants) {
    const path = media.variants[variant]
      ?? media.variants.large
      ?? media.variants.original;
    return path ? publicUrl(tenantSlug, path) : null;
  }
  // Fallback: media lama sebelum sistem variant (path = large URL)
  return media.path ? publicUrl(tenantSlug, media.path) : null;
}
```

---

## Update: MediaItem Type

```typescript
// components/media/media-picker.tsx — tambah field variants

export type MediaItem = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  altText: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  module: string;
  isUsed: boolean;
  createdAt: string;
  url: string;          // selalu path/large — backward compat
  variants?: Record<string, string> | null;  // resolved URLs per variant
};
```

`variants` di `MediaItem` berisi **resolved URLs** (bukan path MinIO) — di-resolve saat
list/upload response, sehingga client tidak perlu tahu tentang `publicUrl()`.

---

## Update: api/media/upload/route.ts

Perubahan dari versi existing:
1. Tambah `shouldBypass(mime)` check — SVG → simpan as-is
2. Jalankan `processImage(buffer)` untuk gambar non-SVG
3. Upload 6 variant ke MinIO dengan rollback jika partial failure
4. Insert DB dengan kolom `variants`, `processingStatus`, `originalMime`, `originalExpiresAt`
5. Response include `variants` (resolved URLs)
6. MAX_SIZE naik dari 10 MB ke 20 MB

**Konstruksi local state setelah upload** di `media-shell.tsx` dan `media-picker.tsx`
perlu ditambah `variants: data.variants ?? null` saat optimistic update.

---

## Update: api/media/delete/route.ts

Setelah variant system aktif, delete harus hapus **semua variant file** dari MinIO:

```typescript
// Ambil path + variants dari DB
const [media] = await tenantDb
  .select({ path: schema.media.path, variants: schema.media.variants })
  .from(schema.media)
  .where(eq(schema.media.id, mediaId));

// Hapus semua variant dari MinIO
const pathsToDelete = media.variants
  ? Object.values(media.variants).filter(Boolean) as string[]
  : [media.path];

await Promise.allSettled(
  pathsToDelete.map(p => deleteFile(slug, p))
);
// Gunakan allSettled — jangan biarkan satu file yang tidak ditemukan membatalkan semua
```

---

## Update: api/media/list/route.ts

Tambah resolved variant URLs ke response:

```typescript
const result = mediaList.map((m) => ({
  ...m,
  url: publicUrl(slug, m.path),   // tetap ada — backward compat
  variants: m.variants
    ? Object.fromEntries(
        Object.entries(m.variants).map(([k, v]) => [k, publicUrl(slug, v as string)])
      )
    : null,
  createdAt: m.createdAt.toISOString(),
}));
```

---

## Update: media-shell.tsx dan media-picker.tsx

**Grid display**: gunakan `thumbnail` variant jika tersedia — lebih cepat untuk grid 6 kolom.

```typescript
// Helper untuk resolve display URL di komponen:
function resolveDisplayUrl(item: MediaItem, variant: "thumbnail" | "url" = "thumbnail"): string {
  return item.variants?.[variant] ?? item.url;
}
```

Ganti semua `src={item.url}` di `GridView`, `ListView`, `MediaThumb` dengan `resolveDisplayUrl(item)`.

---

## Update: resolveCovers di posts-section.tsx

```typescript
async function resolveCovers(
  db: TenantDb["db"],
  schema: TenantDb["schema"],
  rows: { coverId: string | null }[],
  tenantSlug: string,
): Promise<Map<string, string>> {
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  if (!coverIds.length) return new Map();
  const media = await db
    .select({ id: schema.media.id, path: schema.media.path, variants: schema.media.variants })
    .from(schema.media)
    .where(inArray(schema.media.id, coverIds));
  return new Map(media.map(m => [m.id, getImageUrl(m, tenantSlug, "medium")]));
  //                                                              ^^^^^^^^
  //  Post card utama: medium (800×420) — sesuai pemetaan variant per modul
}
```

`fetchFeaturedPosts` perlu update yang sama — select `variants` + `getImageUrl(m, tenantSlug, "large")`.

---

## Cron Job: Cleanup Original Files

```typescript
// apps/web/app/api/cron/cleanup-images/route.ts
// Dipanggil harian via cron — auth via CRON_SECRET header

export async function GET(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenants = await db.select().from(publicSchema.tenants)
    .where(eq(publicSchema.tenants.status, "active"));
  let deleted = 0;

  for (const tenant of tenants) {
    const tenantClient = createTenantDb(tenant.slug);
    const { db: tenantDb, schema } = tenantClient;
    const expired = await tenantDb
      .select({ id: schema.media.id, variants: schema.media.variants })
      .from(schema.media)
      .where(and(
        eq(schema.media.processingStatus, "done"),
        lte(schema.media.originalExpiresAt, new Date()),
      ));

    for (const media of expired) {
      if (media.variants?.original) {
        // Pakai deleteFile() dari lib/minio.ts — bukan raw s3.send()
        await deleteFile(tenant.slug, media.variants.original);
        const { original: _, ...rest } = media.variants;
        await tenantDb.update(schema.media)
          .set({ variants: rest, originalExpiresAt: null })
          .where(eq(schema.media.id, media.id));
        deleted++;
      }
    }
  }

  return Response.json({ deleted });
}
```

---

## Urutan Eksekusi (Wajib Diikuti)

```
Step 1 — Drizzle schema update (website.ts — tambah 4 kolom + ImageVariants type)
Step 2 — DDL update create-tenant-schema.ts (ALTER TABLE ADD COLUMN)
Step 3 — ALTER TABLE manual untuk tenant existing (pc-ikpm-jogjakarta)
Step 4 — lib/image-processor.ts (Sharp logic — processImage + shouldBypass)
Step 5 — lib/image-url.ts (getImageUrl helper)
Step 6 — Update api/media/upload/route.ts (pipeline + bypass + rollback)
Step 7 — Update api/media/delete/route.ts (hapus semua variant)
Step 8 — Update api/media/list/route.ts (resolve variant URLs)
Step 9 — Update MediaItem type di media-picker.tsx (tambah variants field)
Step 10 — Update media-shell.tsx + media-picker.tsx (gunakan thumbnail di grid)
Step 11 — Update resolveCovers + fetchFeaturedPosts di posts-section.tsx (getImageUrl)
Step 12 — (Opsional) api/cron/cleanup-images/route.ts
```

Step 1–3 wajib selesai sebelum Step 6 dijalankan.
Step 5 wajib selesai sebelum Step 11.
Step 9 wajib selesai sebelum Step 10.

---

## Dependency

Sharp sudah terinstall: `"sharp": "^0.34.5"` di `apps/web/package.json`.
Tidak perlu install tambahan.

---

## Struktur File

```
apps/web/
├── lib/
│   ├── image-processor.ts         → processImage() + IMAGE_VARIANTS + shouldBypass()
│   └── image-url.ts               → getImageUrl() helper
├── app/api/media/
│   ├── upload/route.ts            → update: pipeline + bypass + rollback
│   ├── delete/route.ts            → update: hapus semua variant
│   ├── list/route.ts              → update: resolve variant URLs
│   └── [id]/metadata/route.ts    → tidak berubah
├── app/api/cron/
│   └── cleanup-images/route.ts   → baru: hapus expired originals
└── components/media/
    ├── media-picker.tsx           → update: MediaItem type + thumbnail display
    └── media-shell.tsx            → update: thumbnail display di grid

packages/db/src/schema/tenant/website.ts
  → update: createMediaTable() + ImageVariants type export

packages/db/src/helpers/create-tenant-schema.ts
  → update: DDL ALTER TABLE ADD COLUMN 4 kolom baru

apps/web/components/website/public/sections/posts/posts-section.tsx
  → update: resolveCovers + fetchFeaturedPosts gunakan getImageUrl()
```

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| Drizzle schema — 4 kolom baru + `ImageVariants` type | ✅ Selesai |
| DDL `create-tenant-schema.ts` | ✅ Selesai |
| `lib/image-processor.ts` | ✅ Selesai |
| `lib/image-url.ts` | ✅ Selesai |
| `api/media/upload/route.ts` — pipeline + bypass + rollback | ✅ Selesai |
| `api/media/delete/route.ts` — hapus semua variant | ✅ Selesai |
| `api/media/list/route.ts` — variant URLs di response | ✅ Selesai |
| `MediaItem` type — tambah `variants` | ✅ Selesai |
| `media-shell.tsx` + `media-picker.tsx` — thumbnail di grid | ✅ Selesai |
| `resolveCovers` + `fetchFeaturedPosts` — `getImageUrl()` | ✅ Selesai |
| `api/cron/cleanup-images/route.ts` | ✅ Selesai |

**TypeScript: 0 errors. Semua fase selesai.**

### Catatan Implementasi

- **Tenant existing sudah dimigrasikan**: `pc-ikpm-jogjakarta` sudah dapat 4 kolom baru via `ALTER TABLE` manual (2026-04-26). Media lama tetap bekerja via fallback `path` di `getImageUrl()` — `variants = NULL` ditangani gracefully.
- **Tenant baru**: 4 kolom sudah ada di `create-tenant-schema.ts` — otomatis saat provisioning.
- **`CRON_SECRET`**: wajib set di `.env` sebelum cron job aktif.
- **`resolveCovers`**: `fetchRecentPosts` menggunakan `"medium"`, `fetchFeaturedPosts` menggunakan `"large"`.
- **`resolveDisplayUrl`**: helper lokal di `media-shell.tsx` dan `media-picker.tsx` — prioritas thumbnail untuk grid.

---

## Keterkaitan dengan Dokumen Lain

| Dokumen | Keterkaitan |
|---------|-------------|
| `arsitektur-website.md` | Featured image posts/pages — pakai `large` via `getImageUrl()` |
| `arsitektur-template-post-card.md` | PostCardData.coverUrl — resolved dari `medium` (list) atau `large` (featured) |
| `arsitektur-section-post.md` | Design 5 Carousel — coverUrl dari `medium`, CSS override aspect ratio |
| `arsitektur-donasi.md` | Featured image campaign — pakai `large` |
| `arsitektur-event.md` | Featured image event — pakai `large` |
| `CLAUDE.md` § Media Library | Storage MinIO, bucket per tenant, path structure |
