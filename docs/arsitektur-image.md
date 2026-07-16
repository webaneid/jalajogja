# Arsitektur Global Image System — jalakarta

Dokumen ini mendefinisikan sistem gambar global: konversi WebP, auto-crop ke variant standar,
penyimpanan di MinIO, dan pembersihan file original.

Berlaku untuk **semua modul** — posts, pages, donasi, event, produk, anggota, media library.

**Entry point tunggal**: semua upload gambar di seluruh aplikasi melalui
`POST /api/media/upload?tenant={slug}&module={module}` — tidak ada jalur upload lain.

> **Rencana optimasi pipeline:** `processImage()` saat ini generate semua 7 variant lalu filter,
> padahal setiap module hanya butuh subset. Rencana refactoring + client-side compression ada di
> **`docs/arsitektur-upload-pipeline.md`**.

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
┌──────────────┬────────┬────────┬────────┬──────────────────────────────────┐
│ Variant      │ Lebar  │ Tinggi │ Rasio  │ Dipakai untuk                    │
├──────────────┼────────┼────────┼────────┼──────────────────────────────────┤
│ original     │ as-is  │ as-is  │ as-is  │ Backup — WebP tanpa crop         │
│ large        │ 1200px │  630px │ 1.91:1 │ Featured image, OG meta, Discover│
│ medium       │  800px │  420px │ 1.91:1 │ Card list, section preview       │
│ thumbnail    │  400px │  210px │ 1.91:1 │ Grid kecil, widget, admin list   │
│ square       │  400px │  400px │  1:1   │ Produk kecil, avatar, icon       │
│ square-large │  800px │  800px │  1:1   │ Produk utama, galeri, OG produk  │
│ profile      │  300px │  400px │   3:4  │ Foto profil anggota IKPM         │
└──────────────┴────────┴────────┴────────┴──────────────────────────────────┘
```

**Pola dimensi**:
- Keluarga 1.91:1: `large → medium → thumbnail` — ukuran setengah dari sebelumnya
- Keluarga 1:1: `square` (400) → `square-large` (800) — untuk produk dan galeri
- Independen: `profile` (3:4) — khusus foto orang

---

## Pemetaan Variant per Modul

| Modul / Konteks | Variant Utama | Fallback | Catatan |
|-----------------|---------------|----------|---------|
| Posts — featured image | `large` | `original` | OG meta wajib pakai `large` |
| Pages — featured image | `large` | `original` | |
| Donasi — featured image | `large` | `original` | |
| Event — featured image | `large` | `original` | |
| Produk — foto utama (card besar) | `square-large` | `square` | 800×800 — Google Shopping ideal |
| Produk — foto utama (card kecil) | `square` | `square-large` | 400×400 — grid padat |
| Produk — foto tambahan (thumbnail) | `square` | `square-large` | |
| Anggota — foto profil | `profile` | `square` | Portrait 3:4 |
| Post card `klasik`/`ringkas` | `medium` | `large` | Aspect 16:9 via CSS |
| Post card `list` (gambar kecil) | `square` | `medium` | 96×96px display — square lebih rapi |
| Post card `overlay` | `medium` | `large` | |
| Post Carousel (Design 5) | `medium` | `large` | CSS override ke aspect-[3/4] |
| Event card — cover | `medium` | `large` | |
| Campaign card — cover | `medium` | `large` | |
| Admin media library grid | `thumbnail` | `path` | Lebih cepat untuk grid 6 kolom |
| Admin media picker thumbnail | `thumbnail` | `path` | 120px display |

**Catatan logo/favicon:** Logo dan favicon saat ini diisi via URL manual di Settings —
belum ada upload pipeline khusus. Saat diimplementasikan nanti, logo sebaiknya
di-bypass (simpan as-is sebagai PNG/SVG), bukan diproses ke 6 variant.
Bypass berbasis **MIME type**: `image/svg+xml` selalu bypass. PNG untuk logo
ditandai via `module=general` + ukuran file kecil (belum ada mekanisme eksplisit — catat sebagai open question).

---

## Module-Aware Variant Generation

Tidak semua modul butuh semua variant. Upload route membaca parameter `module` dan hanya
men-generate variant yang relevan. `ImageVariants` JSONB sudah handle partial variants
(semua field optional) — `getImageUrl()` fallback gracefully jika variant tidak ada.

### Aturan per Modul

| Module | Variant yang di-generate | Alasan |
|--------|--------------------------|--------|
| `shop` | `original`, `square`, `square-large` | Produk butuh square (Google Shopping, card grid + card besar). Landscape tidak relevan. |
| `members` | `original`, `profile` | Foto profil anggota — portrait 3:4. Square/landscape tidak relevan. |
| `letters` | `original` | **Kop surat wajib ukuran asli** — header/footer surat tidak boleh di-crop atau di-resize sama sekali. Hanya dikonvert ke WebP. Dimensi original dipertahankan 100%. |
| `akun` | `original`, `large`, `square`, `profile` | Upload foto anggota front-end. |
| `website`, `event`, `donasi`, `general` | `original`, `large`, `medium`, `thumbnail`, `square` | Konten umum: keluarga 1.91:1 untuk featured/OG + square kecil untuk avatar/thumbnail. |

### Implementasi di Upload Route

```typescript
// lib/image-processor.ts — variant sets per modul
export const MODULE_VARIANTS: Record<string, (keyof ProcessedVariants)[]> = {
  shop:    ["original", "square", "square-large"],
  members: ["original", "profile"],
  letters: ["original"],   // kop surat: WAJIB ukuran asli, hanya convert WebP
  akun:    ["original", "large", "square", "profile"],
  // default: semua modul lain (website, event, donasi, general)
};

export const DEFAULT_VARIANTS: (keyof ProcessedVariants)[] = [
  "original", "large", "medium", "thumbnail", "square",
];

export function getVariantsForModule(module: string): (keyof ProcessedVariants)[] {
  return MODULE_VARIANTS[module] ?? DEFAULT_VARIANTS;
}
```

```typescript
// api/media/upload/route.ts — hanya generate & upload variant yang relevan
const variantKeys = getVariantsForModule(module);
const allProcessed = await processImage(inputBuffer);   // generate semua
const toUpload = variantKeys.reduce((acc, key) => {
  acc[key] = allProcessed[key];
  return acc;
}, {} as Partial<ProcessedVariants>);
// Upload hanya variant yang dipilih
```

### Fallback di getImageUrl()

Jika variant yang diminta tidak ada (karena tidak di-generate untuk modul ini),
`getImageUrl()` fallback ke chain berikutnya:

```
variant diminta → large → original → path lama (backward compat)
```

Contoh: card produk meminta `medium` → tidak ada → fallback ke `large` → tidak ada
→ fallback ke `original` → tetap tampil meski tidak optimal.

### Profile Upload — Belum Diimplementasi

Modul `members` (foto profil anggota) belum punya UI upload — saat ini foto profil diisi
via URL manual. Saat diimplementasikan:
- Upload via `module=members`
- Hanya generate `original` + `profile` (300×400, 3:4)
- UI crop editor di halaman edit anggota (Phase D2) akan sangat berguna di sini
  karena foto KTP/selfie sering butuh adjustment posisi wajah

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
   ├── original.webp      ← konversi saja, tanpa crop/resize
   ├── large.webp         ← resize + attention crop ke 1200×630
   ├── medium.webp        ← resize + attention crop ke 800×420
   ├── thumbnail.webp     ← resize + attention crop ke 400×210
   ├── square.webp        ← resize + attention crop ke 400×400
   ├── square-large.webp  ← resize + attention crop ke 800×800  ← BARU
   └── profile.webp       ← resize + attention crop ke 300×400
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

**Auto-crop strategy**: Sharp `fit: 'cover'`, `position: 'attention'` — smart crop via libvips
(face detection + saliency map). Detail lengkap di bagian **Phase D** di bawah.

**Rollback jika upload variant gagal**: jika salah satu `Promise.all` MinIO upload gagal,
hapus variant yang sudah terupload sebelum throw error (cleanup partial upload).

---

## Naming Convention File di MinIO

```
{module}/{year}/{month}/{uuid}_{suffix}.webp

Contoh:
website/2026/04/a1b2c3d4_ori.webp      ← original (WebP, no crop)
website/2026/04/a1b2c3d4_lg.webp       ← large        (1200×630)
website/2026/04/a1b2c3d4_md.webp       ← medium       (800×420)
website/2026/04/a1b2c3d4_th.webp       ← thumbnail    (400×210)
website/2026/04/a1b2c3d4_sq.webp       ← square       (400×400)
website/2026/04/a1b2c3d4_sql.webp      ← square-large (800×800)
website/2026/04/a1b2c3d4_pf.webp       ← profile      (300×400)

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
  "original":      "website/2026/04/a1b2c3d4_ori.webp",
  "large":         "website/2026/04/a1b2c3d4_lg.webp",
  "medium":        "website/2026/04/a1b2c3d4_md.webp",
  "thumbnail":     "website/2026/04/a1b2c3d4_th.webp",
  "square":        "website/2026/04/a1b2c3d4_sq.webp",
  "square-large":  "website/2026/04/a1b2c3d4_sql.webp",
  "profile":       "website/2026/04/a1b2c3d4_pf.webp"
}
```

---

## Drizzle Schema Update

```typescript
// packages/db/src/schema/tenant/website.ts — createMediaTable()

export type ImageVariants = {
  original?:       string;
  large?:          string;
  medium?:         string;
  thumbnail?:      string;
  square?:         string;
  "square-large"?: string;
  profile?:        string;
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
  large:        { width: 1200, height: 630  },   // 1.91:1 — featured, OG
  medium:       { width: 800,  height: 420  },   // 1.91:1 — card preview
  thumbnail:    { width: 400,  height: 210  },   // 1.91:1 — grid kecil
  square:       { width: 400,  height: 400  },   // 1:1 — produk kecil, avatar
  "square-large": { width: 800, height: 800 },   // 1:1 — produk utama, galeri
  profile:      { width: 300,  height: 400  },   // 3:4 — foto profil
} as const;

const WEBP_QUALITY = 85;

export type ProcessedVariants = {
  original:     Buffer;
  large:        Buffer;
  medium:       Buffer;
  thumbnail:    Buffer;
  square:       Buffer;
  "square-large": Buffer;
  profile:      Buffer;
};

export function shouldBypass(mime: string): boolean {
  return mime === "image/svg+xml";
}

export async function processImage(inputBuffer: Buffer): Promise<ProcessedVariants> {
  const original = await sharp(inputBuffer)
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // Proses per-key, bukan positional destructuring — urutan Object.entries tidak dijamin
  const [large, medium, thumbnail, square, squareLarge, profile] = await Promise.all([
    sharp(inputBuffer).resize(1200, 630,  { fit: "cover", position: "attention" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(800,  420,  { fit: "cover", position: "attention" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(400,  210,  { fit: "cover", position: "attention" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(400,  400,  { fit: "cover", position: "attention" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(800,  800,  { fit: "cover", position: "attention" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(300,  400,  { fit: "cover", position: "attention" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
  ]);

  return { original, large, medium, thumbnail, square, "square-large": squareLarge, profile };
}
```

---

## lib/image-url.ts

```typescript
// apps/web/lib/image-url.ts
import { publicUrl } from "@/lib/minio";
import type { ImageVariants } from "@jalajogja/db"; // atau import lokal dari schema

export type ImageVariant = "original" | "large" | "medium" | "thumbnail" | "square" | "square-large" | "profile";

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

## Metadata SEO Gambar

Setiap gambar di media library memiliki 4 field metadata yang penting untuk SEO dan aksesibilitas.
Field ini sudah ada di DB schema (`alt_text`, `title`, `caption`, `description`) dan sudah ada
di `MediaItem` type. Yang perlu diimplementasikan adalah **UX untuk mengisi dan mengeditnya**.

### Fungsi Tiap Field

| Field | Tag HTML | Fungsi SEO / UX | Contoh |
|-------|----------|-----------------|--------|
| **Alt Text** | `<img alt="...">` | **Wajib untuk SEO** — dibaca Google untuk indexing gambar, screen reader, muncul saat gambar gagal load | `"Prosesi wisuda santri IKPM angkatan 2024"` |
| **Title** | `<img title="...">` | Tooltip saat hover gambar. Juga dipakai schema.org `ImageObject.name` | `"Wisuda Santri 2024"` |
| **Caption** | `<figcaption>` | Teks di bawah gambar dalam artikel/post. Terbaca Google sebagai konteks gambar | `"Para santri mengenakan toga saat prosesi wisuda di Aula Utama IKPM"` |
| **Description** | schema.org `ImageObject.description` | Deskripsi panjang untuk structured data — dipakai `generateArticleJsonLd()` dan image sitemap | `"Dokumentasi wisuda angkatan 87 Pondok Modern Darussalam Gontor, ..."` |

**Alt text adalah field terpenting** — tanpa alt text, Google tidak tahu isi gambar.
Caption dan description adalah bonus SEO yang bisa ditambahkan kapan saja setelah upload.

### Urutan Prioritas Pengisian

Saat upload baru: hanya upload, metadata kosong — **tidak blokir alur upload**.
Admin isi metadata kapan saja di media library atau saat memilih gambar di MediaPicker.

```
Upload → gambar masuk DB (metadata null)
       ↓
Edit via MediaShell (/media page) — klik gambar → panel detail → autosave
       ATAU
Edit via MediaPicker (saat pilih gambar di form post/produk/dll) → panel kanan → save sebelum konfirmasi
```

---

## UI Editing Metadata: MediaShell

Halaman `/media` — perubahan UX dari pola saat ini (pensil hover-only) ke pola WordPress:

### Layout dua zona

```
┌─────────────────────────────┬───────────────────────────┐
│  Grid/List (kiri, flex-1)   │  Detail Panel (kanan)     │
│                             │  — muncul saat ada        │
│  [☐img] [☐img] [☐img]      │    gambar di-klik         │
│  [☐img] [☐img] [☐img]      │                           │
│                             │  [preview gambar]         │
│                             │  Nama file, ukuran, tipe  │
│                             │  ─────────────────────    │
│                             │  Alt Text [input]         │
│                             │  Title    [input]         │
│                             │  Caption  [textarea]      │
│                             │  Deskripsi[textarea]      │
│                             │                           │
│                             │  💾 Tersimpan ✓ (autosave)│
└─────────────────────────────┴───────────────────────────┘
```

Panel kanan: `w-80 shrink-0 border-l bg-card` — muncul/hilang via `selectedItem` state.

### Behavior

- **Klik gambar** → set `selectedItem`, panel kanan muncul (jika belum ada)
- **Klik gambar lain** → ganti `selectedItem`, panel update ke gambar baru
- **Klik gambar yang sudah dipilih** → tutup panel (toggle)
- **Checkbox** di pojok kiri atas **selalu tampil** (tidak hanya hover) — untuk select batch delete atau pemilihan gallery
  - Toolbar "Hapus yang Dipilih" muncul saat minimal 1 checkbox tercentang
  - Checkbox dan klik-detail adalah dua interaksi independen — satu item bisa sekaligus diceklis DAN tampil di panel
- **Panel menutup** → autosave sudah jalan via debounce — tidak perlu explicit save saat menutup

### Autosave

Debounce **1000ms** setelah user stop mengetik di field mana pun:

```
User mengetik → clearTimeout → setTimeout(1000ms) → PATCH /api/media/[id]/metadata
                                                     → indicator "Menyimpan..."
                                                     → "Tersimpan ✓" (2 detik, lalu hilang)
                                                     → jika error → "Gagal ✗" + toast
```

Indicator di pojok kanan bawah panel:
- Idle: kosong
- Saving: `<Loader2 spin /> Menyimpan...` (teks abu-abu kecil)
- Saved: `✓ Tersimpan` (hijau, fade out setelah 2 detik)
- Error: `✗ Gagal simpan` (merah, tetap sampai retry)

---

## UI Editing Metadata: MediaPicker

Dialog picker yang dipakai di form post/produk/dll — perubahan dari single-column ke split view
saat ada gambar terpilih:

### Layout dua kolom (saat ada yang terpilih)

```
┌──────────────────────────────────────────────────────┐
│  Dialog Header: "Pilih Media"                        │
├─────────────────────┬────────────────────────────────┤
│  Grid (kiri)        │  Detail (kanan, w-72)          │
│  — tetap scroll     │  — muncul saat 1 item terpilih │
│                     │                                │
│  [ ✓ ] [ ] [ ]     │  [preview gambar besar]        │
│  [ ] [ ] [ ]        │  nama.jpg · 240 KB · image/jpg │
│                     │  ─────────────────────────     │
│                     │  Alt Text [input]              │
│                     │  Title    [input]              │
│                     │  Caption  [textarea 2 rows]    │
│                     │                                │
│                     │  💾 Tersimpan ✓               │
└─────────────────────┴────────────────────────────────┘
│ [Batal]                           [Pilih (1)]        │
└──────────────────────────────────────────────────────┘
```

Panel kanan hanya tampil saat **tepat 1 item terpilih** (bukan `multiple` select atau 0 item).

### Behavior

- Klik gambar → pilih + panel kanan muncul otomatis
- User isi Alt Text / Title / Caption di panel kanan
- Debounce autosave ke DB (1000ms) — sama seperti di MediaShell
- Klik "Pilih" → `onSelect` dipanggil dengan `MediaItem` yang sudah updated
- Data yang dikembalikan ke parent sudah include perubahan metadata terbaru

### Multiple mode

Saat `multiple=true`: panel kanan **tidak tampil** (terlalu sempit untuk multi-select UX).
Edit metadata individual dalam multiple mode via tombol pensil kecil per item → buka `MediaEditModal`.
Ini konsisten dengan pola saat ini — modal tetap ada sebagai fallback untuk multiple mode.

---

## MediaDetailPanel — Komponen Bersama

Daripada duplikasi form di `MediaShell` dan `MediaPicker`, gunakan satu komponen:

```typescript
// components/media/media-detail-panel.tsx

type Props = {
  media:            MediaItem;
  slug:             string;
  onChange:         (updated: MediaItem) => void;   // update local state parent
  showDescription?: boolean;                        // default false; true hanya di MediaShell
};

export function MediaDetailPanel({ media, slug, onChange, showDescription = false }: Props)
```

**State internal**: field values (altText, title, caption, description)
**Autosave**: `useEffect` watch field changes + debounce 1000ms → PATCH → update parent via `onChange`
**Indicator**: save status (idle | saving | saved | error)

**PENTING — reset state saat item berganti**: komponen harus di-`key` oleh `media.id` di parent:
```tsx
<MediaDetailPanel key={selectedItem.id} media={selectedItem} ... />
```
Tanpa `key`, state internal (altText dll) tidak ter-reset saat panel berpindah ke gambar lain —
data gambar lama akan ter-autosave ke gambar yang baru dipilih.

Dipakai oleh:
- `MediaShell` → panel kanan saat item dipilih, `showDescription={true}`
- `MediaPicker` → panel kanan saat 1 item terpilih (single mode), `showDescription={false}`

---

## Update: api/media/[id]/metadata/route.ts

Endpoint sudah ada. Tidak perlu perubahan — sudah support PATCH dengan field `altText`, `title`,
`caption`, `description`. Response mengembalikan `MediaItem` updated.

Field `description` tidak ditampilkan di `MediaDetailPanel` dalam `MediaPicker`
(caption sudah cukup untuk konteks picker) — tampilkan `description` hanya di `MediaShell`
yang lebih luas.

---

## Integrasi dengan SEO

### Alt text & title di `<img>` tag — ✅ Selesai

`PostCardData` diperluas dengan dua field baru:

```typescript
coverAlt?:   string | null;  // dari media.alt_text
coverTitle?: string | null;  // dari media.title
```

`resolveCovers` di `posts-section.tsx` fetch `altText` + `title` dari DB dan mengisinya.

**Fallback chain** (tidak pernah kosong):
```
alt   = media.altText   ?? post.title
title = media.title     ?? undefined  (tidak wajib ada)
```

Komponen yang sudah terimplementasi:
| Komponen | alt | title |
|----------|-----|-------|
| `PostCardKlasik` | `coverAlt ?? post.title` | `coverTitle` |
| `PostCardList` | `coverAlt ?? post.title` | `coverTitle` |
| `PostCardRingkas` | `coverAlt ?? post.title` | `coverTitle` |
| `PostCardOverlay` | `coverAlt ?? post.title` | `coverTitle` |
| `PostsDesign2` (featured) | `coverAlt ?? post.title` | `coverTitle` |
| Post archive page | `media.altText ?? post.title` | `media.title` |
| Post detail page | `media.altText ?? post.title` | `media.title` |

### Caption di single post — ✅ Selesai

Featured image di halaman detail post (`/(public)/[tenant]/post/[slug]`) dibungkus `<figure>`:

```tsx
<figure className="mb-8">
  <div className="rounded-xl overflow-hidden border border-border">
    <img src={coverUrl} alt={coverAlt ?? post.title} title={coverTitle ?? undefined} ... />
  </div>
  {coverCaption && (
    <figcaption className="mt-2 text-center text-xs text-muted-foreground italic px-2">
      {coverCaption}
    </figcaption>
  )}
</figure>
```

`coverCaption` diambil dari `media.caption` — hanya tampil jika terisi, tidak mempengaruhi layout jika kosong.
`getPost()` fetch empat field sekaligus: `path`, `altText`, `title`, `caption`.

### Caption di block editor

Block editor (Tiptap) sudah support `<figure>` + `<figcaption>` di `ImageBlock` node.
Saat user insert gambar via MediaPicker di editor:
- `alt` diisi otomatis dari `media.altText`
- `title` diisi dari `media.title`
- Caption bisa diisi manual di editor (terpisah dari `media.caption`)
- `media.caption` adalah default suggestion tapi user bisa override di editor

### schema.org ImageObject (future)

`media.description` dipakai untuk structured data gambar. Implementasi di `generateArticleJsonLd()`:

```typescript
image: {
  "@type": "ImageObject",
  url:         resolvedUrl,
  name:        media.title        ?? post.title,
  description: media.description  ?? post.excerpt ?? undefined,
  width:       1200,
  height:      630,
}
```

---

## Urutan Eksekusi (Wajib Diikuti)

```
── Phase A: Variant System ─────────────────────────────────────────────────
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

── Phase B: Metadata UI ────────────────────────────────────────────────────
Step 13 — Buat components/media/media-detail-panel.tsx (autosave + indicator)
Step 14 — Refactor media-shell.tsx: klik = detail panel kanan, checkbox = select delete
Step 15 — Refactor media-picker.tsx: tambah panel kanan saat 1 item terpilih (single mode)
Step 16 — TypeScript check (tsc --noEmit)
```

Phase A Step 1–3 wajib selesai sebelum Step 6.
Phase A Step 5 wajib selesai sebelum Step 11.
Phase B bisa dikerjakan independen dari Phase A (metadata sudah ada di DB).

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
│   └── [id]/metadata/route.ts    → tidak berubah (sudah support 4 field)
├── app/api/cron/
│   └── cleanup-images/route.ts   → baru: hapus expired originals
└── components/media/
    ├── media-picker.tsx           → update: thumbnail display + panel detail kanan
    ├── media-shell.tsx            → update: thumbnail display + klik = panel, checkbox = select
    ├── media-detail-panel.tsx     → BARU: form 4 field + autosave + indicator
    └── media-edit-modal.tsx       → tetap ada (dipakai di MediaPicker multiple mode)

packages/db/src/schema/tenant/website.ts
  → update: createMediaTable() + ImageVariants type export

packages/db/src/helpers/create-tenant-schema.ts
  → update: DDL ALTER TABLE ADD COLUMN 4 kolom baru

apps/web/components/website/public/sections/posts/posts-section.tsx
  → update: resolveCovers + fetchFeaturedPosts gunakan getImageUrl()
```

---

## Status Implementasi

### Phase A — Variant System

| Komponen | Status |
|----------|--------|
| Drizzle schema — 4 kolom baru + `ImageVariants` type | ✅ Selesai |
| DDL `create-tenant-schema.ts` | ✅ Selesai |
| `lib/image-processor.ts` — tambah `square-large` + ganti ke `attention` | ⬜ Belum (Phase D) |
| `lib/image-url.ts` — tambah `"square-large"` ke `ImageVariant` type | ⬜ Belum (Phase D) |
| `api/media/upload/route.ts` — pipeline + bypass + rollback | ✅ Selesai |
| `api/media/delete/route.ts` — hapus semua variant | ✅ Selesai |
| `api/media/list/route.ts` — variant URLs di response | ✅ Selesai |
| `MediaItem` type — tambah `variants` | ✅ Selesai |
| `media-shell.tsx` + `media-picker.tsx` — thumbnail di grid | ✅ Selesai |
| `resolveCovers` + `fetchFeaturedPosts` — `getImageUrl()` | ✅ Selesai |
| `api/cron/cleanup-images/route.ts` | ✅ Selesai |

### Phase B — Metadata UI

| Komponen | Status |
|----------|--------|
| DB schema — `alt_text`, `title`, `caption`, `description` | ✅ Selesai (sudah ada sejak awal) |
| `api/media/[id]/metadata/route.ts` — PATCH 4 field | ✅ Selesai |
| `media-edit-modal.tsx` — modal edit manual (tombol Simpan) | ✅ Selesai |
| `media-detail-panel.tsx` — panel autosave baru | ✅ Selesai |
| `media-shell.tsx` — klik=panel, checkbox=select | ✅ Selesai |
| `media-picker.tsx` — panel kanan saat 1 item terpilih | ✅ Selesai |

### Phase C — Propagasi ke Front-end

| Komponen | Status |
|----------|--------|
| `PostCardData` — tambah `coverAlt` + `coverTitle` | ✅ Selesai |
| `resolveCovers` — fetch `altText` + `title` dari DB | ✅ Selesai |
| PostCard (klasik, list, ringkas, overlay) — `alt` + `title` attr | ✅ Selesai |
| `PostsDesign2` featured image — `alt` + `title` attr | ✅ Selesai |
| Post archive page — `alt` + `title` dari media | ✅ Selesai |
| Post detail page — `alt` + `title` + `caption` dari media | ✅ Selesai |
| Post detail — `<figure>` + `<figcaption>` untuk caption | ✅ Selesai |

### Phase D — Autocrop

| Komponen | Status |
|----------|--------|
| D1: `position: "attention"` + `square-large` + `getVariantsForModule()` | ✅ Selesai |
| D2: `crop_data` kolom + manual crop UI | ✅ Selesai |

### Catatan Implementasi

- **Tenant existing sudah dimigrasikan**: `pc-ikpm-jogjakarta` sudah dapat 4 kolom variant baru via `ALTER TABLE` manual (2026-04-26). Media lama tetap bekerja via fallback `path` di `getImageUrl()` — `variants = NULL` ditangani gracefully.
- **Tenant baru**: 4 kolom sudah ada di `create-tenant-schema.ts` — otomatis saat provisioning.
- **`CRON_SECRET`**: wajib set di `.env` sebelum cron job aktif.
- **`resolveCovers`**: `fetchRecentPosts` menggunakan `"medium"`, `fetchFeaturedPosts` menggunakan `"large"`.
- **`resolveDisplayUrl`**: helper lokal di `media-shell.tsx` dan `media-picker.tsx` — prioritas thumbnail untuk grid.
- **Fallback alt text**: `media.altText ?? post.title` — tidak pernah kosong, selalu ada nilai semantik.
- **Caption single post**: hanya di halaman detail, bukan di post card — caption panjang tidak cocok untuk grid.

---

## Phase D — Autocrop System

### Latar Belakang

Phase A–C menggunakan `position: "center"` — crop selalu dari tengah gambar, tanpa peduli
subjek foto ada di mana. Untuk foto orang dan kegiatan (mayoritas konten IKPM), ini sering
memotong kepala atau wajah.

Phase D mengganti strategi crop menjadi dua lapis:
1. **Attention autocrop** — default, otomatis, berbasis libvips
2. **Manual crop** — override oleh admin jika attention tidak tepat

---

### Phase D1 — Attention Autocrop (1 baris kode)

Ganti `position: "center"` → `position: "attention"` di `lib/image-processor.ts`.

**Cara kerja `attention` di libvips (tanpa AI, tanpa API eksternal):**

| Langkah | Mekanisme | Prioritas |
|---------|-----------|-----------|
| 1 | **Face detection** — Haar cascade classifier (OpenCV-style, murni matematika) | Tertinggi |
| 2 | **Saliency map** — analisis brightness + saturation + edge density per region | Fallback |
| 3 | **Entropy** — area dengan informasi visual paling tinggi (kontras, tekstur) | Fallback |

Semua proses **lokal, offline, zero API call** — libvips sudah ter-bundle dalam Sharp.
Kecepatan: hampir sama dengan `center`, tambahan ~5–15ms per gambar.

**Perubahan di `lib/image-processor.ts`:**
```typescript
// Sebelum (Phase A–C):
sharp(inputBuffer).resize(1200, 630, { fit: "cover", position: "center" })

// Sesudah (Phase D):
sharp(inputBuffer).resize(1200, 630, { fit: "cover", position: "attention" })
```

Berlaku untuk semua 5 variant yang di-resize (large, medium, thumbnail, square, profile).
`original` tidak di-crop — tetap konversi WebP saja.

**Perlu re-crop gambar lama?** Tidak wajib — gambar lama tetap jalan dengan crop lama.
Re-crop opsional bisa dilakukan via tombol "Proses Ulang" di Media Library (future feature).

---

### Phase D2 — Manual Crop Override

Untuk kasus di mana attention tidak menghasilkan crop yang tepat, admin bisa override
lewat UI crop editor di **Media Detail Panel** (`/media`).

#### Flow Lengkap

```
[Admin buka /media]
         │
         ▼
[Klik gambar → Media Detail Panel terbuka di kanan]
         │
         ▼
[Klik "Edit Crop" di panel]
         │
         ▼
[Crop editor muncul: gambar original + crop box overlay]
[Admin drag crop box ke posisi yang diinginkan]
[Pilih variant yang ingin di-override: large / square / semua]
         │
         ▼
[Klik "Terapkan"]
         │
         ▼
[POST /api/media/[id]/recrop]
├── Fetch original (_ori) dari MinIO
├── sharp.extract({ left, top, width, height })  ← manual crop rect
├── sharp.resize(target_w, target_h, { fit: "cover" })
├── Re-upload variant ke MinIO (overwrite path yang sama)
└── Simpan crop_data ke DB: { x%, y%, w%, h%, variant }
         │
         ▼
[Panel refresh — tampilkan hasil crop baru]
```

#### Schema DB — kolom baru `crop_data`

```sql
-- Tambah ke tenant_{slug}.media
ALTER TABLE "tenant_{slug}".media
  ADD COLUMN IF NOT EXISTS crop_data JSONB;
```

```typescript
// Drizzle schema
cropData: jsonb("crop_data").$type<CropData | null>(),

// Type
export type CropData = {
  x:       number;  // persentase dari lebar original (0–100)
  y:       number;  // persentase dari tinggi original (0–100)
  width:   number;  // persentase lebar crop area (0–100)
  height:  number;  // persentase tinggi crop area (0–100)
  variant: "all" | "large" | "medium" | "thumbnail" | "square" | "profile";
};
```

Koordinat dalam **persentase** (bukan pixel) — agar tidak bergantung pada dimensi original
yang tidak kita simpan secara eksplisit.

#### Logika server saat processImage

```typescript
async function processVariant(
  inputBuffer: Buffer,
  width: number,
  height: number,
  cropData?: CropData | null,
): Promise<Buffer> {
  let pipeline = sharp(inputBuffer);

  if (cropData) {
    // Manual crop: extract dulu, baru resize
    const meta    = await sharp(inputBuffer).metadata();
    const imgW    = meta.width  ?? 1;
    const imgH    = meta.height ?? 1;
    pipeline = pipeline.extract({
      left:   Math.round(cropData.x      / 100 * imgW),
      top:    Math.round(cropData.y      / 100 * imgH),
      width:  Math.round(cropData.width  / 100 * imgW),
      height: Math.round(cropData.height / 100 * imgH),
    });
  }

  return pipeline
    .resize(width, height, { fit: "cover", position: cropData ? "center" : "attention" })
    .webp({ quality: 85 })
    .toBuffer();
}
```

Saat `cropData` ada → `extract()` dulu ke area manual, lalu resize dengan `center`
(area sudah dipersempit, tidak perlu attention lagi).
Saat `cropData` tidak ada → `attention` langsung.

#### API Route

```
POST /api/media/[id]/recrop
Body: { cropData: CropData }

Auth: tenant access wajib
Flow:
1. Fetch media row (cek variants.original ada)
2. Fetch file _ori dari MinIO
3. Jalankan processVariant() sesuai cropData.variant
4. Re-upload ke path yang sama (overwrite)
5. Update media.crop_data di DB
6. Return updated MediaItem
```

#### UI: Crop Editor di MediaDetailPanel

Library: **`react-image-crop`** (npm `react-image-crop`, ~10 KB, zero dependency).

```
┌──────────────────────────────────────────────────────┐
│  [Gambar dengan crop overlay — draggable]            │
│  ┌──────────────────────┐                            │
│  │  ✂ Area Crop         │                            │
│  │  (drag untuk pindah) │                            │
│  └──────────────────────┘                            │
│                                                      │
│  Terapkan ke: [Semua variant ▾]                      │
│  [Batal]                          [✓ Terapkan Crop]  │
└──────────────────────────────────────────────────────┘
```

Tombol "Edit Crop" muncul di `MediaDetailPanel` di bawah preview gambar.
Saat klik → panel berganti ke crop editor mode.
Saat "Batal" → kembali ke panel normal tanpa perubahan.
Saat "Terapkan" → POST ke `/api/media/[id]/recrop` → loading → tampilkan hasil.

**Catatan**: Crop editor hanya tampil jika `variants.original` ada (belum dihapus cron).
Jika original sudah dihapus (> 10 hari), tampilkan teks "Crop manual tidak tersedia —
original sudah dihapus. Upload ulang untuk mengaktifkan fitur ini."

---

### Phase D — Status Implementasi

| Komponen | Status |
|----------|--------|
| **D1**: `position: "attention"` + `square-large` + `getVariantsForModule()` | ✅ Selesai |
| **D2**: Kolom `crop_data JSONB` di media table (Drizzle + DDL) | ✅ Selesai |
| **D2**: `processVariant()` helper — manual extract + attention fallback | ✅ Selesai |
| **D2**: `POST /api/media/[id]/recrop` route | ✅ Selesai |
| **D2**: Crop editor UI di `MediaDetailPanel` (`react-image-crop`) | ✅ Selesai |
| **D2**: Tombol "Crop" di panel + state crop editor | ✅ Selesai |

**Phase D selesai** — D1 (attention + square-large + module-aware) + D2 (manual crop UI).
**Catatan tenant existing**: perlu `ALTER TABLE ... ADD COLUMN IF NOT EXISTS crop_data JSONB`
untuk tenant yang sudah ada sebelum Phase D.

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
