# Arsitektur Sistem Mitra — jalajogja

Dokumen ini mendefinisikan sistem **Mitra** — mekanisme bagi anggota IKPM untuk
berjualan produk di toko tenant sebagai mitra resmi.

**Keterkaitan dokumen:**
- `docs/arsitektur-product.md` — modul produk yang diperluas
- `docs/arsitektur-keanggotaan.md` — identitas anggota IKPM (`public.members`)
- `docs/arsitektur-akun.md` — tiga level akses, login front-end anggota
- `docs/arsitektur-image.md` — gambar produk mitra (module `shop`)

---

## Konsep Utama

```
Dua jenis produk di toko IKPM:
┌──────────────────────────────────────────────────────┐
│  Produk Tenant (internal)                            │
│  Dibuat oleh admin/editor di dashboard               │
│  seller_type = "tenant"                              │
├──────────────────────────────────────────────────────┤
│  Produk Mitra (anggota IKPM)                         │
│  Dibuat oleh anggota IKPM yang sudah disetujui       │
│  seller_type = "mitra", mitra_id → mitras.id         │
│  Tampil dengan nama usaha mitra                      │
└──────────────────────────────────────────────────────┘
```

**Mitra adalah per-tenant** — satu anggota bisa menjadi mitra di banyak cabang,
tapi di setiap cabang memiliki satu akun mitra dengan satu usaha utama.

---

## Syarat Menjadi Mitra

Untuk mendaftar sebagai mitra di tenant tertentu, anggota harus memenuhi **semua** syarat:

1. **Anggota IKPM** — terdaftar di `public.members` (alumni Gontor)
2. **Anggota tenant ini** — ada di `public.tenant_memberships` untuk tenant ini
3. **Sudah melengkapi data usaha** — minimal satu `public.member_businesses` dengan `is_active = true`
4. **Belum punya akun mitra** di tenant ini (satu member = satu mitra per tenant)
5. **Tidak sedang menunggu** review pengajuan yang pending

---

## Alur Lengkap

```
[Anggota IKPM]
    │
    ▼
Buka /{slug}/akun/mitra
    │
    ├── Belum punya usaha? → Arahkan ke /akun/usaha (isi data usaha dulu)
    │
    ├── Belum apply? → Tampilkan form pengajuan
    │   └── Pilih usaha (dropdown dari member_businesses)
    │       + Motivasi/deskripsi singkat
    │       → Submit → mitra_applications (status=pending)
    │
    ├── Status pending? → Tampilkan "Menunggu review admin"
    │
    ├── Status rejected? → Tampilkan alasan + tombol ajukan ulang
    │
    └── Status approved? → Tampilkan dashboard mitra
            ├── Link ke /akun/mitra/produk (kelola produk)
            └── Statistik sederhana (total produk, total pesanan)

[Admin dashboard /{slug}/toko/mitra]
    ├── Tab "Pengajuan" — list pending applications + review
    │   └── Klik → lihat detail member + data usaha → Approve / Tolak
    └── Tab "Mitra Aktif" — list mitra + toggle suspend/aktifkan
```

---

## Database Schema

### Tabel Baru: `tenant_{slug}.mitra_applications`

```sql
CREATE TABLE IF NOT EXISTS "{s}".mitra_applications (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id        UUID         NOT NULL,   -- FK → public.members via DDL
    business_id      UUID         NOT NULL,   -- FK → public.member_businesses via DDL
    motivation       TEXT,                    -- alasan/deskripsi (opsional)
    status           TEXT         NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected','cancelled')),
    rejection_reason TEXT,
    applied_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    reviewed_at      TIMESTAMPTZ,
    reviewed_by      UUID,                    -- FK → officers.id via DDL (nullable)
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mitra_applications_member_pending
  ON "{s}".mitra_applications (member_id)
  WHERE status = 'pending';
-- Satu pending application per member per tenant
```

### Tabel Baru: `tenant_{slug}.mitras`

```sql
CREATE TABLE IF NOT EXISTS "{s}".mitras (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id        UUID         NOT NULL UNIQUE,  -- satu mitra per member per tenant
    business_id      UUID         NOT NULL,          -- usaha utama yang didaftarkan
    application_id   UUID,                           -- FK → mitra_applications.id via DDL
    status           TEXT         NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active','suspended')),
    suspension_reason TEXT,
    approved_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    approved_by      UUID,                           -- FK → officers.id via DDL (nullable)
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mitras_status ON "{s}".mitras (status);
```

### Perubahan Tabel: `tenant_{slug}.products`

```sql
-- Tambah dua kolom untuk membedakan produk tenant vs mitra
ALTER TABLE "{s}".products
  ADD COLUMN IF NOT EXISTS seller_type TEXT NOT NULL DEFAULT 'tenant'
    CHECK (seller_type IN ('tenant', 'mitra')),
  ADD COLUMN IF NOT EXISTS mitra_id UUID REFERENCES "{s}".mitras(id) ON DELETE SET NULL;
```

### Drizzle Schema

```typescript
// packages/db/src/schema/tenant/mitra.ts — BARU

export const MITRA_APPLICATION_STATUSES = ["pending","approved","rejected","cancelled"] as const;
export const MITRA_STATUSES = ["active","suspended"] as const;

export function createMitraApplicationsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("mitra_applications", {
    id:              uuid("id").primaryKey().defaultRandom(),
    memberId:        uuid("member_id").notNull(),       // FK → public.members via DDL
    businessId:      uuid("business_id").notNull(),     // FK → public.member_businesses via DDL
    motivation:      text("motivation"),
    status:          text("status", { enum: MITRA_APPLICATION_STATUSES }).notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    appliedAt:       timestamp("applied_at",   { withTimezone: true }).notNull().defaultNow(),
    reviewedAt:      timestamp("reviewed_at",  { withTimezone: true }),
    reviewedBy:      uuid("reviewed_by"),               // FK → officers.id via DDL
    createdAt:       timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
  });
}

export function createMitrasTable(s: ReturnType<typeof pgSchema>) {
  return s.table("mitras", {
    id:               uuid("id").primaryKey().defaultRandom(),
    memberId:         uuid("member_id").notNull().unique(),
    businessId:       uuid("business_id").notNull(),
    applicationId:    uuid("application_id"),
    status:           text("status", { enum: MITRA_STATUSES }).notNull().default("active"),
    suspensionReason: text("suspension_reason"),
    approvedAt:       timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
    approvedBy:       uuid("approved_by"),
    createdAt:        timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp("updated_at",  { withTimezone: true }).notNull().defaultNow(),
  });
}
```

```typescript
// Perubahan di shop.ts — tambah ke createProductsTable()
export const SELLER_TYPES = ["tenant", "mitra"] as const;

// Tambah dua kolom:
sellerType: text("seller_type", { enum: SELLER_TYPES }).notNull().default("tenant"),
mitraId:    uuid("mitra_id"),  // FK → mitras.id via DDL
```

---

## Route Structure

### Dashboard Admin

```
app/(dashboard)/[tenant]/toko/
└── mitra/
    ├── page.tsx           → Tab "Pengajuan" + Tab "Mitra Aktif"
    └── [id]/page.tsx      → Detail aplikasi: info member + usaha + tombol Approve/Tolak
                             Detail mitra aktif: info + produk + tombol Suspend/Aktifkan
```

Terintegrasi ke `toko-nav.tsx` — tambah item "Mitra".

### Front-end Mitra (anggota login)

```
app/(public)/[tenant]/akun/mitra/
├── page.tsx               → Status mitra + dashboard (jika aktif)
├── apply/page.tsx         → Form pengajuan (pilih usaha + motivasi)
└── produk/
    ├── page.tsx           → List produk mitra sendiri
    ├── new/page.tsx       → Buat produk baru
    └── [id]/edit/page.tsx → Edit produk
```

**Auth**: Semua route ini dilindungi — wajib login sebagai anggota IKPM
(`members.better_auth_user_id = session.user.id`).

---

## API Routes

### Mitra Self-Service (anggota)

```
GET  /api/mitra/status?slug=      → cek status + info mitra
POST /api/mitra/apply             → daftar menjadi mitra (body: { slug, businessId, motivation })
POST /api/mitra/cancel-apply      → batalkan pengajuan pending

GET  /api/mitra/products?slug=    → list produk milik mitra yang login
POST /api/mitra/products          → buat produk baru (body: ProductData + slug)
PATCH /api/mitra/products/[id]    → edit produk (hanya jika mitraId cocok)
DELETE /api/mitra/products/[id]   → hapus produk
```

### Admin Actions (dashboard server actions)

```typescript
// app/(dashboard)/[tenant]/toko/mitra/actions.ts
approveMitraAction(slug, applicationId)     → insert mitras + update application status
rejectMitraAction(slug, applicationId, reason)
suspendMitraAction(slug, mitraId, reason)
reactivateMitraAction(slug, mitraId)
```

---

## Komponen

```
components/toko/
└── mitra/
    ├── mitra-application-list.tsx  → list aplikasi pending (admin)
    ├── mitra-active-list.tsx       → list mitra aktif (admin)
    ├── mitra-review-client.tsx     → form approve/tolak (admin)
    └── mitra-product-form.tsx      → form produk mitra (frontend, reuse ProductForm)

components/akun/
└── mitra/
    ├── mitra-status-card.tsx       → status + CTA (frontend member)
    ├── mitra-apply-form.tsx        → form pengajuan (pilih usaha + motivasi)
    └── mitra-product-list.tsx      → list produk milik mitra (frontend)
```

---

## Tipe Data

```typescript
// Untuk display di admin dan frontend
export type MitraApplicationDetail = {
  id:           string;
  memberId:     string;
  memberName:   string;        // dari public.members.name
  memberNumber: string | null; // dari public.members.member_number
  businessId:   string;
  businessName: string;        // dari public.member_businesses.name
  businessSector: string;
  motivation:   string | null;
  status:       "pending" | "approved" | "rejected" | "cancelled";
  rejectionReason: string | null;
  appliedAt:    string;
};

export type MitraDetail = {
  id:           string;
  memberId:     string;
  memberName:   string;
  businessId:   string;
  businessName: string;
  businessBrand: string | null;
  status:       "active" | "suspended";
  suspensionReason: string | null;
  productCount: number;     // JOIN COUNT dari products
  approvedAt:   string;
};
```

---

## Validasi & Keamanan

### Server-side checks saat `POST /api/mitra/apply`:
1. Session valid + anggota IKPM (`members.better_auth_user_id = session.user.id`)
2. Member ada di `tenant_memberships` untuk tenant ini
3. `businessId` milik member yang login (`member_businesses.member_id = member.id`)
4. Business `is_active = true`
5. Tidak ada `mitras` row untuk member ini di tenant ini
6. Tidak ada `mitra_applications` dengan `status = 'pending'` untuk member ini

### Server-side checks saat `POST/PATCH /api/mitra/products`:
1. Session valid + anggota IKPM
2. Mitra `status = 'active'` untuk tenant ini
3. Untuk PATCH/DELETE: `products.mitra_id = mitraId` (tidak bisa edit produk mitra lain)
4. `seller_type` di-set hardcode ke `"mitra"`, `mitra_id` diambil dari session (tidak dari client)

### Produk mitra di front-end publik:
- Hanya tampil jika `products.status = 'active'` AND `mitras.status = 'active'`
- JOIN ke `mitras` wajib untuk filter ini

---

## Integrasi dengan Produk Existing

### Query produk di front-end publik

```typescript
// Filter produk yang boleh tampil:
WHERE p.status = 'active'
  AND (
    p.seller_type = 'tenant'
    OR (p.seller_type = 'mitra' AND m.status = 'active')
  )
LEFT JOIN mitras m ON m.id = p.mitra_id
```

### Tampilan produk mitra di card

Produk mitra menampilkan badge "Mitra" + nama usaha di bawah judul:
```
┌──────────────────┐
│ [Gambar Produk]  │
├──────────────────┤
│ Nama Produk      │
│ Rp 150.000       │
│ 🏪 Batik Sanjaya ← nama usaha mitra
│ [badge Mitra]    │
└──────────────────┘
```

### ProductCardData — perlu field tambahan

```typescript
export type ProductCardData = {
  // ... existing fields ...
  sellerType:   "tenant" | "mitra";
  businessName: string | null;   // null untuk produk tenant
  mitraId:      string | null;
};
```

### Admin produk list — perlu filter baru

Di `/{slug}/toko/produk`, admin bisa filter:
- Semua produk (tenant + mitra)
- Produk tenant saja
- Produk mitra saja (+ filter per mitra)

---

## Nomor & Identifikasi Mitra

Mitra tidak punya nomor terpisah. Identifikasi via:
- `member_number` (No. ID IKPM) — sudah ada
- `business_name` — dari `member_businesses.name`

---

## Notifications (Future)

Saat event berikut, kirim notifikasi (email/WA jika add-on aktif):
- Pengajuan mitra submitted → notif ke admin
- Pengajuan approved → notif ke member
- Pengajuan rejected → notif ke member + alasan
- Mitra suspended → notif ke member + alasan
- Produk mitra dihapus admin → notif ke member

---

## Urutan Implementasi

```
Phase 1 — Schema & Admin
  Step 1: Drizzle schema baru (mitra.ts) + shop.ts update seller_type/mitra_id
  Step 2: DDL create-tenant-schema.ts (mitra_applications + mitras + ALTER products)
  Step 3: Admin actions (approve/reject/suspend/reactivate)
  Step 4: Admin routes: /toko/mitra/ + /toko/mitra/[id]
  Step 5: toko-nav.tsx — tambah item Mitra

Phase 2 — Frontend Mitra
  Step 6: GET /api/mitra/status — cek status + eligibility check
  Step 7: POST /api/mitra/apply + cancel
  Step 8: Frontend: /akun/mitra + /akun/mitra/apply
  Step 9: CRUD API /api/mitra/products
  Step 10: Frontend: /akun/mitra/produk/*

Phase 3 — Integrasi Produk
  Step 11: ProductCardData — tambah sellerType + businessName
  Step 12: Fetch produk front-end — JOIN mitras + filter status
  Step 13: ProductCard display — badge Mitra + nama usaha
  Step 14: Admin produk list — filter seller_type
```

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| Schema: `mitra_applications` + `mitras` (Drizzle) | ⬜ Belum |
| Schema: `products.seller_type` + `products.mitra_id` | ⬜ Belum |
| DDL: `create-tenant-schema.ts` update | ⬜ Belum |
| Admin: `approveMitraAction`, `rejectMitraAction`, dst | ⬜ Belum |
| Admin: `/toko/mitra/` list + review | ⬜ Belum |
| `toko-nav.tsx` tambah item Mitra | ⬜ Belum |
| API: `GET /api/mitra/status` | ⬜ Belum |
| API: `POST /api/mitra/apply` + validasi | ⬜ Belum |
| Frontend: `/akun/mitra` + `/akun/mitra/apply` | ⬜ Belum |
| API: CRUD `/api/mitra/products` | ⬜ Belum |
| Frontend: `/akun/mitra/produk/*` | ⬜ Belum |
| `ProductCardData` update + card display mitra | ⬜ Belum |
| Fetch produk publik: JOIN mitras + filter | ⬜ Belum |
| Admin produk list: filter seller_type | ⬜ Belum |

---

## Pertanyaan Terbuka

1. **Limit produk per mitra**: apakah ada batas jumlah produk yang bisa di-upload mitra?
2. **Komisi**: apakah ada sistem komisi dari penjualan mitra? (jika ya, butuh kolom tambahan di orders)
3. **Review produk**: apakah produk mitra perlu di-approve admin sebelum tampil publik?
4. **Multiple tenant**: jika mitra dari PC Jogja ingin jual juga di PC Semarang — apakah bisa apply di sana juga?
