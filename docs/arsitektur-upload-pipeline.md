# Arsitektur Upload Pipeline — Refactoring

Dokumen ini mendokumentasikan masalah yang ditemukan pada pipeline upload gambar dan perbaikan
yang telah dieksekusi agar lebih ringan, terutama untuk pengguna mobile.

> **Status:** ✅ Sudah dieksekusi (per 2026-05-16). Semua 7 perubahan selesai.

---

## Status Implementasi

| # | Perubahan | Status |
|---|-----------|--------|
| 1 | Buat `lib/client-image-compress.ts` | ✅ Selesai |
| 2 | Terapkan di `MemberMediaPicker` (compress + size guard + accept + hint) | ✅ Selesai |
| 3 | Terapkan di `InvoicePublicClient` (compress bukti transfer) | ✅ Selesai |
| 4 | Refactor `processImage()` — variant list + decompression bomb guard | ✅ Selesai |
| 5 | Update pemanggil di kedua route (admin + akun) | ✅ Selesai |
| 6 | HEIC/HEIF support di akun upload + error handling spesifik Sharp | ✅ Selesai |
| 7 | Timing log kondisional (`DEBUG_UPLOAD`) | ✅ Selesai |
| + | Size guard setelah compress di `/akun/media/page.tsx` | ✅ Selesai |
| + | Error message HEIC di `proof-upload/route.ts` | ✅ Selesai |

---

## Diagnosis Masalah

### Masalah 1 — `processImage()` selalu generate 7 variant, filter belakangan

Di `lib/image-processor.ts` baris 85-96, `processImage()` memanggil `Promise.all` untuk 7 Sharp
calls sekaligus — `original`, `large`, `medium`, `thumbnail`, `square`, `square-large`, `profile`.

Kedua route memanggil generate-dulu-filter-belakangan, tapi dengan perbedaan kecil:
```typescript
// /api/akun/media/upload — module hardcoded "akun"
const allVariants = await processImage(buffer);
const variantKeys = getVariantsForModule("akun");   // ["original","large","square","profile"]

// /api/media/upload (admin) — module dari query param
const allVariants = await processImage(buffer);
const variantKeys = getVariantsForModule(module);   // tergantung module
```

Keduanya tetap generate 7 lalu buang sisa — boros CPU Sharp.

Dampak per module jika diperbaiki:
| Module | Sekarang | Seharusnya | Hemat |
|--------|----------|-----------|-------|
| `akun` | 7 | 4 | ~43% |
| `shop` | 7 | 3 | ~57% |
| `members` | 7 | 2 | ~71% |
| `general/website` | 7 | 5 | ~29% |

### Masalah 2 — Variant `original` = full-res WebP tanpa cap ("normalized original")

```typescript
sharp(inputBuffer).webp({ quality: 85 }).toBuffer()
```

Foto iPhone 12MP masuk → variant `original` bisa 3-5 MB WebP. Tidak ada use case menampilkan
gambar profil atau foto usaha di resolusi penuh.

**Catatan konsep penting:** Setelah di-cap 1600px, variant ini tidak lagi benar-benar "original".
Nama variant tetap `original` untuk backward-compatibility (key di DB, path `_ori`), tapi secara
konseptual ini adalah **"normalized original"** atau **"display original"** — bukan arsip mentah
kamera. Ini harus dipahami oleh developer agar tidak ada asumsi bahwa `_ori.webp` = foto unmodified
dari device.

### Masalah 3 — Tidak ada client-side compression (ROOT CAUSE utama mobile failure)

Browser mengirim file mentah langsung ke server. Foto 8-10 MB dikirim lewat uplink mobile lambat
→ request timeout sebelum sampai ke pipeline server, Sharp bahkan belum mulai. Berlaku di **dua
jalur berbeda**:
- Upload media anggota via `MemberMediaPicker`
- Upload bukti transfer via `InvoicePublicClient`

Server optimization (Masalah 1) penting, tapi tidak membantu jika file besar gagal diterima
sebelum server sempat memproses.

### Masalah 4 — Pipeline upload terlalu synchronous (Technical Debt)

Saat ini satu request upload menunggu seluruh rantai selesai:
```
formData parse → Buffer → Sharp (semua variant) → MinIO upload (N file) → DB insert → response
```

Untuk fase sekarang ini masih dapat diterima, tapi secara arsitektur ini adalah **desain
sementara, bukan final**. Jangka panjang, idealnya:

```
upload file compressed → insert DB processing_status = "pending" → response cepat ke client
                       ↓ (background worker)
                generate variant → upload MinIO → update DB processing_status = "done"
```

**Tidak perlu dieksekusi sekarang.** Dicatat agar tidak dianggap pipeline synchronous ini adalah
desain yang disengaja dan final — ini hanya fase awal.

### Masalah 5 — HEIC/HEIF ditolak di akun upload, tapi Sharp HEIC tidak 100% dijamin

`/api/akun/media/upload` tidak include `image/heic`/`image/heif` di `ALLOWED_TYPES`. Pengguna
iPhone mendapat error tanpa pesan informatif.

**Catatan penting:** Sharp mendukung HEIC melalui libvips, tapi dukungan ini tergantung build
environment. Di beberapa deploy, HEIC bisa gagal meski MIME diterima. Route harus siap `catch`
error Sharp dengan pesan spesifik — jangan fallback ke pesan generik "Gagal memproses gambar".

Client-side Canvas juga tidak 100% bisa decode HEIC — iOS Safari biasanya bisa, tapi perlu
fallback `img.onerror` jika gagal.

### Masalah 6 — Potensi decompression bomb

File 2 MB bisa punya pixel sangat besar (misal PNG ultra-compressed). Perlu validasi total pixel
setelah `sharp(buffer).metadata()` agar tidak membebani VPS.

Batas konkret: `MAX_PIXELS = 40_000_000` (40 megapixel). Foto 12MP dan 24MP masih aman jauh di
bawah batas ini. Yang ditolak hanya gambar abnormal.

### Masalah 7 — Inkonsistensi antar route

| Route | Max size | HEIC/HEIF | Sharp | Client compress |
|-------|----------|-----------|-------|-----------------|
| `/api/media/upload` | 20 MB | ✗ | ✓ (7 variant) | ✗ |
| `/api/akun/media/upload` | 10 MB | ✗ | ✓ (7 variant, buang 3) | ✗ |
| `/api/invoice/proof-upload` | 8 MB | ✓ | ✗ (langsung upload) | ✗ |

`proof-upload` tidak pakai Sharp (lebih ringan), tapi tetap perlu client-side compression karena
screenshot bukti transfer tidak perlu dikirim 8 MB original. **Alur server tidak berubah** —
file tetap dikirim ke `/api/invoice/proof-upload` yang sama, hanya file yang dikirim sudah
diperkecil client sebelum `fetch()`.

---

## Rencana Perbaikan (Final)

### Perubahan 1 — Buat `lib/client-image-compress.ts` (reusable)

**File baru:** `apps/web/lib/client-image-compress.ts`

Fungsi ini dipakai oleh semua komponen yang upload gambar dari browser:
- `MemberMediaPicker` (upload foto akun/profil/usaha/pesantren)
- `InvoicePublicClient` (upload bukti transfer)
- Upload lain di akun/mitra di masa mendatang

```typescript
// apps/web/lib/client-image-compress.ts
// TIDAK ada "use server" — ini browser-only

export interface CompressOptions {
  maxDimension?: number;   // default: 1600
  quality?:      number;   // default: 0.82 (JPEG)
  skipIfSmall?:  number;   // skip jika file.size < nilai ini (bytes), default: 800KB
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const { maxDimension = 1600, quality = 0.82, skipIfSmall = 800 * 1024 } = options;

  // Lewati non-gambar dan SVG — tidak bisa di-canvas
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;

      // Skip jika sudah kecil dan dimensi OK
      if (w <= maxDimension && h <= maxDimension && file.size < skipIfSmall) {
        resolve(file);
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; } // fallback: kirim as-is
          // Ganti extension ke .jpg — HEIC/PNG dikonversi jadi JPEG
          const newName = file.name.replace(/\.[^.]+$/, ".jpg");
          resolve(new File([blob], newName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };

    // Fallback jika Canvas gagal decode (HEIC di browser non-iOS, dll)
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
```

**Catatan nama file:** Jika input HEIC atau PNG dikonversi jadi JPEG, nama file diganti ke `.jpg`
agar tidak membingungkan di log/debug. MIME type otomatis `image/jpeg`.

**Catatan EXIF dan orientation:** Canvas draw menghapus semua metadata EXIF, termasuk GPS dan
orientation tag. Untuk privasi ini bagus (tidak ada data lokasi tersimpan), tapi orientation
perlu diperhatikan. Browser biasanya sudah menerapkan orientation EXIF saat render `<img>` ke
canvas, tapi perlu ditest di iPhone portrait sebelum dianggap aman. Jika ada laporan foto
miring, tambahkan koreksi orientation manual sebelum draw.

### Perubahan 2 — Terapkan di `MemberMediaPicker`

**File:** `apps/web/components/media/member-media-picker.tsx`

```typescript
import { compressImage } from "@/lib/client-image-compress";

// Di uploadFiles(), sebelum append ke FormData:
const compressed = await compressImage(file);
formData.append("file", compressed);
```

**Estimasi dampak:** Foto iPhone 12MP (8 MB) → ~400-600 KB sebelum dikirim ke server.
Upload time dari ~30 detik → ~3 detik di jaringan 4G.

### Perubahan 3 — Terapkan di upload bukti transfer

**File:** `apps/web/components/billing/invoice-public-client.tsx`

```typescript
import { compressImage } from "@/lib/client-image-compress";

// Sebelum fetch ke /api/invoice/proof-upload — alur server tidak berubah:
const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.80 });
formData.append("file", compressed);
// fetch ke /api/invoice/proof-upload tetap sama seperti sebelumnya
```

Screenshot bukti transfer di 1600px JPEG sudah lebih dari cukup untuk verifikasi admin.

### Perubahan 4 — Refactor `processImage()` terima variant list + decompression bomb guard

**File:** `apps/web/lib/image-processor.ts`

Ubah signature agar hanya generate variant yang diminta:

```typescript
// SEBELUM
export async function processImage(inputBuffer: Buffer): Promise<ProcessedVariants>

// SESUDAH
export async function processImage(
  inputBuffer: Buffer,
  variantList: VariantKey[],
  options?: { originalMaxWidth?: number }
): Promise<Partial<ProcessedVariants>>
```

Tambah decompression bomb guard di awal:
```typescript
const MAX_PIXELS = 40_000_000; // 40MP — foto 12MP/24MP masih aman
const meta = await sharp(inputBuffer).metadata();
const totalPixels = (meta.width ?? 0) * (meta.height ?? 0);
if (totalPixels > MAX_PIXELS) {
  throw new Error("Gambar terlalu besar (maks 40 megapixel). Compress dulu sebelum upload.");
}
```

Untuk variant `original` dengan `originalMaxWidth` (menghasilkan **normalized original**),
gunakan `fit: "inside"` agar tidak ada crop dan tidak memperbesar gambar yang sudah kecil:
```typescript
// Menghasilkan "normalized original" — nama key tetap "original" untuk backward-compat
if (options?.originalMaxWidth) {
  sharp(inputBuffer)
    .resize(options.originalMaxWidth, undefined, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: q })
    .toBuffer()
} else {
  sharp(inputBuffer).webp({ quality: q }).toBuffer()
}
```

Setelah return `Partial<ProcessedVariants>`, route upload perlu guard sebelum pakai hasil:
```typescript
const output = allVariants[name];
if (!output) throw new Error(`Variant ${name} gagal dibuat`);
// → error ini ditangkap try/catch yang sudah ada → rollback MinIO berjalan
```

### Perubahan 5 — Update pemanggil di kedua route

**Files:**
- `apps/web/app/api/media/upload/route.ts`
- `apps/web/app/api/akun/media/upload/route.ts`

```typescript
// SEBELUM (kedua route)
const allVariants = await processImage(buffer);
const variantKeys = getVariantsForModule(module); // atau "akun" hardcoded

// SESUDAH — generate dulu variantKeys, baru pass ke processImage
const variantKeys = getVariantsForModule(module); // atau "akun" di route akun
const allVariants = await processImage(buffer, variantKeys, {
  // Cap "normalized original" 1600px hanya untuk module akun
  // website/general/shop tidak di-cap — ada implikasi konten/SEO/editor
  originalMaxWidth: module === "akun" ? 1600 : undefined,
  // atau di route akun: originalMaxWidth: 1600 (selalu)
});
```

### Perubahan 6 — Support HEIC/HEIF di akun upload + error handling spesifik Sharp

**File:** `apps/web/app/api/akun/media/upload/route.ts`

```typescript
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg":    "jpg",
  "image/png":     "png",
  "image/gif":     "gif",
  "image/webp":    "webp",
  "image/svg+xml": "svg",
  "image/heic":    "heic",   // ← tambah
  "image/heif":    "heif",   // ← tambah
};
```

Di blok `try/catch` Sharp processing, gunakan pesan error spesifik:
```typescript
} catch (err) {
  await Promise.allSettled(uploadedPaths.map(p => deleteFile(slug, p)));
  const isHeic = file.type === "image/heic" || file.type === "image/heif";
  const msg = isHeic
    ? "Format HEIC gagal diproses oleh server. Coba pilih format JPEG atau PNG."
    : "Gagal memproses gambar";
  console.error("Member image upload failed:", err);
  return NextResponse.json({ error: msg }, { status: 500 });
}
```

### Perubahan 7 — Timing log kondisional

**File:** `apps/web/app/api/akun/media/upload/route.ts`

```typescript
const debugUpload = process.env.DEBUG_UPLOAD === "true";
const t0 = Date.now();

// ... setelah parse formData:
if (debugUpload) console.log(`[akun-upload] parse: ${Date.now()-t0}ms, size: ${file.size}B, type: ${file.type}`);

const t1 = Date.now();
// ... setelah processImage:
if (debugUpload) console.log(`[akun-upload] sharp: ${Date.now()-t1}ms`);

const t2 = Date.now();
// ... setelah MinIO:
if (debugUpload) console.log(`[akun-upload] minio: ${Date.now()-t2}ms, total: ${Date.now()-t0}ms`);
```

Aktifkan di `.env.local` saat debug: `DEBUG_UPLOAD=true`. Tidak berisik di production.

---

## Urutan Eksekusi

| # | Perubahan | File | Dampak |
|---|-----------|------|--------|
| 1 | Buat `lib/client-image-compress.ts` | baru | Reusable, 0 deps |
| 2 | Terapkan di `MemberMediaPicker` | `member-media-picker.tsx` | Mobile paling terasa |
| 3 | Terapkan di upload bukti transfer | `invoice-public-client.tsx` | Fix proof upload mobile |
| 4 | Refactor `processImage()` + decompression guard | `image-processor.ts` | Server efisien + aman |
| 5 | Update pemanggil di kedua route | `api/media/upload`, `api/akun/media/upload` | — |
| 6 | HEIC support + Sharp error handling spesifik | `api/akun/media/upload` | Fix iPhone silent failure |
| 7 | Timing log kondisional | `api/akun/media/upload` | Diagnostik per-stage |

---

## Technical Debt — Pipeline Asynchronous (Jangka Panjang)

Pipeline saat ini sepenuhnya synchronous: satu request menunggu seluruh rantai
`formData → Sharp → MinIO → DB` sebelum response dikirim ke client.

Arsitektur ideal jangka panjang:
```
client → upload file compressed → server insert DB (processing_status = "pending") → response cepat
                                              ↓ background worker
                              generate variant → upload MinIO → update DB (status = "done")
```

**Tidak perlu dieksekusi sekarang.** Pipeline synchronous masih diterima untuk skala saat ini.
Dicatat agar tidak dianggap desain final — ini akan menjadi bottleneck saat concurrent upload
meningkat atau ketika file size rata-rata naik.

---

## Yang TIDAK Diubah

- `/api/invoice/proof-upload` server-side — tidak pakai Sharp, sudah ringan (client compress cukup)
- DB schema — tidak ada perubahan
- MinIO path structure — tidak ada perubahan
- Rollback logic di upload routes — tetap ada, diperkuat dengan guard variant null

---

## Catatan Pasca-Deploy

Jika setelah refactoring ini bukti transfer 2 MB masih gagal, penyebabnya bisa di lapisan
infrastruktur — bukan kode:
- `client_max_body_size` di konfigurasi Nginx
- Proxy timeout antara Nginx → Next.js
- Upload timeout MinIO

Gunakan timing log (`DEBUG_UPLOAD=true`) untuk membedakan: gagal sebelum route, saat formData
parse, saat Sharp, atau saat MinIO upload.
