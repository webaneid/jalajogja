# Arsitektur Modul Billing

> **Dokumen terkait:**
> - `docs/arsitektur-keuangan.md` — double-entry journal, account mapping
> - `docs/arsitektur-fulfillment.md` — 5-stage fulfillment, tracking, rencana WA notif
> - `docs/arsitektur-addon-ongkir.md` — RajaOngkir v2, ongkos kirim per seller
> - `docs/arsitektur-mitra.md` — shipping mitra vs tenant
> - `docs/arsitektur-kode-unik.md` — kode unik Rp 100–999 untuk identifikasi transfer masuk
> - `docs/arsitektur-voucher.md` — diskon & voucher berkode, memotong `invoice_items.total`
>   PER ITEM (bukan invoice keseluruhan), termasuk kasus voucher 100% → checkout Rp 0 auto-lunas

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
voucher_id            UUID NULL      -- FK → vouchers.id, lihat docs/arsitektur-voucher.md
voucher_code          TEXT NULL      -- snapshot kode, tetap kebaca meski voucher dihapus nanti
voucher_discount_total NUMERIC(15,2) NOT NULL DEFAULT 0  -- = Σ invoice_items.discount_amount
created_by     UUID NULL             -- admin yang buat (null = dari front-end/guest)
created_at     TIMESTAMP
updated_at     TIMESTAMP
```

### `invoice_items`

```sql
id              UUID PK
invoice_id      UUID NOT NULL        -- FK → invoices.id CASCADE DELETE
item_type       TEXT NOT NULL        -- 'product' | 'ticket' | 'donation' | 'custom'
item_id         UUID NULL            -- referensi ke sumber
name            TEXT NOT NULL        -- snapshot nama
description     TEXT NULL
unit_price      NUMERIC(15,2) NOT NULL
quantity        INTEGER NOT NULL DEFAULT 1
discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0  -- potongan voucher baris ini (nominal, bukan %)
voucher_id      UUID NULL            -- FK → vouchers.id
total           NUMERIC(15,2) NOT NULL   -- (unit_price * quantity) - discount_amount, clamp ≥ 0
sort_order      INTEGER NOT NULL DEFAULT 0
```

> **Diskon memotong `invoice_items.total` PER BARIS, bukan `invoices.discount` (kolom lama, murni
> untuk invoice manual admin).** `invoices.discount` TIDAK PERNAH diisi oleh alur voucher — lihat
> `docs/arsitektur-voucher.md` untuk alasan dan alur lengkap.

> **Invariant: halaman admin yang di-scope ke SATU domain (Toko/Event/Donasi) TIDAK BOLEH
> menampilkan `invoices.total` mentah sebagai nominal.** Karena arsitektur cart universal
> sengaja mengizinkan satu invoice mencampur item lintas-domain (produk+tiket+donasi dalam satu
> checkout), kolom nominal di halaman admin yang di-scope ke satu domain WAJIB dihitung ulang
> dari `invoice_items` yang difilter `itemType` domain itu (`SUM(invoice_items.total) WHERE
> itemType='product'`, ditambah `SUM(invoice_shipping_lines.cost)` untuk shipping yang selalu
> domain produk) — bukan percaya `invoices.total` penuh, meski filter WHERE halaman itu sendiri
> sudah benar memilih baris invoice yang relevan. "Invoice yang relevan" ≠ "nominal invoice itu
> seluruhnya relevan". Pengecualian sah: halaman detail invoice/fulfillment yang MEMANG
> menampilkan tabel itemized penuh sebelum baris total (transparan by design) — contoh:
> `pesanan/invoice/[invoiceId]/page.tsx`. Kasus nyata (2026-08-15): `/toko/pesanan` list sempat
> menampilkan total invoice campuran produk+tiket event sebagai "Total" — dihitung ulang jadi
> "Total Produk" via 2 query agregat `GROUP BY invoiceId`.

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

> **Status: Fase A + B (revisi final) + C SELESAI (2026-07-19) — admin CRUD, konversi invoice
> jadi cicilan, settlement waterfall, kode unik per termin, tampilan jadwal termin di invoice
> admin+publik, notifikasi WA (5 event) + cron reminder H-1/hari-H.**
> Rencana lengkap + riset: `/Users/webane/.claude/plans/polished-moseying-shell.md`. Lesson
> CLAUDE.md "[2026-07-19] Fitur Cicilan — Fase B Revisi: Cicilan Sebagai Metode Pembayaran" +
> "[2026-07-19] Notifikasi WhatsApp untuk Program Cicilan — 5 Event Baru".
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
dijalankan di VPS SEBELUM deploy kode. **Dikonfirmasi sudah jalan di production** (2026-07-19,
verifikasi langsung via SSH — kolom `unique_code` ada di `installment_schedules` kedua tenant).

### Fase C — Notifikasi WA + Cron Reminder (SELESAI, 2026-07-19)

> Lesson lengkap CLAUDE.md "[2026-07-19] Notifikasi WhatsApp untuk Program Cicilan — 5 Event Baru".

5 event baru (`installment_converted`, `installment_payment_submitted`,
`installment_payment_confirmed`, `installment_reminder`, `installment_due_today`) — grup UI
"Cicilan" di `/settings/notifications`, nol migrasi DB (JSONB `tenant.settings` seperti semua
notifikasi WA lain). `installment_payment_confirmed` hanya dikirim kalau MASIH ADA termin
tersisa (`newStatus !== "paid"`) — pelunasan penuh cukup `payment_confirmed`/`event_registered`
standar (tidak diubah, sudah otomatis benar sejak Fase B). Cron baru terpisah
`app/api/cron/installment-reminder/route.ts` (H-1 dan hari-H per termin) — terpisah dari
`invoice-reminder` karena `invoices.dueDate` di-freeze ke termin pertama saja, tidak pernah
diupdate untuk termin ke-2 dst.

**Status deploy production (diverifikasi 2026-07-19 via SSH langsung ke VPS)**: kode di commit
yang sama dengan yang di-push, migration 0033 sudah jalan di kedua tenant aktif
(`pc-ikpm-jogjakarta`, `visikita`), cron sudah dijadwalkan admin (`15 8 * * *`, diverifikasi
respons `{"notified":0}` — wajar karena belum ada invoice cicilan sungguhan), GOWA gateway
sehat, dan toggle notifikasi sudah diaktifkan admin di tenant `visikita`. **Fitur sudah
sepenuhnya live** — belum ada uji nyata end-to-end (menunggu invoice cicilan pertama).

### Keamanan — Audit Server Action Permission Guard (2026-07-19)

> Ditemukan+difix di sesi audit pra-dokumentasi ini, terpisah dari bug `uniqueCode` di atas.

**Temuan**: 4 Server Action READ (`getInvoiceListAction`, `getInvoiceDetailAction`,
`getInstallmentPlanListAction`, `getInstallmentPlanDetailAction`) hanya memeriksa
`getTenantAccess(slug)` (user valid di tenant ini, role APAPUN) — TIDAK memeriksa
`hasReadAccess(access.tenantUser, "keuangan")`. Ini berbeda dari SEMUA action MUTASI di file
yang sama (`createInvoiceAction`, `confirmInvoicePaymentAction`, `createInstallmentPlanAction`,
dst) yang konsisten memakai `hasFullAccess(access.tenantUser, "keuangan")`.

**Dampak nyata**: keempat action ini mengembalikan data sensitif — nama+HP+email customer,
nominal transaksi, URL foto bukti transfer, dan (untuk installment) progres cicilan per
invoice. `finance/layout.tsx` (layout modul, membungkus SEMUA halaman `/finance/*`) SUDAH
benar memeriksa `hasReadAccess(...,"keuangan")` dan redirect kalau gagal — tapi ini HANYA
menutup jalur "navigasi via UI". Next.js Server Actions adalah endpoint POST yang bisa dipanggil
langsung (devtools/curl dengan cookie sesi valid) TANPA pernah membuka halaman yang
memanggilnya — jadi guard di layout TIDAK melindungi pemanggilan langsung ke action.

**Siapa yang sebenarnya terpapar**: 4 role sistem (`owner`, `ketua`, `sekretaris`, `bendahara`)
semuanya sudah punya `keuangan` minimal `"read"` (lihat `lib/permissions.ts` `SYSTEM_PERMISSIONS`)
— jadi TIDAK ADA user existing yang terdampak/berubah aksesnya. Yang benar-benar terpapar
adalah **custom role** (fitur Role System, admin bisa buat role dengan `keuangan: "none"` untuk
staf yang sengaja tidak boleh lihat data finansial, mis. staf khusus modul Anggota/Event) — user
dengan role custom seperti itu SEBENARNYA masih bisa memanggil keempat action ini langsung dan
membaca seluruh data invoice+cicilan tenant, melanggar batasan yang admin sudah set eksplisit.

**Fix**: tambah `if (!hasReadAccess(access.tenantUser, "keuangan")) return {success:false,
error:"Akses ditolak."};` ke keempat action, pola identik dengan guard mutasi yang sudah ada.
`getEventTicketOptionsAction` (dipakai picker tiket saat admin buat program cicilan) SENGAJA
TIDAK ditambah guard — datanya (nama tiket+harga) sudah publik lewat halaman event manapun,
tidak ada kebocoran baru.

**Tidak diperluas ke seluruh aplikasi** — pola yang sama (READ actions tanpa
`hasReadAccess`/`hasFullAccess`, hanya `getTenantAccess`) SANGAT MUNGKIN ada di modul lain
(`toko`, `donasi`, `event`, dll — belum diaudit). **Ditemukan juga 2 MUTATION action tanpa
guard permission sama sekali** di file yang sama, di luar scope fitur cicilan:
`updateAdminShippingTrackingAction` dan `updateFulfillmentStatusAction` (keduanya urusan
resi/status pengiriman toko) — hanya cek `getTenantAccess`, tidak ada `hasFullAccess`. Dicatat
sebagai technical debt terpisah, **BELUM difix** sesi ini — audit sengaja dibatasi ke bagian
cicilan+billing-read yang langsung terkait instruksi user ("khusus di bagian ini saja").

### Bug Ditemukan Saat Audit Pra-Commit (2026-07-19) — `invoices.uniqueCode` Tidak Pernah Di-nolkan Saat Konversi

**Root cause**: `confirmInvoicePaymentAction`/`verifySubmittedPaymentAction`/
`getInvoiceDetailAction`/halaman invoice publik SEMUA menghitung `amountDue = total +
invoices.uniqueCode` untuk menentukan kapan invoice lunas (`newStatus = "paid"`). Tapi
`convertInvoiceToInstallmentAction` tidak pernah menyentuh `invoices.uniqueCode` — kode yang
sudah ter-generate saat invoice PERTAMA dibuat (checkout normal, sebelum tahu-menahu soal
cicilan) tetap menempel. Jumlah seluruh termin cicilan by design PERSIS sama dengan `total`
(TANPA kode invoice-level — lihat § "Kode Unik PER TERMIN" di atas) — jadi kalau
`unique_code_enabled` aktif saat invoice dibuat, `amountDue` SELALU lebih besar dari jumlah
yang bisa dicapai lewat pembayaran cicilan murni. **Konsekuensi**: invoice cicilan tidak
PERNAH bisa mencapai status `"paid"` meski semua termin sudah `status='paid'` — event
registration tidak pernah `confirmed`, dan (temuan langsung terkait sesi ini) notifikasi
`installment_payment_confirmed` akan terus terkirim tanpa henti karena guard `newStatus !==
"paid"` tidak pernah `false`.

**Fix**: `convertInvoiceToInstallmentAction` sekarang set `uniqueCode: 0` di UPDATE invoice
yang sama dengan `installmentPlanId` — konsisten dengan prinsip yang sudah didokumentasikan
("kode invoice-level tidak relevan lagi begitu cicilan aktif, digantikan kode per termin").
Tidak ada migrasi DB (murni logic aplikasi). **Invoice cicilan yang sudah dikonversi SEBELUM
fix ini** (kalau ada, di production/lokal) mungkin masih punya `uniqueCode` tersisa — perlu
`UPDATE invoices SET unique_code = 0 WHERE installment_plan_id IS NOT NULL` manual per tenant
kalau ditemukan laporan invoice cicilan yang "stuck" di partial walau semua termin lunas.

### Bug Ditemukan Dari Laporan User (2026-07-19) — Nominal & Kode Unik Salah di Form Konfirmasi Admin (2 Bug Terpisah)

**Gejala yang dilaporkan**: teks konfirmasi (nomor termin, kode unik) sudah benar, tapi nominal
yang ter-submit dan tercatat di halaman admin adalah nominal **pelunasan penuh**, bukan
nominal satu termin.

**Root cause**: `InvoiceDetailClient` (`components/keuangan/billing/invoice-detail-client.tsx`)
punya DUA form berbeda untuk mencatat pembayaran, dan hanya SATU yang cicilan-aware:
- **"✓ Verifikasi"** (untuk payment yang customer submit via halaman publik) — `verifyAmount`
  di-seed lewat `toggleVerifyForm(paymentId, nextUnpaidTerm ? nextUnpaidTerm.amount : p.amount)`
  — BENAR, sudah cicilan-aware sejak awal.
- **"Konfirmasi Pembayaran"** (form manual, untuk admin mencatat pembayaran yang TIDAK melalui
  submission customer — mis. tunai diterima langsung) — `payAmount` HANYA
  `useState(String(Math.round(invoice.remaining)))`, sama sekali TIDAK mempertimbangkan
  `nextUnpaidTerm`. `invoice.remaining` = sisa tagihan TOTAL lintas semua termin yang belum
  lunas, bukan nominal SATU termin. Form ini tetap tampil dan bisa dipakai untuk invoice cicilan
  (tidak ada guard `installmentPlanId` yang menyembunyikannya).

**Konsekuensi**: admin yang memakai form "Konfirmasi Pembayaran" untuk mencatat penerimaan SATU
termin cicilan (mis. tunai Rp 33.334 untuk termin 1 dari 3) akan melihat field pre-filled
dengan sisa tagihan TOTAL (Rp 100.000, jumlah 3 termin) — kalau tidak disadari dan dikoreksi
manual, submit akan mencatat `payments.amount = 100.000`, `invoice.paidAmount` langsung
melompat ke `amountDue`, `newStatus` langsung `"paid"`, dan `settleInstallmentSchedules`
menandai LUNAS semua termin sekaligus — padahal uang yang benar-benar diterima cuma untuk
termin pertama.

**Fix**: `togglePayForm()` baru — SETIAP kali form dibuka (bukan cuma sekali saat mount),
`payAmount` di-reset ke `nextUnpaidTerm.amount` (angka bersih, tanpa kode — konsisten dengan
form Verifikasi) jika invoice ini cicilan, else `invoice.remaining` seperti semula. Hint teks di
bawah field diperluas: untuk invoice cicilan, tampilkan nomor termin + peringatan eksplisit
"jangan catat sisa tagihan penuh kecuali memang menerima pelunasan sekaligus" + tetap tampilkan
sisa tagihan total sebagai info (bukan default).

**Kenapa fix pakai reset-on-open, bukan cuma perbaiki initializer**: `payAmount` adalah
`useState` di level komponen yang PERSISTEN sepanjang hidup komponen — memperbaiki nilai awal
`useState(...)` saja tidak cukup kalau admin membuka-tutup form berkali-kali untuk termin yang
berbeda-beda (`nextUnpaidTerm` berubah setiap `router.refresh()` setelah termin sebelumnya
lunas, tapi `useState` initializer cuma jalan sekali saat mount). Pola sama dengan fix
`payAmount` di sisi customer (`invoice-public-client.tsx`, § "4 Bug Ditemukan Saat Testing
Manual" bug #4) — cuma di sana dipakai `useEffect`+`useRef` karena formnya selalu tampil
(tidak toggle buka/tutup); di sini form toggle buka/tutup jadi titik reset paling natural ada
di handler toggle-nya sendiri.

**Data production**: dicek — 0 invoice cicilan di kedua tenant, jadi bug ini belum sempat
menimbulkan kerusakan data nyata (kemungkinan besar ditemukan user saat testing di lokal).

#### Bug ke-2 (lebih halus) — Default form "✓ Verifikasi" SENDIRI blind ke satu termin, abaikan nominal yang customer benar-benar submit

Setelah fix di atas, user eksplisit minta dipastikan lagi: apakah masalah serupa terjadi di
jalur LAIN (bukan cicilan), khususnya skenario **customer membayar lebih** (overpayment,
misalnya sengaja transfer sekaligus untuk 2 termin) — dan apakah **kode unik yang tampil ke
admin** memang kode unik cicilan yang benar, bukan kode unik "pelunasan penuh" (invoice-level).
Audit ulang ini menemukan bug KEDUA, terpisah dari yang di atas, di form "✓ Verifikasi" itu
sendiri (`toggleVerifyForm`) — form yang SEBELUMNYA dikira sudah benar sejak awal.

**Root cause**: `toggleVerifyForm(paymentId, nextUnpaidTerm ? nextUnpaidTerm.amount : p.amount)`
— untuk invoice cicilan, default SELALU `nextUnpaidTerm.amount` (nominal SATU termin saja),
**mengabaikan sepenuhnya `p.amount`** (nominal yang CUSTOMER SESUNGGUHNYA submit lewat halaman
publik). Kalau customer overpay — misalnya sengaja transfer Rp 70.000 untuk menutup 2 termin
@Rp 33.334 sekaligus — form Verifikasi TETAP menampilkan default Rp 33.334 (cuma 1 termin),
BUKAN Rp 70.000 yang sebenarnya diterima. Kalau admin tidak sadar dan langsung klik
"Konfirmasi", customer di-**under-credit** diam-diam: hanya 1 termin tercatat lunas meski
mereka sudah bayar untuk 2, dan Rp 36.666 sisanya "hilang" dari pembukuan (tidak pernah masuk
`invoice.paidAmount` sama sekali, karena admin hanya mengonfirmasi Rp 33.334, bukan Rp 70.000
yang sungguhan mereka terima).

**Ini KEBALIKAN dari bug pertama** (yang over-credit dengan mencatat TERLALU BANYAK) — bug ini
under-credit dengan mencatat TERLALU SEDIKIT. Sama-sama berakar dari default yang tidak
mencerminkan realita transaksi, di dua form berbeda.

**Fix**: `verifyDefaultFor(payment)` baru — default sekarang dihitung dari
`payment.amount - (nextUnpaidTerm.uniqueCode ?? 0)` (nominal yang CUSTOMER SUNGGUH-SUNGGUH
submit, dikurangi kode unik termin) — BUKAN `nextUnpaidTerm.amount` yang blind mengasumsikan
selalu tepat satu termin. Untuk kasus normal (customer transfer persis `term.amount+kode`),
hasilnya identik dengan sebelumnya (`term.amount`) — TIDAK ada regresi. Untuk kasus overpay,
hasilnya otomatis ikut lebih besar dan benar (mis. Rp 70.000 − kode = ~Rp 69.653, mendekati 2×
nominal termin, waterfall settlement lalu otomatis menutup 2 termin sekaligus). Hint teks
diperluas menjelaskan asal perhitungan default + peringatan "kalau customer bayar untuk
beberapa termin sekaligus, default ini otomatis ikut lebih besar".

**Kode unik yang "salah" — root cause TERNYATA sama dengan bug `uniqueCode` yang sudah difix
sebelumnya, dikonfirmasi via data lokal**: dicek invoice cicilan test lokal
(`620-INV-202607-00002`) — kolom `invoices.unique_code` masih **106** (kode invoice-level LAMA,
dari SEBELUM invoice ini dikonversi ke cicilan, sebelum fix `uniqueCode: 0` di
`convertInvoiceToInstallmentAction` diterapkan), sementara kode PER TERMIN yang sesungguhnya di
`installment_schedules` sama sekali berbeda (termin 1=260, termin 2=545, termin 3=905, dst).
Card ringkasan "Kode Unik" di bagian ATAS halaman admin (`invoice.uniqueCode`, line ~420) SEMPAT
menampilkan 106 (kode "pelunasan penuh" invoice-level, sudah tidak relevan sejak cicilan aktif)
— PERSIS gejala yang dilaporkan user. **Ini bukan bug kode baru** — murni DATA LAMA yang belum
ter-backfill, karena fix `uniqueCode: 0` (sesi audit sebelumnya) hanya berlaku untuk konversi
BARU, tidak retroaktif ke invoice yang sudah dikonversi sebelumnya. **Sudah dibackfill manual**
di lokal (`UPDATE invoices SET unique_code = 0 WHERE installment_plan_id IS NOT NULL AND
unique_code > 0`) — setelah backfill, card "Kode Unik" di atas otomatis hilang (guard `> 0`),
dan admin hanya melihat kode yang benar (per termin, di tabel Jadwal Cicilan + hint form
Verifikasi/Konfirmasi). Production dicek ulang — tetap 0 invoice cicilan, tidak perlu backfill.

### Prinsip Terkunci: Fidelitas ke Nominal yang Customer Submit — Nol Perhitungan Otomatis (2026-07-19)

> Ditegaskan eksplisit oleh user setelah fix di atas: "Apa yang tertulis di konfirmasi
> pembayaran, nominal itulah yang harus dikirim ke admin, jangan sampai ada gap nominal dibuat
> otomatis dan tidak sesuai dengan yang user kirim via konfirmasi form. itu bahaya."

**Audit ulang menemukan tepat fix di atas (`verifyDefaultFor`) MELANGGAR prinsip ini** — default
form "✓ Verifikasi" menghitung `payment.amount - (nextUnpaidTerm.uniqueCode ?? 0)`, secara diam-
diam MENGURANGI nominal dari yang customer sungguhan submit (misalnya customer submit
Rp 33.681 = term.amount+kode, form Verifikasi menampilkan default Rp 33.334 — angka BERBEDA).
Kalau admin tidak sadar dan langsung klik "Konfirmasi", yang tercatat ke sistem BUKAN nominal
yang customer benar-benar kirim & konfirmasi (via dialog "Pastikan nominal Anda sama persis
dengan bukti transfer" di halaman publik) — persis gap berbahaya yang dimaksud user.

**Fix**: `verifyDefaultFor` **dihapus**, diganti default = `payment.amount` PERSIS (tanpa
pengurangan apa pun). Referensi "nominal yang seharusnya" (untuk `amountWarning` saja, BUKAN
untuk default field) dipindah ke fungsi terpisah `verifyExpected()` = `term.amount + kode`
(untuk cicilan) atau `invoice.remaining` (non-cicilan) — HANYA dipakai sebagai pembanding
peringatan, tidak pernah menyentuh nilai yang benar-benar akan dikirim ke server.

**Pemisahan tanggung jawab yang sekarang berlaku (prinsip permanen untuk seluruh form nominal
admin di aplikasi ini)**:
1. **DEFAULT field** = SELALU nilai sumber yang paling dekat dengan kebenaran (nominal yang
   customer submit, kalau ada; kalau tidak ada — seperti form Konfirmasi Pembayaran manual
   tanpa submission customer — baru boleh pakai nominal yang dihitung sistem, mis. nominal
   termin berikutnya).
2. **PERINGATAN (amountWarning)** = satu-satunya mekanisme yang boleh membandingkan nominal
   terhadap "apa yang seharusnya" dan memberi tahu admin kalau beda — TIDAK PERNAH mengubah
   nilai field secara diam-diam.
3. Admin selalu punya kendali penuh untuk mengoreksi manual — sistem TIDAK PERNAH "membetulkan"
   nominal atas nama admin tanpa sepengetahuan mereka.

**Diaudit ulang, dikonfirmasi TIDAK ada gap serupa di tempat lain**: `toggleEditForm` (form
"✎ Edit" bukti+metadata) sudah benar sejak awal (`setEditAmount(p.amount)`, tanpa modifikasi).
`handleVerify`/`handlePay` mengirim persis apa yang ada di state field ke server, tanpa
komputasi tambahan. Grep pola `amount - uniqueCode` di seluruh komponen billing — nol hasil
lain selain yang sudah difix.

### Keputusan Produk: Overpayment Selalu Diizinkan + Peringatan Non-Blocking (2026-07-19)

Menjawab temuan di atas (`confirmInvoicePaymentAction` sebelumnya MENOLAK nominal yang melebihi
sisa tagihan), user memutuskan aturan baru yang berlaku di SEMUA form nominal admin (Konfirmasi
Pembayaran manual DAN Verifikasi):

> Kurang dari nominal seharusnya → tampil peringatan "Angka yang Anda masukkan kurang dari
> nominal". Lebih dari nominal seharusnya → **tetap boleh dicatat**, tapi tampil peringatan
> "Nominal yang Anda kirim lebih dari tagihan. Kelebihan nominal di luar tanggung jawab kami."
> Field tetap bebas diedit di kedua kondisi — peringatan murni informasional, TIDAK memblokir.

**Implementasi:**
- `confirmInvoicePaymentAction` — guard `if (data.amount > remaining) throw ...` **DIHAPUS**.
  Overpayment sekarang diizinkan penuh (server), matching `verifySubmittedPaymentAction` yang
  sudah lama tidak punya batasan ini. Lower bound (`data.amount <= 0` ditolak) tidak berubah.
- `amountWarning(entered, expected)` — helper baru di `invoice-detail-client.tsx`, murni
  client-side, non-blocking. `expected` = `payExpected` (`nextUnpaidTerm.amount` untuk cicilan,
  `invoice.remaining` untuk invoice biasa) di form Konfirmasi Pembayaran; `verifyExpected()`
  (bukan default field — lihat § "Prinsip Terkunci: Fidelitas" di bawah) di form Verifikasi.
  Warning re-render live setiap kali admin mengetik, tidak pernah mencegah submit.
- Perlakuan jurnal untuk kelebihan bayar **DIREVISI** setelah keputusan produk susulan — lihat
  § "Overpayment Juga Dijurnal" di bawah (SUPERSEDED: paragraf jurnal versi awal di sini yang
  bilang "TETAP membukukan total saja" sudah tidak berlaku).

**Kenapa tidak diterapkan ke form customer publik (`invoice-public-client.tsx`)**: keputusan ini
scoped ke form ADMIN saja (Konfirmasi Pembayaran + Verifikasi) — form submit bukti transfer
customer sudah punya UX berbeda (`AlertDialog` konfirmasi sebelum submit, § "Nominal Pembayaran
Terlihat + Bisa Diedit") dan sudah tidak pernah punya batas atas sejak awal. Kalau nanti user
minta warning yang sama juga di sisi customer, itu perubahan terpisah.

### Prinsip Terkunci: Fidelitas ke Nominal yang Customer Submit — Nol Perhitungan Otomatis (2026-07-19)

> Ditegaskan eksplisit oleh user: "Apa yang tertulis di konfirmasi pembayaran, nominal itulah
> yang harus dikirim ke admin, jangan sampai ada gap nominal dibuat otomatis dan tidak sesuai
> dengan yang user kirim via konfirmasi form. itu bahaya."

**Audit ulang menemukan fix di atas sendiri MELANGGAR prinsip ini** — default form "✓ Verifikasi"
(`verifyDefaultFor`, versi lama) menghitung `payment.amount - (nextUnpaidTerm.uniqueCode ?? 0)`,
secara diam-diam MENGURANGI nominal dari yang customer sungguhan submit & konfirmasi (via dialog
"Pastikan nominal Anda sama persis dengan bukti transfer" di halaman publik). Kalau admin tidak
sadar dan langsung konfirmasi, yang tercatat BUKAN nominal yang customer benar-benar kirim.

**Fix**: `verifyDefaultFor` dihapus total, diganti default = `payment.amount` PERSIS (nol
pengurangan apa pun). Referensi "nominal seharusnya" dipindah ke fungsi terpisah
`verifyExpected()` = `term.amount + kode` (cicilan) atau `invoice.remaining` (non-cicilan) —
HANYA dipakai sebagai pembanding di `amountWarning()`, TIDAK PERNAH menyentuh nilai yang
sungguhan dikirim ke server.

**Prinsip permanen untuk SEMUA form nominal admin di aplikasi ini**:
1. DEFAULT field = selalu nilai sumber paling dekat kebenaran (nominal yang customer submit,
   kalau ada). Sistem TIDAK PERNAH "membetulkan" nominal atas nama admin secara diam-diam.
2. Peringatan (`amountWarning`) = satu-satunya mekanisme yang boleh membandingkan nominal
   terhadap ekspektasi sistem dan memberi tahu admin — tidak pernah mengubah nilai field.
3. Admin selalu punya kendali penuh untuk koreksi manual berdasar informasi yang benar, bukan
   dikoreksi otomatis tanpa sepengetahuan mereka.

**Diaudit ulang, dikonfirmasi TIDAK ada gap serupa di tempat lain**: `toggleEditForm` (form
"✎ Edit" bukti+metadata) sudah benar sejak awal. `handleVerify`/`handlePay` mengirim persis apa
yang ada di state field ke server. Grep pola `amount - uniqueCode` di seluruh komponen billing —
nol hasil lain selain yang sudah difix.

### Overpayment Juga Dijurnal — Rekonsiliasi Rekening Bank = Laporan Keuangan Formal (2026-07-19)

> Keputusan susulan setelah audit fidelitas di atas — user secara eksplisit menegaskan tata
> kelola administrasi butuh akurasi total: "jangan sampai terjadi perbedaan antara jumlah dalam
> rekening, dan jumlah dalam laporan di aplikasi admin." Ditanya spesifik apakah kelebihan bayar
> (yang sudah akurat di halaman Billing/Detail Invoice) juga harus tercermin di laporan keuangan
> FORMAL (Buku Besar/Neraca/Laba Rugi, bukan cuma Billing) — user pilih **"Kelebihan juga harus
> masuk laporan keuangan."**

**Root cause sebelumnya**: `recordIncome(tenantDb, {amount: total, ...})` — jurnal SELALU
membukukan nilai NOMINAL invoice (`total`), bukan nominal yang SUNGGUHAN diterima. Untuk
pembayaran pas/tepat, ini sudah benar (tidak ada bedanya). Tapi untuk overpayment (yang sekarang
DIIZINKAN penuh per keputusan sebelumnya), kelebihan bayar TIDAK PERNAH sampai ke jurnal —
rekening bank menerima lebih, tapi Buku Besar/Laba Rugi hanya mengakui sejumlah tagihan. Gap
persis yang dikhawatirkan user, meski di lapisan berbeda (laporan formal, bukan Billing
dashboard yang sudah lebih dulu akurat).

**Fix — formula jurnal baru, diterapkan di SEMUA titik konfirmasi invoice**:
```typescript
const journalAmount = Math.max(0, newPaidAmount - uniqueCode);
```
`newPaidAmount` = akumulasi SESUNGGUHNYA yang diterima (termasuk kelebihan, kalau ada).
`uniqueCode` = **HANYA** kode unik INVOICE-LEVEL (identifier sistem-generated, bukan pendapatan —
prinsip yang sudah dikunci sejak fitur Kode Unik pertama kali dibuat, dan untuk cicilan sudah
0 sejak `convertInvoiceToInstallmentAction` menolkannya saat konversi). Formula ini TIDAK
mencoba mengurangi kode unik PER TERMIN cicilan dari `paidAmount` — kalau admin tidak sengaja
membiarkan kode termin ikut tercatat (karena default sekarang tidak lagi auto-strip, lihat
prinsip fidelitas di atas), itu akan ikut terjurnal sebagai bagian "kelebihan" — trade-off yang
disengaja, konsisten dengan prinsip "percaya nominal yang admin konfirmasi, jangan tebak-tebak
niatnya" (sistem tidak bisa membedakan "kelebihan bayar genuine" vs "kode unik yang lupa
dikurangi" — keduanya sama-sama tanggung jawab admin, dibantu `amountWarning` sebagai sinyal).

**Verifikasi formula tidak regresi untuk kasus normal**: pembayaran pas/tepat → `newPaidAmount =
total + uniqueCode` (non-cicilan) atau `= total` (cicilan, uniqueCode sudah 0) →
`journalAmount = total` di kedua kasus — IDENTIK dengan perilaku SEBELUM fix ini. Hanya
skenario overpay yang berubah (sekarang jurnal ikut lebih besar, sebelumnya diam-diam terpotong
ke `total`).

**Diterapkan di 3 titik** (SEMUA jalur konfirmasi invoice yang sudah/berpotensi menjurnal —
diaudit menyeluruh via grep `recordIncome` di seluruh app, bukan cuma modul yang sedang
dikerjakan sesi ini):
1. `confirmInvoicePaymentAction` (`finance/billing/actions.ts`)
2. `verifySubmittedPaymentAction` (`finance/billing/actions.ts`)
3. `confirmEventInvoicePaymentAction` (`event/actions.ts`) — jalur TERPISAH untuk konfirmasi
   invoice tiket event dari tab "Peserta" (`event-registration-list.tsx`), paralel dengan
   `finance/billing/actions.ts` tapi kodenya duplikat sendiri (tidak reuse). Ditemukan saat
   audit menyeluruh — punya bug identik (`amount: total` fixed) DAN gap tambahan: TIDAK
   mengunci baris invoice (`FOR UPDATE`) sebelum update, race-condition risk yang sudah
   dipatch di semua titik konfirmasi lain sejak sesi-sesi sebelumnya. Kedua gap sekarang
   difix bersamaan (lock ditambah + formula jurnal disamakan).

**Tidak diubah (sudah benar sejak awal, dikonfirmasi via audit)**: `confirmRegistrationPaymentAction`
(`event/actions.ts`, alur registrasi LANGSUNG bukan cart), + fungsi sejenis di
`toko/actions.ts`/`donasi/actions.ts` — semuanya menjurnal `amount = parseFloat(payment.amount)`
langsung (bukan `total` tetap) — SUDAH akurat tanpa perlu fix. Tapi ketiganya memanggil
`syncInvoicePayment()` (`packages/db/src/helpers/billing.ts`) untuk sinkron ke tabel `invoices`
— fungsi ini TERNYATA meng-cap `newPaidAmount` via `Math.min(total, ...)`, artinya
`invoices.paidAmount` (dipakai Billing dashboard) bisa lebih RENDAH dari yang sungguhan
tercatat di `payments`/jurnal untuk overpayment via jalur ini — gap DI ARAH BERLAWANAN
(Billing dashboard yang under-report, bukan jurnal). **Sudah difix**: `Math.min()` dihapus +
ditambah `FOR UPDATE` lock (fungsi ini sebelumnya tidak locking sama sekali).

**Kesimpulan audit menyeluruh**: SEMUA jalur konfirmasi pembayaran invoice di seluruh aplikasi
(6 titik: `confirmInvoicePaymentAction`, `verifySubmittedPaymentAction`,
`confirmEventInvoicePaymentAction`, `confirmRegistrationPaymentAction` + `syncInvoicePayment`,
toko, donasi) sekarang konsisten — nominal yang benar-benar diterima (termasuk kelebihan)
tercermin akurat di: `payments.amount`, `invoice_payments.amount`, `invoices.paidAmount`, DAN
jurnal double-entry (Buku Besar/Neraca/Laba Rugi). Rekening bank = Billing dashboard = laporan
keuangan formal, tiga-tiganya sekarang harus selalu sinkron untuk pembayaran yang dikonfirmasi
lewat jalur manapun.

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
A: ✅ Selesai (Fase 1, berkode) — lihat `docs/arsitektur-voucher.md`. Memotong `invoice_items.total`
per item yang ditarget, bukan `invoices.discount` (kolom lama tetap murni untuk invoice manual
admin). Diskon otomatis tanpa kode adalah Fase 2, belum direncanakan detail.

**Q: Payment yang ditolak admin (`status='rejected'`) — apakah ikut kehitung sebagai pemasukan?**
A: **Tidak, tidak mungkin, secara struktural.** `recordIncome()` (jurnal double-entry) HANYA
dipanggil saat payment transisi KE status `"paid"` (di `confirmInvoicePaymentAction`/
`verifySubmittedPaymentAction`) — dan `rejectPaymentAction` (kedua salinannya, `finance/
actions.ts` dan `finance/billing/actions.ts`) punya guard keras `if (status === "paid") return
error` — payment yang SUDAH lunas tidak bisa ditolak lagi. Jadi payment berstatus "rejected"
SELALU berasal dari "submitted" (belum pernah lunas), tidak pernah melalui `recordIncome()`,
tidak pernah punya baris jurnal (`transactions`/`transaction_entries`). Laporan Keuangan resmi
(`/finance/laporan`) dihitung dari jurnal LANGSUNG, bukan dari `payments` — jadi immune secara
struktural. Halaman `/finance/pemasukan` (list mentah semua payment, bukan laporan resmi)
default-nya (filter "Semua") MENYEMBUNYIKAN `rejected`/`cancelled` sejak 2026-07-22 (sebelumnya
tampil campur dengan yang lunas, nominal sama-sama hijau — murni membingungkan tampilan, bukan
salah hitung) — tetap bisa dicari lewat filter status eksplisit, ditampilkan abu-abu+dicoret.
Diverifikasi langsung terhadap data production `visikita` (SQL manual, bukan cuma baca kode).

---

## 13. Peningkatan Form Buat Invoice Admin & Modal Konfirmasi Pembayaran

> **Status implementasi: ✅ SELESAI (2026-07)**
> File terkait:
> - `apps/web/components/keuangan/billing/invoice-create-form.tsx`
> - `apps/web/components/keuangan/billing/invoice-detail-client.tsx`
> - `apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts`

### 13.1 Form Buat Invoice Baru (`/finance/billing/invoice/new`)

Form pembuatan invoice manual di Admin Dashboard ditingkatkan dengan 4 integrasi utama:

1. **Autofill Customer dari Anggota (`MemberNameAutocomplete`)**:
   - Menghubungkan input Customer dengan komponen autocomplete `MemberNameAutocomplete` (dari `components/keuangan/member-name-autocomplete.tsx`).
   - Saat anggota dipilih: `customerName`, `customerPhone`, `customerEmail`, dan `memberId` (`public.members.id`) diisi secara otomatis.
   - Jika customer bukan anggota (tamu): admin dapat mengetik nama dan kontak secara bebas tanpa mengikat `memberId` (fallback `memberId = null`).

2. **Autocomplete Item Tagihan dari Katalog (`CatalogItemAutocomplete`)**:
   - Menambahkan tiga Server Action pencarian:
     - `searchBillingProductsAction(slug, search)` ➔ Mencari produk aktif di `tenant.products`.
     - `searchBillingPaidTicketsAction(slug, search)` ➔ Mencari tiket event berbayar di `tenant.event_tickets`.
     - `searchBillingCampaignsAction(slug, search)` ➔ Mencari program/campaign donasi aktif di `tenant.campaigns`.
   - Komponen `CatalogItemAutocomplete` memungut pilihan:
     - Tipe **"Produk"**: Autofill nama produk, harga satuan (`price`), dan `itemId` (Product UUID).
     - Tipe **"Tiket"**: Autofill nama (`"Judul Event - Nama Tiket"`), harga satuan (`price`), dan `itemId` (Ticket UUID).
     - Tipe **"Donasi"**: Autofill nama (`"Donasi: Judul Campaign"`), harga rekomendasi (`defaultAmount` jika diatur), dan `itemId` (Campaign UUID).
     - Tipe **"Lainnya"**: Admin dapat mengisi nama item dan harga satuan secara manual.

3. **Kode Unik Otomatis (Rp 100–999)**:
   - Pada `createInvoiceAction`, sistem memeriksa setting `unique_code_enabled` pada grup setting `payment` tenant.
   - Jika aktif, helper `generateUniqueCode(tenantDb)` dipanggil untuk menghasilkan kode unik 3-digit acak (Rp 100–999) yang belum terpakai pada invoice aktif.
   - Kode unik disimpan ke `schema.invoices.uniqueCode` dan ditambahkan ke total pembayaran yang diharapkan (`amountDue`).

4. **Notifikasi WhatsApp Otomatis (`invoice_created`)**:
   - Saat invoice berhasil dibuat dan nomor HP customer (`customerPhone`) tersedia, `createInvoiceAction` secara otomatis memicu notifikasi WA (`notifyWa`):
     - **Event**: `invoice_created`
     - **Payload Pesan**: Nama Customer, Nomor Invoice, Total Tagihan (+ Kode Unik), Tanggal Jatuh Tempo, dan Tautan Publik Invoice (`waAppUrl`).

### 13.2 Popup Modal Konfirmasi Pembayaran (`InvoiceDetailClient`)

Form konfirmasi pembayaran manual oleh Admin di halaman detail invoice (`/app/[tenant]/finance/billing/invoice/[id]`):
- **Popup Dialog (`<Dialog>`)**: Tombol **"Konfirmasi Pembayaran"** kini membuka popup modal responsif, menggantikan form inline di bagian bawah halaman.
- **Unggah Bukti Transfer / Kwitansi (`ProofUploadField`)**:
  - Menyediakan field unggah bukti transfer / kwitansi langsung di dalam modal (menggunakan `ProofUploadField` dari `components/keuangan/proof-upload-field.tsx`).
  - Mendukung unggah & kompresi otomatis (HEIC/JPG/PNG ➔ WebP via Sharp ke MinIO storage).
  - Field `proofUrl` disimpan ke `schema.payments.proofUrl` dan otomatis dirender di card **Riwayat Pembayaran** lengkap dengan Lightbox Zoom.
- **Auto-Approval & Jurnal Keuangan**: Pembayaran langsung berstatus `paid` (Dikonfirmasi), memperbarui `paidAmount` invoice, mengubah status invoice (`paid` / `partial`), dan menerbitkan Jurnal Ganda (`recordIncome`) secara otomatis.
- **WA Notification (`payment_confirmed`)**: Begitu pembayaran dikonfirmasi, sistem otomatis mengirimkan pesan WhatsApp konfirmasi penerimaan pembayaran ke customer.

---

## 14. COD (Bayar di Tempat) & Ambil Sendiri — per Penjual

> **Status implementasi: ✅ SELESAI (2026-08)** — belum diverifikasi visual di browser, belum
> di-deploy ke VPS. Rencana lengkap:
> `/Users/webane/.claude/plans/binary-questing-river.md`.
>
> File terkait:
> - `packages/db/migrations/0058_shipping_cod_pickup.sql`
> - `packages/db/src/schema/tenant/mitra.ts`, `packages/db/src/schema/tenant/billing.ts`
> - `apps/web/lib/toko-settings.ts` (setting tenant, group `"toko"`)
> - `apps/web/app/(public)/[tenant]/akun/mitra/pengaturan/page.tsx` (setting mitra self-service)
> - `apps/web/app/(public)/[tenant]/checkout/page.tsx`, `components/billing/checkout-form.tsx`
> - `apps/web/app/(public)/[tenant]/cart/actions.ts` (`checkoutAction`)
> - `apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts` (`confirmCodPaymentAction`)
> - `apps/web/app/(public)/[tenant]/akun/mitra/pesanan/actions.ts` (`confirmMitraCodReceivedAction`)
> - `apps/web/components/billing/invoice-public-client.tsx`
> - `apps/web/components/keuangan/billing/invoice-detail-client.tsx`
> - `apps/web/app/(public)/[tenant]/akun/mitra/pesanan/pesanan-client.tsx`

### 14.1 Konsep

Dua opsi transaksi baru untuk pengiriman produk toko, **opsional** (default OFF), diatur di
Setting Toko — bukan per-produk:

- **COD (Bayar di Tempat)** — customer bayar tunai saat barang diterima kurir, bukan
  transfer/QRIS di muka.
- **Ambil Sendiri (self-pickup)** — customer ambil barang langsung ke lokasi penjual, **SELALU
  prabayar** (tidak pernah dikombinasikan dengan COD — ambil sendiri murni soal cara
  pengiriman, bukan cara bayar).

Konfigurasi ada di **dua level independen**, sejajar pola `mitras.rajaongkirCityId/Name` yang
sudah ada:
- **Tenant** — `/{slug}/toko/pengaturan`, tersimpan di `tenant.settings` group `"toko"`.
- **Mitra** — `/{slug}/akun/mitra/pengaturan` (halaman self-service BARU, kapabilitas edit
  profil toko PERTAMA untuk mitra — sebelumnya `rajaongkirCityId/Name` cuma diisi sekali saat
  admin approve, tanpa jalur edit sesudahnya), tersimpan di kolom `mitras.*`.

### 14.2 Konfirmasi COD — per penjual, independen

Prinsip kunci: kalau keranjang campuran tenant+mitra dan keduanya sama-sama pakai COD,
**konfirmasi "uang sudah diterima" terjadi per penjual, independen** — bukan dibatasi
1-penjual-per-invoice. Mitra konfirmasi porsi miliknya sendiri (self-service, TANPA akses
dashboard keuangan admin), admin konfirmasi porsi tenant. Satu invoice bisa "sebagian COD
terkonfirmasi, sisanya menunggu" — reuse mekanisme partial-payment yang sama dengan cicilan
(multiple `payments` rows terhadap satu invoice, `paidAmount` terakumulasi bertahap).

Ini bisa dilakukan tanpa kolom tambahan karena `invoice_items.sellerType`/`sellerId` sudah ada
sejak awal (untuk grouping ongkir per penjual) — porsi milik seorang penjual pada sebuah
invoice SELALU bisa dihitung ulang kapan saja: `SUM(invoice_items.total) WHERE
invoiceId=X AND sellerType=Y AND sellerId=Z`.

⚠️ **`invoice_items.total` SUDAH net-of-discount** (lihat komentar schema
`billing.ts`: `"total = (unitPrice*quantity) - discountAmount"`) — JANGAN kurangi
`discountAmount` lagi saat menghitung porsi penjual. Bug double-subtraction ini sempat
tertulis di draf pertama kedua fungsi konfirmasi di bawah, ditemukan+diperbaiki sebelum
`tsc`/build final.

Dua Server Action, replikasi logic inti yang sama (duplikasi kecil disengaja — pola project
ini untuk jalur admin vs self-service yang menyentuh uang):

- **`confirmCodPaymentAction(slug, shippingLineId)`** (admin, `finance/billing/actions.ts`) —
  guard `hasFullAccess(access.tenantUser, "keuangan")`, HANYA untuk baris `sellerType='tenant'`.
- **`confirmMitraCodReceivedAction(slug, shippingLineId)`** (mitra self-service,
  `akun/mitra/pesanan/actions.ts`) — auth pola `updateShippingTrackingAction` (session →
  `members.betterAuthUserId` → mitra aktif → verifikasi `line.sellerId === mitra.id`), HANYA
  untuk baris `sellerType='mitra'` milik mitra yang login.

Keduanya, di dalam `db.transaction()`: `FOR UPDATE` lock invoice + shipping line → hitung
porsi penjual → insert `payments` (`method:"cash"`, `status:"paid"`) → update
`invoices.paidAmount`/`status` (transisi pending→partial→paid, reuse logic yang sama) →
`recordIncome()` (jurnal) → stamp `invoice_shipping_lines.codConfirmedAt`/`codPaymentId` pada
baris itu SAJA → `revalidatePath` invoice admin+publik+halaman pesanan mitra.

**Kolom konfirmasi tanpa `DEFAULT`** — `codConfirmedAt` (dan seluruh kolom `_confirmed_at`/
`_paid_at`/`signed_at` lain di aplikasi ini) TIDAK PERNAH punya `DEFAULT NOW()` di DDL, sesuai
aturan lama yang berulang kali dikunci — kolom itu harus selalu `NULL` sampai diisi eksplisit
oleh aksi konfirmasi.

### 14.3 Deviasi desain — `createdBy` jurnal COD mitra

`recordIncome()`/`recordJournal()`'s `createdBy` (di tabel `transactions`/`transaction_entries`)
adalah `uuid NOT NULL`, FK konseptual ke `tenant.users.id`. **Mitra bukan `tenant.users`** —
mitra adalah `public.members` yang punya baris `mitras`, tidak pernah punya baris
`tenant.users.id` sendiri. Menulis `createdBy: null` gagal (kolom NOT NULL); mengarang UUID
acak akan melanggar integritas referensial (tidak ada baris `tenant.users` yang cocok).

**Solusi**: jurnal COD yang dikonfirmasi mitra diatribusikan ke **owner tenant** (fallback:
pengurus manapun yang paling lama terdaftar, `ORDER BY (role='owner') DESC, createdAt ASC LIMIT
1`) — sebagai pemegang tanggung jawab pembukuan toko. `payerNote` (di `payments`) dan
`description` (di jurnal) tetap eksplisit menyebut "dikonfirmasi mitra" — atribusi UUID ke
owner murni memenuhi syarat referensial DB, bukan menyamarkan siapa yang sesungguhnya
mengonfirmasi.

`payments.confirmedBy` (beda dari `transaction_entries.createdBy`) **nullable** — versi mitra
sengaja tidak mengisi field ini sama sekali (tidak perlu fallback owner di situ).

### 14.4 Tampilan invoice

`PublicInvoiceData.codPendingTotal` (dihitung di `invoice/[id]/page.tsx`) = total porsi COD
(item penjual + ongkos) yang **belum** dikonfirmasi — sudah termasuk di dalam
`invoice.total`/`remaining` (COD tetap bagian dari total invoice, cuma belum "dibayar" sampai
dikonfirmasi), murni dipakai untuk memisahkan tampilan.

- **Default "Nominal Transfer"** = `remaining - codPendingTotal` (floor 0) untuk invoice
  non-cicilan — customer tidak diminta transfer porsi yang memang akan dibayar tunai nanti.
- **Card breakdown** (`canPay && codPendingTotal > 0`): "Dibayar tunai saat barang diterima:
  Rp Y" + "Perlu ditransfer sekarang: Rp Z".
- **Per-baris shipping**: status "Menunggu pembayaran tunai (COD)" (amber) atau "✓ Tunai
  diterima {tanggal}" (hijau) berdasarkan `codConfirmedAt`.
- **Ambil Sendiri**: baris shipping tampil "Ambil Sendiri" + nama lokasi/alamat/link Google
  Maps, menggantikan tampilan kurir/resi (tidak relevan untuk pickup).

Admin invoice detail (`finance/billing/invoice/[id]`) dan halaman mitra
(`akun/mitra/pesanan`) sama-sama dapat tombol **"Konfirmasi Tunai Diterima"** di baris COD yang
`sellerType` cocok dan belum `codConfirmedAt`.

### 14.4b Bug fix — produk variasi selalu skip shipping/COD/pickup (2026-08)

Ditemukan saat testing lokal pertama: aktifkan COD+pickup di `/toko/pengaturan`, tapi checkout
sama sekali tidak menampilkan pilihan pengiriman apa pun (bukan cuma COD/pickup — cek ongkos
kirim pun tidak muncul). Root cause: `checkout/page.tsx`'s query pembangun `sellerGroups` query
`ts.products` pakai `productItemIds` (dari `cart_items.item_id`) langsung — TAPI untuk produk
**variable**, `cart_items.item_id` adalah `product_variations.id`, bukan `products.id` (celah
ini sudah dicatat sejak Fase 1 Voucher, `docs/arsitektur-voucher.md`, sengaja di-scope-out saat
itu — sekarang genuinely memblokir fitur ini). Akibatnya `inArray(ts.products.id,
productItemIds)` tidak pernah match apa pun untuk produk variasi → `sellerGroups` selalu kosong
→ `needsShipping = sellerGroups.length > 0` di `checkout-form.tsx` selalu `false` → seluruh
section pengiriman (kurir, COD, pickup) tidak pernah dirender.

**Fix**: `checkout/page.tsx` sekarang query `product_variations` dulu untuk resolve
`itemId → parentProductId` (kalau itemId adalah variation id) sebelum lookup `products`/`mitras`.
Berat juga di-resolve dengan prioritas `variation.weightGram ?? product.weightGram` —
`product_variations.weight_gram` memang didesain sebagai override berat per-variasi (lihat
komentar schema di `packages/db/src/schema/tenant/shop.ts`).

**Gap susulan ditemukan+ditutup di hari yang sama**: `VariationTable`
(`components/toko/variation-table.tsx`) awalnya tidak punya field input berat sama sekali —
kolom `product_variations.weight_gram` ada di DB dan sudah DIBACA oleh checkout (§ di atas),
tapi tidak ada UI untuk MENGISINYA. User laporkan langsung setelah fix di atas ("saya tidak
melihat field berat ketika edit product di variasi"), sekaligus minta field baru ini dibuat
sebagai **popup/Dialog** saat edit variasi — bukan field inline tambahan di sidebar `w-72`
yang sudah padat (alasan eksplisit: "lebar sidebar yang kecil bikin bingung editnya").

**Fix**: `VariationTable` direstrukturisasi total — tiap baris variasi sekarang jadi ringkasan
kompak (foto thumbnail, badge atribut, harga/stok/berat sebagai satu baris teks, toggle Aktif,
tombol Edit pensil, tombol Hapus), bukan lagi form inline penuh per baris. Klik foto/ringkasan/
tombol Edit membuka `Dialog` (shadcn/Radix, pola sama `MediaPicker`) berisi form lengkap:
Harga Dasar, Stok, Harga Publik, **Berat (gram) — field baru**, Harga Anggota (dengan hint
validasi maks harga anggota yang sudah ada), SKU, dan manajemen foto. Field Berat sengaja
placeholder "Ikut produk" (bukan "0") — kosong berarti checkout fallback ke berat produk
induk, sesuai desain override yang sudah dikunci di paragraf sebelumnya.

Dialog tambah-foto (`MediaPicker`) tetap bisa dibuka SAAT Dialog edit variasi masih terbuka
(dua Radix `Dialog` root independen, state masing-masing terpisah) — pola ini sudah ada
preseden identik di codebase (`MediaEditModal` dibuka dari dalam `MediaPicker` yang sedang
terbuka, lihat komentar "di luar Dialog" di `media-picker.tsx`), jadi tidak perlu mekanisme
`collapseSignal` seperti kasus Dialog+AlertDialog konfirmasi pembayaran yang pernah bermasalah.

3 titik lain diupdate agar `weightGram` benar-benar tersimpan+termuat:
`toko/actions.ts`'s `saveVariationsAction` (insert `weightGram` ke DB) dan
`generateVariationsAction` (default `""` untuk kombinasi variasi baru), serta
`produk/[id]/edit/page.tsx` (load `weightGram` dari DB row saat membuka form edit). Nol
migrasi baru — kolom `weight_gram` sudah ada sejak Fase A COD/pickup.

### 14.4c Fallback Harga/Berat/SKU per Variasi + cart-item orphaning (2026-08)

User menegaskan prinsip yang seharusnya sudah berlaku sejak awal: kalau variasi tidak
mengisi harga/berat/SKU sendiri, sistem WAJIB pakai nilai produk induk — bukan angka kosong
atau 0 ("buat apa harga dasar kalau tidak dipakai"). Sebelum fix ini, hanya `weightGram`
yang sudah punya semantik ini (nullable + fallback di checkout, § 14.4b); `price` justru
DIPAKSA jadi `0.00` di `saveVariationsAction` kalau field-nya dibiarkan kosong (`(parseFloat
(v.price) || 0).toFixed(2)`), dan `sku` (sudah nullable, tapi tidak pernah di-resolve
fallback di manapun).

**Migrasi**: `product_variations.price` diubah jadi nullable
(`0059_product_variation_price_nullable.sql`) — sama seperti `weight_gram` yang memang sudah
lama nullable. `sku` sudah nullable sejak awal, tidak perlu migrasi.

**Resolve-time fallback, bukan disalin ke DB saat simpan** — konsisten pola `weightGram`
yang sudah ada: `saveVariationsAction` sekarang menulis `null` (bukan `0.00`) kalau field
harga variasi dikosongkan, dan setiap titik BACA yang mengonsumsi harga variasi wajib
resolve `variation.price ?? product.price` sebelum dipakai:
- `produk/[productSlug]/page.tsx` — `variations` array (dipakai add-to-cart & priceMin/
  priceMax milik produk sendiri) di-resolve saat dibangun: `price: String(v.price ?? row.price)`,
  `sku: v.sku ?? row.sku`. Setelah ini, downstream (`resolvePrice()`, `parseFloat(displayPrice)`
  yang dikirim ke `addToCartAction`) otomatis benar tanpa perlu tahu apakah nilainya explicit
  atau fallback.
- **4 titik lain** menghitung `MIN(price)`/`MAX(price)` mentah lintas semua variasi produk
  (untuk tampilan "Mulai dari Rp X" di listing/kartu) — SQL polos ini salah begitu ada
  variasi ber-`price=NULL`: aggregate mengabaikan baris NULL sepenuhnya, padahal baris itu
  efektif berharga = harga produk. Diganti helper baru **`lib/product-variation-price.server.ts`**
  (`resolveVariantPriceRanges`) yang pakai `COALESCE(product_variations.price,
  products.price)` di dalam agregat — dipakai di `produk/page.tsx` (arsip), `produk/kategori/
  [categorySlug]/page.tsx`, `produk/[productSlug]/page.tsx` (bagian "Produk Terkait"), dan
  `products-section.tsx` (section landing page). Satu implementasi, bukan 4 salinan SQL yang
  bisa drift lagi ke depan.
- `weightGram` sudah benar sejak § 14.4b (satu-satunya konsumen: checkout). `sku`
  saat ini TIDAK dikonsumsi/ditampilkan di mana pun secara fungsional (dicek via grep
  menyeluruh — `ProductVariationData.sku` di-fetch tapi tidak pernah dirender di
  `product-detail-client.tsx`) — fallback untuk SKU murni kosmetik di popup admin
  (placeholder "(dari produk)"), belum ada tempat lain yang butuh resolve runtime.

**`VariationTable`/`VariationEditForm` diperluas** — 3 prop baru (`productPrice`,
`productWeightGram`, `productSku`) diteruskan dari `product-form.tsx` (nilai field "Harga
Dasar"/"Berat (gram)"/"SKU" di sidebar/main content, bukan query terpisah). Baris ringkasan
variasi & placeholder di dialog edit sekarang menunjukkan nilai EFEKTIF (mis. "Rp 150.000
(produk)" kalau variasi tidak override) — supaya admin tidak salah kira field kosong berarti
"harga Rp 0", dan tahu persis angka apa yang benar-benar akan dipakai. Teks hint sidebar
"Field harga di atas diabaikan" (menyesatkan untuk produk variable) diganti "dipakai sebagai
bawaan untuk variasi yang tidak diisi sendiri — tidak diabaikan"; Stok tetap eksplisit selalu
per-variasi (tidak ada fallback stok — tiap variasi punya stok independen).

**Bug arsitektur terpisah ditemukan+diperbaiki bersamaan — `saveVariationsAction` delete-all
+insert-all meregenerasi SEMUA UUID variasi setiap kali produk disimpan.** Ini ditemukan
saat mendiagnosis laporan "checkout masih tidak menampilkan apa pun" — investigasi DB lokal
langsung (`psql`) menunjukkan `cart_items.item_id` (untuk produk variable, ini adalah
`product_variations.id`) menunjuk UUID yang **sudah tidak ada** di `product_variations` sama
sekali. Root cause: `saveVariationsAction` SEBELUMNYA selalu `DELETE ... WHERE product_id=X`
lalu `INSERT` ulang SEMUA variasi dengan UUID BARU (`defaultRandom()`) — meski kombinasi
atributnya identik dengan sebelumnya. Kalau seorang pelanggan sudah menambahkan sebuah
variasi ke keranjang, LALU admin resave produk itu (mengubah stok, harga, atau — persis
skenario sesi ini — mengisi field Berat lewat popup baru), UUID variasi yang ada di keranjang
pelanggan langsung jadi orphan: `checkout/page.tsx`'s lookup `variationMap[item.itemId]`
tidak menemukan apa pun → `realProductId` fallback ke `item.itemId` mentah (bukan UUID produk
valid) → query produk tidak menemukan apa pun → baris di-skip total →
`sellerGroups` kosong → seluruh section pengiriman (kurir, COD, pickup) tidak pernah
dirender — persis gejala yang dilaporkan.

**Fix**: `saveVariationsAction` ditulis ulang jadi **diff-based upsert** (bukan delete-all+
insert-all) — pola yang sama dengan "Tag Sync" yang sudah lama dikunci di lesson CLAUDE.md
project ini ("gunakan diff, bukan delete-all+insert-all, untuk pivot table"). Variasi yang
masih dikirim DAN sudah punya `id` (existing) di-`UPDATE` di tempat — UUID-nya dipertahankan.
Variasi baru (tanpa `id`) di-`INSERT`. Variasi yang ada di DB tapi TIDAK lagi dikirim di
payload (dihapus admin dari UI) baru di-`DELETE`. Ini menutup kelas bug ini untuk SEMUA
resave produk ke depan, bukan cuma skenario testing sesi ini — orphaning HANYA akan terjadi
sekarang kalau admin benar-benar MENGHAPUS variasi tertentu (yang memang seharusnya membuat
cart_item yang mereferensikannya tidak valid lagi — itu perilaku yang benar).

**Data test lokal**: satu `cart_items` row yang sudah terlanjur orphan (dari sesi testing
sebelum fix ini) dihapus manual via `psql` di database lokal — bukan sesuatu yang perlu
di-backport ke data lain, murni cleanup test data lokal.

### 14.5 Belum diverifikasi

- Belum ada uji end-to-end di browser (checkout dengan grup penjual campuran, pilih Ambil
  Sendiri untuk satu grup + COD untuk grup lain, konfirmasi dari kedua sisi admin & mitra).
- Belum diverifikasi visual di browser: Dialog edit variasi baru (isi Berat, simpan, generate
  ulang variasi tidak menghapus berat yang sudah diisi, MediaPicker tetap bisa dibuka saat
  Dialog edit terbuka).
- Belum diverifikasi visual di browser: fallback harga/berat/SKU (kosongkan harga variasi →
  ringkasan tampil "Rp X (produk)" → checkout hitung harga & ongkir dengan benar; simpan
  variasi lalu resave produk lagi → UUID variasi TIDAK berubah, cek via DevTools/DB kalau
  perlu; harga listing "Mulai dari Rp X" ikut benar begitu campuran variasi override+fallback).
- Migration `0058_shipping_cod_pickup.sql` DAN `0059_product_variation_price_nullable.sql`
  **belum dijalankan di VPS** — wajib sebelum deploy, urutan sesuai nomor.

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
- [x] **Invoice manual admin** — item picker: pilih dari katalog produk/tiket (`searchBillingProductsAction`, `searchBillingPaidTicketsAction`) + customer autocomplete (`MemberNameAutocomplete`) + Kode Unik Otomatis + WA Notifikasi (`invoice_created`) ✅ SELESAI (2026-07)

### Fulfillment Pengiriman (Phase 4)
- [x] `SHIPPING_STATUSES` 5 stage: `pending|processing|packed|shipped|delivered`
- [x] `updateFulfillmentStatusAction` — validasi transisi, handle timestamps
- [x] Admin fulfillment page: `/toko/pesanan/invoice/[invoiceId]`
- [x] `FulfillmentCard` + `FulfillmentTimeline` client component
- [x] Lightbox untuk bukti transfer di admin + publik
- [x] `/akun/transaksi` tampilkan 5 stage dengan icon berbeda
- [x] Link pesanan list → fulfillment page
> Detail: **`docs/arsitektur-fulfillment.md`**

### Diskon & Voucher (Fase 1)
- [x] Schema `vouchers` + `voucher_redemptions` + kolom baru `invoices`/`invoice_items`
- [x] Resolver murni `packages/db/src/helpers/voucher.ts` (findVoucherByCode, countCustomerRedemptions, computeVoucherDiscount)
- [x] Integrasi `checkoutAction` — potongan per-item, Rp 0 auto-lunas, kode unik di-skip saat total=0
- [x] UI preview + input kode di `checkout-form.tsx` (bukan halaman keranjang — lihat § UI di `docs/arsitektur-voucher.md`)
- [x] Admin CRUD `/finance/billing/voucher/*` + tab `BillingTabs`
- [x] `cancelInvoiceAction` — rollback `usedCount` + tandai redemption `cancelledAt`
- [x] Audit docs-vs-kode pasca-implementasi — 4 bug/gap ditemukan+difix (email case-sensitivity,
      invoice detail tidak tampilkan voucher, validFrom/validUntil UTC-mentah, NaN guard) — lihat
      `docs/arsitektur-voucher.md` § 11
- [ ] Migrasi `0034_vouchers.sql` **belum dijalankan di VPS** — wajib sebelum deploy
- [ ] Belum dites manual end-to-end di browser
> Detail lengkap: **`docs/arsitektur-voucher.md`**

### COD (Bayar di Tempat) & Ambil Sendiri
- [x] Schema `mitras` (5 kolom) + `invoice_shipping_lines` (9 kolom + 5 kolom courier jadi
      nullable) — migration `0058_shipping_cod_pickup.sql`
- [x] Setting tenant `/toko/pengaturan` + setting mitra self-service `/akun/mitra/pengaturan`
- [x] Checkout: pilih metode pengiriman (kurir/ambil sendiri) + metode bayar (transfer-QRIS/COD)
      per grup penjual, validasi server-side (tolak kombinasi pickup+cod, re-cek konfigurasi
      seller sesungguhnya)
- [x] Konfirmasi COD per penjual independen — `confirmCodPaymentAction` (admin) +
      `confirmMitraCodReceivedAction` (mitra self-service), reuse mekanisme partial-payment
- [x] Tampilan invoice publik+admin+mitra — breakdown COD, status per-baris, info pickup
- [ ] Migrasi `0058_shipping_cod_pickup.sql` **belum dijalankan di VPS** — wajib sebelum deploy
- [ ] Belum dites manual end-to-end di browser
> Detail lengkap: **§ 14 di dokumen ini**

### Belum Dimulai
- [ ] Invoice PDF (Playwright)
- [ ] Laporan Piutang Outstanding
- [ ] Diskon otomatis tanpa kode + target produk mitra (Voucher Fase 2) — lihat § 10 `docs/arsitektur-voucher.md`
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

---

> **Prinsip Billing Universal — jangan pernah split list transaksi per jalur masuk.** Semua
> transaksi dari jalur manapun (admin/front-end/API) idealnya tampil dalam SATU list (query dari
> `invoices` sebagai sumber utama, filter via `sourceType`/`item_type`, badge visual kalau perlu
> dibedakan) — bukan dua section terpisah untuk data yang sama. **Ralat terhadap klaim lama:**
> catatan sebelumnya (CLAUDE.md, 2026-05) mengklaim `/toko/pesanan` sudah "difix" dari pola
> dua-tabel (`orders` lama + "Pesanan via Keranjang" dari `invoices`) — ternyata TIDAK akurat
> untuk halaman ini. `docs/arsitektur-fulfillment.md` § 4 (List Pesanan) dan § 15 di bawah
> (2026-09-04) sama-sama mengonfirmasi `/toko/pesanan/page.tsx` MASIH dua tabel terpisah saat ini
> — prinsipnya tetap valid sebagai tujuan arsitektur, tapi contoh "sudah difix" itu keliru untuk
> kasus spesifik ini. § 15 di bawah adalah rencana yang belum dieksekusi untuk menyatukannya.

## 15. [PERENCANAAN — BELUM DIEKSEKUSI] Unifikasi Invoice Manual Admin — Variasi Produk + Pengiriman

> **Status: 📋 RENCANA MURNI. Nol kode ditulis.** Ditulis atas permintaan eksplisit user
> ("bikin perencanaan dulu aja bro yg matang..") sebelum eksekusi apa pun. Dokumen ini WAJIB
> dibaca ulang dan disetujui user (termasuk menjawab § 15.7) sebelum baris kode pertama ditulis.

### 15.1 Masalah yang Memicu

User melaporkan (tenant `visikita`, produk "Kaos" yang punya variasi ukuran) bahwa form
**"Buat Invoice"** (`/finance/billing/invoice/new`, modul Keuangan → Billing) TIDAK BISA:
1. Memilih varian produk (ukuran/warna) saat menambahkan produk bervariasi ke invoice.
2. Memilih metode pengiriman (kurir RajaOngkir / COD / Ambil Sendiri).

Diverifikasi lewat baca kode langsung (`invoice-create-form.tsx` 733 baris + `finance/billing/
actions.ts`'s `createInvoiceAction`/`searchBillingProductsAction`) — **laporan user akurat 100%**,
kedua kapabilitas itu genuinely tidak ada sama sekali di form ini.

Sebaliknya, form **"Buat Pesanan"** (`/toko/pesanan/new`, modul Toko) SUDAH punya KEDUA
kapabilitas itu secara penuh (`AdminVariationPicker` + `SellerGroup`-based shipping widget
dengan RajaOngkir/COD/pickup). Solusi "pakai saja Buat Pesanan yang sudah ada" ditolak user
secara eksplisit — jawabannya "TIDAK", karena:
- Harga yang di-resolve BEDA (Buat Pesanan hanya bisa pilih dari katalog Produk Toko; Buat
  Invoice mendukung Produk + Tiket Event + Donasi/Campaign + item custom bebas dalam SATU
  invoice campuran).
- Variasi/atribut yang tersedia BEDA secara konsep — dua form ini punya cakupan item yang
  sepenuhnya berbeda, bukan sekadar UI yang beda tapi datanya sama.

Permintaan user: **satu arah invoice** — konsisten antara front-end (checkout publik) dan
admin, beda hanya di UI. Pertanyaan terbuka dari user sendiri: "atau gmn?" (atau bagaimana) —
dijawab di § 15.3 dengan rekomendasi SCOPE YANG LEBIH SEMPIT dari "satu arah mutlak", disertai
alasan eksplisit kenapa penyempitan ini tepat.

### 15.2 Audit Kondisi Saat Ini — Peta Tiga Jalur Pembuatan Invoice

Ada TIGA titik yang sama-sama menghasilkan baris `invoices`/`invoiceItems`/
`invoiceShippingLines`, masing-masing di file terpisah:

| Jalur | File | Trigger | Permission gate |
|---|---|---|---|
| **Publik (cart)** | `app/(public)/[tenant]/cart/actions.ts`'s `checkoutAction` | Customer klik "Checkout" di `/checkout` | Tanpa auth (guest boleh) |
| **Toko (admin)** | `app/(dashboard)/app/[tenant]/toko/actions.ts`'s `createOrderAction` | Admin klik "Buat Pesanan" di `/toko/pesanan/new` | `hasFullAccess(..., "toko")` |
| **Billing (admin)** | `app/(dashboard)/app/[tenant]/finance/billing/actions.ts`'s `createInvoiceAction` | Admin klik "Buat Invoice" di `/finance/billing/invoice/new` | `hasFullAccess(..., "keuangan")` |

**Yang SUDAH sama di ketiganya** (infrastruktur bersama, tidak perlu disentuh):
- Skema tabel tujuan (`invoices`/`invoiceItems`/`invoiceShippingLines`/`invoicePayments`) — satu
  skema universal, bukan tiga skema berbeda.
- Voucher engine (`findVoucherByCode`/`countCustomerRedemptions`/`computeVoucherDiscount` di
  `packages/db/src/helpers/voucher.ts`) — pure function, direuse identik oleh ketiganya.
- Kode unik transaksi (`generateUniqueCode`) + aturan `amountDue = total + uniqueCode`.
- Setelah invoice TERBIT: konfirmasi pembayaran, penolakan, pembatalan, cicilan, fulfillment —
  SEMUA sudah lewat mekanisme invoice generik yang sama (`confirmInvoicePaymentAction`,
  `verifySubmittedPaymentAction`, `rejectPaymentAction`, `cancelInvoiceAction`,
  `confirmCodPaymentAction`) — lihat § 15.2a, ini sudah unified sejak lama, TIDAK termasuk
  scope pekerjaan ini.

**Yang BEDA — inilah titik divergensi sesungguhnya**:

| Aspek | Publik (`checkoutAction`) | Toko (`createOrderAction`) | Billing (`createInvoiceAction`) |
|---|---|---|---|
| Sumber item | `cart_items` (customer sendiri yang isi) | Katalog Produk Toko saja | Produk + Tiket Event + Donasi + item custom bebas |
| Resolusi variasi produk | ✅ via `resolveProductCartItem()` (`itemId` asli disimpan, `productId` induk dipisah untuk voucher) | ✅ via `resolveProductCartItem()` (identik) + `AdminVariationPicker` dialog UI | ❌ `searchBillingProductsAction` return `{id, name, price, sku}` — TIDAK ADA productType/variasi sama sekali |
| Widget pengiriman | ✅ `SellerGroup`/`CheckoutShippingData`, per-seller (kurir/COD/pickup) | ✅ identik (`order-create-client.tsx`, `LocalSellerGroup`) | ❌ tidak ada field pengiriman apa pun |
| `sourceType` yang ditulis | `"cart"` | `"order"` | `"manual"` |
| `mitraId` untuk voucher matching | ✅ resolved dari `resolveProductCartItem()` | ✅ resolved | ❌ **hardcode `null`** (gap pre-existing, lihat § 15.4d) |

### 15.2a Temuan Penting: Konfirmasi Pembayaran SUDAH Unified — Bukan Bagian dari Masalah

`toko/actions.ts` masih punya 4 fungsi (`addPaymentToOrderAction`, `confirmOrderPaymentAction`,
`cancelOrderAction`, `updateOrderStatusAction`) yang beroperasi di tabel **LEGACY**
`schema.orders`/`schema.orderItems` — tapi dikonfirmasi lewat 3 bukti independen bahwa keempatnya
**dead code, tidak reachable dari UI mana pun**:
1. `pesanan/[id]/page.tsx` (satu-satunya route yang merender komponen pemanggil ke-4 fungsi ini,
   `order-detail-client.tsx`) adalah stub yang SELALU redirect ke list — dikonfirmasi baca isi
   filenya langsung (13 baris, komentar eksplisit: `"Halaman pesanan lama sudah tidak dipakai —
   semua pesanan kini via invoice"`).
2. `schema.orders` = 0 baris di kedua tenant lokal yang dicek.
3. `docs/arsitektur-product.md` (§ "Gap yang ditemukan") secara independen mengonfirmasi hal
   yang sama: `deleteProductAction` masih JOIN ke `orders`/`order_items` untuk cek "pesanan
   aktif" tapi guard itu "efektif mati" karena modul ini sudah lama tidak menulis ke tabel itu.

**Konsekuensi penting untuk scope pekerjaan ini**: pembayaran/pembatalan/fulfillment untuk
pesanan produk yang dibuat via `createOrderAction` MODERN sudah lewat mekanisme invoice generik
yang SAMA dengan Billing (`confirmInvoicePaymentAction` dkk, bukan 4 fungsi legacy di atas) —
jadi unifikasi yang dibutuhkan HANYA di titik PEMBUATAN invoice (CREATE), bukan seluruh siklus
hidupnya. Ini secara signifikan mempersempit scope pekerjaan.

### 15.3 Keputusan Arsitektur yang Direkomendasikan

**Bukan "satu arah mutlak" (gabung SEMUA termasuk publik) — melainkan: satukan DUA jalur ADMIN
(Toko + Billing) jadi SATU, biarkan jalur PUBLIK tetap terpisah.**

Alasan pemisahan publik tetap dipertahankan:
- Konteksnya struktural berbeda: publik selalu mulai dari `cart_items` yang sudah terisi lewat
  navigasi browsing produk (`/produk/{slug}` → "Tambah ke Keranjang" → picker atribut di
  halaman detail produk, BUKAN di form checkout) — bukan form "ketik lalu cari katalog" seperti
  admin. Menyatukan ini akan memaksa checkout publik ikut pola search-autocomplete admin, yang
  justru mengubah UX customer yang sudah berjalan baik tanpa alasan.
- Publik tidak butuh: pilihan tipe item campuran bebas (Tiket/Donasi/custom — customer sudah
  di context spesifik produk/tiket/campaign saat menambah ke cart), autocomplete pelanggan
  (customer = dirinya sendiri), atau kode unik/voucher-preview di form yang sama dengan
  pemilihan item (checkout publik SUDAH punya alur voucher sendiri di halaman terpisah).
- Risiko regresi: `checkoutAction` adalah kode paling sering dieksekusi di seluruh platform
  (setiap transaksi customer nyata lewat sini) — menyentuhnya demi unifikasi UI admin adalah
  risiko yang tidak proporsional dengan manfaatnya.

**Yang diusulkan untuk DUA jalur admin (Toko + Billing)**:
1. **Retire (pensiunkan) `/toko/pesanan/new`** — hapus halaman ini, redirect ke
   `/finance/billing/invoice/new` (pola sama seperti `pesanan/[id]/page.tsx` yang sudah jadi
   stub redirect sejak migrasi invoice-only lama).
2. **Perluas `/finance/billing/invoice/new`** (`invoice-create-form.tsx` +
   `createInvoiceAction`/`previewInvoiceVoucherAction`) supaya bisa melakukan SEMUA yang bisa
   dilakukan `createOrderAction`:
   - Saat admin pilih produk `productType === "variable"` dari `CatalogItemAutocomplete` →
     buka `<AdminVariationPicker>` (komponen SUDAH ADA, `components/toko/admin-variation-
     picker.tsx` — reuse langsung, TIDAK ditulis ulang) untuk pilih kombinasi atribut → `itemId`
     yang tersimpan ke `invoiceItems.itemId` adalah ID VARIASI (bukan produk induk), persis pola
     `resolveProductCartItem()` yang sudah benar di `createOrderAction`/`checkoutAction`.
   - Widget pengiriman baru — REUSE logic dari `order-create-client.tsx` (`LocalSellerGroup`,
     `CourierOption`, fetch cost RajaOngkir, toggle delivery/payment method per-seller,
     re-validasi server-side terhadap `tokoSettings`/`schema.mitras`) — porting UI + server data
     fetching (`pesanan/new/page.tsx`'s server component logic: RajaOngkir addon config, toko
     settings, per-mitra shipping config) ke `finance/billing/invoice/new/page.tsx`.
     > **PENTING (2026-09-04)**: `order-create-client.tsx` PERNAH punya 2 bug di widget ini
     > (Kota Tujuan tetap wajib meski semua grup pilih "Ambil Sendiri" + dropdown pencarian
     > kota tidak pernah tampil kalau hasil kosong/gagal) — SUDAH DIFIX di file itu sendiri.
     > Kalau porting dilakukan, port versi FIXED (`anyCourierGroup` guard + dropdown
     > `cityOpen && citySearch.length>=2` dengan state loading/kosong eksplisit), JANGAN
     > menyalin dari commit/riwayat sebelum fix ini. Detail lengkap: lesson CLAUDE.md
     > "[2026-09-04] Bug Widget Pengiriman `/toko/pesanan/new`".
   - Widget pengiriman HANYA muncul/relevan kalau invoice mengandung minimal satu item bertipe
     produk (Tiket/Donasi/custom tidak butuh pengiriman fisik) — kondisional, bukan selalu
     tampil.
3. **`createOrderAction` DIHAPUS TOTAL** setelah `createInvoiceAction` terbukti mencakup semua
   kemampuannya (bukan dibiarkan sebagai dead code baru — beda dari 4 fungsi legacy `schema.
   orders` yang SUDAH lama jadi dead code sebelum sesi ini, retensi mereka di luar scope ini).

### 15.4 Rincian Teknis per Titik Perbedaan

**a. Permission module (`toko` vs `keuangan`)**

`createOrderAction` di-gate `hasFullAccess(..., "toko")`; `createInvoiceAction` di-gate
`hasFullAccess(..., "keuangan")` — dua modul berbeda di sistem 10-modul permission
(`lib/permissions.ts`). Kalau "Buat Pesanan" dihapus dan digantikan sepenuhnya oleh "Buat
Invoice", staf yang SEBELUMNYA punya akses `toko` (full) tapi TIDAK punya akses `keuangan`
(mis. staf gudang/admin toko yang bukan bendahara) akan KEHILANGAN kemampuan membuat pesanan
produk — regresi akses nyata untuk role tertentu, bukan sekadar cosmetic. **Ini keputusan
produk, bukan teknis — dicatat sebagai pertanyaan terbuka § 15.7 poin 1.**

**b. `sourceType` yang ditulis + dependency di `/toko/pesanan/page.tsx`**

`/toko/pesanan/page.tsx` (halaman LIST pesanan di modul Toko, TIDAK dihapus — cuma tombol
"Buat Pesanan"-nya yang di-retire) memfilter query-nya dengan
`eq(schema.invoices.sourceType, "order")` secara literal. Kalau `createInvoiceAction`
(pengganti) menulis `sourceType: "manual"` untuk SEMUA invoice terlepas isinya (perilaku
saat ini), invoice produk yang dibuat lewat form baru TIDAK AKAN muncul lagi di halaman list
Toko ini — regresi fungsional.

Dua opsi (dibahas, TIDAK diputuskan sepihak — lihat § 15.7 poin 2):
- **Opsi B1** — `createInvoiceAction` menulis `sourceType` secara DINAMIS: `"order"` kalau
  SEMUA item invoice bertipe produk (persis kondisi yang dulu memicu `createOrderAction`),
  `"manual"` untuk kasus campuran/lainnya. Minim perubahan di `/toko/pesanan/page.tsx`.
- **Opsi B2** — Ganti filter `/toko/pesanan/page.tsx` dari `sourceType==='order'` jadi
  "invoice yang punya minimal satu `invoiceItems.itemType==='product'`" (query via
  `EXISTS`/JOIN ke `invoice_items`, konsisten dengan arah migrasi income-splitting yang SUDAH
  meninggalkan `sourceType` sebagai basis akurasi laporan keuangan — lihat catatan di § 14
  soal `invoice_items.item_type` sebagai basis yang lebih granular). Lebih tahan lama tapi
  mengubah 1 file tambahan.

**c. Widget pengiriman — kondisional, bukan selalu tampil**

Tidak semua invoice Billing butuh pengiriman (Tiket/Donasi/custom item tidak punya wujud
fisik). Widget pengiriman baru di `invoice-create-form.tsx` WAJIB muncul HANYA ketika
`items.some(i => i.type === "product")` — dan di dalam kelompok produk itu sendiri, dikelompokkan
per-seller (tenant vs tiap mitra) persis algoritma `SellerGroup` yang sudah ada, karena satu
invoice campuran produk tenant+mitra tetap valid (keputusan lama yang sudah dikunci: "Boleh
campur toko + mitra").

**d. Gap pre-existing yang HARUS ikut ditutup: `mitraId: null` hardcoded di voucher matching**

Ditemukan saat audit (bukan disebabkan sesi ini) — komentar eksplisit di
`createInvoiceAction`/`previewInvoiceVoucherAction` (`finance/billing/actions.ts`, per catatan
"KOREKSI (2026-08-31)") mengakui `mitraId` untuk keperluan pencocokan target voucher
di-hardcode `null`, alih-alih di-resolve dari produk sesungguhnya via
`resolveProductCartItem()`. Efeknya: produk MITRA yang ditambahkan ke invoice manual admin
BISA salah menerima diskon voucher yang seharusnya cuma berlaku untuk produk TENANT (atau
sebaliknya), tergantung bagaimana `computeVoucherDiscount()` memakai `mitraId` di logic
matching-nya.

Karena pekerjaan ini SUDAH HARUS menyentuh baris kode yang sama (resolusi item produk di
`createInvoiceAction`, untuk menambahkan dukungan variasi), memperbaiki `mitraId` di titik
yang sama adalah perubahan MURAH (nol biaya tambahan riset, sudah tahu polanya dari
`resolveProductCartItem()`) — direkomendasikan DIBUNDLE ke pekerjaan ini, bukan ditunda
terpisah. Dicatat sebagai keputusan yang perlu dikonfirmasi di § 15.7 poin 3 (defaultnya:
ya, dibundle).

**e. Voucher preview — `perItemDiscount` key alignment untuk variasi**

`previewInvoiceVoucherAction` menerima array item mentah dari form untuk preview diskon
sebelum submit. Begitu form bisa kirim `itemId` = ID VARIASI, fungsi ini WAJIB mengikuti pola
yang sama seperti fix §17 `docs/arsitektur-voucher.md` (`applyVoucherToInvoiceAction`) — resolve
`itemId` variasi → `productId` induk HANYA untuk matching, sambil `perItemDiscount` tetap
di-key oleh `itemId` ASLI (variasi) supaya alignment index dengan array yang dikirim form tidak
geser. Pola ini SUDAH ada preseden kerjanya persis di commit `56ac7db` — tinggal direplikasi
ke fungsi preview yang setipe.

### 15.5 Yang TIDAK Berubah (Batasan Scope, Sengaja Dijaga)

- `checkoutAction` (public cart checkout) — nol sentuhan.
- Seluruh siklus PASCA-invoice-terbit (konfirmasi/tolak/batal/cicilan/fulfillment/COD) — sudah
  unified, nol sentuhan (lihat § 15.2a).
- Voucher engine inti (`packages/db/src/helpers/voucher.ts`) — dipakai apa adanya, tidak
  diubah.
- Skema DB — nol migrasi baru diperkirakan dibutuhkan (semua kolom yang perlu, seperti
  `invoiceItems.itemId`/`invoiceShippingLines.*`, sudah ada sejak fitur COD/pickup § 14 dan
  fitur variasi produk lama).
- 4 fungsi legacy `schema.orders`-based di `toko/actions.ts` dan guard basi di
  `deleteProductAction` (`docs/arsitektur-product.md`) — dead code yang SUDAH terdokumentasi
  sebagai gap terpisah sebelum sesi ini, TETAP di luar scope pekerjaan ini (jangan digabung,
  supaya PR/perubahan tetap fokus dan mudah di-review).

### 15.6 Rencana Fase Eksekusi (draft, menunggu konfirmasi § 15.7)

1. **Fase A — Server-side**: perluas `searchBillingProductsAction` (atau tambah action baru)
   untuk expose `productType`; tambah action `getBillingProductVariationsAction` (bisa reuse
   `getProductVariationsAction` dari `toko/actions.ts` apa adanya kalau sudah generik, atau
   duplikasi tipis ke `finance/billing/actions.ts` sesuai konvensi "duplikasi demi isolasi" —
   diputuskan saat implementasi berdasar seberapa reusable fungsi aslinya). Perluas
   `createInvoiceAction` + `previewInvoiceVoucherAction`: resolusi `itemId`/`productId`
   terpisah (§ 15.4e), fix `mitraId` (§ 15.4d), terima+simpan payload shipping
   (`invoiceShippingLines`), keputusan `sourceType` dinamis (§ 15.4b, opsi terpilih).
   Verifikasi `tsc --noEmit` di `apps/web` dan `packages/db`.
2. **Fase B — Server-side data fetching untuk halaman**: perluas
   `finance/billing/invoice/new/page.tsx` mereplikasi fetch yang sudah ada di
   `pesanan/new/page.tsx` (RajaOngkir addon config, `getTokoSettings()`, per-mitra shipping
   config via `schema.mitras` + `memberBusinesses`) — HANYA dipanggil/dipakai kalau tenant
   memang mengaktifkan modul Toko (cek relevansinya, jangan fetch sia-sia untuk tenant yang
   modul Ekosistem/Toko-nya nonaktif).
3. **Fase C — Client UI**: `invoice-create-form.tsx` — integrasikan `<AdminVariationPicker>`
   ke alur pilih item produk; port widget shipping dari `order-create-client.tsx`
   (`LocalSellerGroup` dkk) sebagai komponen baru atau bagian dari form ini, kondisional
   tampil (§ 15.4c). Verifikasi `tsc --noEmit` + `bun run build --filter=@jalajogja/web`
   genuine (dev server dimatikan, `.next` dibersihkan, direstart setelah).
4. **Fase D — Retire "Buat Pesanan"**: `pesanan/new/page.tsx` diubah jadi stub redirect ke
   `/finance/billing/invoice/new` (pola sama `pesanan/[id]/page.tsx`), `order-create-client.tsx`
   + `AdminVariationPicker`'s pemanggilan lama dihapus KALAU sudah tidak dipakai di tempat lain
   (dicek dulu — `AdminVariationPicker` dipakai ULANG oleh form baru, jangan dihapus filenya,
   cuma pemanggilan dari `order-create-client.tsx` yang sudah tidak relevan). `createOrderAction`
   dihapus dari `toko/actions.ts` setelah dipastikan nol pemanggil tersisa (grep).
   Sesuaikan `toko-nav.tsx` (submenu "Buat Pesanan" kalau ada link langsung ke tombol itu).
5. **Fase E — Update `/toko/pesanan/page.tsx`** sesuai opsi B1/B2 yang dipilih (§ 15.4b).
6. **Fase F — Dokumentasi**: update `docs/arsitektur-product.md` (hapus/tandai superseded
   bagian "Buat Pesanan"), `docs/arsitektur-billing.md` § 13 (perluas cakupan deskripsi form),
   `docs/arsitektur-voucher.md` (tambah catatan variasi-di-Billing-invoice kalau relevan).
   Update CLAUDE.md Lessons Learned.

Setiap fase diverifikasi `tsc --noEmit` (kedua package) sebelum lanjut ke fase berikutnya,
sesuai SOP project. `bun run build --filter=@jalajogja/web` genuine (dev server dimatikan,
`.next` dibersihkan sebelum build, direstart setelah) dijalankan minimal di akhir Fase C dan
Fase D. Belum ada instruksi untuk commit/push/deploy — menunggu seluruh fase selesai dan
diverifikasi lokal, sesuai pola kerja project ini.

### 15.7 Keputusan Terbuka — Wajib Dijawab User Sebelum Eksekusi

1. **Akses role staf toko-tanpa-keuangan** (§ 15.4a) — kalau "Buat Pesanan" dihapus, staf
   dengan permission `toko: full` tapi `keuangan: none` kehilangan cara membuat pesanan
   produk. Tiga opsi: (i) terima risiko ini (asumsi role seperti itu jarang/tidak dipakai di
   praktik — perlu dicek dulu apakah ada custom role tenant manapun dengan kombinasi ini);
   (ii) `createInvoiceAction` mengizinkan akses kalau `hasFullAccess(..., "toko") ||
   hasFullAccess(..., "keuangan")` KHUSUS untuk invoice yang isinya murni produk (menambah
   percabangan guard, lebih kompleks); (iii) pertahankan "Buat Pesanan" sebagai ENTRY POINT
   terpisah (route/tombol beda) yang keduanya memanggil action YANG SAMA — tidak retire
   halaman/tombolnya, cuma unify logic di baliknya. **Rekomendasi: (iii)** — risiko akses
   paling rendah, dan user sendiri bilang "bedanya di UI saja" yang justru cocok dengan
   opsi ini (dua PINTU MASUK/tombol, satu MEKANISME).
2. **`sourceType` — dinamis (B1) atau ganti basis filter list (B2)** (§ 15.4b). Rekomendasi:
   B1 (lebih murah, minim perubahan file lain) kecuali user ingin sekalian membereskan
   ketergantungan `sourceType` di tempat lain juga (di luar scope pekerjaan ini kalau begitu).
3. **Bundling fix `mitraId: null`** (§ 15.4d) — rekomendasi: ya, dibundle (murah, satu titik
   kode yang sama).
4. **Nasib halaman/tombol "Buat Pesanan" secara UI** — mengikuti keputusan poin 1: kalau opsi
   (iii) dipilih, apakah tombolnya tetap bernama "Buat Pesanan" (di sub-nav Toko) sebagai
   jalan pintas ke form yang sama (mungkin dengan filter tampilan default "hanya produk"), atau
   dihapus total dan digantikan satu tombol "Buat Invoice" di kedua modul?

### 15.8 Query Diagnosa — Cek Data Historis SEBELUM Eksekusi (read-only, jalankan di VPS)

Ditanyakan user "aman secara data?" saat rencana ini ditulis. Jawaban: rencana ini sendiri
aman (nol migrasi, tidak menyentuh baris lama, tidak menyentuh siklus pasca-terbit invoice) —
TAPI ada 1 celah PRE-EXISTING (bukan disebabkan rencana ini) yang belum diverifikasi ke data
production: sebelum rencana ini, `searchBillingProductsAction` (form "Buat Invoice") tidak
membedakan produk simple/variable — admin BISA sudah pernah menambahkan produk bervariasi
lewat form ini, tersimpan sebagai `itemId` = ID PRODUK INDUK (bukan varian spesifik) dengan
harga dasar produk induk, karena memang belum ada picker varian saat itu.

Jalankan via SSH ke VPS (`docker compose exec -T postgres psql -U jalakarta -d jalakarta`,
ganti `tenant_visikita` sesuai schema tenant yang mau dicek — ulangi per tenant aktif):

```sql
-- Cari invoice_items dari invoice manual admin (sourceType='manual') yang itemId-nya
-- adalah PARENT product id untuk produk yang sebenarnya productType='variable'.
-- Hasil 0 baris = aman, tidak pernah terjadi. Ada baris = data lama yang perlu keputusan
-- terpisah (biarkan sebagai histori apa adanya, atau koreksi manual seperti kasus voucher
-- lama di docs/arsitektur-voucher.md § 16-17).
SELECT
  i.id                  AS invoice_id,
  i.invoice_number,
  i.created_at,
  ii.id                 AS invoice_item_id,
  ii.item_id,
  ii.name               AS item_name_snapshot,
  ii.unit_price,
  p.name                AS product_name,
  p.product_type
FROM tenant_visikita.invoice_items ii
JOIN tenant_visikita.invoices i  ON i.id = ii.invoice_id
JOIN tenant_visikita.products p ON p.id = ii.item_id
WHERE ii.item_type = 'product'
  AND i.source_type = 'manual'
  AND p.product_type = 'variable'
ORDER BY i.created_at DESC;
```

Belum dijalankan — menunggu Anda sempat SSH. Tidak memblokir penulisan kode di § 15.6 (hasil
query ini murni informasional untuk data LAMA, tidak mengubah desain rencana), tapi sebaiknya
dijalankan sebelum invoice manual pertama pakai form BARU dibuat, supaya kalau ada baris lama
yang perlu dikoreksi, tidak tercampur dengan data baru yang sudah benar.
