# Arsitektur Modul Billing

> **Dokumen terkait:**
> - `docs/arsitektur-keuangan.md` — double-entry journal, account mapping
> - `docs/arsitektur-fulfillment.md` — 5-stage fulfillment, tracking, rencana WA notif
> - `docs/arsitektur-addon-ongkir.md` — RajaOngkir v2, ongkos kirim per seller
> - `docs/arsitektur-mitra.md` — shipping mitra vs tenant
> - `docs/arsitektur-kode-unik.md` — kode unik Rp 100–999 untuk identifikasi transfer masuk

## Visi

Billing adalah **lapisan universal** yang menghubungkan semua modul produk
(Toko, Donasi, Event) dengan modul Keuangan. Satu alur, satu database, dua
antarmuka: front-end publik dan tenant dashboard admin.

```
[Front-end publik]             [Tenant Dashboard Admin]
 User tambah ke cart      |    Admin input invoice manual
  (produk + tiket +       |    (bisa campur produk +
   donasi sekaligus)      |     tiket + donasi)
         ↓                |           ↓
    Universal Cart ────────┴──→ Universal Invoice
                                  (invoices + invoice_items)
                                       ↓
                           Universal Payment Request
                                  (payments)
                                       ↓
                           Finance Verifikasi → Jurnal
```

### Prinsip Kunci yang TIDAK BOLEH Dilanggar

1. **Satu infrastruktur, dua pintu masuk** — cart (front-end) dan invoice manual
   (admin) sama-sama menghasilkan `invoices` + `invoice_items`. Tidak ada
   "transaksi tersembunyi" di luar sistem ini.

2. **Cart = front-end universal** — user bisa tambah produk, tiket event, dan
   donasi sekaligus ke satu keranjang. Checkout satu kali, bayar satu kali.

3. **Invoice manual admin = back-end universal** — admin bisa buat invoice yang
   berisi campuran apapun (produk + tiket + donasi + item custom) tanpa harus
   masuk ke modul masing-masing.

4. **Tidak ada transaksi modul-spesifik di front-end** — halaman detail produk,
   event, dan donasi tidak punya form "beli/daftar/donasi" sendiri. Semua
   lewat "Tambah ke Keranjang" → checkout universal.

5. **Toko, Donasi, Event = sumber item saja** — mereka adalah *katalog*.
   Transaksinya selalu lewat Billing.

### Contoh Use Case yang Harus Bisa Dilakukan

```
User A (front-end):
  - Tambah 2 kaos IKPM ke cart (produk)
  - Tambah 1 tiket Tabligh Akbar (event)
  - Tambah donasi Rp 50.000 (donasi)
  → Checkout → 1 invoice → 1 transfer → 1 konfirmasi
  → Semua modul terupdate: stok produk berkurang,
    event_registrations terbuat, donation terbuat

Admin B (dashboard):
  - Buat invoice manual untuk Pak Ahmad
  - Tambah: 3 kaos M (produk), 1 tiket VIP (event), donasi Rp 100.000
  → 1 invoice → admin input bukti bayar → konfirmasi
  → Semua modul terupdate sekaligus
```

---

## Alur Lengkap

```
1. CART
   Guest / member buka halaman produk / event / donasi
   → "Tambah ke Keranjang" (tanpa login)
   → Cart disimpan via session_token (cookie httpOnly, TTL 24 jam)

2. CHECKOUT
   User klik "Checkout"
   → Sistem tawarkan login dulu ("Masuk untuk proses lebih cepat")
   → [Login] → lanjut sebagai Jalur 2 Login Universal (lihat arsitektur-keanggotaan.md)
   → [Lanjut tanpa login] → form: nama + HP + email (keduanya wajib)
   → System lookup public.members via public.contacts (by HP or email)
       - Ketemu → transaksi ter-link ke member_id (meski tidak login)
       - Tidak ketemu → simpan sebagai guest (member_id = null)
   → Pilih metode pembayaran (bank/QRIS/cash)
   → Submit → Invoice dibuat (status: pending)
   → Catatan: guest checkout tidak otomatis buat akun baru di sistem

3. INVOICE
   Invoice digenerate otomatis (nomor INV-YYYYMM-NNNNN)
   → Tampil halaman tagihan publik: total, metode, instruksi bayar
   → Bisa download PDF
   → User transfer / bayar tunai / QRIS

4. PAYMENT SUBMITTED
   - Via gateway (Midtrans/Xendit): otomatis callback → status: waiting_verification
   - Via transfer manual: user upload bukti / admin input → status: waiting_verification

5. FINANCE VERIFIKASI
   Finance admin buka dashboard → list payment waiting_verification
   → Cek bukti → konfirmasi
   → System update invoice.paid_amount += confirmed_amount
       - paid_amount >= total  → invoice status: paid → jurnal otomatis
       - paid_amount < total   → invoice status: partial (piutang tercatat)
       - Tolak → status: rejected, notes alasan

6. HUTANG / CICILAN
   - Partial: invoice tetap "partial", sisa = total - paid_amount (piutang)
   - Cicilan (program khusus, misal Nabung Qurban): ada jadwal termin per invoice
```

---

## Tabel Database

### `carts`

```sql
id            UUID PK
session_token TEXT UNIQUE NOT NULL   -- httpOnly cookie untuk guest
member_id     UUID NULL              -- FK → public.members.id (jika login)
expires_at    TIMESTAMP NOT NULL     -- TTL 24 jam, cleanup via cron
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

### `cart_items`

```sql
id         UUID PK
cart_id    UUID NOT NULL             -- FK → carts.id CASCADE DELETE
item_type  TEXT NOT NULL             -- 'product' | 'ticket' | 'donation' | 'custom'
item_id    UUID NULL                 -- FK → products.id / event_tickets.id / campaigns.id
name       TEXT NOT NULL             -- snapshot nama saat ditambah
unit_price NUMERIC(15,2) NOT NULL    -- snapshot harga saat ditambah (bukan live)
quantity   INTEGER NOT NULL DEFAULT 1
notes      TEXT NULL
sort_order INTEGER NOT NULL DEFAULT 0
created_at TIMESTAMP
```

> **Penting:** `name` dan `unit_price` adalah snapshot — tidak berubah meski admin
> edit harga produk setelah item masuk cart.

### `invoices`

```sql
id             UUID PK
invoice_number TEXT UNIQUE NOT NULL  -- INV-YYYYMM-NNNNN
source_type    TEXT NOT NULL         -- 'cart' | 'order' | 'donation' | 'event_registration' | 'manual'
source_id      UUID NULL             -- FK ke tabel sumber
customer_name  TEXT NOT NULL
customer_phone TEXT NULL
customer_email TEXT NULL
member_id      UUID NULL             -- FK → public.members.id (hasil lookup HP/email)
subtotal       NUMERIC(15,2) NOT NULL
discount       NUMERIC(15,2) NOT NULL DEFAULT 0
total          NUMERIC(15,2) NOT NULL
paid_amount    NUMERIC(15,2) NOT NULL DEFAULT 0
status         TEXT NOT NULL         -- lihat Status Flow di bawah
due_date       DATE NULL             -- batas bayar (default +3 hari dari created_at)
notes          TEXT NULL
pdf_url        TEXT NULL             -- setelah generate PDF
installment_plan_id UUID NULL        -- FK → installment_plans.id (program cicilan)
created_by     UUID NULL             -- admin yang buat (null = dari front-end/guest)
created_at     TIMESTAMP
updated_at     TIMESTAMP
```

### `invoice_items`

```sql
id          UUID PK
invoice_id  UUID NOT NULL            -- FK → invoices.id CASCADE DELETE
item_type   TEXT NOT NULL            -- 'product' | 'ticket' | 'donation' | 'custom'
item_id     UUID NULL                -- referensi ke sumber
name        TEXT NOT NULL            -- snapshot nama
description TEXT NULL
unit_price  NUMERIC(15,2) NOT NULL
quantity    INTEGER NOT NULL DEFAULT 1
total       NUMERIC(15,2) NOT NULL   -- unit_price * quantity
sort_order  INTEGER NOT NULL DEFAULT 0
```

### `invoice_payments`

Tabel junction antara invoice dan payments. Satu invoice bisa punya banyak
payment (cicilan / bayar bertahap).

```sql
id         UUID PK
invoice_id UUID NOT NULL             -- FK → invoices.id
payment_id UUID NOT NULL             -- FK → payments.id
amount     NUMERIC(15,2) NOT NULL    -- jumlah di payment ini
created_at TIMESTAMP
```

### `installment_plans` (program cicilan — hidden by default)

Program cicilan khusus seperti "Nabung Qurban 2025". Tidak dipublish secara
default — admin aktifkan per program.

```sql
id                UUID PK
name              TEXT NOT NULL        -- "Nabung Qurban 2025"
description       TEXT NULL
source_type       TEXT NULL            -- 'campaign' | 'event' | null (umum)
source_id         UUID NULL            -- FK ke campaign/event
total_amount      NUMERIC(15,2) NULL   -- total target (null = bebas)
installment_count INTEGER NOT NULL     -- berapa kali cicil
interval_days     INTEGER NOT NULL     -- jarak antar cicilan (30 = bulanan)
is_active         BOOLEAN DEFAULT FALSE -- wajib diaktifkan manual oleh admin
is_published      BOOLEAN DEFAULT FALSE -- tampil di front-end
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### `installment_schedules` (jadwal cicilan per invoice)

```sql
id                  UUID PK
invoice_id          UUID NOT NULL
installment_plan_id UUID NOT NULL
term_number         INTEGER NOT NULL   -- cicilan ke-1, ke-2, dst
due_date            DATE NOT NULL
amount              NUMERIC(15,2) NOT NULL
payment_id          UUID NULL          -- diisi saat cicilan ini dibayar
paid_at             TIMESTAMP NULL
status              TEXT NOT NULL      -- 'pending' | 'paid' | 'overdue'
```

---

## Status Flow Invoice

```
draft
  ↓  (checkout selesai / admin publish invoice)
pending
  ↓  (user submit pembayaran)
waiting_verification
  ↓  (finance verifikasi)
  ├── partial  (paid_amount < total — piutang aktif)
  │     ↓  (payment berikutnya diverifikasi)
  │     └── paid (lunas) ✓
  └── paid (lunas) ✓
  
cancelled  (admin cancel / expired due_date tanpa bayar)
overdue    (due_date terlewat, status masih pending/partial)
```

---

## Lookup Member via HP/Email

Saat checkout, user hanya input HP atau email — tidak perlu login.

```
Input: phone "0812xxxx" atau email "user@domain.com"

Lookup:
  SELECT m.*
  FROM public.members m
  JOIN public.contacts c ON c.id = m.contact_id
  WHERE c.phone = input OR c.email = input
  LIMIT 1

Hasil:
  - Ketemu → invoice.member_id = member.id, customer_name prefilled
  - Tidak ketemu → invoice.member_id = null, customer_name = input user
```

Data yang disimpan di invoice tetap: `customer_name`, `customer_phone`,
`customer_email` — tidak berubah meski data member diupdate nanti.

---

## Integrasi dengan Modul Existing

### Alur Baru (dengan Billing)

```
Toko:
  Cart (item_type='product') → checkout → Invoice + invoice_items
  → payments → invoice_payments → jurnal

Donasi:
  Cart (item_type='donation') → checkout → Invoice + invoice_items
  → buat record donations → payments → invoice_payments → jurnal

Event:
  Cart (item_type='ticket') → checkout → Invoice + invoice_items
  → buat record event_registrations → payments → invoice_payments → jurnal

Manual (Admin):
  Admin buat invoice langsung (source_type='manual')
  → invoice_items manual → payments → invoice_payments → jurnal
```

### Backward Compatibility

Modul Toko/Donasi/Event yang sudah ada **tidak langsung diubah**. Integrasi
dilakukan bertahap:

1. **Phase 1** — Billing berdiri sendiri: modul baru, create invoice manual dari
   dashboard, list semua invoice, partial payment tracking.
2. **Phase 2** — Integrasi front-end: cart API public, checkout flow, halaman
   invoice publik.
3. **Phase 3** — Migrasi modul existing: Toko/Donasi/Event buat invoice otomatis
   saat transaksi baru.

---

## Nomor Invoice

Format: `INV-YYYYMM-NNNNN`

Contoh: `INV-202605-00001`

Menggunakan tabel `financial_sequences` yang sudah ada dengan type baru `invoice`.
Helper: `generateFinancialNumber(tenantDb, "invoice")`

---

## Route Structure

### Tenant Dashboard

```
app/(dashboard)/[tenant]/billing/
├── layout.tsx                     → Billing shell: BillingNav + slot
├── page.tsx                       → redirect ke /billing/invoice
├── invoice/
│   ├── page.tsx                   → List invoice: filter status/sumber/tanggal, search
│   ├── new/page.tsx               → Buat invoice manual
│   └── [id]/page.tsx              → Detail: items + payment history + sisa hutang
└── cicilan/
    ├── page.tsx                   → List program cicilan (hidden fitur)
    ├── new/page.tsx               → Buat program cicilan
    └── [id]/page.tsx              → Detail program + daftar invoice terkait
```

### Front-end Publik

```
app/(public)/[tenant]/
├── keranjang/page.tsx             → Halaman cart (public)
├── checkout/page.tsx              → Input HP/email + pilih metode
└── invoice/[id]/page.tsx          → Tagihan publik + instruksi bayar + upload bukti
```

### API Routes

```
app/api/[tenant]/
├── cart/
│   ├── route.ts                   → GET (load cart by session), DELETE (clear)
│   ├── items/route.ts             → POST (add item)
│   └── items/[id]/route.ts        → PATCH (qty), DELETE (remove)
└── checkout/route.ts              → POST (create invoice from cart)

(Semua API publik: rate-limited per IP, no auth required — Server Actions sudah CSRF-safe by default)
```

---

## Keamanan

### CSRF — Tidak Perlu Token Manual

Next.js 15 App Router + Server Actions sudah CSRF-safe by default:
- Server Actions hanya menerima request dengan `Content-Type: application/x-www-form-urlencoded`
  atau `multipart/form-data` dari origin yang sama — browser tidak bisa fake ini dari domain lain
- Cookie httpOnly dikelola oleh Better Auth — tidak bisa diakses JavaScript
- Tidak ada token CSRF manual yang perlu diimplementasikan

### Public API — Rate Limiting

Public endpoints (cart, checkout) tidak butuh auth tapi perlu dilindungi dari abuse:

```typescript
// Implementasi via middleware custom atau @upstash/ratelimit
// Contoh batas per IP:
// - Tambah item ke cart:  30 req/menit
// - Checkout:             5 req/menit
// - Submit pembayaran:    3 req/menit
```

Library yang direkomendasikan: `@upstash/ratelimit` (Redis-based) atau middleware
custom dengan `headers().get("x-forwarded-for")` saat deploy via Nginx/Caddy.

### Proteksi Data di Cart

- Cart session via httpOnly cookie (tidak bisa diakses JavaScript)
- Harga produk di cart adalah **snapshot** — server selalu re-fetch harga dari DB saat
  checkout, tidak percaya angka yang dikirim client
- Invoice ID menggunakan UUID v4 (tidak guessable, tidak sequential)
- Halaman invoice publik: hanya bisa lihat, tidak bisa edit

### Webhook Payment Gateway — HMAC Signature

Untuk callback otomatis dari Midtrans/Xendit (bukan CSRF — ini konsep berbeda):

```typescript
// Midtrans: verifikasi signature_key = SHA512(orderId + statusCode + grossAmount + serverKey)
// Xendit: verifikasi header x-callback-token
// Implementasi di: app/api/[tenant]/webhook/[gateway]/route.ts
```

Webhook endpoint tidak butuh auth session — autentikasinya via HMAC signature dari gateway.

### Input Sanitization & Validation

Dilakukan di setiap Server Action (existing pattern):
- Trim + panjang maksimum semua input string
- Validasi tipe dan range numerik (amount > 0, qty >= 1)
- Server selalu ambil harga dari DB, tidak dari form input

### Admin Dashboard

- Better Auth session (existing)
- `hasFullAccess(tenantUser, "keuangan")` untuk konfirmasi payment
- Admin bisa buat invoice manual tanpa cart

---

## Invoice PDF

Template berbeda dari surat. Menggunakan Playwright (existing infrastructure).

Konten invoice PDF:
- Header: logo + nama organisasi + alamat (dari settings)
- Info invoice: nomor, tanggal, jatuh tempo
- Info customer: nama, phone, email
- Tabel item: nama, qty, harga satuan, subtotal
- Total, diskon, grand total
- Sisa pembayaran (jika partial)
- Metode pembayaran + instruksi
- QR Code: link ke halaman invoice publik
- Footer: terima kasih + kontak

---

## Finance Integration

Saat payment di invoice dikonfirmasi:
1. `recordIncome(tenantDb, {...})` dipanggil (double-entry journal)
2. `invoice.paid_amount` di-update atomik dalam satu transaction
3. Status invoice dievaluasi: `paid_amount >= total` → `paid`; else → `partial`
4. Jika cicilan: `installment_schedules` baris terkait di-update `status = 'paid'`

### Laporan Baru di Keuangan

| Laporan | Sumber |
|---------|--------|
| Piutang Outstanding | `invoices` WHERE status IN ('pending', 'partial') |
| Invoice Aging | Group by umur invoice (0-30, 31-60, 60+ hari) |
| Cicilan Jatuh Tempo | `installment_schedules` WHERE due_date <= today AND status = 'pending' |

---

## Program Cicilan — Detail

> **Status: Fase A + B (revisi final) SELESAI (2026-07-19) — admin CRUD, konversi invoice
> jadi cicilan, settlement waterfall, kode unik per termin, tampilan jadwal termin di invoice
> admin+publik. Fase C (reminder H-1) BELUM.**
> Rencana lengkap + riset: `/Users/webane/.claude/plans/polished-moseying-shell.md`. Lesson
> CLAUDE.md "[2026-07-19] Fitur Cicilan — Fase B Revisi: Cicilan Sebagai Metode Pembayaran".
> **Versi Fase B pertama (enrollment via card terpisah di halaman event) SUDAH DIBUANG** —
> lesson CLAUDE.md yang membahasnya ditandai SUPERSEDED, jangan diikuti kalau masih terbaca
> di riwayat lama.

Cicilan **tidak tampil di front-end** kecuali admin aktifkan DAN publish program tertentu.

**Scope yang dikunci (klarifikasi user, bukan asumsi)**: cicilan HANYA untuk **tiket event**
di fase ini — donasi biasa tidak butuh cicilan (donasi = pemberian, bukan pembelian).
Qurban (pola sama, nanti diterapkan lagi) eksplisit di luar scope sesi ini, menyusul terpisah.

`installment_plans.sourceType='event'` → `sourceId` = **ID tiket** (`event_tickets.id`),
BUKAN ID event — satu event bisa punya beberapa tiket harga beda, tiap tiket bisa punya
program cicilan sendiri. `totalAmount` di form admin **HANYA saran/default tampilan** saat
program dibuat — TIDAK PERNAH jadi acuan otoritatif saat konversi sungguhan (lihat prinsip
di bawah).

### Prinsip Arsitektur — Cicilan = Metode Pembayaran, Bukan Jalur Pendaftaran

**Ini keputusan paling penting di fitur ini, hasil koreksi user setelah versi pertama sempat
dibangun dan ditolak.** Analog langsung dengan diskon/kupon: cicilan adalah transformasi yang
terjadi pada invoice yang SUDAH ADA, bukan cabang khusus di titik pendaftaran/checkout.

```
Checkout/Registrasi (TIDAK BERUBAH, tidak tahu-menahu soal cicilan)
  → invoice normal terbentuk seperti biasa
  → customer buka halaman invoice publik (/invoice/{id})
  → kalau ada program cicilan aktif+published yang cocok dengan item tiket di invoice ini
    DAN invoice belum installmentPlanId DAN belum lunas
    → tampil prompt "Ubah jadi Cicilan"
  → customer klik → convertInvoiceToInstallmentAction → invoice YANG SAMA jadi berjadwal termin
```

**Boleh dikonversi kapan saja selama belum lunas** — TERMASUK setelah invoice sudah dibayar
sebagian (partial payment). Jadwal N-termin selalu dibangun dari `invoice.total` UTUH (bukan
sisa), lalu `settleInstallmentSchedules` dijalankan SEKALI langsung setelah jadwal dibuat,
memakai `paidAmount` invoice SAAT ITU — otomatis menandai lunas berapa pun termin awal yang
tertutup oleh histori pembayaran sebelum konversi. Total yang dipecah **SELALU
`invoice.total` yang sebenarnya**, bukan `plan.totalAmount` — kalau harga tiket sudah berubah
sejak program dibuat, tidak ada penolakan/mismatch check sama sekali, konversi tetap jalan
memakai angka invoice yang riil.

**Invoice hasil konversi TETAP `sourceType` aslinya** (biasanya `event_registration`) — TIDAK
ada `sourceType` baru. Yang membedakan cukup `invoices.installmentPlanId`. Konsekuensi bagus:
hook existing "kalau sourceType event_registration DAN invoice lunas → confirm
eventRegistrations" **otomatis berlaku untuk cicilan tanpa kode tambahan** — registrasi baru
"confirmed" begitu SELURUH termin lunas.

**Settlement termin — waterfall FIFO**: setiap kali `invoices.paidAmount` bertambah (di
`confirmInvoicePaymentAction`, `verifySubmittedPaymentAction`, DAN
`convertInvoiceToInstallmentAction` — tiga pemanggil `settleInstallmentSchedules`, fungsi
shared di `packages/db/src/helpers/billing.ts`), `installment_schedules` ditandai lunas
berurutan (termin 1, 2, dst) sejauh nominal kumulatif mencukupi — customer TIDAK memilih
"saya bayar termin keberapa". Termin terakhir menyerap sisa pembulatan pembagian
`total/count` supaya jumlah seluruh termin persis sama dengan `total`.

### Kode Unik PER TERMIN — Beda dari `invoices.uniqueCode`

Satu invoice cicilan menerima **N transfer terpisah** di waktu berbeda (satu per termin) —
`invoices.uniqueCode` (sekali per invoice, ditambahkan ke total sekali di awal) tidak
membantu identifikasi termin ke-2 dst, dan berisiko tabrakan nominal kalau banyak customer
punya program yang sama (nominal termin identik, transfer di hari yang sama).

**Desain**: kolom baru `installment_schedules.unique_code INTEGER` (nullable) — SATU kode
PER TERMIN, di-generate sekali saat termin dibuat (saat konversi), permanen. Customer
diinstruksikan transfer `amount + kode` (mis. "Termin 3 — Rp 35.000 — transfer Rp 35.347").

**Kode TIDAK PERNAH dihitung sebagai bagian dari cicilan** — `installment_schedules.amount`
selalu angka bersih, waterfall settlement & jurnal selalu pakai angka bersih itu. Kode murni
alat bantu identifikasi manual admin di mutasi rekening: begitu admin cocokkan mutasi
Rp 35.347 dengan termin 3, saat konfirmasi di sistem admin input **Rp 35.000** (bukan
35.347) — selisih receh TIDAK PERNAH masuk ke sistem pembukuan. Ini **beda filosofi
sengaja** dari `invoices.uniqueCode` (yang memang ikut jadi bagian `amountDue`/`paidAmount`
riil) — cicilan butuh total N-termin PERSIS sama dengan `invoice.total`, kalau kode ikut
terhitung di tiap termin totalnya akan meleset.

Scope kode per-termin: **cicilan saja** (dikonfirmasi eksplisit) — invoice biasa/non-cicilan
tetap pakai mekanisme `invoices.uniqueCode` lama, tidak digeneralisasi.

Contoh use case (nanti, di luar scope sesi ini): **Nabung Qurban 2025** — Total Rp 3.000.000,
10x cicilan @ Rp 300.000/bulan, terhubung ke campaign qurban bukan event. Pola aplikasinya
akan mirip (konversi invoice, settlement waterfall, kode per termin) tapi butuh
`sourceType='campaign'` + prompt konversi di halaman campaign/invoice donasi — dikerjakan
terpisah.

### Fase A — Admin CRUD (SELESAI, tidak berubah oleh revisi Fase B)

- `finance/billing/actions.ts`: `getEventTicketOptionsAction`, `getInstallmentPlanListAction`,
  `getInstallmentPlanDetailAction`, `createInstallmentPlanAction`,
  `updateInstallmentPlanAction`, `toggleInstallmentPlanAction`.
- `finance/billing/cicilan/{page,new/page,[id]/page}.tsx` — list + create + detail (toggle
  aktif/publish + tabel invoice terdaftar dengan progres termin).
- `finance/billing/cicilan/[id]/edit/page.tsx` — edit program (reuse `InstallmentPlanForm`
  dual-mode create/edit). Total Nominal auto-terisi dari harga tiket yang dipilih (saran
  tampilan saja, lihat catatan "Total mana yang dipecah" di atas).
- `components/keuangan/billing/billing-tabs.tsx` — tab ringan "Invoice | Cicilan" di kedua
  halaman (BUKAN nav shell `BillingNav` terpisah seperti sketsa lama — struktur folder
  `finance/billing/` sebenarnya flat, `page.tsx` cuma redirect).

### Fase B — Konversi Invoice + Settlement + Kode Unik Termin (SELESAI, revisi final)

- `packages/db/src/helpers/billing.ts` — 3 fungsi baru:
  - `findEligibleInstallmentPlan(tenantDb, invoiceId)` — cek eligibility (belum
    `installmentPlanId`, belum lunas/dibatalkan, item tiket cocok plan aktif+published).
    Dipanggil di halaman invoice publik (render prompt) DAN diulang lagi di dalam lock
    transaction saat konversi sungguhan.
  - `generateInstallmentScheduleCode(tenantDb, extraExclude?)` — generator kode unik per
    termin, namespace terpisah dari `generateUniqueCode()` (target `installment_schedules`
    bukan `invoices`). Parameter `extraExclude` WAJIB dipakai saat generate banyak kode
    sekaligus dalam satu konversi (N termin) — mencegah 2 termin di invoice yang sama dapat
    kode identik (DB query saja tidak cukup karena kode-kode itu belum ter-INSERT).
  - `settleInstallmentSchedules(tx, schema, invoiceId, newPaidAmount, paymentId)` — waterfall
    FIFO yang diekstrak dari 2 salinan duplikat versi pertama, sekarang SATU fungsi dipanggil
    3 tempat (confirm, verify, convert). `tx` bertipe `PgTransaction<...>` (diimpor langsung
    dari `drizzle-orm/pg-core` — TIDAK bisa pakai `TenantDb["db"]`, beda shape karena
    `PostgresJsDatabase` mensyaratkan `$client` yang tidak ada di transaction callback param).
- `apps/web/app/(public)/[tenant]/cart/actions.ts` — `convertInvoiceToInstallmentAction(slug,
  invoiceId, planId)`, public, pola lock `FOR UPDATE` sama dengan `submitPaymentProofAction`:
  lock invoice → validasi status+belum-cicilan+plan aktif+eligibility re-check → hitung N
  termin dari `invoice.total` ASLI → generate kode unik per termin (skip kalau
  `unique_code_enabled` mati) → insert `installment_schedules` → `UPDATE invoices SET
  installmentPlanId` → `settleInstallmentSchedules` pakai `paidAmount` saat ini.
- `components/billing/invoice-public-client.tsx` — card "Tersedia Cicilan: {nama program}" +
  tombol "Ubah jadi Cicilan" (`AlertDialog` konfirmasi) muncul kalau eligible+belum
  cicilan+masih bisa dibayar. Jadwal Cicilan diperluas: highlight termin belum-lunas paling
  awal dengan instruksi transfer termasuk kode. "Nominal Transfer" default kondisional:
  invoice cicilan → termin berikutnya (`amount+kode`); invoice biasa → `invoice.remaining`
  (tidak berubah).
- `components/keuangan/billing/invoice-detail-client.tsx` — kolom kode unik di tabel Jadwal
  Cicilan + highlight termin berikutnya. Tombol "✓ Verifikasi" prefill dari
  `nextUnpaidTerm.amount` (angka bersih tanpa kode) untuk invoice cicilan — invoice biasa
  tetap prefill dari `payment.amount` seperti sebelumnya.

**Dihapus total dari versi pertama** (bukan dikomentari): `enrollInstallmentPlanAction`
(`event/actions.ts`), `components/event/event-installment-enroll.tsx`, blok query+render
terkait di `agenda/[slug]/page.tsx`. Halaman event publik sekarang kembali tidak tahu-menahu
soal cicilan sama sekali — cicilan sepenuhnya hidup di sisi invoice.

**Migration**: `packages/db/migrations/0033_installment_schedule_unique_code.sql` — WAJIB
dijalankan di VPS SEBELUM deploy kode.

**Belum**: Fase C (cron reminder H-1 jatuh tempo termin + WA template baru) — tetap deferred,
rencana lama masih relevan apa adanya.

### 4 Bug Ditemukan Saat Testing Manual (2026-07-19) — Semua Sudah Difix

Setelah kode di atas "SELESAI" dari sisi implementasi, testing manual di dev machine lokal
menemukan 4 bug nyata (di luar bug data lokal terpisah, lihat bagian "Bug Lokal — Bukan Bug
Kode" di bawah). Lesson lengkap: CLAUDE.md "[2026-07-19] Fitur Cicilan — 4 Bug Ditemukan Saat
Testing Manual".

1. **Termin 1 langsung "Terlambat" begitu invoice baru saja dikonversi** —
   `convertInvoiceToInstallmentAction` menghitung "hari ini" via `new Date().toISOString()`
   (UTC murni). WIB = UTC+7, jadi jam 00:00–06:59 WIB masih tanggal KEMARIN di UTC — termin 1
   ke-generate dengan `due_date` = kemarin, langsung overdue. Fix: anchor ke tanggal kalender
   WIB dulu (`toLocaleDateString("en-CA", {timeZone:"Asia/Jakarta"})`), baru hitung offset
   termin berikutnya via `setUTCDate` dari anchor UTC-midnight itu.
2. **Badge "Terlambat" bisa salah tergantung timezone browser/server** — perbandingan lama
   `new Date(dueDate) < new Date(new Date().toDateString())` mencampur Date object dari
   sumber timezone berbeda. Fix: bandingkan STRING `"YYYY-MM-DD"` langsung (`s.dueDate <
   todayWib`), bukan Date object — di kedua komponen (`invoice-public-client.tsx` dan
   `invoice-detail-client.tsx`).
3. **QRIS dinamis terkunci ke `invoice.remaining` (sisa SELURUH invoice), bukan nominal
   termin** — customer scan QRIS untuk bayar 1 termin malah dikunci ke total semua termin
   yang belum lunas. `PaymentMethodCard` sekarang terima prop `payAmount` eksplisit (ikut
   nominal yang sedang diketik di field "Nominal Transfer"), bukan hardcode
   `invoice.remaining`.
4. **Field "Nominal Transfer" (dan akibatnya QRIS di atas) nyangkut ke nominal LAMA setelah
   invoice baru saja dikonversi jadi cicilan** — `payAmount` di-`useState(defaultPayAmount)`
   cuma dihitung sekali saat komponen mount. `router.refresh()` setelah konversi mengirim
   prop `invoice` baru ke komponen yang SAMA (tanpa remount) — state lama tetap nyangkut ke
   default sebelum-cicilan. Fix: `useEffect` yang sync `payAmount` ke `defaultPayAmount`
   terbaru, tapi HANYA kalau `payAmount` masih persis sama dengan default sebelumnya (supaya
   edit manual customer tidak ketimpa).

**Pola umum dari bug #1+#2**: setiap kali kode MENGHITUNG (bukan cuma menampilkan) tanggal
"hari ini" atau membandingkan tanggal untuk logic bisnis (bukan display biasa), WAJIB anchor
ke kalender WIB — `new Date().toISOString()` mentah SELALU salah kalau dieksekusi jam
00:00–06:59 WIB. Bug ini KEMUNGKINAN BESAR juga ada di tempat lain di codebase (grep
`toISOString().slice(0, 10)` untuk "hari ini"/offset tanggal menemukan ~12 titik lain,
termasuk default `dueDate` invoice +3 hari di `createLinkedInvoice` dan tanggal jurnal
keuangan) — BELUM diaudit/difix di sesi ini, di luar scope, dicatat sebagai technical debt.

**Pola umum dari bug #4**: komponen client dengan state yang di-inisialisasi dari props lewat
`useState(propDerivedValue)` TIDAK otomatis ikut berubah kalau prop berubah tanpa remount
(`router.refresh()` tidak remount, cuma kirim prop baru). Kalau state itu harus selalu
mencerminkan prop terbaru (kecuali user sudah mengedit manual), sync via `useEffect` yang
membandingkan ke nilai default SEBELUMNYA (bukan nilai state saat ini) — pola yang sama
persis dengan cara membedakan "sudah diedit" vs "belum diedit" di form manapun.

### Bug Lokal — Bukan Bug Kode

Saat testing pertama kali di dev machine lokal, `installment_plans`/`installment_schedules`
di database lokal ternyata masih berstruktur SANGAT LAMA — kolom `down_payment_pct`,
`installment_number`, `paid_amount` per-termin, dll — sama sekali beda dari skema yang
dipakai kode saat ini (`source_id`, `total_amount`, `term_number`, `payment_id`). Ini bukan
bug kode — DB lokal itu dibuat dari versi `create-tenant-schema.ts` yang jauh lebih lama dan
tidak pernah di-refresh, dan tidak ada migration yang men-transform struktur lama tersebut
(migration 0033 cuma `ADD COLUMN IF NOT EXISTS`, tidak menyentuh base structure). Fix:
kedua tabel di-`DROP`+`CREATE ulang` manual sesuai DDL current di `create-tenant-schema.ts`
(tabel kosong, aman). **Kalau dev lain mengalami error serupa** (`column X does not exist`
pada tabel yang harusnya sudah lama ada), cek dulu apakah strukturnya benar-benar legacy
seperti ini sebelum asumsi cuma kurang migration `ADD COLUMN`.

### Timezone — Semua Perhitungan Tanggal Mengikuti Setting Tenant (SELESAI, 2026-07-19)

> Detail lengkap (root cause, desain helper, cakupan fix di modul Event+Invoice): CLAUDE.md
> "[2026-07-19] Arsitektur Timezone Tenant — Akhirnya Benar-Benar Dipakai".

Audit lanjutan dari 4 bug cicilan di atas menemukan pola yang sama berulang di banyak tempat:
default `dueDate` invoice (+3 hari, 3 lokasi duplikat: `createLinkedInvoice`, `checkoutAction`,
`createInvoiceAction`), tanggal jurnal `recordIncome` saat konfirmasi/verifikasi pembayaran,
dan cron `invoice-reminder` (hitung "besok" HARUS per-tenant di dalam loop, bukan sekali di
luar loop — tiap tenant bisa beda timezone). Semua diganti dari `new Date().toISOString()`
(UTC mentah) ke helper `anchorTodayUtc(tenantTimezone)`/`todayInTz(tenantTimezone)` di
`packages/db/src/helpers/tenant-timezone.ts` (re-export via `@/lib/tenant-timezone` di
apps/web). `convertInvoiceToInstallmentAction` (yang sebelumnya hardcode `"Asia/Jakarta"`)
ikut digeneralisasi baca setting tenant yang sesungguhnya.

`invoice-public-client.tsx` + `invoice-detail-client.tsx` — `formatDate`/`isOverdue`/
`todayWib` (termasuk bagian Jadwal Cicilan) sekarang terima `timezone` sebagai prop dari page
pemanggil (bukan hardcode), konsisten dengan setting `/settings/general` tenant.

---

## Server Actions (billing/actions.ts)

```typescript
// Invoice
createInvoiceAction(slug, data)              → buat invoice manual
createInvoiceFromCartAction(slug, cartToken, customerData) → checkout
updateInvoiceDueDateAction(slug, invoiceId, dueDate)
cancelInvoiceAction(slug, invoiceId, reason)
generateInvoicePdfAction(slug, invoiceId)

// Payment — dua jalur (lihat detail di bawah)
confirmInvoicePaymentAction(slug, invoiceId, paymentData)
  → admin input manual → insert payments (status: 'paid')
  → update invoice.paid_amount
  → if paid: recordIncome() → jurnal

verifySubmittedPaymentAction(slug, paymentId)
  → admin verifikasi bukti customer → update payments.status: submitted→paid
  → update invoice.paid_amount
  → if paid: recordIncome() → jurnal

// Public — customer submit bukti bayar (tanpa auth)
submitPaymentProofAction(slug, invoiceId, { method, payerName, payerBank, transferDate, proofUrl?, notes? })
  → insert payments (status: 'submitted')
  → insert invoice_payments
  → update invoice.status → 'waiting_verification'

// Cart (public, tidak butuh auth)
addToCartAction(cartToken, slug, item)
removeFromCartAction(cartToken, itemId)
getCartAction(cartToken, slug)
clearCartAction(cartToken)

// Cicilan
createInstallmentPlanAction(slug, data)
toggleInstallmentPlanAction(slug, planId, field: 'is_active' | 'is_published')
```

---

## Bukti Transfer (Payment Proof)

### Upload API

```
POST /api/invoice/proof-upload?tenant={slug}&invoiceId={id}
Content-Type: multipart/form-data
body: file (image/jpeg|png|webp|heic, maks 8 MB)
```

- **Publik** — tidak butuh session/auth; siapapun yang punya `invoiceId` bisa upload
- Validasi: invoice harus ada, status bukan `paid`/`cancelled`
- **Image processing via Sharp (SELESAI, 2026-07-18)** — file di-decode dari ISI BYTE (bukan MIME
  type/ekstensi nama file, yang tidak reliable untuk foto HEIC dari galeri iPhone) lalu dipaksa
  konversi ke WebP (`.rotate()` auto-orientasi EXIF + `.resize(1600,1600,{fit:"inside"})` +
  `.webp({quality:85})`). Alasan: HEIC bisa berhasil ter-upload tapi tidak native-viewable di
  kebanyakan browser desktop — admin melihat "tidak ada bukti" meski `proofUrl` valid tersimpan.
  Lihat lesson CLAUDE.md `[2026-07-18] Bug: Bukti Transfer Gagal Upload Diam-Diam`.
- File disimpan ke MinIO bucket `tenant-{slug}` di path `payments/{invoiceId}/{uuid}.webp` (selalu
  `.webp`, format input asli tidak lagi relevan setelah konversi)
- Response: `{ url: string }` — URL lengkap MinIO
- Tidak ada record di tabel `media` — URL disimpan langsung di `payments.proof_url`

### Alur Dua Tahap: Customer Submit → Admin Verifikasi

```
1. Customer klik "Konfirmasi Pembayaran" di /{slug}/invoice/{id}
   → Isi form: nama pengirim, bank, tanggal, catatan
   → Upload foto bukti transfer (opsional tapi disarankan)
   → submitPaymentProofAction() dipanggil
   → payments.status = "submitted", invoice.status = "waiting_verification"

2. Admin buka /{slug}/finance/billing/invoice/{id}
   → Lihat section Riwayat Pembayaran
   → Badge "Menunggu Verifikasi" (biru) + tombol "✓ Verifikasi" hijau
   → Jika ada proofUrl: tampil thumbnail foto bukti (klik = **lightbox popup**, bukan tab baru)
   → Admin klik "✓ Verifikasi" → dialog konfirm
   → verifySubmittedPaymentAction() dipanggil
   → payments.status = "paid", invoice.paid_amount += amount
   → invoice.status = "paid" (jika lunas) atau "partial"
   → recordIncome() → jurnal double-entry dibuat
```

### Status Payment

| Status | Artinya | Siapa yang set |
|--------|---------|----------------|
| `pending` | Dibuat, belum ada aksi | System saat invoice dibuat |
| `submitted` | Customer klaim sudah bayar + upload bukti | Customer via submitPaymentProofAction |
| `paid` | Terverifikasi — uang sudah masuk | Admin via verifySubmittedPaymentAction ATAU confirmInvoicePaymentAction |
| `rejected` | Admin tolak bukti | Admin via rejectPaymentAction (tombol "Tolak" di invoice detail) |
| `cancelled` | Dibatalkan | System |
| `refunded` | Dikembalikan via disbursement | System |

### Concurrency Safety — Lock + Re-check Wajib di Semua Aksi Status-Changing

> **Status: SELESAI — audit + fix 2026-07-18.** Detail lengkap tiap temuan: lesson CLAUDE.md
> "Audit Proaktif — 4 Race Condition Ditemukan".

Semua aksi yang mengubah `payments.status` atau `invoices.status`/`paidAmount` WAJIB pola ini:
1. SELECT biasa di luar transaction — cuma early-exit UX cepat (pesan error tanpa nunggu lock)
2. `SELECT ... FOR UPDATE` DI DALAM `db.transaction()` — lock baris yang akan diubah
3. Re-verifikasi status/kondisi SETELAH lock diperoleh — baru boleh lanjut UPDATE

Berlaku di: `confirmInvoicePaymentAction`, `verifySubmittedPaymentAction`, `rejectPaymentAction`,
`cancelInvoiceAction`, `submitPaymentProofAction` (cart/actions.ts), `updatePaymentEvidenceAction`
(khusus saat `amount` ikut diedit). Kalau menambah aksi baru yang mengubah status pembayaran/invoice,
WAJIB ikuti pola yang sama — jangan andalkan SELECT di luar transaction sebagai jaminan korektnes.

### Display di Admin Invoice Detail

Tiap payment di-render dengan:
- Jumlah, metode, bank, nama a.n., catatan
- Badge status (warna berbeda per status)
- Tombol **"✓ Verifikasi"** — hanya tampil jika status `submitted`
- Thumbnail foto bukti jika `proofUrl` ada → klik = **lightbox popup** (bukan buka tab baru)

Lightbox juga tersedia di halaman invoice publik `/{slug}/invoice/{id}`:
- Section "Menunggu Verifikasi" tampil saat ada payment `submitted`
- Thumbnail klik = lightbox overlay (fixed, tutup dengan klik background atau ×)

---

### Admin Edit Bukti Transfer + Metadata Payment

> **Status: SELESAI — 2026-07-18.** Diminta user setelah insiden bukti transfer gagal terlampir
> (bug HEIC, lihat lesson CLAUDE.md di atas) — sebagai jalan recovery kalau kejadian serupa
> terulang: admin bisa tambah/ganti bukti transfer dan koreksi data pengirim langsung dari
> halaman invoice, tanpa perlu minta customer submit ulang dari nol.

**Action baru**: `updatePaymentEvidenceAction(slug, paymentId, data)` di
`finance/billing/actions.ts` — `data: { amount?, proofUrl?, payerName?, payerBank?,
transferDate?, payerNote? }`, semua field opsional (hanya field yang diisi yang di-UPDATE).

**Keputusan yang dikunci — nominal TIDAK bisa diedit untuk payment `status="paid"`:**
Payment yang sudah dikonfirmasi sudah tercatat di `invoice.paidAmount` DAN jurnal double-entry
(`recordIncome` dipanggil dengan `invoice.total` saat invoice mencapai lunas — bukan
`payment.amount` per baris). Mengubah `payment.amount` setelah itu tidak akan pernah tercermin
di jurnal yang sudah dibuat, dan `sum(payments.amount)` bisa jadi tidak sinkron dengan
`invoice.paidAmount` tanpa ada mekanisme koreksi. Server menolak dengan pesan eksplisit:
"Nominal pembayaran yang sudah dikonfirmasi tidak bisa diubah — sudah tercatat di buku besar
keuangan." UI juga men-disable input nominal (dengan keterangan yang sama) saat status `paid`.

Untuk status lain (`submitted`, `rejected`, dll — belum pernah masuk `invoice.paidAmount`/jurnal),
nominal AMAN diedit — `payments.amount` dan `invoice_payments.amount` di-update bersamaan (pola
sama dengan `verifySubmittedPaymentAction`), `invoice.paidAmount` tidak tersentuh sama sekali
(memang belum pernah dihitung ke situ untuk status non-paid).

**Bukti transfer (`proofUrl`) dan metadata (nama/bank/tanggal/catatan) SELALU aman diedit di
status manapun** — murni evidentiary, tidak pernah dipakai untuk hitung apapun di ledger.

**UI** (`invoice-detail-client.tsx`): tombol "✎ Edit" tampil di SETIAP baris riwayat pembayaran
(tidak digate status, beda dari "✓ Verifikasi"/"Tolak" yang hanya untuk `submitted`) — membuka
form inline (pola sama form Verifikasi/Tolak yang sudah ada): nominal (disabled kalau `paid`),
nama pengirim, bank, tanggal transfer, catatan, dan upload bukti (reuse endpoint yang sama
`/api/invoice/proof-upload`, termasuk konversi Sharp/WebP-nya). Baris payment tanpa `proofUrl`
menampilkan hint kuning "⚠ Belum ada bukti transfer terlampir — klik Edit untuk menambahkan" —
supaya kasus yang memicu permintaan fitur ini (bukti hilang, admin tidak sadar) langsung terlihat
tanpa perlu scroll/cek manual satu-satu.

---

### Nominal Pembayaran Terlihat + Bisa Diedit — Prasyarat Cicilan

> **Status: SELESAI — diimplementasikan 2026-07-17.** Ditemukan saat diskusi perencanaan fitur
> Cicilan (belum ada dokumen terpisah) — user tanya duluan: "di konfirmasi pembayaran itu jumlah
> pembayarannya ditulis gk bro?" — jawabannya TIDAK, dan ini gap nyata yang wajib dibenahi
> SEBELUM Cicilan dibangun (cicilan = bayar sebagian berkali-kali, butuh nominal akurat per
> transaksi).

**Bug yang ditemukan** (baca kode langsung, bukan asumsi): `submitPaymentProofAction`
(`cart/actions.ts`) TIDAK menerima `amount` dari customer sama sekali — form publik
(`invoice-public-client.tsx`) cuma minta nama pengirim, bank, tanggal, catatan, foto bukti.
Server SELALU menghitung `payment.amount = remaining` (sisa tagihan, `total + uniqueCode -
paidAmount`) — bukan angka yang customer benar-benar transfer. `verifySubmittedPaymentAction`
juga cuma menerima `paymentId` — admin tidak bisa mengoreksi, cuma bisa terima nilai asumsi
tadi (via tombol "✓ Verifikasi") atau tolak total (via "Tolak", customer submit ulang dari nol).

**Kenapa berbahaya** (dikonfirmasi user): customer bisa transfer KURANG dari sisa tagihan
(nyicil sendiri secara tidak resmi, atau salah kirim) atau LEBIH (kelebihan bayar) — sistem
sekarang tidak punya cara menangkap kenyataan itu, invoice bisa tercatat lunas padahal kurang,
atau kelebihan bayar hilang begitu saja tanpa tercatat.

**Keputusan yang dikunci** (dikonfirmasi user): nominal **terlihat** (bukan tersembunyi di
balik kalkulasi otomatis) dan **bisa diedit** — baik oleh customer (saat submit bukti) maupun
admin (saat verifikasi, karena "kalau tidak bisa edit, bahaya meski cuma beda 100 atau kurang").
Default tetap `remaining` (perilaku existing dipertahankan sebagai nilai awal) — cuma sekarang
BUKAN nilai terkunci.

**Perubahan customer-facing** (`submitPaymentProofAction` + `invoice-public-client.tsx`):
```typescript
// Tambah field amount ke parameter data — WAJIB diisi, bukan optional
submitPaymentProofAction(slug, invoiceId, {
  amount: number,       // BARU — customer isi sendiri, default state = invoice.remaining
  method: "cash" | "transfer" | "qris",
  payerName?, payerBank?, transferDate?, proofUrl?, notes?,
})
```
Validasi server: `amount > 0` (tidak ada batas atas — user eksplisit bilang "ada yg tf lebih",
overpayment harus bisa dicatat apa adanya, bukan ditolak). `payments.amount` diisi dari
`data.amount`, bukan `remaining` yang dihitung sistem.

UI form (`invoice-public-client.tsx`): input nominal baru (currency-formatted, mirip pola input
Rupiah yang sudah dipakai di form donasi/checkout lain di app ini) — muncul di bagian atas form,
`defaultValue`/state awal = `invoice.remaining`, `onChange` bebas diubah user.

**Perubahan admin-facing** (`verifySubmittedPaymentAction` + `invoice-detail-client.tsx`):
```typescript
// Tambah parameter verifiedAmount — admin lihat p.amount (submitted customer) sebagai default,
// bisa dikoreksi sebelum konfirmasi
verifySubmittedPaymentAction(slug, paymentId, verifiedAmount: number)
```
`payments.amount` di-UPDATE ke `verifiedAmount` (bukan dipertahankan nilai submit customer) saat
verifikasi — nilai yang admin konfirmasi jadi satu-satunya sumber kebenaran final, dipakai untuk
`invoice.paidAmount += verifiedAmount` (bukan `payment.amount` lama). Validasi: `verifiedAmount >
0`, tidak ada batas atas (overpayment tetap sah, dicatat apa adanya — tidak menangani refund
kelebihan bayar di scope ini, itu pembahasan terpisah kalau dibutuhkan nanti).

UI (`invoice-detail-client.tsx`): tombol "✓ Verifikasi" yang sekarang langsung `confirm()` +
panggil action, diganti jadi buka form inline kecil (pola sama form "Tolak" yang sudah ada di
komponen yang sama) — input nominal ter-prefill dari `p.amount`, admin edit kalau perlu, baru
klik "Konfirmasi" untuk memanggil action dengan nominal final.

**Di luar scope bagian ini** (dicatat, bukan lupa):
- `confirmInvoicePaymentAction` (admin input manual, BUKAN dari submit customer) — **sudah benar**
  sejak awal, sudah punya parameter `data.amount` eksplisit dengan validasi `> 0`. Tidak disentuh.
- Penanganan refund/pengembalian kelebihan bayar — di luar scope, dicatat sebagai potensi
  pembahasan terpisah kalau nanti dibutuhkan.
- Fitur Cicilan itu sendiri (`installment_plans`/`installment_schedules`) — menyusul SETELAH
  bagian ini selesai, dibangun di atas fondasi nominal-akurat yang dibenahi di sini.

**Urutan implementasi**:
```
Step PA1: submitPaymentProofAction — tambah param amount (wajib), validasi >0, isi payments.amount
          dari data.amount (bukan remaining)
Step PA2: invoice-public-client.tsx — input nominal baru di form, default = invoice.remaining
Step PA3: verifySubmittedPaymentAction — tambah param verifiedAmount, update payments.amount saat
          verifikasi, pakai verifiedAmount untuk invoice.paidAmount (bukan payment.amount lama)
Step PA4: invoice-detail-client.tsx — ganti confirm() jadi form inline (pola sama form Tolak),
          input ter-prefill dari p.amount, admin bisa edit sebelum konfirmasi
Step PA5: tsc --noEmit + build, verifikasi 0 error
```

**Realisasi**: rencana diikuti tanpa deviasi. Tambahan yang tidak eksplisit ditulis di rencana
tapi dilakukan untuk konsistensi: `invoice_payments.amount` (junction table) ikut di-`UPDATE`
saat admin verifikasi, supaya tidak ada nilai basi (nominal submit customer) yang tersisa di
tabel itu setelah admin mengoreksi nominalnya — `payments.amount` dan `invoice_payments.amount`
untuk payment yang sama sekarang selalu identik. Notifikasi WA `payment_submitted` dan
`payment_confirmed` disesuaikan memakai nominal yang sebenarnya (submitted/verified), bukan lagi
`remaining` hasil kalkulasi sistem. `confirmInvoicePaymentAction` (jalur admin input manual)
tidak disentuh — sudah benar sejak awal.

---

### Halaman Publik — Dialog Konfirmasi Elegan + Status "Diverifikasi" Instan

> **Status: SELESAI — 2026-07-18.** Ditemukan lewat pengetesan langsung oleh user setelah fitur
> nominal-terlihat di atas selesai. Detail root cause + fix: lihat lesson CLAUDE.md
> `[2026-07-18] Konfirmasi Pembayaran Publik — window.confirm() Diganti AlertDialog + Status
> "Diverifikasi" Instan`.

Dua perbaikan di `invoice-public-client.tsx`:

1. **Dialog konfirmasi sebelum submit** — `window.confirm()` (native browser) diganti `<AlertDialog>`
   (`components/ui/alert-dialog.tsx`, shadcn/Radix). `handleSubmitProof` (submit form) sekarang
   hanya validasi nominal lalu `setConfirmOpen(true)`; pengiriman sesungguhnya di `doSubmitProof()`,
   dipanggil dari tombol `AlertDialogAction` di dalam dialog.
2. **Status "sedang diverifikasi" tampil instan** — state lokal `justSubmitted` di-set `true`
   segera setelah `submitPaymentProofAction` sukses, tidak menunggu `router.refresh()`. Panel
   status biru sekarang dikondisikan `invoice.status === "waiting_verification" || justSubmitted`
   — customer langsung melihat konfirmasi visual yang jelas ("Konfirmasi pembayaran sudah kami
   terima... Anda tidak perlu mengirim ulang"), bukan halaman yang terkesan diam menunggu refresh.
   `canPay` juga ditambah `&& !justSubmitted` untuk mencegah tombol submit re-muncul sebelum
   `invoice.status` dari server benar-benar ter-refresh.

---

## Fulfillment Pengiriman (Toko — Produk Fisik)

> Detail arsitektur lengkap: **`docs/arsitektur-fulfillment.md`**

Setelah invoice `paid`, produk fisik perlu melalui alur fulfillment.
State disimpan di `invoice_shipping_lines.status`.

### 5 Stage

```
pending → processing → packed → shipped → delivered
```

| Stage | Admin | Timestamp set |
|-------|-------|---------------|
| `pending` | Belum diproses | — |
| `processing` | Klik "Proses Pesanan" | — |
| `packed` | Klik "Selesai Packing" | — |
| `shipped` | Input resi + "Kirim" | `shipped_at` |
| `delivered` | Klik "Konfirmasi Diterima" | `delivered_at` |

### Route Admin Fulfillment

Halaman khusus terpisah dari billing invoice detail:

```
/toko/pesanan/invoice/[invoiceId]   ← fulfillment page (5-stage timeline + actions)
/finance/billing/invoice/[id]       ← billing invoice page (pembayaran, verifikasi)
```

Keduanya link satu sama lain — fulfillment halaman punya link "Buka Invoice" ke billing, dan sebaliknya billing punya section "Kelola Pengiriman".

### Server Action

```typescript
updateFulfillmentStatusAction(slug, shippingLineId, newStatus, trackingNumber?)
// Validasi: invoice harus paid, transisi hanya maju satu langkah
// Shipped: wajib trackingNumber, set shippedAt
// Delivered: set deliveredAt
```

### Display di Pelanggan

`/akun/transaksi` menampilkan status pengiriman dengan 5 status:
- `pending` → "Menunggu Diproses" (Clock)
- `processing` → "Sedang Disiapkan" (Settings2)
- `packed` → "Sudah Dikemas" (PackageCheck)
- `shipped` → "Dalam Pengiriman" (Truck) + resi AWB
- `delivered` → "Sudah Diterima" (CheckCircle2)

---

## Keputusan Teknis — UUID vs nanoid (Bug Fix)

### Problem

Column `confirmed_by` dan `created_by` di tabel `payments` dan `transactions` bertipe `uuid`.
Better Auth menyimpan user ID sebagai **nanoid** (26 karakter random), **bukan UUID**.

```
access.userId        = "1bbNUBnobqznt8AZX7LqiSW92l"   ← nanoid, BUKAN UUID
access.tenantUser.id = "a3f1c2d4-..."                   ← UUID dari tenant.users table, BENAR
```

Mengisi kolom `uuid` dengan nanoid → PostgreSQL error: `invalid input syntax for type uuid`.

### Fix

Selalu gunakan `access.tenantUser.id` (UUID dari `tenant.users`) untuk kolom `confirmed_by`, `rejected_by`, `created_by` di tabel finance.

```typescript
// SALAH — nanoid, bukan UUID
confirmedBy: access.userId,

// BENAR — UUID dari tenant.users
confirmedBy: access.tenantUser.id,
```

**Aturan ini berlaku untuk semua server actions di modul Keuangan dan Billing.**

---

## Q&A Keputusan Desain

**Q: Order di Toko yang sudah ada (existing) bagaimana?**
A: Phase 3 — migrasi bertahap. Order lama tetap berfungsi via `payments` langsung.
Order baru (setelah Phase 3) akan buat invoice otomatis. Tidak breaking.

**Q: Jika user tidak input HP/email, bisa checkout tidak?**
A: Harus input minimal salah satu. Checkout tanpa identitas tidak diizinkan —
karena invoice harus ada pemiliknya untuk pengiriman status/notifikasi.

**Q: Cart expired sebelum checkout, bagaimana?**
A: Cart di-delete oleh background cleanup (cron job TTL). User harus tambah ulang.
Cart item menyimpan snapshot harga, jadi harga di cart tidak stale.

**Q: Multiple currency?**
A: Belum. Semua IDR. Dipertimbangkan di versi berikutnya.

**Q: Diskon kode promo?**
A: Belum di scope ini. `invoices.discount` kolom sudah ada, implementasi promo code menyusul.

---

## Status Implementasi

### Phase 1 — Schema + Admin Dashboard
- [x] Schema 7 tabel (`carts`, `cart_items`, `invoices`, `invoice_items`, `invoice_payments`, `installment_plans`, `installment_schedules`)
- [x] Dashboard Billing: list + create manual + detail + partial payment tracking
- [x] Nav: "Billing" di `keuangan-nav.tsx`

### Phase 2 — Cart + Checkout + Halaman Publik
- [x] Server Actions: `getCartAction`, `addToCartAction`, `updateCartItemQtyAction`, `removeCartItemAction`, `clearCartAction`, `checkoutAction`, `submitPaymentProofAction`
- [x] Halaman publik: `/{slug}/keranjang`, `/{slug}/checkout`, `/{slug}/invoice/[id]`
- [x] Client components: `cart-client.tsx`, `checkout-form.tsx`, `invoice-public-client.tsx`
- [x] **Bukti Transfer** — upload foto di form konfirmasi publik, API `POST /api/invoice/proof-upload`
- [x] **Verifikasi Admin** — `verifySubmittedPaymentAction`, tombol "✓ Verifikasi" di invoice detail admin
- [x] **Display bukti di admin** — thumbnail foto + status badge per payment di riwayat pembayaran
- [ ] **Cart item type `product`** — tombol "Tambah ke Keranjang" di halaman detail produk ⏸
- [ ] **Cart item type `ticket`** — tombol "Daftar" di halaman detail event ⏸
- [ ] **Cart item type `donation`** — tombol "Donasi" di halaman detail campaign ⏸
  > Ketiga item di atas menunggu halaman publik masing-masing modul dibangun

### Phase 3 — Integrasi Modul → Invoice Otomatis
- [x] `billing.ts` helpers: `createLinkedInvoice()` + `syncInvoicePayment()`
- [x] Toko: `createOrderAction` → invoice otomatis (sourceType=`order`), `confirmOrderPaymentAction` → sync
- [x] Donasi: `createDonationAction` → invoice otomatis (sourceType=`donation`), `confirmDonationAction` → sync
- [x] Event: `registerForEventAction` → invoice otomatis untuk tiket berbayar (sourceType=`event_registration`), `confirmRegistrationPaymentAction` → sync
- [x] Billing dashboard: badge sumber tampil untuk semua tipe (Toko/Donasi/Event/Cart/Manual)
- [ ] **Invoice manual admin** — item picker: pilih dari katalog produk/tiket/donasi ⏸
  > Saat ini invoice manual hanya bisa item custom (teks bebas)

### Fulfillment Pengiriman (Phase 4)
- [x] `SHIPPING_STATUSES` 5 stage: `pending|processing|packed|shipped|delivered`
- [x] `updateFulfillmentStatusAction` — validasi transisi, handle timestamps
- [x] Admin fulfillment page: `/toko/pesanan/invoice/[invoiceId]`
- [x] `FulfillmentCard` + `FulfillmentTimeline` client component
- [x] Lightbox untuk bukti transfer di admin + publik
- [x] `/akun/transaksi` tampilkan 5 stage dengan icon berbeda
- [x] Link pesanan list → fulfillment page
> Detail: **`docs/arsitektur-fulfillment.md`**

### Belum Dimulai
- [ ] Invoice PDF (Playwright)
- [ ] Program Cicilan UI
- [ ] Laporan Piutang Outstanding
- [x] Notifikasi WA per fulfillment stage — ✅ SELESAI 2026-07-15 (commit `876fe91`), lihat
      `docs/arsitektur-whatsapp.md` § 6.2
- [ ] RajaOngkir tracking proxy `/api/ongkir/track` (rencana di `docs/arsitektur-fulfillment.md`)
- [ ] Tombol "Konfirmasi Terima" di sisi pelanggan
- [ ] Invoice Aging Report
- [ ] **[RENCANA] Setting jatuh tempo invoice yang bisa diatur admin** — dicatat 2026-07-15.
      Saat ini `due_date` hardcoded +3 hari (di `checkoutAction` DAN `createLinkedInvoice` helper),
      dan invoice yang lewat jatuh tempo **tidak punya konsekuensi otomatis apapun** — status tidak
      pernah pindah ke `overdue` (meski kolom + UI badge merah sudah siap), tidak ada pengingat
      susulan setelah cron H-1, tidak ada denda, tidak ada auto-cancel. Customer boleh bayar kapan
      saja — ini **keputusan disengaja untuk sekarang** (biarkan seperti ini), tapi ke depan mau
      ditambah setting di `/settings/payment`: (1) admin atur sendiri berapa hari jatuh tempo
      (ganti hardcoded +3), (2) toggle auto-cancel invoice yang lewat jatuh tempo + berapa hari.
      Kalau dikerjakan: key baru di settings group `"payment"`, cron baru transisi status +
      auto-cancel (perlu lepas kuota/stok ter-reserve, ikuti pola `cancelInvoiceAction`). Detail
      lengkap di CLAUDE.md § Technical Debt. **Belum dijadwalkan eksekusi.**
