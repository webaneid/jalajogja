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

> **Belum diimplementasi.** Dicatat untuk roadmap.

URL: `app/(public)/[tenant]/donasi/[slug]/page.tsx` — grup `(public)`, tanpa auth.

Menampilkan:
- Judul + deskripsi + cover campaign
- Progress bar: `collected_amount / target_amount` + persentase
- Sisa waktu jika ada `ends_at`
- Daftar donatur (jika `show_donor_list = true`), label "Anonim" jika `is_anonymous = true`
- Jumlah terkumpul (jika `show_amount = true`)
- Form donasi: nama, nominal, phone/email opsional, pilih metode bayar
- Setelah submit → tampilkan instruksi transfer (nomor rekening + unique code)

**Meta tags** dari kolom SEO campaign (meta_title, og_title, og_image_id, dll).
Tidak perlu login — publik bisa donasi langsung.
Jika user sudah login → nama otomatis terisi, `member_id` di-set.

---

## 12. Donasi Rutin (Recurring) — Roadmap

Belum diimplementasi:
- Donatur berkomitmen donasi rutin (bulanan/tahunan)
- Sistem generate reminder notifikasi setiap periode
- Tidak ada auto-debit — tetap konfirmasi manual
- Schema: tambah `is_recurring`, `recurring_interval`, `parent_donation_id`

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

---

## 14. Status Implementasi

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
| Halaman publik campaign | 🔲 Belum |
| Sertifikat PDF donasi | 🔲 Belum |
| Kirim email sertifikat | 🔲 Belum |
| Donasi recurring | 🔲 Roadmap |
| Export CSV laporan | 🔲 Belum |
| Grafik donasi per bulan | 🔲 Belum |

---

## 15. Lessons Learned

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
