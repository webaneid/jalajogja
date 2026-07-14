# Arsitektur Media Library — jalajogja

Dokumen ini mencakup dua scope:
1. **Admin Media Library** — sudah ada dan berjalan (`/{slug}/media`)
2. **Member Media Library** — perencanaan: anggota IKPM bisa upload & kelola foto sendiri

> **Rencana optimasi pipeline upload** (client-side compress + efisiensi Sharp + HEIC support):
> **`docs/arsitektur-upload-pipeline.md`**

---

## 1. Admin Media Library (Sudah Ada)

### Infrastruktur

**Storage**: MinIO self-hosted, bucket per tenant `tenant-{slug}`.

**Path di MinIO:**
```
{module}/{year}/{month}/{filename}
Contoh: website/2025/05/foto-artikel_lg.webp
```

**Tabel DB**: `tenant_{slug}.media`

```sql
id              UUID        PRIMARY KEY
filename        TEXT        NOT NULL
original_name   TEXT        NOT NULL
mime_type       TEXT        NOT NULL
size            INTEGER     NOT NULL
path            TEXT        NOT NULL        -- path large/as-is untuk backward compat
alt_text        TEXT
title           TEXT
caption         TEXT
description     TEXT
module          TEXT        DEFAULT 'general'
                            CHECK (module IN ('website','members','letters','shop','general'))
is_used         BOOLEAN     DEFAULT false   -- false = orphan candidate
uploaded_by     UUID        REFERENCES tenant.users(id) ON DELETE SET NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
variants        JSONB                       -- { large: "path", medium: "path", ... }
processing_status TEXT      DEFAULT 'done'
original_mime   TEXT
original_expires_at TIMESTAMPTZ
crop_data       JSONB
```

**Kolom kunci:**
- `uploaded_by` → FK ke `tenant.users` (hanya pengurus/admin yang bisa upload via dashboard)
- `variants` → JSONB berisi path MinIO per variant WebP hasil Sharp
- `is_used` → untuk cleanup orphan files (cron)

### Variant System

6 variant WebP otomatis via Sharp saat upload:

| Variant | Dimensi | Rasio | Dipakai |
|---------|---------|-------|---------|
| `original` | as-is | - | Backup, tersedia 10 hari |
| `large` | 1200×630 | 1.91:1 | Featured image, OG meta |
| `medium` | 800×420 | 1.91:1 | Card preview |
| `thumbnail` | 400×210 | 1.91:1 | Grid kecil, widget |
| `square` | 400×400 | 1:1 | Avatar, produk kecil |
| `square-large` | 800×800 | 1:1 | Produk utama, galeri |
| `profile` | 300×400 | 3:4 | Foto profil anggota |

SVG bypass — disimpan as-is tanpa konversi.
Detail lengkap: `docs/arsitektur-image.md`

### File yang Sudah Ada

```
apps/web/
├── app/
│   ├── (dashboard)/[tenant]/media/page.tsx       → halaman admin media library
│   └── api/media/
│       ├── upload/route.ts                        → POST upload + Sharp variants
│       ├── list/route.ts                          → GET list dengan filter
│       ├── delete/route.ts                        → DELETE satu file
│       ├── [id]/metadata/route.ts                 → PATCH alt/title/caption/description
│       └── [id]/recrop/route.ts                   → POST manual crop
└── components/media/
    ├── media-shell.tsx                            → UI utama (upload + grid/list + filter)
    ├── media-detail-panel.tsx                     → panel kanan autosave metadata
    ├── media-edit-modal.tsx                       → modal edit untuk MediaPicker multiple mode
    └── media-picker.tsx                           → komponen picker reusable (single/multiple)
```

### Fitur Admin Media Library Saat Ini

- Upload drag-drop + tombol, multi-file
- Filter per modul (website/members/letters/shop/general) + search nama file
- Grid view (6 kolom) dan list view
- Batch delete via checkbox
- Detail panel kanan: autosave alt/title/caption/description (debounce 1000ms)
- Manual crop via `react-image-crop` + endpoint `/recrop`
- Cron cleanup file `_ori` setelah 10 hari

### Limitasi Saat Ini

- `uploaded_by` FK ke `tenant.users` — hanya pengurus/admin yang punya akses
- Anggota IKPM (front-end only) tidak bisa upload apapun
- Tidak ada isolasi per user — semua admin lihat semua file tenant

---

## 2. Member Media Library — Perencanaan

### Konsep

Anggota IKPM yang login di front-end bisa:
1. Upload foto/file sendiri
2. Melihat **hanya file milik sendiri** — tidak bisa melihat file anggota lain atau file admin
3. Menggunakan file tersebut di form profil, pesantren, usaha (via MediaPicker member)

### Usecase Prioritas

| Usecase | Detail |
|---------|--------|
| Foto profil pesantren | Upload gambar tampak depan pesantren |
| Foto usaha | Upload foto produk/toko untuk data usaha |
| Foto profil anggota | Opsional: foto diri untuk direktori anggota |
| Dokumen pendukung | PDF ijazah, sertifikat (fase berikutnya) |

### Keputusan Arsitektur

#### Opsi yang Dipertimbangkan

| Opsi | Pro | Kontra | Keputusan |
|------|-----|--------|-----------|
| Bucket terpisah per member | Isolasi sempurna | Terlalu banyak bucket, biaya MinIO | ❌ |
| Bucket sama, filter path `members/{userId}/` | Simpel, tidak perlu schema change | Filter fragile, tidak queryable | ❌ |
| Tabel terpisah `public.member_media` | Isolasi bersih, tidak conflict tenant | Duplikasi infrastruktur upload/variant | ❌ |
| **Kolom baru `member_id` di `tenant.media` + path prefix** | Reuse infrastruktur, queryable, isolasi by column | Perlu migration | ✅ **Dipilih** |

#### Keputusan yang Dikunci

1. **Bucket sama** `tenant-{slug}` — tidak perlu bucket baru
2. **Path prefix** untuk file member: `akun/{betterAuthUserId}/{year}/{month}/{filename}`
   - Beda dari admin path (`{module}/{year}/{month}/`) → mudah dibedakan
   - Bisa di-cleanup berdasarkan path jika member hapus akun
3. **Kolom baru `member_id TEXT`** di tabel `tenant.media`:
   - Tipe TEXT (bukan UUID FK) karena referensi cross-schema ke `public.members` tidak bisa FK di Drizzle tenant factory
   - Nilainya = `public.members.id` (UUID sebagai string)
   - NULL untuk file yang diupload admin (backward compat)
   - Filter: `WHERE member_id = '{memberId}'` untuk member, `WHERE member_id IS NULL` untuk admin
4. **Modul baru `'akun'`** ditambahkan ke CHECK constraint di DDL:
   - Tidak mengubah modul admin yang sudah ada
   - Member upload selalu pakai module `'akun'`
5. **Variant sama** — reuse Sharp pipeline yang sudah ada (tidak perlu duplikasi)
6. **Upload endpoint baru** `/api/akun/media/upload` — auth via `members.betterAuthUserId`, bukan `getTenantAccess`

### Schema Change

#### DDL Migration (per tenant existing)

```sql
-- Tambah kolom member_id ke tabel media
ALTER TABLE "tenant_{slug}".media
  ADD COLUMN IF NOT EXISTS member_id TEXT;

-- Perbarui CHECK constraint modul (drop + recreate)
ALTER TABLE "tenant_{slug}".media
  DROP CONSTRAINT IF EXISTS media_module_check;

ALTER TABLE "tenant_{slug}".media
  ADD CONSTRAINT media_module_check
  CHECK (module IN ('website','members','letters','shop','general','akun'));

-- Index untuk query per member (O(1) lookup)
CREATE INDEX IF NOT EXISTS idx_media_member_id
  ON "tenant_{slug}".media(member_id)
  WHERE member_id IS NOT NULL;
```

#### `create-tenant-schema.ts` (untuk tenant baru)

Tambah `member_id TEXT` dan update CHECK constraint di DDL media.

#### Drizzle Schema (`schema/tenant/index.ts` atau file media terpisah)

```typescript
// Tambah kolom ke schema object
memberId: text("member_id"),
```

### API Routes Baru

#### `POST /api/akun/media/upload?tenant={slug}`

Auth: `auth.api.getSession()` → `members.betterAuthUserId = session.user.id`

Flow:
1. Resolve member dari session
2. Validasi file (tipe + ukuran, sama dengan admin upload)
3. Build path: `akun/{member.id}/{year}/{month}/{uuid}.webp`
4. Upload ke MinIO bucket `tenant-{slug}`
5. Proses Sharp variants (reuse `processImage()`)
6. Insert ke `tenant.media` dengan `member_id = member.id`, `module = 'akun'`
7. Return `{ id, url, variants }`

```typescript
// Route: app/api/akun/media/upload/route.ts
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });

  const slug = req.nextUrl.searchParams.get("tenant");
  if (!slug) return NextResponse.json({ error: "tenant required" }, { status: 400 });

  // Resolve member
  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Bukan anggota IKPM." }, { status: 403 });

  // ... proses upload identik dengan /api/media/upload ...
  // Beda: path = `akun/${member.id}/${year}/${month}/${uuid}`
  //        member_id = member.id di INSERT
}
```

#### `GET /api/akun/media?tenant={slug}&page={n}&search={q}`

Auth: sama — resolve member dari session.
Filter: `WHERE member_id = member.id`
Pagination: 50 per halaman (media tidak sebanyak admin).

```typescript
const rows = await tenantDb
  .select()
  .from(schema.media)
  .where(eq(schema.media.memberId, member.id))
  .orderBy(desc(schema.media.createdAt))
  .limit(50)
  .offset(page * 50);
```

#### `DELETE /api/akun/media/{id}?tenant={slug}`

Guard: pastikan `media.member_id = member.id` sebelum delete — member tidak bisa hapus file orang lain.

```typescript
const file = await tenantDb.query.media.findFirst({
  where: and(eq(schema.media.id, id), eq(schema.media.memberId, member.id)),
});
if (!file) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
// ... delete dari MinIO + delete dari DB ...
```

### Frontend

#### Halaman `/akun/media` (opsional, phase berikutnya)

Versi sederhana MediaShell untuk anggota:
- Tidak ada filter modul (semua sudah `'akun'`)
- Tidak ada batch delete orang lain
- Grid view saja (tidak perlu list view)
- Detail panel: hanya alt text (untuk aksesibilitas)
- Tombol copy URL untuk pakai di form lain

#### `MemberMediaPicker` — komponen picker untuk form anggota

Komponen baru yang akan dipakai di:
- Form edit pesantren (foto tampak depan)
- Form edit usaha (foto produk/toko)
- Form profil anggota (foto diri, opsional)

```typescript
// components/media/member-media-picker.tsx
// Mirip MediaPicker tapi:
// - Fetch dari /api/akun/media (bukan /api/media/list)
// - Upload ke /api/akun/media/upload (bukan /api/media/upload)
// - Single mode by default
// - Tampilan sederhana: grid 3 kolom, pilih + konfirmasi
```

### Urutan Eksekusi

```
Phase 1 — Schema + Backend (Foundation)
  1a. Update DDL media: tambah member_id + constraint module 'akun'
  1b. Update create-tenant-schema.ts untuk tenant baru
  1c. Migration SQL untuk tenant existing
  1d. Update Drizzle schema (tambah memberId kolom)

Phase 2 — Upload API
  2a. POST /api/akun/media/upload — auth member, path prefix 'akun/'
  2b. GET /api/akun/media — list file milik member
  2c. DELETE /api/akun/media/[id] — hapus dengan guard member_id

Phase 3 — Frontend Picker
  3a. MemberMediaPicker komponen
  3b. Integrasi ke form pesantren (foto pesantren)
  3c. Integrasi ke form usaha (foto usaha)

Phase 4 — Halaman /akun/media (opsional)
  4a. Halaman browse semua file milik sendiri
  4b. Tombol hapus per file
```

### Aturan Yang Tidak Boleh Dilanggar

1. **Guard `member_id` wajib di DELETE** — tidak pernah hapus file tanpa verifikasi kepemilikan
2. **Path prefix `akun/`** wajib untuk semua upload member — bukan `members/` (konflik dengan modul admin members)
3. **`member_id` bukan FK** — disimpan sebagai TEXT (UUID string), bukan UUID FK, karena cross-schema reference tidak bisa FK di Drizzle tenant factory
4. **Reuse `processImage()` yang sudah ada** — jangan duplikasi Sharp pipeline
5. **Batch delete tidak ada di member UI** — member hanya hapus satu per satu
6. **Admin tidak bisa lihat file member** via admin media library — filter `WHERE member_id IS NULL` di admin, `WHERE member_id = ?` di member API

---

## Catatan Status

| Fitur | Status |
|-------|--------|
| Admin Media Library | ✅ Selesai |
| Variant System (Sharp) | ✅ Selesai |
| MediaPicker (admin) | ✅ Selesai |
| MediaDetailPanel autosave | ✅ Selesai |
| Manual Crop | ✅ Selesai |
| **Member upload API** | ✅ Selesai (Phase 1-2) |
| **MemberMediaPicker** | ✅ Selesai (Phase 3) |
| **Halaman /akun/media** | ✅ Selesai (Phase 4) — **tapi lihat § 3, ada gap arsitektur** |

---

## 3. Member Media Library — Fase Global Cross-Tenant

> **Status: Step 1-4 ✅ SEMUA KODE SELESAI (2026-07-14).** Cron cleanup (Step 4) sudah ditulis
> dengan hard safety-gate tanggal — **tidak akan menghapus apapun sampai 2026-08-13**, meski
> di-deploy dan dijadwalkan crontab sekarang. Jadwalkan crontab-nya kapan saja, aman.

### Masalah yang Ditemukan

Desain Phase 1-4 (§ 2 di atas) menyimpan `member_id` di kolom `tenant_{slug}.media` — **per-tenant
schema**. Keputusan ini sengaja dibuat ("Kolom baru `member_id` di `tenant.media`" dipilih di atas
opsi "Tabel terpisah `public.member_media`") karena saat itu belum ada requirement eksplisit soal
akses lintas tenant.

Sekarang ketahuan ada **mismatch nyata** dengan bagian lain arsitektur yang sudah dikunci:

| Entitas | Lokasi schema | Scope |
|---------|--------------|-------|
| `member_businesses` (data usaha) | `public` | **Global** — satu row per member, semua tenant |
| `member_professionals` (data profesional) | `public` | **Global** — satu row per member, semua tenant |
| `member_owned_pesantren` (data pesantren) | `public` | **Global** — satu row per member, semua tenant |
| `public.members.photo_url` (foto profil) | `public` | **Global** |
| `tenant_{slug}.media` (file foto-nya sendiri) | **per-tenant** | **Terkunci ke tenant tempat upload** |

Semua data di atas (usaha/pesantren/profesional/profil) sesuai prinsip "satu akun anggota IKPM
berlaku di semua tenant" — **tapi foto pendukungnya tidak ikut prinsip yang sama**. Kalau anggota
upload foto usaha saat browsing `ikpmjogja.com`, file itu masuk `tenant_ikpmjogja.media`. Data
usahanya sendiri tetap tampil di tenant manapun (karena globalnya di `public.member_businesses`,
dan `cover_url` yang disimpan adalah URL absolut MinIO — tetap resolve dengan benar di tenant
manapun). Tapi ketika anggota buka `/akun/media` di tenant LAIN (mis. `visikita.com`), API
`GET /api/akun/media?tenant=visikita` query ke `tenant_visikita.media WHERE member_id = X` — foto
yang di-upload di `tenant_ikpmjogja.media` **tidak pernah muncul**, meski itu identitas yang sama.

**Bukti transfer/pembayaran** — dikonfirmasi TIDAK PERNAH masuk tabel `media` sama sekali (baik
tenant maupun global), by design (`docs/arsitektur-billing.md`: `POST /api/invoice/proof-upload`
upload langsung ke MinIO tanpa record DB apapun). Ini bukan bug — item terpisah untuk didiskusikan
di § "Open Question" di bawah, bukan bagian dari fix utama.

### Opsi yang Dipertimbangkan

| Opsi | Cara Kerja | Migrasi Data | Kompleksitas | Trade-off |
|------|-----------|--------------|---------------|-----------|
| **A — Full global bucket** | Bucket MinIO baru khusus (mis. `member-media`), pindahkan SEMUA file existing dari bucket per-tenant ke bucket baru | **Berat** — copy file fisik antar bucket untuk semua tenant, downtime risk, perlu update URL di `cover_url` existing yang sudah tersimpan | Tinggi | Paling "bersih" secara arsitektur, tapi risiko migrasi tinggi & effort besar untuk manfaat yang sama dengan Opsi C |
| **B — Aggregate query N-tenant saat load** *(sempat ditawarkan sebagai "fix cepat", ditolak user)* | `/akun/media` query ke SEMUA tenant tempat member terdaftar (via `tenant_memberships`), gabungkan hasil di aplikasi | Tidak perlu migrasi data | Sedang, tapi lambat (N query per load, makin banyak tenant makin lambat) | Upload baru tetap "terjebak" di tenant tempat upload — tidak benar-benar menyelesaikan akar masalah, hanya menyamarkan gejala |
| **C — Metadata global, file tetap di tempatnya (RECOMMENDED)** | Tabel baru `public.member_media` (metadata only) dengan kolom `source_tenant_slug` menunjuk bucket asal. File FISIK tetap di bucket tenant tempat upload — TIDAK PERNAH dipindah. Upload baru langsung insert ke tabel global (bukan `tenant.media`) | **Ringan** — hanya migrasi METADATA (SQL `INSERT...SELECT` per tenant), tidak ada file yang dipindah, tidak ada downtime | Sedang | File tetap "tersebar" di banyak bucket secara fisik (tidak masalah — hanya masalah kalau tenant asalnya suatu saat dihapus total, yang saat ini tidak didukung sistem) |

**Opsi C direkomendasikan** — memenuhi kebutuhan "media tetap satu, dibuka dimana saja" tanpa
migrasi data fisik yang berisiko. `cover_url` yang sudah tersimpan di `member_businesses` dkk tidak
perlu diubah sama sekali (masih URL absolut yang valid, file-nya tidak pindah).

### Desain Opsi C — Detail

#### Schema Baru: `public.member_media`

```sql
CREATE TABLE public.member_media (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  source_tenant_slug  TEXT NOT NULL,        -- bucket MinIO tempat file fisik berada ("tenant-{slug}")
  filename            TEXT NOT NULL,
  original_name       TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  size                INTEGER NOT NULL,
  path                TEXT NOT NULL,        -- path relatif di bucket source_tenant_slug
  variants            JSONB,                -- sama seperti tenant.media.variants
  processing_status   TEXT NOT NULL DEFAULT 'done',
  original_mime       TEXT,
  original_expires_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_member_media_member_id ON public.member_media(member_id);
```

Drizzle: file baru `packages/db/src/schema/public/member-media.ts`, pola sama dengan
`member-businesses.ts` (public schema table biasa, FK asli ke `public.members` karena SAMA-SAMA di
public schema — beda dengan `tenant.media.memberId` yang harus TEXT non-FK karena cross-schema).

#### Perubahan API

| Route | Perubahan |
|-------|-----------|
| `POST /api/akun/media/upload?tenant={slug}` | File tetap fisik upload ke bucket `tenant-{slug}` (TIDAK BERUBAH — reuse `uploadFile()`, `processImage()` apa adanya). Yang berubah: baris INSERT terakhir target `public.member_media` (bukan `tenant.media`), isi `sourceTenantSlug: slug` |
| `GET /api/akun/media?tenant={slug}` | Query `public.member_media WHERE member_id = X` — **hapus filter tenant sepenuhnya**, `tenant` param jadi tidak relevan untuk READ (boleh tetap diterima untuk backward compat sementara, tapi diabaikan). Setiap row resolve URL via `publicUrl(row.sourceTenantSlug, row.path)` — BUKAN `publicUrl(slug, ...)` dari query param |
| `DELETE /api/akun/media/{id}?tenant={slug}` | Query row dari `public.member_media`, guard `member_id = X`, hapus file fisik via `deleteFile(row.sourceTenantSlug, row.path)` — pakai slug ASLI dari row, bukan dari query param |

#### Perubahan Komponen

- `MemberMediaPicker` / `CoverImageField` — prop `slug` tetap ada, tapi maknanya berubah: HANYA
  dipakai sebagai "tenant bucket tujuan upload FILE BARU", tidak lagi dipakai untuk fetch (fetch
  otomatis cross-tenant). Tidak ada breaking change di call-site (`usaha-client.tsx`,
  `profesional-client.tsx`, `pesantren/page.tsx`, `lengkapi/page.tsx` semua tetap kirim `slug` yang
  sama seperti sekarang).
- `lib/minio.ts` — tidak perlu fungsi baru; `publicUrl(slug, path)` sudah generic per-slug, tinggal
  dipanggil dengan `sourceTenantSlug` dari row alih-alih `slug` dari URL saat ini.

#### Migrasi Data Existing

Untuk setiap tenant aktif, migrasi METADATA saja (bukan file):

```sql
INSERT INTO public.member_media
  (member_id, source_tenant_slug, filename, original_name, mime_type, size, path,
   variants, processing_status, original_mime, original_expires_at, created_at)
SELECT
  member_id::uuid, '{slug}', filename, original_name, mime_type, size, path,
  variants, processing_status, original_mime, original_expires_at, created_at
FROM "tenant_{slug}".media
WHERE module = 'akun' AND member_id IS NOT NULL;
```

Dijalankan per tenant (loop di script migrasi, sama pola dengan migration lain di project — lihat
`docs/migration-*.sql` untuk referensi format). **Row lama di `tenant_{slug}.media` TIDAK dihapus**
— dibiarkan sebagai arsip/rollback safety net, sudah otomatis invisible dari admin media library
(admin filter `WHERE member_id IS NULL`) jadi tidak mengganggu apapun kalau dibiarkan.

### Keputusan Final (dikunci 2026-07-14)

1. **Bukti transfer pembayaran — TETAP TERPISAH**, tidak ikut `member_media`. Alasan user: halaman
   invoice publik sengaja tidak mewajibkan login (guest checkout, lihat § "Q&A Keputusan Desain" di
   `docs/arsitektur-billing.md`) — upload bukti bayar harus tetap bisa dilakukan tanpa akun member.
   Menyatukannya ke `member_media` (yang scoped by `member_id`) akan memaksa ada login, bertentangan
   dengan alur guest checkout yang sudah dikunci. `POST /api/invoice/proof-upload` **tidak disentuh**.

2. **Bucket upload file baru — tenant tempat sedang browsing saat upload.** Tidak ada perubahan
   pada logic fisik upload (`uploadFile()`, `processImage()` tetap seperti sekarang) — hanya baris
   INSERT metadata yang pindah tujuan ke `public.member_media`.

3. **Row lama di `tenant.media` — dibiarkan 30 hari, HANYA dihapus setelah dipastikan tidak
   sedang dipakai.** Sebelum hapus row + file fisik, cron cleanup WAJIB cek apakah URL file
   tersebut masih direferensikan di salah satu dari:
   - `public.members.photo_url`
   - `public.member_businesses.cover_url`
   - `public.member_professionals.cover_url`
   - `public.member_owned_pesantren.cover_url`
   Kalau URL (hasil `publicUrl(source_tenant_slug, path)` atau salah satu `variants`) ditemukan di
   kolom manapun di atas → **skip, jangan hapus** (masih dipakai sebagai cover aktif). Kalau tidak
   ditemukan di manapun DAN `created_at` (di `tenant.media`, row lama) sudah lewat 30 hari dari
   tanggal migrasi Step 1c → aman dihapus (row DB + file fisik MinIO). Cron baru:
   `app/api/cron/cleanup-member-media-legacy/route.ts`, pola sama dengan `cleanup-images` yang
   sudah ada (`x-cron-secret` header, jalan harian via crontab VPS).

### Urutan Eksekusi (Rencana, Final)

```
Step 1 — Schema
  1a. Drizzle schema public/member-media.ts
  1b. Migration SQL: CREATE TABLE public.member_media + index
  1c. Migration SQL: backfill dari semua tenant_{slug}.media WHERE module='akun'
      (catat timestamp migrasi — jadi acuan hitung mundur 30 hari di Step 4)

Step 2 — API
  2a. POST /api/akun/media/upload — ubah target INSERT ke public.member_media
  2b. GET /api/akun/media — ubah query + resolve URL pakai source_tenant_slug per row
  2c. DELETE /api/akun/media/[id] — ubah query + delete pakai source_tenant_slug per row

Step 3 — Verifikasi
  3a. Test: upload di tenant A, cek muncul di /akun/media tenant B (cross-tenant confirmed)
  3b. Test: CoverImageField di usaha/pesantren/profesional/lengkapi masih berfungsi normal
  3c. Test: hapus foto dari tenant B, file fisik di bucket tenant A benar-benar terhapus

Step 4 — Cron Cleanup Legacy — ✅ KODE SELESAI, hard safety-gate tanggal 2026-08-13
  4a. app/api/cron/cleanup-member-media-legacy/route.ts — untuk setiap tenant, ambil
      tenant.media WHERE module='akun'
  4b. Per row: cek URL (path + tiap variant) terhadap 4 kolom referensi
      (members.photo_url, member_businesses.cover_url, member_professionals.cover_url,
      member_owned_pesantren.cover_url) — SKIP kalau ditemukan di manapun
  4c. Kalau tidak dipakai di manapun → deleteFile() dari bucket asal + DELETE row tenant.media
  4d. CLEANUP_CUTOFF = 2026-08-13 hardcoded di route — endpoint return {skipped:true} tanpa
      hapus apapun kalau dipanggil sebelum tanggal itu. Boleh deploy + jadwalkan crontab
      kapan saja (harian), pola sama dengan cleanup-images (x-cron-secret header) — aman
      karena gate tanggal ada di kode, bukan di jadwal crontab
```
