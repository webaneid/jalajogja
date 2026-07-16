# Arsitektur: Modul Donasi / Infaq

## Status
> **IMPLEMENTED** — modul sudah dibangun dan berjalan. Update dokumen ini setiap ada perubahan arsitektur.

---

## 0. Konsep Utama

Modul Donasi adalah fitur untuk organisasi menghimpun dana dari anggota maupun publik.
Berbeda dari Modul Toko (transaksi barang), Donasi adalah **nirlaba** — ada kampanye, ada laporan, ada sertifikat.

**Empat entitas utama:**
```
campaign_categories → klasifikasi campaign (Sosial, Kesehatan, Pendidikan, dll)
campaigns           → program penggalangan dana (dengan target, periode, kategori, SEO)
donations           → satu record donatur per transaksi (identitas + relasi campaign)
payments            → pembayaran universal (source_type='donation') — nominal + status + konfirmasi
```

**Donatur bisa:**
- Anggota yang login (`member_id` terisi)
- Publik tanpa akun (`member_id` null, isi nama/email/phone manual)
- Anonim (nama disembunyikan di laporan publik, `is_anonymous = true`)

**Donasi tanpa campaign:** `campaign_id = null` → ditampilkan sebagai "Donasi Umum".

---

## 1. Kategori Campaign

Kategori campaign adalah entitas terpisah (tabel `campaign_categories`), bisa di-CRUD oleh admin.
Contoh: Sosial, Kesehatan, Pendidikan, Infrastruktur, Kemanusiaan, Lingkungan.

**Berbeda dari `campaignType`** (enum tetap): `campaignType` adalah jenis syariat donasi,
`categoryId` adalah klasifikasi program untuk filter dan navigasi.

| Field | Tipe | Keterangan |
|-------|------|------------|
| `campaignType` | enum (donasi/zakat/wakaf/qurban) | Jenis syariat — hardcoded |
| `categoryId` | FK → campaign_categories | Tema program — fleksibel, admin bisa tambah |

---

## 2. Schema Database

### 2a. Tabel `campaign_categories`

```sql
id         UUID        PK DEFAULT gen_random_uuid()
name       TEXT        NOT NULL
slug       TEXT        NOT NULL UNIQUE
sort_order INTEGER     NOT NULL DEFAULT 0
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

CRUD oleh admin di `/donasi/kategori`. Guard: tidak bisa dihapus jika masih ada campaign.

---

### 2b. Tabel `campaigns`

```sql
id               UUID        PK
slug             TEXT        NOT NULL UNIQUE    -- URL publik: /{tenant}/donasi/{slug}
title            TEXT        NOT NULL
description      TEXT                           -- HTML dari Tiptap (nullable)
category_id      UUID        → campaign_categories.id ON DELETE SET NULL
campaign_type    TEXT        NOT NULL DEFAULT 'donasi'
                             CHECK IN ('donasi','zakat','wakaf','qurban')
target_amount    NUMERIC(15,2)                  -- null = tanpa target
collected_amount NUMERIC(15,2) NOT NULL DEFAULT 0  -- di-update atomic saat konfirmasi
cover_id         UUID        → media.id ON DELETE SET NULL
status           TEXT        NOT NULL DEFAULT 'draft'
                             CHECK IN ('draft','active','closed','archived')
starts_at        TIMESTAMPTZ                    -- null = langsung aktif
ends_at          TIMESTAMPTZ                    -- null = tanpa deadline
show_donor_list  BOOLEAN     NOT NULL DEFAULT true
show_amount      BOOLEAN     NOT NULL DEFAULT true

-- SEO (untuk halaman publik campaign)
meta_title       TEXT
meta_desc        TEXT
og_title         TEXT
og_description   TEXT
og_image_id      UUID        → media.id ON DELETE SET NULL
twitter_card     TEXT        DEFAULT 'summary_large_image'
                             CHECK IN ('summary','summary_large_image')
focus_keyword    TEXT
canonical_url    TEXT
robots           TEXT        NOT NULL DEFAULT 'index,follow'
                             CHECK IN ('index,follow','noindex','noindex,nofollow')
schema_type      TEXT        NOT NULL DEFAULT 'WebPage'
structured_data  JSONB

created_by       UUID        → officers.id ON DELETE SET NULL
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**`collected_amount` update pattern:**
```typescript
// Atomic increment — bukan read-then-write
await db.update(schema.campaigns).set({
  collectedAmount: sql`collected_amount + ${String(amount)}`,
  updatedAt: new Date(),
}).where(eq(schema.campaigns.id, campaignId));
```

---

### 2c. Tabel `donations`

```sql
id               UUID        PK
donation_number  TEXT        NOT NULL UNIQUE    -- DON-YYYYMM-NNNNN
campaign_id      UUID        → campaigns.id ON DELETE SET NULL (null = donasi umum)
donation_type    TEXT        NOT NULL DEFAULT 'donasi'
                             CHECK IN ('donasi','zakat','wakaf','qurban')
member_id        UUID        → public.members.id ON DELETE SET NULL (null = publik)
donor_name       TEXT        NOT NULL
donor_phone      TEXT
donor_email      TEXT
donor_message    TEXT
is_anonymous     BOOLEAN     NOT NULL DEFAULT false
certificate_url  TEXT                           -- URL PDF sertifikat di MinIO
certificate_sent_at TIMESTAMPTZ
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Catatan:** Amount, status, dan bukti bayar ada di tabel `payments` (bukan embedded di donations).
Relasi: `payments.source_type = 'donation'`, `payments.source_id = donations.id`.

---

### 2d. Tabel `payments` (universal — bukan khusus donasi)

```sql
source_type    TEXT  -- 'donation' | 'order' | 'invoice' | 'manual'
source_id      UUID  -- FK polymorphic → donations.id (jika source_type='donation')
amount         NUMERIC(15,2)
unique_code    INTEGER DEFAULT 0   -- 3 digit random, hanya untuk transfer
method         TEXT   -- 'cash' | 'transfer' | 'qris'
status         TEXT   -- 'pending' | 'submitted' | 'paid' | 'cancelled'
confirmed_by   UUID   → public auth user
confirmed_at   TIMESTAMPTZ
transaction_id UUID   → transactions.id (jurnal keuangan)
```

---

### 2e. Tabel `donation_sequences`

```sql
id      UUID    PK
year    INTEGER NOT NULL
month   INTEGER NOT NULL
counter INTEGER NOT NULL DEFAULT 0
UNIQUE (year, month)
```

Format nomor: `DON-YYYYMM-NNNNN`
Generator: `generateDonationNumber(tenantDb)` — atomic SELECT FOR UPDATE per bulan.

---

## 3. Alur Payment & Akuntansi

### Unique Code
Hanya untuk metode `transfer` (bukan cash/qris):
```
total_amount = amount + unique_code
Contoh: donasi Rp 100.000 + kode 234 → transfer Rp 100.234
```
Tujuan: memudahkan identifikasi transfer di mutasi bank rekening.

### Alur Status

```
payments.status:
  pending     → donasi baru diinput admin, belum ada bukti
  submitted   → cash otomatis submitted (tidak perlu bukti)
  paid        → admin konfirmasi
  cancelled   → dibatalkan
```

### Saat Konfirmasi (`confirmDonationAction`)

1. `payments.status = 'paid'`, set `confirmed_by`, `confirmed_at`
2. Cari akun dari `settings.account_mappings` (key `'account_mappings'`, group `'keuangan'`):
   - `cash_default` atau `bank_default` → akun Kas
   - `dana_titipan` → akun Dana Titipan (liability, kode 2200)
3. `recordIncome(tenantDb, { cashAccountId, incomeAccountId: dana_titipan, amount })`
   → jurnal: **Debit Kas / Kredit Dana Titipan**
4. Atomic increment `campaigns.collected_amount` (jika ada campaign)

**Alasan Dana Titipan (bukan Pendapatan langsung):**
Donasi adalah amanah — uang belum bisa diakui sebagai pendapatan sampai disalurkan.
Dana Titipan adalah liabilitas (hutang kepada donatur/penerima manfaat).

**Dependency:** Jika mapping akun belum dikonfigurasi (`dana_titipan = null`),
konfirmasi gagal dengan pesan "Atur di Keuangan → Akun → Mapping".

---

## 4. Route Structure

```
app/(dashboard)/[tenant]/donasi/
├── layout.tsx                    → shell: DonasiNav + slot konten kanan
├── page.tsx                      → redirect ke /campaign
├── actions.ts                    → SEMUA server actions donasi
├── campaign/
│   ├── page.tsx                  → list campaign: tabel + search client-side
│   ├── new/page.tsx              → blank form (create-on-save, tidak pre-create)
│   └── [id]/
│       ├── page.tsx              → detail: progress bar + daftar donasi + DonationActions
│       └── edit/page.tsx         → CampaignForm lengkap
├── transaksi/
│   ├── page.tsx                  → semua donasi lintas campaign: tabel + search
│   ├── new/page.tsx              → input donasi manual oleh admin
│   └── [id]/page.tsx             → detail donasi: info + payment + bukti + TransaksiActions
└── kategori/
    └── page.tsx                  → CRUD inline kategori campaign
```

**Route publik** (tanpa auth, grup `(public)`):
```
app/(public)/[tenant]/donasi/
└── [slug]/page.tsx               → halaman campaign publik (belum diimplementasi)
```

---

## 5. Server Actions (`donasi/actions.ts`)

```typescript
// Campaign CRUD
createCampaignAction(slug, data: CampaignData)
  → validasi title + slug, insert campaigns, return campaignId
updateCampaignAction(slug, campaignId, data: CampaignData)
  → update semua field (termasuk SEO)
toggleCampaignStatusAction(slug, campaignId)
  → siklus: draft → active → closed → archived → draft
deleteCampaignAction(slug, campaignId)
  → blokir jika ada donasi (count > 0), hapus jika kosong

// Campaign Category CRUD
createCampaignCategoryAction(slug, { name, slug })
updateCampaignCategoryAction(slug, categoryId, { name, slug })
deleteCampaignCategoryAction(slug, categoryId)
  → blokir jika masih ada campaign yang pakai kategori ini

// Donasi
createDonationAction(slug, data: DonationData)
  → generate DON-YYYYMM-NNNNN + 620-PAY-YYYYMM-NNNNN
  → insert donations + insert payments
  → cash: payments.status = 'submitted' (tidak perlu bukti)
  → transfer: payments.status = 'pending' + unique_code
confirmDonationAction(slug, paymentId)
  → payments.status = 'paid'
  → recordIncome() → Debit Kas / Kredit Dana Titipan
  → atomic increment campaigns.collected_amount
cancelDonationAction(slug, donationId)
  → payments.status = 'cancelled' (hanya jika belum paid)
```

### Tipe Data

```typescript
type CampaignData = {
  slug, title, description?, categoryId?,
  campaignType: "donasi" | "zakat" | "wakaf" | "qurban",
  targetAmount?, coverId?, status,
  startsAt?, endsAt?, showDonorList, showAmount,
  // SEO
  metaTitle?, metaDesc?, ogTitle?, ogDescription?,
  ogImageId?, twitterCard?, focusKeyword?,
  canonicalUrl?, robots?, schemaType?,
}

type DonationData = {
  campaignId?, donationType, memberId?,
  donorName, donorPhone?, donorEmail?, donorMessage?,
  isAnonymous, amount, method, bankAccountRef?, qrisAccountRef?,
}
```

---

## 6. Komponen Client

```
components/donasi/
├── donasi-nav.tsx                     → sub-nav: Campaign, Transaksi, Kategori
├── campaign-form.tsx                  → form campaign lengkap:
│                                         - TiptapEditor (deskripsi)
│                                         - MediaPicker (cover)
│                                         - Combobox: Kategori + Jenis
│                                         - Input: slug, target, tanggal, toggle tampilan
│                                         - SeoPanel (meta, OG, advanced)
├── campaign-list-client.tsx           → tabel campaign + search client-side
│                                         CreateCampaignButton → navigate ke /new
├── campaign-category-manage-client.tsx → CRUD inline kategori:
│                                         tambah form, edit inline per baris, hapus (guard)
├── donation-actions.tsx               → tombol Eye/CheckCircle2/XCircle per donasi
│                                         confirm/cancel dengan useTransition + router.refresh
├── donation-form.tsx                  → form input donasi manual admin:
│                                         Combobox campaign + jenis + metode bayar
│                                         toggle anonim, field donatur
├── transaksi-list-client.tsx          → tabel transaksi + search
└── transaksi-actions.tsx              → confirm/cancel di halaman detail transaksi
```

---

## 7. Form Campaign — Detail Implementasi

### Layout
```
[Header sticky: ← Campaign | StatusBadge | Tombol Ubah Status | Simpan]

[Main — scroll]                    [Sidebar 288px]
  Judul (Input h-12)                 Kategori (Combobox)
  Slug (font-mono)                   ─────────────────
  Deskripsi (TiptapEditor)           Jenis (Combobox: donasi/zakat/wakaf/qurban)
  SeoPanel (accordion)               ─────────────────
                                     Gambar Cover (MediaPicker)
                                     ─────────────────
                                     Target Nominal (Input Rp)
                                     Tanggal Mulai (datetime-local)
                                     Tanggal Berakhir (datetime-local)
                                     ─────────────────
                                     Tampilan Publik:
                                       Toggle: Daftar donatur
                                       Toggle: Jumlah terkumpul
                                     ─────────────────
                                     [Hapus Campaign] (jika campaignId ada)
```

### Logika Tombol Status

| Status aktif | Tombol outline | Tombol primary |
|---|---|---|
| `draft` | "Aktifkan" | "Simpan" |
| `active` | "Tutup" | "Simpan" |
| `closed` | "Arsipkan" | "Simpan" |
| `archived` | "Jadikan Draft" | "Simpan" |

### Create vs Edit Mode
- `campaignId = null` → create mode: tombol "Buat Campaign", tidak ada Hapus/Ubah Status
- `campaignId = string` → edit mode: tombol "Simpan", ada Hapus + Ubah Status
- Redirect setelah create: `router.push(/${slug}/donasi/campaign/${id}/edit)`

### Slug Auto-generate
```typescript
const [slugEdited, setSlugEdited] = useState(false);
// Saat title berubah: if (!slugEdited) setSlug(toSlug(title))
// Saat user edit slug manual: setSlugEdited(true)
```

---

## 8. SEO Campaign

Campaign memiliki SEO penuh — identik dengan modul Produk dan Post.

| Field | Default | Keterangan |
|-------|---------|------------|
| `metaTitle` | "" | Title tag halaman publik |
| `metaDesc` | "" | Meta description |
| `ogTitle` | "" | Open Graph title (share medsos) |
| `ogDescription` | "" | Open Graph description |
| `ogImageId` | null | Gambar OG (dari Media Library) |
| `twitterCard` | `summary_large_image` | Twitter/X card type |
| `focusKeyword` | "" | Keyword untuk scoring SEO |
| `canonicalUrl` | "" | Canonical URL (opsional) |
| `robots` | `index,follow` | Robots directive |
| `schemaType` | `WebPage` | Schema.org type |
| `structuredData` | null | JSON-LD kustom |

**Schema.org options untuk campaign:** `WebPage`, `Event`, `DonateAction`

SeoPanel: `contentType="campaign"` — accordion di bawah TiptapEditor di main area.

---

## 9. Pembayaran Campaign

Rekening bank dan QRIS diambil dari `settings.payment` dengan kategori `donasi`.
Fallback ke `general` jika tidak ada rekening/QRIS berlabel `donasi`.

Lihat juga: **`CLAUDE.md` → Arsitektur Settings → Kategori Rekening & QRIS**.

---

## 10. Sertifikat Donasi (PDF)

> **Belum diimplementasi.** Dicatat untuk roadmap.

Template sederhana via Playwright:
```
[Logo Organisasi]
SERTIFIKAT DONASI
Nomor: DON-202604-00001

Diberikan kepada: [Nama Donatur]
Telah berdonasi sebesar: Rp [nominal]
untuk campaign: [nama campaign]
Jenis: [campaignType]

[Kota], [tanggal konfirmasi]
[Tanda tangan pengurus]
```

Pola: identik dengan PDF surat (`lib/letter-html.ts` → Playwright → MinIO).
Path MinIO: `/donations/{year}/{month}/{donation_number}.pdf`
URL disimpan di `donations.certificate_url`.

---

## 11. Halaman Publik Donasi

URL: `app/(public)/[tenant]/campaign/[slug]/page.tsx` — grup `(public)`, tanpa auth.

**✅ SELESAI. Alur implementasi berbeda dari desain awal — baca catatan berikut.**

### Alur Donasi Publik — SEKARANG (cart universal)

Form donasi menggunakan `addToCartAction(itemType:"donation", itemId:campaignId)` → `checkoutAction` → invoice.
**Tidak ada row baru di tabel `donations`** — tabel itu legacy.

Anonimitas: `notes = "Anonim"` di cart item → tersimpan di `invoice_items.description`.

Menampilkan:
- Judul + deskripsi + cover campaign
- Progress bar: `collected_amount / target_amount` + persentase (tampil meski tanpa target)
- Daftar donatur (jika `show_donor_list = true`): **wajib gabung dua sumber**
  - Legacy: `donations` INNER JOIN `payments` WHERE `status='paid'` → anonimitas dari `is_anonymous`
  - Cart-based (utama): `invoice_items` INNER JOIN `invoices` WHERE `itemType='donation' AND itemId=campaignId AND invoices.status='paid'` → anonimitas dari `description === "Anonim"`, nama dari `invoices.customerName`
  - Merge → sort by `createdAt` desc → limit 100
- Jumlah terkumpul (jika `show_amount = true`)
- Form donasi via cart universal (lihat `campaign-detail-client.tsx`)

**Meta tags** dari kolom SEO campaign (meta_title, og_title, og_image_id, dll).
Tidak perlu login. Jika sudah login → nama + phone + email terisi otomatis dari session.
Setelah add-to-cart → popup: "Donasi program lain?" Ya → `/campaign`, Tidak → express checkout langsung ke invoice (jika login) atau inline login form (jika belum login).

### Catatan `revalidate = 60`
Halaman di-cache 60 detik. Data donor baru bisa telat tampil hingga 1 menit setelah pembayaran dikonfirmasi. Ini diterima — bukan bug.

---

## 11b. Front-end Publik — CampaignCard + CampaignsSection + Halaman Arsip & Detail

> **Status**: Perencanaan selesai. Implementasi belum dimulai.

---

### Prinsip Utama: Satu Alur Universal

Donasi menggunakan **alur cart universal** — identik dengan Toko. Tidak ada alur
pembayaran terpisah untuk donasi.

```
Donasi Reguler (donasi/zakat/wakaf):
  Detail page → pilih nominal (chips + custom) → add to cart
  → checkout → bayar → admin konfirmasi → recordIncome (Dana Titipan)

Donasi Qurban:
  Detail page → pilih hewan (= variasi) → isi atas nama (= notes) → add to cart
  → checkout → bayar → admin konfirmasi → assign slot patungan → Dana Titipan
```

**Qurban = campaign dengan variasi hewan** — persis seperti produk dengan variasi ukuran/warna.
`qurban_animals` adalah tabel variasi. `atas_nama` masuk ke `cart_item.notes`.
Slot patungan sapi di-assign saat admin konfirmasi pembayaran (bukan saat cart).

```typescript
// Donasi reguler
addToCartAction(slug, {
  itemType:  "donation",
  itemId:    campaign.id,
  name:      campaign.title,
  unitPrice: nominal,       // yang dipilih user dari chips/custom
});

// Qurban (hewan = variasi)
addToCartAction(slug, {
  itemType:  "donation",
  itemId:    qurbanAnimal.id,   // ID variasi hewan, bukan campaign
  name:      `Qurban ${labelHewan} — ${campaign.title}`,
  unitPrice: pricePerSlot + slaughterFee,
  notes:     `Atas nama: ${atasNama}`,
});
```

---

### URL Publik

```
/{slug}/campaign                          → arsip semua campaign aktif
/{slug}/campaign?type={campaignType}      → filter by tipe (donasi/zakat/wakaf/qurban)
/{slug}/campaign?category={categorySlug}  → filter by kategori
/{slug}/campaign/kategori/{categorySlug}  → dedicated category archive
/{slug}/campaign/{campaignSlug}           → detail + form donasi/qurban
```

> **Catatan URL**: `/{slug}/campaign` bukan `/{slug}/donasi` — karena `/donasi` sudah
> dipakai dashboard admin. Pattern sama dengan `/produk` (bukan `/toko`).
> `nav-menu.ts` case `"donasi"` sudah di-update ke `/campaign`.

---

### CampaignCardData

```typescript
// lib/campaign-card-templates.ts (file baru)
export type CampaignCardData = {
  id:              string;
  title:           string;
  slug:            string;
  description:     string | null;
  campaignType:    "donasi" | "zakat" | "wakaf" | "qurban";
  coverUrl:        string | null;
  coverVariants?:  Record<string, string> | null;
  categoryName:    string | null;
  targetAmount:    string | null;    // null = tanpa target
  collectedAmount: string;
  progressPercent: number | null;    // pre-computed, null jika tanpa target
  endsAt:          string | null;    // ISO string
  isRecurring:     boolean;
};

export const CAMPAIGN_CARD_VARIANTS = ["grid", "list", "ringkas"] as const;
export type CampaignCardVariant = typeof CAMPAIGN_CARD_VARIANTS[number];

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  donasi: "Donasi",
  zakat:  "Zakat",
  wakaf:  "Wakaf",
  qurban: "Qurban",
};
```

---

### Card Variants

| Variant | Deskripsi | Dipakai di |
|---------|-----------|------------|
| `grid` | Cover (aspect-video) + badge tipe + judul + progress bar + sisa hari | Design 1, Design 2 (kecil) |
| `list` | Horizontal: thumbnail kecil + judul + progress mini + badge tipe | Design 3 |
| `ringkas` | Cover + judul + progress bar tipis saja | Design 2 (featured inline) |

**Progress bar** hanya tampil jika `targetAmount != null`. Qurban tidak punya progress bar
(targetnya adalah stok hewan, bukan uang — sudah tampil di detail page).

---

### Section Designs

```typescript
// lib/campaigns-section-designs.ts (file baru)
export type CampaignsSectionData = {
  title:        string;
  count:        number;          // default 6
  categoryId:   string | null;
  campaignType: "donasi" | "zakat" | "wakaf" | "qurban" | null; // null = semua tipe
};

export const CAMPAIGNS_SECTION_DESIGN_IDS = ["1", "2", "3"] as const;

// Design 1 — Grid Donasi
// 3 kolom campaign-card-grid, cocok untuk semua tipe campaign

// Design 2 — Campaign Unggulan
// 1 campaign terbaru besar (inline: cover kiri, info+progress kanan) + 2 card grid kecil

// Design 3 — Daftar Donasi (Compact)
// List vertikal campaign-card-list, cocok untuk widget sidebar atau section sempit
```

**Filter di section** bisa berdasarkan:
- `categoryId` — kategori campaign (Sosial, Kesehatan, dll)
- `campaignType` — jenis (donasi/zakat/wakaf/qurban)
- `null` — semua campaign aktif

---

### Integrasi Landing Page

Tambah `"campaigns"` ke `SECTION_TYPES` di `lib/page-templates.ts`:

```typescript
// lib/page-templates.ts
export const SECTION_TYPES = [
  "hero", "posts", "products", "events", "campaigns", "gallery", "about_text",
] as const;

// Default data untuk section campaigns
campaigns: { title: "Donasi & Infaq", count: 6, categoryId: null, campaignType: null }
```

Di `landing-template.tsx`:
```typescript
case "campaigns": return <CampaignsSection data={...} variant={...} tenantClient={...} tenantSlug={...} />;
```

Di section editor (`website/page/[id]/edit`): tambah design picker untuk campaigns.

---

### Halaman Arsip Campaign

```
app/(public)/[tenant]/campaign/
├── page.tsx                              → arsip utama (semua campaign aktif)
├── kategori/
│   └── [categorySlug]/page.tsx          → arsip per kategori
└── [campaignSlug]/page.tsx              → detail + form donasi/qurban (sudah ada, perlu refactor)
```

**Archive `page.tsx`**: filter chips (tipe + kategori), grid 3 kolom, pagination.
**Query params**: `?type=qurban`, `?category=sosial`, `?page=2`

---

### Halaman Detail Campaign — Dua Mode UI

Server component fetch campaign → pass ke `CampaignDetailClient` (client component).

**Mode 1: Campaign Reguler (donasi/zakat/wakaf)**

```
┌─────────────────────────────────────────────┐
│  [Cover campaign]                           │
│  Judul Campaign                Badge Tipe   │
│  Progress bar (jika ada target)             │
│  Deskripsi                                  │
├─────────────────────────────────────────────┤
│  [Sticky sidebar kanan]                     │
│  Pilih Nominal:                             │
│  [Rp 10K] [Rp 25K] [Rp 50K] [Rp 100K]     │  ← dari settings.donation_config
│  [Nominal lain: Rp ____________]            │
│                                             │
│  Nama Donatur: [________________]           │  ← pre-fill jika login
│  Pesan (opsional): [____________]           │
│  [ ] Sembunyikan nama (anonim)              │
│                                             │
│  [+ Tambah ke Keranjang]                    │
└─────────────────────────────────────────────┘
```

**Mode 2: Campaign Qurban (qurban)**

```
┌─────────────────────────────────────────────┐
│  [Cover campaign]                           │
│  Qurban 1446 H / 2025 M      Badge Qurban  │
│  Deskripsi                                  │
├─────────────────────────────────────────────┤
│  [Sticky sidebar kanan]                     │
│  Pilih Hewan:  ← cards seperti variasi     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │🐑 Domba  │ │🐐 Kambing│ │🐄 Sapi   │   │
│  │Rp 2,5jt  │ │Rp 1,8jt  │ │Patungan 7│   │
│  │Stok: 8   │ │Stok: 3   │ │Rp 2,1jt/org│ │
│  └──────────┘ └──────────┘ └──────────┘   │
│                                             │
│  Atas Nama (Shohibul Qurban):               │
│  [________________________________]         │
│  [ ] Atas nama saya sendiri                 │
│                                             │
│  Biaya Penyembelihan: Rp XXX                │
│  Total: Rp XXX                              │
│                                             │
│  [+ Tambah ke Keranjang]                    │
└─────────────────────────────────────────────┘
```

**Perbedaan hanya di pilihan nominal/hewan** — aksi akhir sama: `addToCartAction`.

---

### CampaignDetailClient — Komponen Shared

```typescript
// components/donasi/public/campaign-detail-client.tsx
type Props = {
  campaign:      CampaignDetailData;
  qurbanAnimals: QurbanAnimalData[];    // kosong jika bukan qurban
  slaughterFees: { domba: number; kambing: number; sapi: number };
  recommendedAmounts: number[];         // dari settings, untuk campaign reguler
  defaultName:   string;               // pre-fill dari session
  tenantSlug:    string;
  session:       { userId: string } | null;
};
```

Mode ditentukan dari `campaign.campaignType === "qurban"` — bukan dua komponen berbeda.

---

### Refactor QurbanOrderForm yang Sudah Ada

`QurbanOrderForm` (sudah dibuat) harus **diganti** dengan bagian dari `CampaignDetailClient`.
Hapus file `qurban-order-form.tsx` saat implementasi, integrasikan ke dalam satu komponen.

Keuntungan: satu komponen untuk semua tipe campaign, lebih mudah maintain.

---

### Fetch Layer CampaignsSection

```typescript
async function fetchCampaigns(
  tenantClient: TenantDb,
  data: CampaignsSectionData,
  tenantSlug: string,
): Promise<CampaignCardData[]> {
  const { db, schema } = tenantClient;

  const clauses = [
    eq(schema.campaigns.status, "active"),
    ...(data.categoryId    ? [eq(schema.campaigns.categoryId,    data.categoryId)]    : []),
    ...(data.campaignType  ? [eq(schema.campaigns.campaignType,  data.campaignType)]  : []),
  ];

  const rows = await db
    .select({ id, title, slug, description, campaignType, coverId,
              targetAmount, collectedAmount, endsAt, categoryName, isRecurring })
    .from(schema.campaigns)
    .leftJoin(schema.campaignCategories, ...)
    .where(and(...clauses))
    .orderBy(desc(schema.campaigns.createdAt))
    .limit(data.count ?? 6);

  // Resolve cover URLs
  // Pre-compute progressPercent
  return rows.map(r => ({
    ...r,
    progressPercent: r.targetAmount
      ? Math.round((parseFloat(r.collectedAmount) / parseFloat(r.targetAmount)) * 100)
      : null,
    coverUrl: /* resolveMediaUrl(r.coverId) */,
  }));
}
```

---

### Urutan Implementasi

```
Phase C — CampaignCard + CampaignsSection + Halaman Publik

Step C1: lib/campaign-card-templates.ts
  - CampaignCardData type
  - CAMPAIGN_CARD_VARIANTS

Step C2: lib/campaigns-section-designs.ts
  - CampaignsSectionData type
  - CAMPAIGNS_SECTION_DESIGN_IDS + design registry

Step C3: Tambah "campaigns" ke lib/page-templates.ts
  - SECTION_TYPES, SECTION_LABELS, SECTION_DEFAULTS
  - landing-template.tsx case

Step C4: CampaignCard (3 variant)
  - components/website/public/campaign-cards/campaign-card.tsx
  - campaign-card-grid.tsx + campaign-card-list.tsx + campaign-card-ringkas.tsx

Step C5: CampaignsSection (3 design)
  - components/website/public/sections/campaigns/campaigns-section.tsx
  - campaigns-design-1.tsx + campaigns-design-2.tsx + campaigns-design-3.tsx

Step C6: Archive pages
  - app/(public)/[tenant]/campaign/page.tsx — refactor dari yang sudah ada
  - app/(public)/[tenant]/campaign/kategori/[categorySlug]/page.tsx
  - Filter: ?type= + ?category=

Step C7: Detail page + CampaignDetailClient
  - Refactor app/(public)/[tenant]/campaign/[slug]/page.tsx
  - Ganti QurbanOrderForm dengan CampaignDetailClient unified
  - Mode reguler: nominal chips + custom input + addToCartAction
  - Mode qurban: hewan cards (= variasi) + atasNama + addToCartAction
  - Sapi patungan: unitPrice = price/split + slaughterFee, notes = "Atas nama: X"

Step C8: Section editor
  - Tambah campaigns ke section editor di /website/page/[id]/edit
  - Filter picker: kategori + tipe campaign
```

---

## 12. Donasi Rutin (Recurring) — Perencanaan

> **Status**: Belum diimplementasi. Dokumen ini adalah perencanaan lengkap.

---

### 12a. Konsep

Donasi rutin adalah **komitmen berlangganan** dari anggota — mereka mendaftar satu kali
dan sistem mengingatkan (atau menagih) setiap periode secara otomatis.

```
Admin buat campaign "Donasi Jumat Berkah" (is_recurring = true)
  → tentukan interval: mingguan / bulanan / tahunan
  → tentukan pilihan nominal: [Rp 10.000, Rp 25.000, Rp 50.000, Rp 100.000]

Anggota buka front-end dashboard → pilih campaign → subscribe
  → pilih nominal dari pilihan yang admin buat
  → sistem simpan subscription: next_due_at = sekarang + interval

Setiap periode (cron harian):
  → cari subscription yang due hari ini
  → generate draft donation + kirim reminder ke anggota (WA/email)
  → anggota klik link → konfirmasi bayar seperti biasa
```

**Model: reminder-based, bukan auto-debit.**
Auto-debit membutuhkan integrasi rekening bank atau payment gateway recurring.
Sistem jalakarta menggunakan konfirmasi manual → reminder adalah pilihan yang realistis.
Auto-debit bisa ditambahkan di fase berikutnya jika gateway mendukung.

---

### 12b. Keputusan Desain yang Dikunci

| Keputusan | Pilihan | Alasan |
|-----------|---------|--------|
| Siapa yang bisa subscribe | Anggota IKPM saja | Perlu identitas untuk notifikasi + riwayat |
| Nominal | Dari pilihan admin (tidak bebas) | Lebih mudah dikelola + analitik yang bersih |
| Interval | Mingguan / Bulanan / Tahunan | Cukup untuk kebutuhan umum |
| Billing model | Reminder-based | Tidak butuh gateway recurring |
| Jika anggota tidak bayar | Lanjut cycle berikutnya | Tidak suspend — ini donasi, bukan langganan SaaS |
| Cancel subscription | Kapan saja oleh anggota | Self-service di dashboard |

---

### 12c. Perubahan Schema

#### Perubahan `campaigns` — tambah kolom recurring

```sql
ALTER TABLE "{s}".campaigns
  ADD COLUMN IF NOT EXISTS is_recurring       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_interval TEXT        -- 'weekly' | 'monthly' | 'yearly' | null
                                               CHECK (recurring_interval IN ('weekly','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS recurring_amounts  JSONB;      -- [10000, 25000, 50000, 100000]
```

**Drizzle:**
```typescript
isRecurring:        boolean("is_recurring").notNull().default(false),
recurringInterval:  text("recurring_interval", { enum: ["weekly","monthly","yearly"] }),
recurringAmounts:   jsonb("recurring_amounts").$type<number[]>(),
```

**Aturan:**
- `is_recurring = true` → `recurringInterval` wajib diisi
- `recurringAmounts` = pilihan nominal yang admin tentukan (bukan rekomendasi global)
- Campaign recurring tidak punya `defaultAmount` atau `targetAmount` — tidak relevan

---

#### Tabel baru `donation_subscriptions`

```sql
CREATE TABLE "{s}".donation_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL REFERENCES "{s}".campaigns(id) ON DELETE CASCADE,
  member_id    UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount       NUMERIC(15,2) NOT NULL,         -- nominal yang dipilih anggota
  interval     TEXT        NOT NULL
               CHECK (interval IN ('weekly','monthly','yearly')),
  status       TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','paused','cancelled')),
  next_due_at  TIMESTAMPTZ NOT NULL,           -- kapan reminder berikutnya dikirim
  last_paid_at TIMESTAMPTZ,                    -- terakhir kali donasi dikonfirmasi
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, member_id)              -- satu anggota satu subscription per campaign
);

CREATE INDEX idx_subscriptions_next_due ON "{s}".donation_subscriptions(next_due_at)
  WHERE status = 'active';
CREATE INDEX idx_subscriptions_member   ON "{s}".donation_subscriptions(member_id);
```

---

#### Perubahan `donations` — link ke subscription

```sql
ALTER TABLE "{s}".donations
  ADD COLUMN IF NOT EXISTS subscription_id UUID
    REFERENCES "{s}".donation_subscriptions(id) ON DELETE SET NULL;
```

Setiap donasi yang di-generate dari subscription akan punya `subscription_id` terisi.
Donasi manual / one-time tetap `subscription_id = null`.

---

### 12d. Alur Subscription Anggota

```
[Front-end: /{slug}/campaign/{campaignSlug}]

Halaman campaign recurring:
  → Tampil pilihan nominal dari campaign.recurring_amounts
  → Tampil interval (mis. "Setiap Bulan")
  → Tombol "Subscribe Donasi Bulanan"

Anggota klik Subscribe:
  → Pilih nominal dari list (chip selection)
  → Konfirmasi: "Anda akan menerima reminder donasi setiap bulan sebesar Rp 50.000"
  → createSubscriptionAction() → INSERT donation_subscriptions
    - next_due_at = NOW() + interval (mis. +1 bulan)
    - status = 'active'
  → Tampil: "Berhasil berlangganan! Reminder pertama akan dikirim pada {next_due_at}"
```

---

### 12e. Alur Reminder (Cron Job)

```
Cron: setiap hari jam 07.00 WIB
→ Jalankan: generateRecurringDonationsJob(slug)

Untuk setiap subscription WHERE status='active' AND next_due_at <= NOW():
  1. Generate draft donation:
     INSERT donations { campaignId, memberId, amount, subscriptionId, status='pending' }
     INSERT payments { sourceType='donation', sourceId=donationId, status='pending' }

  2. Kirim reminder ke anggota:
     → WhatsApp (jika add-on aktif): "Halo {nama}, saatnya donasi rutin Anda untuk
       {campaign.title} sebesar Rp {amount}. Klik: {link konfirmasi}"
     → Email (jika SMTP dikonfigurasi): sama

  3. Update subscription:
     next_due_at = next_due_at + interval
     (contoh: jika monthly, tambah 1 bulan dari next_due_at lama)

Anggota klik link → halaman konfirmasi bayar
  → Pilih metode bayar → bayar → upload bukti
  → Admin konfirmasi → status donation = 'paid', subscription.last_paid_at = NOW()
```

**Toleransi keterlambatan**: jika anggota tidak bayar, reminder tetap dikirim lagi di periode
berikutnya. Tidak ada penalti, tidak ada suspend — ini donasi, bukan tagihan wajib.

---

### 12f. Dashboard Anggota — Manage Subscriptions

Route: `/{slug}/akun/subscriptions`

```
┌─────────────────────────────────────────────────────┐
│  Donasi Rutin Saya                                  │
├─────────────────────────────────────────────────────┤
│  📅 Donasi Jumat Berkah                              │
│  Rp 50.000 / Bulan                                  │
│  Reminder berikutnya: 1 Juni 2026                   │
│  Status: Aktif                          [Batalkan]  │
├─────────────────────────────────────────────────────┤
│  📅 Infaq Pendidikan                                │
│  Rp 25.000 / Mingguan                               │
│  Reminder berikutnya: Jumat, 16 Mei 2026            │
│  Status: Aktif                          [Batalkan]  │
└─────────────────────────────────────────────────────┘
```

**Actions:**
- Cancel → `cancelSubscriptionAction` → status = 'cancelled'
- Pause (opsional fase 2) → status = 'paused', system skip reminder

---

### 12g. Admin View — Subscriber per Campaign

Di halaman detail campaign recurring, tab tambahan "Subscriber":

```
Campaign: Donasi Jumat Berkah
Total Subscriber Aktif: 42 orang
Total Terkumpul Bulan Ini: Rp 1.750.000

┌────────────────┬──────────┬────────────┬────────────┬──────────┐
│ Nama Anggota   │ Nominal  │ Interval   │ Terakhir   │ Status   │
├────────────────┼──────────┼────────────┼────────────┼──────────┤
│ Ahmad Fauzi    │ Rp 50K   │ Bulanan    │ 1 Mei 2026 │ Aktif    │
│ Budi Santoso   │ Rp 25K   │ Mingguan   │ 8 Mei 2026 │ Aktif    │
│ ...            │          │            │            │          │
└────────────────┴──────────┴────────────┴────────────┴──────────┘
```

---

### 12h. CampaignForm — Perubahan untuk Recurring

Saat `is_recurring = true`, sidebar tampil section **Konfigurasi Rutin**:

```
┌─────────────────────────────────────────────────────┐
│  Donasi Rutin  [✓]                                  │
│                                                     │
│  Interval:                                          │
│  ○ Mingguan  ● Bulanan  ○ Tahunan                   │
│                                                     │
│  Pilihan Nominal:                                   │
│  [Rp 10.000 ✕] [Rp 25.000 ✕] [Rp 50.000 ✕]        │
│  [+ Tambah nominal]                                 │
│                                                     │
│  Maksimal 4 pilihan nominal                         │
└─────────────────────────────────────────────────────┘
```

Field yang disembunyikan untuk campaign recurring:
- Target Nominal (tidak relevan)
- Nominal Tetap (tidak relevan — user pilih dari list)
- Konfigurasi Qurban (bukan qurban)

---

### 12i. Server Actions Baru

```typescript
// createSubscriptionAction — anggota subscribe
createSubscriptionAction(slug, { campaignId, memberId, amount, interval })
  → validasi: campaign is_recurring=true, amount in recurring_amounts
  → INSERT donation_subscriptions, next_due_at = NOW() + interval
  → return { subscriptionId, nextDueAt }

// cancelSubscriptionAction — anggota cancel
cancelSubscriptionAction(slug, subscriptionId)
  → validasi: subscription.memberId === current user
  → UPDATE status = 'cancelled'

// generateRecurringDonationsJob — dipanggil cron
generateRecurringDonationsJob(slug)
  → SELECT subscriptions WHERE status='active' AND next_due_at <= NOW()
  → Untuk tiap subscription: INSERT donation + INSERT payment + kirim notif
  → UPDATE next_due_at += interval

// getMySubscriptionsAction — dashboard anggota
getMySubscriptionsAction(slug, memberId)
  → SELECT dengan JOIN campaigns
```

---

### 12j. Integrasi Notifikasi

| Channel | Trigger | Isi Pesan |
|---------|---------|-----------|
| WhatsApp | Reminder H-0 | "Saatnya donasi {campaign.title} sebesar Rp {amount}" + link |
| Email | Reminder H-0 | Sama + tombol konfirmasi |
| WhatsApp | Konfirmasi terima | "Terima kasih atas donasi Anda 🙏" |

**Dependency**: Add-on WhatsApp harus aktif untuk notifikasi WA.
Jika tidak ada add-on WA dan tidak ada SMTP → reminder tidak terkirim (silent fail, bukan error).

---

### 12k. Urutan Implementasi

```
Phase R — Donasi Rutin
  Step R1: Schema
    - Kolom is_recurring, recurring_interval, recurring_amounts di campaigns
    - Tabel donation_subscriptions
    - Kolom subscription_id di donations

  Step R2: CampaignForm
    - Toggle is_recurring + section konfigurasi rutin
    - Input pilihan nominal (max 4, sama dengan recommendation chips)

  Step R3: Front-end subscribe
    - Halaman campaign recurring: pilih nominal + tombol subscribe
    - createSubscriptionAction

  Step R4: Dashboard anggota
    - /{slug}/akun/subscriptions — list + cancel
    - getMySubscriptionsAction + cancelSubscriptionAction

  Step R5: Admin view
    - Tab subscriber di halaman detail campaign recurring
    - Stats: total subscriber, terkumpul bulan ini

  Step R6: Cron reminder
    - generateRecurringDonationsJob (dipanggil via cron API route atau external scheduler)
    - Integrasi WhatsApp/email notification

  Step R7: Riwayat donasi rutin
    - Di /{slug}/akun/transaksi, filter by subscription
    - Badge "Rutin" di samping nomor donasi
```

---

## 13. Integrasi dengan Modul Lain

| Modul | Integrasi |
|-------|-----------|
| Media Library | Cover campaign (`cover_id`), gambar OG SEO (`og_image_id`), sertifikat PDF |
| Settings/Payment | Rekening & QRIS kategori `donasi` → fallback `general` |
| Anggota | `member_id` optional untuk donatur anggota |
| Keuangan | Konfirmasi → `recordIncome()`: Debit Kas / Kredit Dana Titipan (2200) |
| Pengurus | `created_by` campaign → FK ke officers |
| Notifikasi (WA add-on) | Kirim notif ke admin saat donasi masuk (roadmap) |
| SEO Module | `SeoPanel` di CampaignForm — kolom SEO di `campaigns` |
| **Billing** | Cart-based donation → `invoice_items.itemType='donation'`, `itemId=campaign.id` |

---

## 13a. Dua Jalur Donasi — Tracking Lengkap

Sistem memiliki DUA jalur donasi yang harus ditampilkan secara terintegrasi:

### Jalur A — Donasi Langsung (Sistem Lama)
Admin input manual via `/donasi/transaksi/new`.

```
donations (donationNumber, donorName, campaignId, ...)
   ↓ FK: source_type='donation', source_id=donation.id
payments (amount, status, method, confirmedBy, ...)
```

Saat konfirmasi via `confirmDonationAction`:
- `payment.status → paid`
- `campaign.collected_amount += amount` (atomic SQL)

### Jalur B — Donasi via Keranjang (Sistem Billing)
Donatur checkout via front-end publik `/{slug}/campaign/{slug}`.

```
invoice_items (itemType='donation', itemId=campaign.id, total=nominal)
   ↓ FK: invoiceId
invoices (status, customerName, total, ...)
   ↓ M2M via invoice_payments
payments (amount, status, ...)
```

Saat konfirmasi via `confirmInvoicePaymentAction` atau `verifySubmittedPaymentAction`:
- `payment.status → paid`
- `invoice.status → paid`
- **`campaign.collected_amount += sum(donation items)`** — sync dilakukan di `billing/actions.ts`

### `collected_amount` adalah source of truth ringkasan

Kolom `campaigns.collected_amount` di-update oleh KEDUANYA:
- Jalur A: `confirmDonationAction` via `sql\`collected_amount + ${amount}\``
- Jalur B: billing actions setelah invoice paid

**Untuk display real-time yang akurat** (misal di campaign detail page), hitung LANGSUNG dari kedua jalur:
```typescript
// Jalur A: SUM payments yang paid
const oldCollected = donations.filter(d => d.paymentStatus === "paid")
  .reduce((sum, d) => sum + parseFloat(d.paymentAmount), 0);

// Jalur B: SUM invoice_items yang invoicenya paid
const cartCollected = cartDonations.filter(d => d.invoiceStatus === "paid")
  .reduce((sum, d) => sum + parseFloat(d.itemTotal), 0);

const totalCollected = oldCollected + cartCollected;
```

### Ringkasan Keuangan di Campaign Detail Page

4-box summary di `/donasi/campaign/[id]`:

| Kotak | Sumber Data | Formula |
|-------|------------|---------|
| **Terkumpul** | Payments (jalur A) + Invoice items (jalur B) | `oldCollected + cartCollected` |
| **Target** | `campaigns.target_amount` | — |
| **Disalurkan** | `disbursements WHERE purposeType='donation_payout' AND purposeId=campaignId AND status='paid'` | SUM |
| **Sisa Titipan** | Terkumpul - Disalurkan | `totalCollected - totalDisbursed` |

### Penyaluran (Disbursement)

Penyaluran dicatat via Keuangan → Pengeluaran (type: `donation_payout`):
```sql
disbursements.purposeType = 'donation_payout'
disbursements.purposeId   = campaign.id
disbursements.status      = 'paid'  -- saat benar-benar disalurkan
```

Ditampilkan di campaign detail page sebagai "Riwayat Penyaluran".

### Admin Transaksi List

`/donasi/transaksi` menampilkan DUA tabel:
1. **Donasi Langsung** — dari `donations` + `payments` (jalur A)
2. **Donasi via Keranjang** — dari `invoice_items` + `invoices` (jalur B), komponen `CartDonationsTable`

### Customer View (`/akun/transaksi`)

Invoice dengan `invoice_items.itemType='donation'` muncul di riwayat transaksi anggota.
Icon: Heart (pink) untuk donasi, berbeda dari Package (produk) dan Ticket (tiket).

---

## 14. Pengaturan Donasi + Nominal Default per Campaign

### 14a. Konsep

Dua layer nominal donasi yang saling berinteraksi:

```
Layer 1 — Tenant level (berlaku untuk semua campaign)
  Rekomendasi nominal: [10.000, 50.000, 100.000, 500.000]
  Max 4 rekomendasi, admin bisa kustom
  Disimpan di settings (key=donation_config, group=donasi)

Layer 2 — Campaign level (berlaku hanya untuk campaign tertentu)
  default_amount: NUMERIC(15,2) nullable
  null  = gunakan rekomendasi + kolom custom (perilaku default)
  diisi = nominal dikunci, tidak ada pilihan lain
```

**Perilaku front-end:**

```
Campaign.default_amount != null?
  ✅ YA  → Tampilkan nominal terkunci saja
            "Nominal donasi: Rp 100.000 (tetap)"
            Tidak ada rekomendasi chip, tidak ada custom input
            User hanya bisa klik Donasi Sekarang

  ❌ TIDAK → Tampilkan rekomendasi (dari settings tenant) + custom input
              [Rp 10K] [Rp 50K] [Rp 100K] [Rp 500K]
              [         Nominal lain: Rp ________      ]
              User bisa pilih chip ATAU ketik nominal sendiri
```

---

### 14b. Perubahan Schema

**Kolom baru di `campaigns`:**
```sql
ALTER TABLE "{s}".campaigns
  ADD COLUMN IF NOT EXISTS default_amount NUMERIC(15,2);
  -- null = tidak ada default (pakai rekomendasi)
  -- diisi = nominal dikunci di front-end
```

**Drizzle schema — tambah ke `createCampaignsTable()`:**
```typescript
defaultAmount: numeric("default_amount", { precision: 15, scale: 2 }),
```

**Settings baru — group `donasi`:**
```json
key   = "donation_config"
group = "donasi"
value = {
  "recommended_amounts": [10000, 50000, 100000, 500000]
}
```

**CHECK constraint `settings.group`** perlu diperluas:
```sql
-- Tambahkan 'donasi' ke CHECK constraint di create-tenant-schema.ts dan DDL migration
CHECK ("group" IN ('general','contact','payment','display','mail','notif','website','keuangan','toko','donasi'))
```

---

### 14c. Route Pengaturan

```
app/(dashboard)/[tenant]/donasi/
└── pengaturan/
    └── page.tsx    → DonationSettingsClient (rekomendasi nominal)
```

Sub-nav `DonasiNav` diperluas dengan item "Pengaturan" (icon: Settings2).

---

### 14d. UI Pengaturan (`/donasi/pengaturan`)

```
┌─────────────────────────────────────────────────────┐
│  Pengaturan Donasi                                  │
├─────────────────────────────────────────────────────┤
│  Rekomendasi Nominal                                │
│  Tampil sebagai pilihan cepat di form donasi publik │
│  Maksimal 4 rekomendasi                             │
│                                                     │
│  [Rp 10.000  ✕]  [Rp 50.000  ✕]                    │
│  [Rp 100.000 ✕]  [Rp 500.000 ✕]                    │
│                                                     │
│  [+ Tambah Rekomendasi]  (disabled jika sudah 4)    │
│                                                     │
│  Catatan: Rekomendasi tidak tampil jika campaign    │
│  memiliki nominal tetap (default amount).           │
│                                                     │
│  [Simpan Pengaturan]                                │
└─────────────────────────────────────────────────────┘
```

**Input tambah rekomendasi:**
- Input angka (Rp format)
- Tekan Enter atau klik + → tambah ke list
- Klik ✕ → hapus
- Sort: diurutkan ascending otomatis sebelum disimpan

---

### 14e. Perubahan CampaignForm (Admin)

Tambah field **Nominal Tetap (Opsional)** di sidebar campaign form:

```
┌─────────────────────────────────────┐
│  Nominal Tetap (Opsional)           │
│  [Rp ___________________]           │
│  Jika diisi, donatur tidak bisa     │
│  memilih nominal lain. Rekomendasi  │
│  dan input custom disembunyikan.    │
└─────────────────────────────────────┘
```

- Input: `type="number"`, nullable (kosong = null)
- Posisi di sidebar: setelah field Target Nominal

---

### 14f. UI Front-end — Form Donasi Publik

**Saat `default_amount = null` (bebas pilih):**
```
Pilih Nominal:
  [Rp 10.000] [Rp 50.000] [Rp 100.000] [Rp 500.000]  ← dari settings

  Nominal lain:
  [Rp _______________]  ← custom input, always tampil

  → Chip yang diklik = selected (highlight), custom input dikosongkan
  → Ketik di custom input = chip-chip di-deselect
```

**Saat `default_amount != null` (nominal terkunci):**
```
Nominal Donasi:
  Rp 100.000  (tetap)   ← tidak bisa diubah

  [Donasi Sekarang]
```

---

### 14g. Data yang Dibutuhkan Front-end

Server component halaman publik fetch:
```typescript
// 1. Data campaign (termasuk default_amount)
const campaign = await tenantDb.select({ ..., defaultAmount: schema.campaigns.defaultAmount })...

// 2. Settings rekomendasi (hanya jika default_amount = null)
let recommendedAmounts: number[] = [];
if (!campaign.defaultAmount) {
  const settings = await getSettings(tenantClient, "donasi");
  const config = settings.donation_config as { recommended_amounts?: number[] } | undefined;
  recommendedAmounts = config?.recommended_amounts ?? [10000, 50000, 100000, 500000];
}
```

Pass ke client component:
```typescript
<DonationForm
  campaign={campaign}
  defaultAmount={campaign.defaultAmount ? Number(campaign.defaultAmount) : null}
  recommendedAmounts={recommendedAmounts}
  // ...
/>
```

---

### 14h. Server Actions

```typescript
// Di donasi/actions.ts — baru
saveDonationSettingsAction(slug, { recommendedAmounts: number[] })
  → validasi max 4 item, semua > 0
  → upsertSetting(tenantDb, "donation_config", "donasi", { recommended_amounts: sorted })

// Di donasi/actions.ts — update updateCampaignAction
// Terima field defaultAmount?: number | null
// Set ke null jika input kosong
```

---

### 14i. Urutan Implementasi

```
Step D1: Schema
  - Tambah default_amount ke Drizzle schema campaigns
  - Tambah 'donasi' ke settings CHECK constraint (create-tenant-schema.ts)
  - DDL migration untuk tenant existing (migration-tenant-pc-ikpm-jogjakarta.sql)

Step D2: Pengaturan admin (/donasi/pengaturan)
  - DonasiNav: tambah item Pengaturan
  - saveDonationSettingsAction
  - DonationSettingsClient (UI chip + input)
  - Page server component

Step D3: CampaignForm — field default_amount
  - Input di sidebar
  - Update updateCampaignAction + createCampaignAction terima defaultAmount

Step D4: Front-end halaman publik
  - Fetch recommendedAmounts dari settings
  - DonationForm: conditional UI (rekomendasi vs nominal terkunci)
```

---

## 15. Fitur Qurban

Qurban **bukan entitas terpisah** — ia adalah campaign dengan `campaign_type = 'qurban'`.
Ketika admin membuat campaign bertipe qurban, muncul konfigurasi tambahan: jenis hewan,
harga, stok, dan sistem patungan. Front-end publik menampilkan UI qurban-spesifik.

---

### 15a. Konsep Utama

```
Campaign (campaign_type = 'qurban')
  ├── Periode qurban (TEXT, mis. "1446 H / 2025 M")
  └── Jenis hewan (qurban_animals — tabel baru):
        ├── Domba  → individual, harga tetap, stok N ekor
        ├── Kambing → individual, harga tetap, stok N ekor
        └── Sapi   → bisa individual ATAU patungan (split: 5 atau 7 orang)
                      admin yang tentukan split-nya, bukan user front-end
```

**Alur pesanan qurban:**
```
User pilih jenis hewan → isi atas nama (shohibul qurban) → pilih metode bayar
  → Untuk sapi patungan: masuk ke "grup sapi" yang masih tersedia
  → Satu grup = 1 ekor sapi, total slot = split (5 atau 7)
  → Grup otomatis penuh saat semua slot terisi + terbayar
  → Jika grup habis, buka grup sapi baru (dari stok)
```

---

### 15b. Schema Database — Tabel Baru

#### Tabel `qurban_animals` — jenis hewan per campaign

```sql
CREATE TABLE "{s}".qurban_animals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        NOT NULL REFERENCES "{s}".campaigns(id) ON DELETE CASCADE,
  animal_type TEXT        NOT NULL CHECK (animal_type IN ('domba','kambing','sapi')),
  price       NUMERIC(15,2) NOT NULL,     -- harga per ekor / per slot patungan
  stock       INTEGER     NOT NULL DEFAULT 0, -- jumlah ekor tersedia
  booked      INTEGER     NOT NULL DEFAULT 0, -- sudah dipesan (confirmed + pending)
  split       INTEGER,    -- hanya sapi: 5 atau 7 (null untuk domba/kambing)
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Aturan:**
- `domba` dan `kambing`: `split = null` — selalu individual
- `sapi`: `split = 5` atau `split = 7` — dikonfigurasi admin, bukan user
- `booked` di-increment saat ada pesanan masuk (pending), de-increment jika dibatalkan
- `available = stock × split - booked` (untuk sapi) atau `stock - booked` (individu)

---

#### Tabel `qurban_sapi_groups` — grup patungan sapi

```sql
CREATE TABLE "{s}".qurban_sapi_groups (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id    UUID        NOT NULL REFERENCES "{s}".qurban_animals(id) ON DELETE CASCADE,
  group_number INTEGER     NOT NULL,   -- urutan grup ke-N dari stok sapi ini
  total_slots  INTEGER     NOT NULL,   -- = animal.split (5 atau 7)
  filled_slots INTEGER     NOT NULL DEFAULT 0,
  is_complete  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Grup baru dibuat otomatis saat grup sebelumnya penuh.

---

#### Tabel `qurban_participants` — satu slot per peserta

```sql
CREATE TABLE "{s}".qurban_participants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id   UUID        NOT NULL REFERENCES "{s}".donations(id) ON DELETE CASCADE,
  animal_id     UUID        NOT NULL REFERENCES "{s}".qurban_animals(id),
  sapi_group_id UUID        REFERENCES "{s}".qurban_sapi_groups(id), -- null untuk domba/kambing
  slot_number   INTEGER,    -- posisi di grup sapi (1,2,3,...,split); null untuk individu
  atas_nama     TEXT        NOT NULL,  -- nama shohibul qurban
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Catatan:** `donation_id` tetap menyimpan identitas pemesan (`donor_name`).
`atas_nama` di `qurban_participants` adalah nama yang diniatkan qurban-nya —
bisa sama dengan pemesan, bisa berbeda (mis. "atas nama almarhum Bapak X").

---

### 15c. Pengaturan Donasi — Biaya Administrasi Penyembelihan

Tambah ke `/donasi/pengaturan` section **Biaya Administrasi Penyembelihan**:

```json
key   = "qurban_config"
group = "donasi"
value = {
  "slaughter_fees": {
    "domba":   150000,
    "kambing": 200000,
    "sapi":    500000
  }
}
```

**Tidak ada `default_prices`** — harga hewan diatur per campaign oleh admin karena berubah tiap tahun.

**`slaughter_fees`**: Biaya administrasi penyembelihan per jenis hewan, berbeda-beda.
Ditambahkan otomatis ke harga hewan saat user checkout.

> Harga hewan = per campaign (di `qurban_animals.price`)
> Biaya penyembelihan = per tenant (di `settings.qurban_config.slaughter_fees`)
> Total pesanan = harga_hewan + slaughter_fee[animal_type]

**`QurbanConfig` type:**
```typescript
export type QurbanConfig = {
  slaughterFees: { domba: number; kambing: number; sapi: number };
};
```

---

### 15d. Akuntansi Qurban

```
Total pembayaran = harga_hewan + slaughter_fee[animal_type]

→ Jurnal saat konfirmasi:
   Debit  Kas / Bank
   Kredit Dana Titipan (harga_hewan)         ← amanah untuk disalurkan
   Kredit Pendapatan Jasa (slaughter_fee)    ← hak organisasi sebagai penyelenggara
```

Dua credit entry berbeda: harga hewan masuk **Dana Titipan** (liabilitas),
biaya penyembelihan masuk **Pendapatan Jasa** (income). Mapping akun di Keuangan → Mapping Akun.

---

### 15e. Perubahan CampaignForm (Admin)

Saat `campaign_type = 'qurban'`:

**Field yang DISEMBUNYIKAN (tidak relevan untuk qurban):**
- Target Nominal — harga ditentukan dari hewan, bukan target uang
- Nominal Tetap — harga sudah fixed per hewan

**Section yang DITAMBAHKAN** di sidebar: **Konfigurasi Hewan Qurban** (card vertikal, fit di sidebar):

```
┌──────────────────────────────────────┐
│  🐑 Domba                    [✓ Aktif]│
│  Harga per ekor: [Rp _________]      │
│  Stok: [__]  Tipe: [Individu]        │
├──────────────────────────────────────┤
│  🐐 Kambing                  [✓ Aktif]│
│  Harga per ekor: [Rp _________]      │
│  Stok: [__]  Tipe: [Individu]        │
├──────────────────────────────────────┤
│  🐄 Sapi                     [✓ Aktif]│
│  Harga per ekor: [Rp 15.000.000]     │
│  Stok: [3_]  Tipe: [Patungan 7 ▼]   │
│  Per orang: Rp 2.142.857 (÷7)        │
└──────────────────────────────────────┘
│  [Simpan Konfigurasi Hewan]          │
```

**Harga per ekor** diisi admin — tidak ada default global (harga berubah tiap tahun).
**Info per orang** muncul otomatis untuk sapi patungan: `price / split` (hanya tampilan, tidak disimpan).
**Sapi bisa pilih**: Individu / Patungan 5 / Patungan 7 — domba & kambing selalu individu.

`QurbanAnimalsEditor` komponen terpisah dari form utama — punya tombol simpan sendiri (bukan bagian dari handleSave campaign). Muncul hanya jika `campaignId` sudah ada (create dulu, baru konfigurasi hewan).

---

### 15f. UI Front-end Publik — Halaman Qurban

```
┌─────────────────────────────────────────────────────────────┐
│  [Cover Campaign]                                           │
│  Qurban 1446 H / 2025 M                                    │
│  [Deskripsi campaign]                                       │
├─────────────────────────────────────────────────────────────┤
│  Pilih Jenis Hewan:                                         │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │  🐑 Domba     │  │  🐐 Kambing   │  │  🐄 Sapi      │  │
│  │  Rp 2.500.000 │  │  Rp 1.800.000 │  │  Rp 15.000.000│  │
│  │  Stok: 8 ekor │  │  Stok: 3 ekor │  │  7 orang/ekor │  │
│  │  [Pilih]      │  │  [Pilih]      │  │  Slot: 4/7    │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
│                                                             │
│  [Setelah pilih hewan:]                                     │
│                                                             │
│  Atas Nama (Shohibul Qurban):                              │
│  [___________________________________]                      │
│  Saya memesan atas nama sendiri [✓]  (auto-isi nama login) │
│                                                             │
│  Biaya Administrasi: Rp 50.000 (ditambahkan otomatis)      │
│  Total: Rp 2.550.000                                        │
│                                                             │
│  Nama Pemesan: [___________________]                        │
│  Telepon:      [___________________]                        │
│  Metode Bayar: [Transfer ▼]                                 │
│                                                             │
│  [Pesan Qurban]                                             │
└─────────────────────────────────────────────────────────────┘
```

**Sapi patungan** — harga per orang dihitung otomatis:
```
  🐄 Sapi (Patungan 7 Orang)
  Slot tersisa: 3 dari 7
  Harga per orang: Rp 2.142.857  (15.000.000 ÷ 7)
  + Biaya Administrasi Penyembelihan: Rp 500.000
  Total: Rp 2.642.857
```

**Biaya penyembelihan** per jenis hewan diambil dari `settings.qurban_config.slaughter_fees[animalType]`.
Ditampilkan terpisah — jika 0 maka tidak ditampilkan.

---

### 15g. Logika Slot Sapi Patungan

```
Saat user pesan sapi patungan:
1. Cari grup aktif (is_complete = false) untuk animal_id ini
   → Ada → tambahkan ke grup tersebut (slot_number = filled_slots + 1)
   → Tidak ada → buat grup baru (jika booked/split < stock)
2. Increment qurban_sapi_groups.filled_slots
3. Jika filled_slots == total_slots → set is_complete = true
4. Increment qurban_animals.booked

Saat pembayaran dibatalkan:
1. Hapus qurban_participants record
2. Decrement filled_slots di grup
3. Jika grup was_complete → set is_complete = false (reopened)
4. Decrement qurban_animals.booked
```

Validasi sebelum accept pesanan:
```
Domba/Kambing: qurban_animals.booked < qurban_animals.stock
Sapi:          total_slots_available > 0
               (= stock × split - total filled across all groups)
```

---

### 15h. Server Actions Baru

```typescript
// Di donasi/actions.ts — tambahan qurban
saveQurbanConfigAction(slug, config: QurbanConfig)
  → upsertSetting(tenantClient, "qurban_config", "donasi", config)

saveQurbanAnimalsAction(slug, campaignId, animals: QurbanAnimalInput[])
  → delete existing + insert new (atau diff update)

createQurbanOrderAction(slug, data: QurbanOrderData)
  → validasi stok + slot
  → generate donation + payment record
  → buat/update qurban_sapi_groups (jika sapi)
  → insert qurban_participants
```

---

### 15i. Urutan Implementasi

```
Step Q1: Schema
  - DDL + Drizzle: qurban_animals, qurban_sapi_groups, qurban_participants
  - Settings: qurban_config key

Step Q2: Pengaturan admin (/donasi/pengaturan)
  - Section "Pengaturan Qurban": default harga + admin fee
  - saveQurbanConfigAction

Step Q3: CampaignForm — section Konfigurasi Qurban
  - Muncul saat campaign_type = 'qurban'
  - Input per hewan: harga, stok, split (sapi)
  - saveQurbanAnimalsAction

Step Q4: Front-end publik halaman qurban
  - Pilih hewan card (stok realtime)
  - Form: atas nama + pemesan + metode bayar
  - Sapi: tampil info slot grup
  - createQurbanOrderAction

Step Q5: Admin — manajemen pesanan qurban
  - List peserta per hewan per campaign
  - View grup sapi + siapa saja di tiap grup
  - Konfirmasi bayar (existing confirmDonationAction + tambah admin_fee split)
```

---

## 16. Status Implementasi

| Fitur | Status |
|-------|--------|
| Schema tabel (campaign_categories, campaigns, donations, donation_sequences) | ✅ Done |
| SEO kolom di campaigns | ✅ Done |
| CRUD Campaign | ✅ Done |
| CRUD Kategori Campaign | ✅ Done |
| Create-on-save (tidak pre-create) | ✅ Done |
| Slug auto-generate + slugEdited flag | ✅ Done |
| Input donasi manual (admin) | ✅ Done |
| Konfirmasi donasi → Dana Titipan | ✅ Done |
| Cancel donasi | ✅ Done |
| Halaman detail campaign + progress bar | ✅ Done |
| Halaman detail transaksi | ✅ Done |
| List transaksi semua campaign | ✅ Done |
| SeoPanel di CampaignForm | ✅ Done |
| **Pengaturan Donasi** — rekomendasi nominal (Step D1–D3) | ✅ Done |
| **default_amount** per campaign + schema | ✅ Done |
| CampaignCardData + 3 variant (grid/list/ringkas) | ✅ Done |
| CampaignsSection (3 design) + fetch layer | ✅ Done |
| "campaigns" di SECTION_TYPES + section editor + wireframe | ✅ Done |
| Archive `/{slug}/campaign` — filter type + kategori | ✅ Done |
| Detail `/{slug}/campaign/{slug}` — donasi reguler + qurban unified | ✅ Done |
| CampaignDetailClient — alur cart universal (addToCartAction) | ✅ Done |
| Qurban = variasi hewan, atas nama di notes, slot assign saat konfirmasi | ✅ Done |
| Instruksi bayar pasca submit → universal checkout | ✅ Done (via keranjang) |
| Sertifikat PDF donasi | 🔲 Belum |
| Kirim email sertifikat | 🔲 Belum |
| **Fitur Qurban** — arsitektur selesai (Section 15) | ✅ Done |
| Qurban Step Q1 — schema (3 tabel + settings group) | ✅ Done |
| Qurban Step Q2 — pengaturan admin harga + admin fee | ✅ Done |
| Qurban Step Q3 — CampaignForm konfigurasi hewan | ✅ Done |
| Qurban Step Q4 — front-end publik (arsip + detail + form order) | ✅ Done |
| Qurban Step Q5 — admin peserta qurban di detail campaign | ✅ Done |
| **Donasi via Keranjang — tracking di campaign detail + transaksi** | ✅ Done |
| `collected_amount` sync saat invoice paid (cart-based) | ✅ Done |
| 4-box financial summary campaign (Terkumpul/Target/Disalurkan/Sisa) | ✅ Done |
| Riwayat penyaluran (disbursements) di campaign detail | ✅ Done |
| `CartDonationsTable` di `/donasi/transaksi` (donasi via keranjang) | ✅ Done |
| `/akun/transaksi` — ikon Heart untuk item donasi | ✅ Done |
| **Donasi Rutin** — perencanaan lengkap (Section 12) | 📋 Terdokumentasi |
| Donasi Rutin Step R1–R7 — implementasi | 🔲 Belum |
| Export CSV laporan | 🔲 Belum |
| Grafik donasi per bulan | 🔲 Belum |

---

## 17. Lessons Learned

### Arsitektur payment terpisah dari donations
Amount dan status tidak disimpan langsung di `donations` — melainkan di tabel `payments`
universal (`source_type='donation'`). Ini konsisten dengan modul Toko (orders) dan memungkinkan
satu donasi punya riwayat pembayaran (misal bayar ulang setelah batal).

### Dana Titipan bukan Pendapatan
Donasi yang masuk dicatat ke akun Dana Titipan (liabilitas, bukan pendapatan).
Ini penting untuk akuntansi nirlaba yang benar — uang baru jadi pendapatan saat disalurkan.
Dependency: mapping akun harus dikonfigurasi di Keuangan → Settings.

### atomic `collected_amount`
Jangan `SELECT lalu UPDATE` untuk increment — gunakan `sql\`collected_amount + ${amount}\``.
Race condition di transaksi bersamaan bisa menyebabkan angka salah.

### `ogImageUrl` di SeoValues selalu null dari server
`SeoValues.ogImageUrl` adalah field runtime untuk preview di form (tidak disimpan ke DB).
Di edit page, pass `ogImageUrl: null` — form akan load URL dari `ogImageId` jika perlu preview.

### Kategori campaign vs campaignType
Jangan campur dua konsep:
- `campaignType` = jenis syariat (enum tetap: donasi/zakat/wakaf/qurban)
- `categoryId` = tema program (FK fleksibel: Sosial, Kesehatan, dll — bisa tambah kapan saja)

### Cover image edit page wajib `publicUrl(slug, path)`
`media.path` adalah raw MinIO path (`general/2026/05/file.webp`) — bukan URL.
Jika langsung dipakai sebagai `src`, browser mengira itu path relatif → 404.
Fix: `coverUrl = media ? publicUrl(slug, media.path) : null` — identik dengan post edit page.
**Aturan**: selalu wrap `media.path` dengan `publicUrl()`. Hanya `media.url` dan JSONB
`images[].url` dari MediaPicker yang sudah berupa full URL dan tidak perlu wrap.

### Tenant existing wajib migration manual untuk kolom + constraint baru
Kolom yang ditambahkan setelah tenant di-provisioning tidak otomatis ada di DB tenant lama.
Wajib jalankan `ALTER TABLE` manual via `psql`. Selalu update
`docs/migration-tenant-pc-ikpm-jogjakarta.sql` setiap ada perubahan schema.
Kolom yang perlu dimigrasikan di sesi ini: `campaigns.default_amount`, `campaigns.gallery`,
dan `settings` CHECK constraint group `donasi`.

### Settings group baru wajib ditambah di tiga tempat
Saat menambah group settings baru (misal `donasi`), wajib update ketiganya sekaligus:
1. `packages/db/src/schema/tenant/settings.ts` → `SETTING_GROUPS` array
2. `packages/db/src/helpers/create-tenant-schema.ts` → DDL CHECK constraint
3. `docs/migration-tenant-pc-ikpm-jogjakarta.sql` → `ALTER TABLE ... DROP/ADD CONSTRAINT`
Melewatkan salah satu → TypeScript error atau runtime `23514` constraint violation.

### Route conflict public vs dashboard — selalu pakai URL berbeda

`(public)/[tenant]/donasi` dan `(dashboard)/[tenant]/donasi` resolve ke URL yang sama → Build Error.
Fix: public pages dipindah ke `/campaign` (pattern sama seperti `/toko` → `/produk`).
**Aturan**: setiap kali buat halaman publik, cek dulu apakah nama route sudah dipakai di dashboard.

### Qurban: tidak ada harga default global — harga per campaign

Harga hewan qurban berubah setiap tahun (tergantung harga pasar). Tidak ada gunanya menyimpan
"harga default" di settings. Yang ada di settings hanya **biaya administrasi penyembelihan** per hewan
(`slaughter_fees`) yang relatif stabil.
`QurbanConfig.slaughterFees: { domba, kambing, sapi }` — bukan `defaultPrices`.

### Qurban: harga per orang dihitung client-side, tidak disimpan

`price_per_slot = animal.price / animal.split` — dihitung di UI, bukan di DB.
Simpan hanya `price` (total per ekor) dan `split`. Harga per orang adalah derived value.
Berlaku untuk display di admin editor maupun front-end publik.

### CampaignForm: field conditional per campaign_type

Field yang tidak relevan untuk tipe tertentu harus disembunyikan, bukan hanya di-disable:
- `campaignType === "qurban"` → sembunyikan Target Nominal dan Nominal Tetap
- Ini mencegah admin mengisi field yang tidak akan dipakai dan menyebabkan kebingungan

### QurbanAnimalsEditor: card vertikal lebih baik dari table di sidebar

Sidebar form campaign lebarnya ~288px — table multi-kolom tidak fit dan sulit dibaca.
Solusi: card vertikal per hewan (satu card = satu jenis hewan), stacked ke bawah.
Tiap card memuat: toggle aktif, input harga, input stok, select tipe patungan, info harga per orang.
**Prinsip**: pilih layout berdasarkan lebar kontainer, bukan kebiasaan.

### Status campaign: dropdown bebas, bukan cycle paksa
Status campaign bisa pindah ke nilai apapun langsung — tidak perlu urutan draft→active→closed→archived.
Implementasi: `<select>` native di header form, nilai disimpan bersamaan tombol "Simpan".
Tidak butuh `toggleCampaignStatusAction` di UI (action bisa tetap ada untuk programmatic use).
Prinsip: jangan paksa admin mengikuti alur yang tidak mereka butuhkan.
