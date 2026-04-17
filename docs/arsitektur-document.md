# Arsitektur Modul Dokumen

> Status: **Proposal — belum dieksekusi**

## Konsep

Modul Dokumen adalah sistem penyimpanan dokumen resmi organisasi — SOP, laporan kegiatan, SK pelantikan,
pedoman, dll. Setiap dokumen punya kategori hierarkis, riwayat versi, dan visibilitas (internal/publik).

### Perbedaan dengan Media Library
| | Media Library | Modul Dokumen |
|---|---|---|
| Tujuan | Aset visual (foto, gambar) untuk konten | Dokumen resmi organisasi (.pdf, .docx) |
| Struktur | Flat (module + folder date) | Hierarkis (kategori bertingkat) |
| Versi | Tidak ada | Ada — arsip versi lama tetap disimpan |
| Visibilitas | Selalu internal | Internal atau Publik |
| Preview | Gambar inline | PDF viewer popup |
| Akses publik | Tidak | Ya — via halaman publik + API |

---

## Entitas Database

### 1. `document_categories` — Kategori hierarkis

```
id, name, slug
parent_id FK → document_categories (nullable, self-referential)
sort_order INTEGER DEFAULT 0
created_at
```

Hierarki tidak dibatasi level — praktiknya 2–3 level sudah cukup.
Contoh:
```
Laporan
  ├── Laporan Kegiatan
  └── Laporan Keuangan
SOP
  ├── SOP Sekretaris
  └── SOP Bendahara
SK (Surat Keputusan)
Pedoman
```

### 2. `documents` — Dokumen utama

```
id, title, description (nullable)
category_id FK → document_categories (nullable)
visibility: internal | public
current_version_id FK → document_versions (nullable — null saat baru dibuat)
tags TEXT[] (nullable — label bebas)
created_by FK → public.members (nullable)
created_at, updated_at
```

**Catatan visibilitas:**
- `internal` — hanya user yang login ke tenant (semua role: owner/admin/editor/viewer)
- `public` — siapapun bisa akses via URL publik tanpa login

### 3. `document_versions` — Riwayat versi

```
id
document_id FK → documents (CASCADE DELETE)
version_number INTEGER NOT NULL  -- 1, 2, 3, dst (auto-increment per document)
file_id FK → media.id            -- file di Media Library (MinIO bucket)
file_name TEXT NOT NULL          -- nama file asli untuk display (misal: "SOP-Sekretaris-v2.pdf")
file_size INTEGER                -- bytes, dari media.size
mime_type TEXT                   -- 'application/pdf' | 'application/vnd.openxmlformats...'
notes TEXT (nullable)            -- catatan perubahan versi ini
uploaded_by FK → public.members (nullable)
created_at
```

**Relasi:**
- `documents.current_version_id → document_versions.id` = versi aktif saat ini
- Versi lama tetap ada di tabel — tidak dihapus saat upload versi baru
- Admin bisa restore versi lama dengan update `current_version_id`

---

## Alur Versioning

```
Upload dokumen baru:
  → INSERT documents (current_version_id = null)
  → Upload file ke MinIO via Media Library (module='documents')
  → INSERT document_versions (version_number = 1)
  → UPDATE documents SET current_version_id = version.id

Upload versi baru:
  → Upload file ke MinIO
  → INSERT document_versions (version_number = max(version_number) + 1)
  → UPDATE documents SET current_version_id = new_version.id
  → Versi lama tetap ada, bisa diakses di riwayat

Restore versi lama:
  → UPDATE documents SET current_version_id = old_version.id
```

---

## Struktur Route

```
app/(dashboard)/[tenant]/dokumen/
├── layout.tsx              → dokumen shell: DokumenNav (sub-nav kiri) + slot konten kanan
├── page.tsx                → redirect ke /dokumen/semua
├── semua/
│   └── page.tsx            → list semua dokumen: tabel + search judul + filter kategori + filter visibilitas
├── new/page.tsx            → form tambah dokumen baru (DokumenForm: upload file + metadata)
├── [id]/
│   ├── page.tsx            → detail dokumen: info + preview + riwayat versi + tombol aksi
│   └── edit/page.tsx       → edit metadata dokumen (judul, kategori, visibilitas, deskripsi)
└── kategori/
    └── page.tsx            → CRUD inline kategori (tree view, drag-reorder)

app/(public)/[tenant]/dokumen/[id]/page.tsx
  → halaman publik dokumen (hanya untuk visibility=public)
  → info dokumen + tombol download/view PDF

app/api/documents/[id]/file/route.ts
  → GET: stream file dari MinIO
  → Auth check: internal → wajib login; public → bebas
  → Proxy stream agar URL MinIO tidak terekspos langsung
```

---

## Server Actions (dokumen/actions.ts)

```typescript
// Dokumen
createDocumentAction(slug, data: DocumentData)
  → INSERT documents + INSERT document_versions (version 1)

updateDocumentAction(slug, docId, data: Partial<DocumentData>)
  → UPDATE metadata saja (judul, kategori, visibilitas, deskripsi)

uploadNewVersionAction(slug, docId, { fileId, fileName, fileSize, mimeType, notes })
  → INSERT document_versions (version_number + 1) + UPDATE current_version_id

restoreVersionAction(slug, docId, versionId)
  → UPDATE documents SET current_version_id = versionId

deleteDocumentAction(slug, docId)
  → DELETE document_versions (CASCADE via FK) + DELETE documents

// Kategori
createDocumentCategoryAction(slug, { name, slug, parentId })
updateDocumentCategoryAction(slug, categoryId, { name, slug, parentId, sortOrder })
deleteDocumentCategoryAction(slug, categoryId)
  → guard: tidak ada dokumen di kategori ini (termasuk subcategori)
```

### Type DocumentData
```typescript
type DocumentData = {
  title:      string;
  description?: string | null;
  categoryId?: string | null;
  visibility: "internal" | "public";
  tags?:      string[];
  // File — wajib saat create, opsional saat edit
  fileId?:    string;   // media.id dari MediaPicker/upload
  fileName?:  string;
  fileSize?:  number;
  mimeType?:  string;
  versionNotes?: string;
};
```

---

## Komponen

```
components/dokumen/
├── dokumen-nav.tsx               → sub-nav kiri: Semua Dokumen, Kategori
├── dokumen-form.tsx              → form create/edit: upload file + metadata + MediaPicker
├── dokumen-list-client.tsx       → tabel list + search + filter + tombol tambah
├── dokumen-version-history.tsx   → riwayat versi: list version + tombol restore + download per versi
├── dokumen-pdf-viewer.tsx        → modal popup: <iframe> PDF viewer (hanya untuk mime PDF)
├── dokumen-category-client.tsx   → CRUD kategori inline dengan tree view
└── dokumen-file-upload.tsx       → komponen upload file (PDF/DOCX via MediaPicker, filter mime)
```

### DokumenForm Layout
```
[Header: ← Dokumen | tombol Simpan]
[Main area]
  Judul dokumen
  Deskripsi (textarea, opsional)
  Upload File
    └── MediaPicker (filter: .pdf, .docx, .doc)
        atau drag-drop langsung upload ke MinIO
  Catatan versi (opsional — "Apa yang berubah di versi ini?")
[Sidebar 288px]
  Visibilitas (Internal / Publik) — pill toggle
  Kategori (Combobox hierarkis)
  Tags (input bebas, comma-separated)
```

### Halaman Detail Dokumen
```
[Header: judul + badge visibilitas + tombol Edit]
[Preview area]
  PDF: tombol "Lihat PDF" → buka DokumenPdfViewer modal
  DOCX: tombol "Download" saja (tidak bisa preview inline)
[Info]
  Kategori · Tanggal upload · Ukuran file · Format
[Tombol aksi]
  Download versi aktif · Upload Versi Baru
[Riwayat Versi]
  v3 (aktif) · v2 · v1 — per versi: tanggal + catatan + download + Restore
```

---

## PDF Viewer

Pendekatan: `<iframe src="/api/documents/[id]/file?slug=">` di dalam shadcn Dialog.
- Browser modern render PDF native dalam iframe tanpa library tambahan
- DOCX tidak bisa preview → hanya tombol download
- Mobile: iframe PDF bisa tidak mulus di beberapa browser → tampilkan tombol "Buka di tab baru" sebagai fallback

```tsx
// DokumenPdfViewer
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
    <DialogHeader>...</DialogHeader>
    <iframe
      src={`/api/documents/${docId}/file?slug=${slug}`}
      className="flex-1 rounded border"
      title={fileName}
    />
  </DialogContent>
</Dialog>
```

---

## API File Proxy

```typescript
// GET /api/documents/[id]/file?slug=
export async function GET(req, { params }) {
  const { id } = params;
  const slug = req.nextUrl.searchParams.get("slug");

  // 1. Fetch dokumen
  const doc = await tenantDb.select().from(schema.documents)...

  // 2. Cek visibilitas
  if (doc.visibility === "internal") {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const access = await getTenantAccess(slug); // cek akses tenant
    if (!access) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Fetch file dari MinIO via existing getSignedUrl / proxy
  const file = await minioClient.getObject(bucket, path);
  return new Response(file, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName}"`,
    },
  });
}
```

---

## Halaman Publik

`app/(public)/[tenant]/dokumen/[id]/page.tsx`:
- Server component, tanpa auth
- Cek: tenant aktif + dokumen `visibility=public`
- Jika internal → tampilkan "Dokumen ini tidak tersedia untuk publik" (bukan 404)
- Tampilkan: judul, deskripsi, kategori, info file, tombol Download/Lihat PDF
- URL share: `{appUrl}/{tenant}/dokumen/{id}`

---

## Navigasi Sidebar

Dokumen masuk setelah Surat:
```
...
Surat      → /letters
Dokumen    → /dokumen    ← FileText icon
Keuangan   → (belum)
...
```

---

## Implementasi — Roadmap

- [ ] **Step 1 — Schema**: tabel `document_categories`, `documents`, `document_versions`; DDL di `create-tenant-schema.ts`; update sidebar
- [ ] **Step 2 — CRUD Dokumen + Kategori**: DokumenForm (create + edit), list, kategori inline, server actions
- [ ] **Step 3 — Versioning**: upload versi baru, riwayat versi, restore versi lama
- [ ] **Step 4 — File Proxy API + PDF Viewer**: `/api/documents/[id]/file`, modal preview PDF
- [ ] **Step 5 — Halaman Publik**: `/(public)/[tenant]/dokumen/[id]`, share link

---

## Keputusan yang Sudah Dikunci

1. **Isolasi tenant otomatis**: dokumen disimpan di `tenant_{slug}` schema — IKPM Jogja hanya bisa lihat dokumen IKPM Jogja. Tidak perlu logika filter tambahan, sudah dijamin oleh arsitektur multi-tenant.
2. **Visibilitas "internal"**: semua user yang login ke tenant ini (semua role: owner/admin/editor/viewer) bisa lihat. Tidak ada sub-permission antar role untuk visibilitas dokumen.
3. **Visibilitas "public"**: siapapun bisa akses via URL publik tanpa login.
4. **DOCX preview**: tidak diimplementasikan (browser tidak support native) — hanya tombol download.
5. **Soft delete**: permanent delete dengan confirmation dialog.

## Open Questions

1. **Permission upload**: semua user yang login ke tenant bisa upload, edit, dan hapus dokumen — belum ada hirarki role per-tenant. Akan diperketat saat modul User/Role diimplementasikan nanti.
