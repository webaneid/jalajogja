# Arsitektur Media Library — jalajogja

Dokumen ini mencakup dua scope:
1. **Admin Media Library** — sudah ada dan berjalan (`/{slug}/media`)
2. **Member Media Library** — perencanaan: anggota IKPM bisa upload & kelola foto sendiri

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
| **Member upload API** | ⬜ Belum (Phase 1-2) |
| **MemberMediaPicker** | ⬜ Belum (Phase 3) |
| **Halaman /akun/media** | ⬜ Belum (Phase 4, opsional) |
