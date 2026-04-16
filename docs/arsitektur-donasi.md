# Arsitektur: Modul Donasi / Infaq

## Status
> **DRAFT** — sedang dirancang. Update file ini sebelum dan selama implementasi.

---

## 0. Konsep Utama

Modul Donasi adalah fitur untuk organisasi menghimpun dana dari anggota maupun publik.
Berbeda dari Modul Toko (transaksi barang), Donasi adalah **nirlaba** — ada kampanye, ada laporan, ada sertifikat.

**Tiga entitas utama:**
```
campaigns   → program penggalangan dana (dengan target, periode, kategori)
donations   → satu transaksi donasi dari satu donatur
receipts    → bukti/sertifikat donasi (PDF otomatis, dikirim via email)
```

**Donatur bisa:**
- Anggota yang login (`member_id` terisi)
- Publik tanpa akun (`member_id` null, isi nama/email/phone manual)
- Anonim (nama disembunyikan di laporan publik)

---

## 1. Kategori Donasi

| Kategori | Keterangan |
|---|---|
| `umum` | Donasi/sumbangan umum tanpa kategori khusus |
| `infaq` | Infaq (pengeluaran di jalan Allah, tidak terikat nisab) |
| `sedekah` | Sedekah (lebih luas dari zakat, tidak wajib) |
| `wakaf` | Wakaf (aset yang diwakafkan, butuh akad khusus) |
| `zakat` | Zakat (terikat nisab dan haul, perlu perhitungan) |
| `iuran` | Iuran khusus (berbeda dari iuran anggota reguler) |

Kategori dipilih per **campaign**, bukan per donasi.
Donasi mengikuti kategori campaign-nya.
Campaign tanpa kategori → default `umum`.

---

## 2. Schema Database

### 2a. Tabel `campaigns`

```typescript
id:             uuid PK
slug:           text UNIQUE — untuk URL publik
title:          text NOT NULL
description:    text — deskripsi HTML (Tiptap)
category:       text enum [umum, infaq, sedekah, wakaf, zakat, iuran] DEFAULT umum
target_amount:  numeric(15,2) — null = tanpa target
collected_amount: numeric(15,2) DEFAULT 0 — di-update setiap konfirmasi donasi
cover_id:       uuid FK → media.id (nullable)
status:         text enum [draft, active, closed, archived] DEFAULT draft
starts_at:      timestamp (nullable — null = langsung aktif)
ends_at:        timestamp (nullable — null = tidak ada deadline)
show_donor_list: boolean DEFAULT true — tampilkan daftar donatur di halaman publik
show_amount:    boolean DEFAULT true — tampilkan nominal di daftar donatur
created_by:     uuid FK → officers.id (nullable)
created_at, updated_at: timestamp
```

### 2b. Tabel `donations`

```typescript
id:             uuid PK
campaign_id:    uuid FK → campaigns.id (nullable — donasi umum tanpa campaign)
donation_number: text UNIQUE — format: DON-YYYYMM-NNNNN

// Donatur
member_id:      uuid FK → public.members.id (nullable)
donor_name:     text NOT NULL — wajib, meski anggota (bisa alias/laqob)
donor_phone:    text
donor_email:    text
donor_message:  text — pesan dari donatur
is_anonymous:   boolean DEFAULT false

// Nominal
amount:         numeric(15,2) NOT NULL
unique_code:    integer DEFAULT 0 — 3 digit tambahan untuk identifikasi transfer
total_amount:   numeric(15,2) — amount + unique_code (yang ditransfer)

// Pembayaran
payment_method: text enum [bank_transfer, qris, cash, gateway]
payment_ref:    text — ID rekening/QRIS dari settings, atau ref gateway
payment_proof_url: text — URL bukti transfer (upload MinIO)

// Status & konfirmasi
status:         text enum [pending, confirmed, cancelled] DEFAULT pending
confirmed_by:   uuid FK → public.members.id (nullable)
confirmed_at:   timestamp
notes:          text — catatan admin

// Sertifikat
certificate_url: text — URL PDF sertifikat (MinIO)
certificate_sent_at: timestamp — kapan dikirim ke email donatur

created_at, updated_at: timestamp
```

### 2c. Tabel `donation_sequences`

```typescript
id:      uuid PK
year:    integer NOT NULL
month:   integer NOT NULL
counter: integer NOT NULL DEFAULT 0
-- UNIQUE (year, month)
```

Format nomor: `DON-YYYYMM-NNNNN`
Generator: `generateDonationNumber(tenantDb)` — atomic SELECT FOR UPDATE.

---

## 3. Alur Status Donasi

```
pending → confirmed   (admin konfirmasi, collected_amount campaign bertambah)
        → cancelled   (admin batalkan)
confirmed → (final, tidak bisa diubah kecuali admin superrole)
```

Saat `confirmed`:
1. `donations.status = confirmed`, set `confirmed_by`, `confirmed_at`
2. `campaigns.collected_amount += donations.amount`
3. Generate sertifikat PDF (background job atau on-demand)
4. Kirim email ke donatur jika `donor_email` ada dan SMTP dikonfigurasi

---

## 4. Route Structure

```
app/(dashboard)/[tenant]/donasi/
├── layout.tsx                    → shell: DonasiNav (sub-nav kiri) + slot konten kanan
├── page.tsx                      → redirect ke /donasi/campaign
├── actions.ts                    → SEMUA server actions donasi
├── campaign/
│   ├── page.tsx                  → list campaign: grid + status + search
│   ├── new/page.tsx              → pre-create draft → redirect ke edit
│   └── [id]/
│       ├── page.tsx              → detail campaign: progress bar, daftar donasi
│       └── edit/page.tsx         → CampaignForm (Tiptap + MediaPicker)
└── donasi/
    ├── page.tsx                  → semua donasi lintas campaign: tabel + filter + search
    └── [id]/page.tsx             → detail satu donasi: info + konfirmasi + sertifikat
```

**Route publik** (tanpa auth, di luar `(dashboard)`):
```
app/(public)/[tenant]/donasi/
└── [slug]/page.tsx               → halaman donasi publik: info campaign + form donasi
```

---

## 5. Server Actions (donasi/actions.ts)

```typescript
// Campaign
createCampaignDraftAction(slug)
updateCampaignAction(slug, campaignId, data: CampaignData)
toggleCampaignStatusAction(slug, campaignId)   // draft → active → closed → archived
deleteCampaignAction(slug, campaignId)          // hanya jika belum ada donasi confirmed

// Donasi
createDonationAction(slug, data: DonationData) // dari dashboard admin atau publik
confirmDonationAction(slug, donationId)         // admin konfirmasi
cancelDonationAction(slug, donationId)
generateCertificateAction(slug, donationId)     // generate PDF sertifikat
sendCertificateEmailAction(slug, donationId)    // kirim email sertifikat
```

---

## 6. Komponen Client

```
components/donasi/
├── donasi-nav.tsx              → sub-nav: Dashboard, Campaign, Semua Donasi
├── campaign-form.tsx           → editor campaign (Tiptap + MediaPicker + sidebar)
├── campaign-list-client.tsx    → grid campaign dengan status badge + progress bar
├── donation-list-client.tsx    → tabel donasi + filter status + search
├── donation-confirm-client.tsx → form konfirmasi donasi (amount, payment_ref)
└── public-donation-form.tsx    → form donasi publik (nama, nominal, metode bayar)
```

---

## 7. Halaman Publik Donasi

URL: `/{slug}/donasi/{campaign-slug}`

Menampilkan:
- Judul + deskripsi campaign
- Progress bar: `collected_amount / target_amount`
- Sisa waktu jika ada `ends_at`
- Daftar donatur (jika `show_donor_list = true`), anonim jika `is_anonymous = true`
- Form donasi: nama, nominal, phone/email opsional, pilih metode bayar
- Setelah submit → tampilkan instruksi transfer (nomor rekening + unique code)

**Tidak perlu login** — publik bisa donasi langsung.
Jika user sudah login sebagai anggota → nama otomatis terisi, `member_id` di-set.

---

## 8. Pembayaran

Menggunakan rekening/QRIS dari `settings.payment` dengan kategori `donasi`.
Fallback ke kategori `general` jika tidak ada yang spesifik `donasi`.

**Unique code:** 3 digit random (1–999) ditambah ke nominal transfer.
`total_amount = amount + unique_code`
Contoh: donasi Rp 100.000 + kode 234 → transfer Rp 100.234

Admin mencocokkan transfer berdasarkan `total_amount` dan mengunggah bukti transfer.

---

## 9. Sertifikat Donasi (PDF)

Template sertifikat sederhana via Playwright:
```
[Logo Organisasi]
SERTIFIKAT DONASI
Nomor: DON-202604-00001

Diberikan kepada:
[Nama Donatur]

Telah berdonasi sebesar:
Rp [nominal] untuk [nama campaign]
Kategori: [kategori]

[Kota], [tanggal konfirmasi]
[Tanda tangan pengurus]
```

Disimpan di MinIO: `/donations/{year}/{month}/{donation_number}.pdf`
URL disimpan di `donations.certificate_url`.

---

## 10. Laporan Donasi

Di halaman detail campaign:
- Total terkumpul vs target (progress bar + persentase)
- Grafik donasi per bulan (bar chart)
- Daftar donatur + nominal (bisa diurutkan)
- Export CSV: nomor, nama, nominal, tanggal konfirmasi

Di halaman Semua Donasi:
- Filter: status, campaign, metode bayar, periode
- Search: nama donatur, nomor donasi
- Total nominal terkonfirmasi

---

## 11. Donasi Rutin (Recurring) — Fase 2

Belum diimplementasi. Dicatat untuk roadmap:
- Donatur bisa berkomitmen donasi rutin (bulanan/tahunan)
- Sistem generate reminder notifikasi setiap periode
- Tidak ada auto-debit — tetap konfirmasi manual
- Schema: tambah kolom `is_recurring`, `recurring_interval`, `parent_donation_id`

---

## 12. Integrasi dengan Modul Lain

| Modul | Integrasi |
|---|---|
| Media Library | Cover campaign, bukti transfer, sertifikat |
| Settings/Payment | Rekening & QRIS kategori `donasi` |
| Anggota | `member_id` opsional untuk donatur anggota |
| Keuangan | Konfirmasi donasi → `recordIncome()` ke akun pendapatan donasi |
| Pengurus | `created_by` campaign → FK ke officers |
| Notifikasi (WA add-on) | Kirim notif ke admin saat ada donasi masuk |

---

## 13. Pertanyaan Terbuka (perlu keputusan sebelum eksekusi)

### Q1: Campaign wajib?
Apakah donasi **harus** terkait campaign, atau boleh donasi umum tanpa campaign?
**Usulan:** Boleh tanpa campaign (`campaign_id = null`) — ditampilkan sebagai "Donasi Umum".

### Q2: Zakat — perlu kalkulator?
Zakat butuh perhitungan nisab. Apakah perlu kalkulator nisab di halaman publik?
**Usulan:** Fase 2 — dulu tanpa kalkulator, user isi nominal sendiri.

### Q3: Wakaf — butuh akad?
Wakaf secara syariat butuh akad dan dokumen. Apakah ada alur khusus?
**Usulan:** Fase 2 — dulu perlakukan seperti donasi biasa, beri catatan kategori saja.

### Q4: Sertifikat otomatis atau on-demand?
Apakah sertifikat di-generate otomatis saat konfirmasi, atau manual oleh admin?
**Usulan:** Otomatis saat konfirmasi — generate background, kirim email jika ada.

### Q5: Halaman publik — perlu SEO?
Halaman campaign publik butuh meta tags / OG untuk share di media sosial?
**Usulan:** Ya — title, description, og:image dari cover campaign.

---

## 14. Urutan Implementasi

```
Step 1 — Schema
  ├─ createCampaignsTable(), createDonationsTable(), createDonationSequencesTable()
  ├─ Update create-tenant-schema.ts (DDL)
  └─ generateDonationNumber() helper

Step 2 — Server Actions
  └─ donasi/actions.ts: CRUD campaign + donasi + konfirmasi

Step 3 — Dashboard UI
  ├─ DonasiNav
  ├─ Campaign list + form (Tiptap + MediaPicker)
  └─ Donation list + konfirmasi

Step 4 — Halaman Publik
  └─ (public)/[tenant]/donasi/[slug]/page.tsx + PublicDonationForm

Step 5 — Sertifikat PDF
  └─ Template HTML + Playwright + MinIO + email

Step 6 — Laporan & Export
  └─ Progress bar, grafik, CSV export
```
