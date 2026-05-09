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

**Mitra adalah per-tenant dan terikat cabang** — mitra hanya bisa mendaftar di
tenant yang mana dia terdaftar sebagai anggota (`tenant_memberships`). Tidak bisa
mendaftar di cabang lain meskipun anggota di beberapa cabang.

---

## Syarat Menjadi Mitra

Untuk mendaftar sebagai mitra di tenant tertentu, anggota harus memenuhi **semua** syarat:

1. **Anggota IKPM** — terdaftar di `public.members` (alumni Gontor)
2. **Anggota cabang ini** — ada di `public.tenant_memberships` untuk tenant ini
   *(tidak bisa mendaftar di cabang lain, hanya cabang tempat dia terdaftar)*
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

## Model Harga & Komisi

### Dua Harga per Produk Mitra

Setiap produk mitra wajib memiliki dua harga:

| Field | Nama | Deskripsi |
|-------|------|-----------|
| `price` | Harga Umum | Harga untuk pembeli umum (non-anggota) |
| `member_price` | Harga IKPM | Harga khusus anggota IKPM — selalu ≤ `price` |

Produk **tenant internal** hanya memiliki satu harga (`price`). `member_price` hanya
relevan untuk produk mitra.

### Sistem Komisi (Bagi Hasil)

IKPM mengambil komisi minimum dari setiap transaksi produk mitra.
Persentase minimum dikonfigurasi di **Pengaturan Toko** (bukan Settings General).

**Formula:**

```
commission_rate     = setting "min_komisi_mitra" (misal: 10%)
IKPM commission     = price × commission_rate   (selalu dari harga umum, bukan harga member)
member_price_max    = price - IKPM commission
                    = price × (1 - commission_rate)

Contoh: price = 100.000, commission_rate = 10%
→ IKPM commission   = 10.000 (selalu, dari setiap penjualan)
→ member_price_max  = 90.000 (batas atas harga IKPM yang boleh diset mitra)
```

**Aturan validasi member_price:**
- `member_price ≤ price × (1 - commission_rate)` — WAJIB, tidak boleh dilanggar
- `member_price ≥ 0` — tidak boleh negatif
- Mitra boleh set `member_price` lebih rendah dari `member_price_max` (berarti mitra
  memberikan diskon lebih besar ke anggota, IKPM tetap dapat komisimya)
- Mitra **tidak boleh** set `member_price` lebih tinggi dari `member_price_max`
  (itu artinya mengurangi komisi IKPM di bawah minimum)

**Auto-kalkulasi di form mitra:**

```
User input: price = 100.000
                         ↓ (otomatis)
Sistem tampilkan: "Harga IKPM maksimum: Rp 90.000"
User bisa set:    member_price = 90.000 (tepat minimum komisi)
                  member_price = 80.000 (komisi lebih besar, mitra dapat lebih sedikit)
                  member_price = 95.000 ← DITOLAK (komisi di bawah minimum)
```

### Alur Keuangan per Transaksi

Semua pembayaran masuk ke **rekening tenant (IKPM cabang)**, tidak ke rekening mitra.
Pencairan ke mitra dilakukan via `disbursements` (modul keuangan existing).

```
Pembeli bayar Rp 100.000 (harga umum)
         ↓
Masuk ke rekening tenant IKPM
         ↓
Dicatat sebagai Order → Payment → dikonfirmasi admin
         ↓
Admin buat Disbursement ke mitra:
  Jumlah disbursed = price - IKPM_commission
                   = 100.000 - 10.000
                   = 90.000 → dikirim ke rekening mitra

(Untuk pembelian anggota dengan member_price = 90.000)
  Jumlah disbursed = member_price - IKPM_commission
                   = 90.000 - 10.000
                   = 80.000 → dikirim ke rekening mitra
```

**Snapshot komisi di order:** Saat order dibuat, `commission_rate` yang berlaku saat itu
di-snapshot ke `order_items.commission_rate_snapshot` — agar perubahan setting di masa depan
tidak mempengaruhi perhitungan order lama.

### Rekening Mitra

Mitra **tidak** mempunyai rekening yang terdaftar di sistem toko.
Pencairan dilakukan admin secara manual via `disbursements`.
Info rekening mitra diambil dari `public.contacts` (data kontak usaha mereka).

---

## Pengaturan Toko (`/toko/pengaturan`)

Sub-menu baru di bawah Toko — **bukan** di `/settings/`. Toko memiliki pengaturan
tersendiri yang terpisah dari pengaturan umum tenant.

### Route

```
app/(dashboard)/[tenant]/toko/pengaturan/
└── page.tsx   → Pengaturan Toko (single page, beberapa section)
```

Tambahkan ke `toko-nav.tsx` sebagai item terakhir: "Pengaturan".

### Isi Pengaturan Toko

Disimpan di `tenant_{slug}.settings` dengan group `"toko"`:

```
key="mitra_enabled"         group="toko"  value=true|false
key="mitra_max_products"    group="toko"  value=20   (0 = tidak terbatas)
key="min_komisi_mitra"      group="toko"  value=10   (persen, 0–100)
key="toko_description"      group="toko"  value="Deskripsi toko"
key="toko_banner_url"       group="toko"  value="..."
key="toko_whatsapp"         group="toko"  value="+628xxx"
```

**Section dalam halaman Pengaturan Toko:**

```
┌─────────────────────────────────────────────────────┐
│ Sistem Mitra                                        │
│ Aktifkan Mitra  [toggle on/off]                     │
│ Batas produk per mitra: [20____] (0 = tak terbatas) │
│ Komisi minimum IKPM:    [10___]% per transaksi      │
│                                                     │
│ ℹ️  Contoh: komisi 10%, produk Rp 100.000           │
│    → Harga IKPM maks: Rp 90.000                     │
│    → IKPM dapat: Rp 10.000 per penjualan            │
├─────────────────────────────────────────────────────┤
│ Info Toko                                           │
│ Deskripsi toko: [textarea]                          │
│ Nomor WhatsApp: [input]                             │
│ Banner toko:    [MediaPicker]                       │
└─────────────────────────────────────────────────────┘
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
-- Tambah kolom untuk membedakan produk tenant vs mitra + harga member
ALTER TABLE "{s}".products
  ADD COLUMN IF NOT EXISTS seller_type TEXT NOT NULL DEFAULT 'tenant'
    CHECK (seller_type IN ('tenant', 'mitra')),
  ADD COLUMN IF NOT EXISTS mitra_id UUID REFERENCES "{s}".mitras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_price NUMERIC(15,2);  -- harga khusus anggota IKPM (mitra only)
```

### Perubahan Tabel: `tenant_{slug}.order_items`

```sql
-- Snapshot komisi saat order dibuat — agar tidak berubah jika setting diubah kemudian
ALTER TABLE "{s}".order_items
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot NUMERIC(5,2),  -- misal: 10.00 (persen)
  ADD COLUMN IF NOT EXISTS ikpm_commission_amount   NUMERIC(15,2); -- nominal komisi IKPM
  -- Untuk produk tenant: kedua kolom NULL (tidak ada komisi mitra)
  -- Untuk produk mitra: diisi saat order confirmed
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

// Tambah tiga kolom ke products:
sellerType:  text("seller_type", { enum: SELLER_TYPES }).notNull().default("tenant"),
mitraId:     uuid("mitra_id"),                                  // FK → mitras.id via DDL
memberPrice: numeric("member_price", { precision: 15, scale: 2 }),  // harga IKPM (mitra only)

// Tambah dua kolom ke order_items:
commissionRateSnapshot:    numeric("commission_rate_snapshot",  { precision: 5,  scale: 2 }),
ikpmCommissionAmount:      numeric("ikpm_commission_amount",    { precision: 15, scale: 2 }),
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
5. **Validasi harga:** `member_price ≤ price × (1 - commission_rate)` — commission_rate diambil dari settings toko saat ini
6. **Batas produk:** jika `mitra_max_products > 0`, cek COUNT produk mitra yang ada

### Hak admin atas produk mitra:
- Admin **dapat menghapus atau menonaktifkan** produk mitra kapanpun, tanpa alasan
- Tidak perlu persetujuan mitra — mitra menerima notifikasi (jika add-on aktif)
- **Produk mitra TIDAK perlu review admin** untuk aktif — setelah mitra approved, produk bisa langsung `status = 'active'`
- Admin tetap bisa override ke `status = 'archived'` / hapus

### Produk mitra di front-end publik:
- Hanya tampil jika `products.status = 'active'` AND `mitras.status = 'active'`
- JOIN ke `mitras` wajib untuk filter ini
- Anggota IKPM yang login → tampilkan `member_price` sebagai harga
- Pembeli umum → tampilkan `price` sebagai harga

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
  price:        string;          // harga umum
  memberPrice:  string | null;   // harga IKPM — null untuk produk tenant
  sellerType:   "tenant" | "mitra";
  businessName: string | null;   // null untuk produk tenant
  mitraId:      string | null;
};
```

**Display harga di card:**
- Pembeli umum: tampilkan `price`
- Anggota IKPM login: tampilkan `memberPrice` (jika ada) dengan badge "Harga Member" + `price` dicoret
- Produk tenant: tampilkan `price` saja

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
Phase 0 — Pengaturan Toko
  Step 1: Settings helper group "toko" di DB (sudah ada mechanism-nya)
  Step 2: /toko/pengaturan/ — halaman pengaturan toko
  Step 3: toko-nav.tsx — tambah item "Pengaturan" (terakhir)
  Step 4: Form: mitra_enabled, mitra_max_products, min_komisi_mitra, info toko

Phase 1 — Schema & Admin Mitra
  Step 5: Drizzle schema baru (mitra.ts) — mitra_applications + mitras
  Step 6: shop.ts — seller_type + mitra_id + member_price di products
         + commission_rate_snapshot + ikpm_commission_amount di order_items
  Step 7: DDL create-tenant-schema.ts update
  Step 8: Admin actions (approve/reject/suspend/reactivate)
  Step 9: Admin routes: /toko/mitra/ + /toko/mitra/[id]
  Step 10: toko-nav.tsx — tambah item "Mitra"

Phase 2 — Frontend Mitra (anggota)
  Step 11: GET /api/mitra/status — cek status + eligibility check + settings
  Step 12: POST /api/mitra/apply + cancel
  Step 13: Frontend: /akun/mitra + /akun/mitra/apply
  Step 14: CRUD API /api/mitra/products — validasi member_price + batas produk
  Step 15: Frontend: /akun/mitra/produk/*

Phase 3 — Integrasi Produk & Transaksi
  Step 16: ProductCardData — tambah sellerType + businessName + memberPrice
  Step 17: Fetch produk publik — JOIN mitras + filter status
  Step 18: ProductCard display — harga member / badge Mitra / nama usaha
  Step 19: Admin produk list — filter seller_type
  Step 20: Order flow — snapshot commission_rate saat order confirmed
           + disbursement calculation helper untuk mitra
```

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| `/toko/pengaturan/` — halaman pengaturan toko | ⬜ Belum (Phase 0) |
| `toko-nav.tsx` tambah item Pengaturan + Mitra | ⬜ Belum |
| Schema: `mitra_applications` + `mitras` (Drizzle) | ⬜ Belum (Phase 1) |
| Schema: `products` + kolom baru + `order_items` + kolom baru | ⬜ Belum |
| DDL: `create-tenant-schema.ts` update | ⬜ Belum |
| Admin: `approveMitraAction`, `rejectMitraAction`, `suspendMitraAction` | ⬜ Belum |
| Admin: `/toko/mitra/` list + `/toko/mitra/[id]` review | ⬜ Belum |
| API: `GET /api/mitra/status` | ⬜ Belum (Phase 2) |
| API: `POST /api/mitra/apply` + validasi eligibility | ⬜ Belum |
| Frontend: `/akun/mitra` + `/akun/mitra/apply` | ⬜ Belum |
| API: CRUD `/api/mitra/products` + validasi member_price | ⬜ Belum |
| Frontend: `/akun/mitra/produk/*` | ⬜ Belum |
| `ProductCardData` update (sellerType + memberPrice + businessName) | ⬜ Belum (Phase 3) |
| Fetch produk publik: JOIN mitras + tampilkan member_price | ⬜ Belum |
| ProductCard display: harga member + badge Mitra | ⬜ Belum |
| Admin produk list: filter seller_type | ⬜ Belum |
| Order flow: snapshot commission_rate + disbursement calc | ⬜ Belum |

---

## Keputusan yang Sudah Dikunci

| Keputusan | Nilai |
|-----------|-------|
| Batas produk per mitra | Dikonfigurasi di Pengaturan Toko. Default: 20. Nilai 0 = tidak terbatas. |
| Komisi minimum | Dikonfigurasi di Pengaturan Toko (%). Default: 10%. Wajib ada. |
| Formula komisi | `IKPM_commission = price × commission_rate` (dari harga umum, bukan harga member) |
| Batas member_price | `member_price ≤ price × (1 - commission_rate)` — divalidasi server-side |
| Review produk | Tidak perlu — mitra approved → produk langsung bisa aktif |
| Hapus/nonaktif produk | Admin bisa kapanpun tanpa alasan |
| Scope mitra | Hanya di cabang tempat terdaftar (`tenant_memberships`) |
| Rekening pembayaran | Selalu rekening tenant/IKPM — tidak ada rekening mitra di sistem |
| Pencairan ke mitra | Manual via `disbursements` (modul keuangan existing) |
| Transaksi | Melalui universal payment system (orders → payments → finance) |
