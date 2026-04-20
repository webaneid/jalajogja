# Arsitektur Modul Billing

## Visi

Billing adalah **lapisan universal** yang menghubungkan semua modul produk
(Toko, Donasi, Event) dengan modul Keuangan. Satu alur, satu database, dua
antarmuka: front-end publik dan tenant dashboard admin.

```
[Front-end publik]             [Tenant Dashboard]
 User tambah ke cart      |    Admin input manual
         ↓                |           ↓
    Universal Cart ────────┴──→ Universal Invoice
                                  (invoices)
                                       ↓
                           Universal Payment Request
                                  (payments)
                                       ↓
                           Finance Verifikasi → Jurnal
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

Cicilan **tidak tampil di front-end** kecuali admin aktifkan dan publish program
tertentu.

Contoh use case: **Nabung Qurban 2025**
- Total: Rp 3.000.000
- 10x cicilan @ Rp 300.000/bulan
- Admin buat `installment_plans` → aktifkan → publish
- User daftar → invoice dibuat + `installment_schedules` 10 baris
- Setiap bulan: user bayar Rp 300.000 → finance konfirmasi → 1 termin lunas

---

## Server Actions (billing/actions.ts)

```typescript
// Invoice
createInvoiceAction(slug, data)              → buat invoice manual
createInvoiceFromCartAction(slug, cartToken, customerData) → checkout
updateInvoiceDueDateAction(slug, invoiceId, dueDate)
cancelInvoiceAction(slug, invoiceId, reason)
generateInvoicePdfAction(slug, invoiceId)

// Payment confirmation (via invoice layer)
confirmInvoicePaymentAction(slug, invoiceId, paymentData)
  → insert payments
  → insert invoice_payments
  → update invoice.paid_amount
  → evaluate status (partial | paid)
  → if paid: recordIncome() → jurnal

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

- [x] Phase 1 — Schema 7 tabel baru (`carts`, `cart_items`, `invoices`, `invoice_items`, `invoice_payments`, `installment_plans`, `installment_schedules`) + `financial_sequences` support type `invoice`
- [x] Phase 1 — Dashboard Billing: list invoice (filter status + search + pagination) + create manual + detail
- [x] Phase 1 — Partial payment tracking: `invoice.paid_amount` atomic, status `partial` jika belum lunas, jurnal hanya saat `paid`
- [x] Phase 1 — Nav: "Billing" masuk `keuangan-nav.tsx` sebagai submenu pertama setelah Dashboard
- [x] Phase 2 — Server Actions publik: `getCartAction`, `addToCartAction`, `updateCartItemQtyAction`, `removeCartItemAction`, `clearCartAction`, `checkoutAction`, `submitPaymentProofAction`
- [x] Phase 2 — Halaman publik: `/{slug}/keranjang`, `/{slug}/checkout`, `/{slug}/invoice/[id]`
- [x] Phase 2 — Client components: `cart-client.tsx`, `checkout-form.tsx`, `invoice-public-client.tsx`
- [x] Phase 3 — Integrasi Toko/Donasi/Event → invoice otomatis
  - `packages/db/src/helpers/billing.ts`: `createLinkedInvoice()` + `syncInvoicePayment()` — helper shared, zero circular dep
  - Toko: `createOrderAction` → invoice (sourceType=order), `confirmOrderPaymentAction` → sync invoice paid
  - Donasi: `createDonationAction` → invoice (sourceType=donation), `confirmDonationAction` → sync invoice paid
  - Event: `registerForEventAction` (paid tickets) → invoice (sourceType=event_registration), `confirmRegistrationPaymentAction` → sync invoice paid
  - Dashboard billing: tabel tambah kolom source badge (Toko/Donasi/Event/Cart/Manual), `sourceType` di `InvoiceListItem`
- [ ] Phase 3 — Integrasi Donasi: donation → invoice otomatis
- [ ] Phase 3 — Integrasi Event: registration → invoice otomatis
- [ ] Invoice PDF (Playwright)
- [ ] Program Cicilan UI
- [ ] Laporan Piutang Outstanding
- [ ] Invoice Aging Report
