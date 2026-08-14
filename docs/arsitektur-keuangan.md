# Arsitektur Modul Keuangan — jalakarta

**Status: DIIMPLEMENTASIKAN (2026-04, diperbarui 2026-08-15)**
- Core (Pemasukan, Pengeluaran, Jurnal, Akun): ✅ Selesai
- Laporan (5 jenis: Neraca Saldo, Laba Rugi, Arus Kas, **Arus Kas Bulanan**, Buku Besar + CSV/Excel export): ✅ Selesai
- Integrasi Toko/Donasi/Event → universal payments: ✅ Selesai
- Akun 4400 Pendapatan Event + `event_income` mapping: ✅ Selesai secara kode, **praktis dormant** untuk transaksi cart modern — lihat § 14
- Klasifikasi Toko/Tiket/Donasi di laporan Arus Kas (Opsi A): ✅ Selesai (2026-08-15) — lihat § 14
- Klasifikasi Toko/Tiket/Donasi di level jurnal/Chart of Accounts (Opsi B): 📋 Direncanakan, BELUM dieksekusi — lihat § 14
- Anggaran (Budgets): ⚠️ Schema ada, UI belum dibuat

---

## 1. Konsep: Tiga Lapisan Keuangan

```
[Business Layer]        [Financial Layer]       [Accounting Layer]
orders ──────────────→  payments ────────────→  transactions
donations ───────────→  (source_type + id)      transaction_entries
event_registrations ─→                          (double-entry ledger)
                        disbursements ───────→  transactions
                        (purpose_type + id)
```

Semua uang masuk dari sumber manapun (toko, donasi, event, manual) melewati satu tabel `payments`.
Semua uang keluar melewati satu tabel `disbursements`. Keduanya, setelah dikonfirmasi,
auto-generate journal entry di `transactions` + `transaction_entries`.

---

## 2. Schema Database

### `accounts` — Chart of Accounts (Bagan Akun)
```sql
id          UUID PK
code        TEXT UNIQUE          -- contoh: "1101", "4100"
name        TEXT                 -- contoh: "Kas Tunai"
type        TEXT                 -- asset | liability | equity | income | expense
parentId    UUID NULLABLE        -- self-referential (hirarkis)
isActive    BOOLEAN DEFAULT true
timestamps
```

**Akun default yang diasumsikan ada (untuk fallback mapping):**
| Kode | Nama | Tipe |
|------|------|------|
| 1101 | Kas Tunai | asset |
| 1102 | Bank | asset |
| 2200 | Dana Titipan | liability |
| 4100 | Pendapatan Iuran | income |
| 4200 | Pendapatan Donasi | income |
| 4300 | Pendapatan Usaha (Toko) | income |
| 5100 | Beban Operasional | expense |

Akun default ini TIDAK di-seed otomatis — admin perlu membuat manual di `/finance/akun`.
Jika kode akun tidak ditemukan, `pickCashAccount` / `pickIncomeAccount` mengembalikan `null`
→ konfirmasi pembayaran gagal dengan pesan "mapping belum lengkap".

### `transactions` — Header Jurnal
```sql
id              UUID PK
date            DATE
description     TEXT
referenceNumber TEXT UNIQUE   -- format: 620-JNL-YYYYMM-NNNNN
createdBy       UUID (FK → tenant.users)
timestamps
```

### `transaction_entries` — Baris Jurnal (Double-Entry)
```sql
id              UUID PK
transactionId   UUID (FK → transactions)
accountId       UUID (FK → accounts)
type            TEXT   -- debit | credit
amount          NUMERIC(15,2)
note            TEXT NULLABLE
```

### `payments` — Universal Uang Masuk
```sql
id              UUID PK
number          TEXT UNIQUE   -- 620-PAY-YYYYMM-NNNNN
sourceType      TEXT          -- order | donation | invoice | event_registration | manual
sourceId        UUID NULLABLE -- FK polymorphik ke tabel masing-masing (null = manual)
amount          NUMERIC(15,2)
uniqueCode      INTEGER       -- 3 digit random, ditambahkan ke nominal transfer (0 untuk manual)
method          TEXT          -- cash | transfer | qris | midtrans | xendit | ipaymu
bankAccountRef  TEXT NULLABLE -- referensi ke settings (bukan FK DB)
qrisAccountRef  TEXT NULLABLE
status          TEXT          -- pending | submitted | paid | rejected | failed | cancelled | refunded
-- Info transfer
transferDate    DATE NULLABLE
proofUrl        TEXT NULLABLE
submittedAt     TIMESTAMP NULLABLE
-- Info pembayar
memberId        UUID NULLABLE
payerName       TEXT NULLABLE
payerPhone      TEXT NULLABLE  -- otomatis dari anggota terpilih (autocomplete), atau isi manual
payerEmail      TEXT NULLABLE  -- idem
payerBank       TEXT NULLABLE
payerNote       TEXT NULLABLE
-- Verifikasi
confirmedBy     UUID NULLABLE
confirmedAt     TIMESTAMP NULLABLE
rejectedBy      UUID NULLABLE
rejectedAt      TIMESTAMP NULLABLE
rejectionNote   TEXT NULLABLE
-- Link jurnal
transactionId   UUID NULLABLE (FK → transactions)
timestamps
```

### `disbursements` — Universal Uang Keluar (2-Level Approval)
```sql
id              UUID PK
number          TEXT UNIQUE   -- 620-DIS-YYYYMM-NNNNN
purposeType     TEXT          -- refund | expense | grant | transfer | donation_payout | manual
purposeId       UUID NULLABLE -- FK polymorphik (null = manual)
amount          NUMERIC(15,2)
method          TEXT          -- cash | transfer
proofUrl        TEXT NULLABLE
-- Penerima
recipientName   TEXT
recipientBank   TEXT NULLABLE
recipientAccount TEXT NULLABLE
note            TEXT NULLABLE
-- Workflow approval
status          TEXT          -- draft | approved | paid | cancelled
requestedBy     UUID (FK → tenant.users)
approvedBy      UUID NULLABLE
approvedAt      TIMESTAMP NULLABLE
paidAt          TIMESTAMP NULLABLE
-- Link jurnal
transactionId   UUID NULLABLE (FK → transactions)
timestamps
```

### `financial_sequences` — Generator Nomor Dokumen
```sql
id          UUID PK
year        INTEGER
month       INTEGER
type        TEXT   -- payment | disbursement | journal
lastNumber  INTEGER
UNIQUE(year, month, type)
```

Generator via `generateFinancialNumber(tenantDb, type)` — atomic SELECT FOR UPDATE dalam transaction.

### `budgets` + `budget_items` — Anggaran (Schema Ada, UI Belum)
```sql
-- budgets
id, name, periodStart, periodEnd, isActive, createdBy, timestamps

-- budget_items
id, budgetId (FK), accountId (FK), amount, note
UNIQUE(budgetId, accountId)
```

---

## 3. Format Nomor Dokumen

```
620-PAY-202504-00001   → Pembayaran (Pemasukan)
620-DIS-202504-00001   → Disbursement (Pengeluaran)
620-JNL-202504-00001   → Jurnal (termasuk jurnal otomatis dari payment/disbursement)
```

Prefix `620` adalah kode internal jalakarta — konsisten di semua dokumen keuangan.

---

## 4. Alur Status

### Pembayaran (Pemasukan)
```
[Otomatis dari Toko/Donasi/Event]
  pending → submitted (konfirmasi user) → paid (admin konfirmasi) → auto-journal
                                        → rejected (admin tolak)

[Manual dari Admin]
  submitted (langsung) → paid (admin konfirmasi) → auto-journal
                       → rejected
```

### Pengeluaran (2-Level Approval)
```
draft → approved (bendahara/admin) → paid (bayar + upload bukti) → auto-journal
     → cancelled (dari draft atau approved)
```

---

## 5. Jurnal Otomatis

### Konfirmasi Pembayaran (Pemasukan)
```
Debit:  Akun Kas/Bank (berdasarkan method)
Kredit: Akun Pendapatan (berdasarkan sourceType)
```

Routing method → akun kas:
- `cash` → `cash_default` (1101)
- `transfer`, `qris`, `midtrans`, `xendit`, `ipaymu` → `bank_default` (1102), fallback `cash_default`

Routing sourceType → akun pendapatan:
- `order` → `income_toko` (4300)
- `donation` → `dana_titipan` (2200) — donasi masuk sebagai kewajiban titipan
- lainnya (invoice, event_registration, manual) → `income_manual` (4100)

**Catatan:** `event_registration` tidak punya mapping khusus — jatuh ke `income_manual`.
Pertimbangkan menambah `income_event` jika modul event berkembang.

### Pengeluaran Dibayar
```
Debit:  Akun Beban (`expense_default`, kode 5100)
Kredit: Akun Kas/Bank (berdasarkan method)
```

Saat ini semua pengeluaran masuk ke satu akun beban. Tidak ada routing per `purposeType`.

---

## 6. Account Mappings

Konfigurasi routing akun disimpan di `settings` table:
```
key   = "account_mappings"
group = "keuangan"
value = {
  cash_default:    "<UUID akun 1101>",
  bank_default:    "<UUID akun 1102>",
  income_toko:     "<UUID akun 4300>",
  income_donasi:   "<UUID akun 4200>",   // dikonfigurasi tapi TIDAK PERNAH dibaca pickIncomeAccount() — dead key, lihat § 14
  income_event:    "<UUID akun 4400>",
  income_manual:   "<UUID akun 4100>",
  dana_titipan:    "<UUID akun 2200>",   // ini yang genuinely dipakai untuk sourceType='donation' — akun kewajiban, bukan pendapatan
  expense_default: "<UUID akun 5100>",
}
```

Jika mapping belum dikonfigurasi → fallback lookup by kode akun default.
Jika kode akun tidak ada di DB → konfirmasi/pembayaran gagal dengan pesan error eksplisit.

UI pengaturan mapping: `/finance/akun` → komponen `AccountMappingsForm`.

> ⚠️ **`income_donasi` (4200) dikonfigurasi di UI tapi genuinely tidak pernah dipakai** —
> `pickIncomeAccount()` route `sourceType==='donation'` ke `dana_titipan` (2200, akun
> kewajiban), bukan ke `income_donasi`. Lihat § 14 untuk analisis lengkap kenapa ini (dan
> `income_toko`/`income_event`) praktis dormant untuk transaksi modern.

---

## 7. Route Structure

```
app/(dashboard)/[tenant]/finance/
├── layout.tsx            → shell: KeuanganNav (sub-nav kiri)
├── page.tsx              → redirect ke /finance/dashboard
├── dashboard/page.tsx    → KPI bulanan: total pemasukan, pengeluaran, saldo, pending count
├── pemasukan/
│   ├── page.tsx          → list payments (filter status + search)
│   ├── new/page.tsx      → form pemasukan manual (PaymentForm)
│   └── [id]/page.tsx     → detail payment + aksi konfirmasi/tolak
├── pengeluaran/
│   ├── page.tsx          → list disbursements (filter status)
│   ├── new/page.tsx      → form pengeluaran baru (DisbursementForm)
│   └── [id]/page.tsx     → detail + aksi approve/mark-paid/cancel
├── jurnal/
│   ├── page.tsx          → list transactions (read-only, immutable)
│   └── new/page.tsx      → form jurnal manual (JournalForm, validasi balance)
├── akun/page.tsx         → chart of accounts tree + AccountMappingsForm
└── laporan/page.tsx      → LaporanClient — 5 jenis laporan, query nyata + export (lihat § 11 dan § 14)
```

**Catatan routing:** Route folder adalah `finance` (bukan `keuangan`), tapi label sidebar dan
folder komponen menggunakan `keuangan`. Konsistensi: `sidebar-nav.tsx` pakai `path: "finance"`.

---

## 8. Komponen

```
components/keuangan/
├── keuangan-nav.tsx           → sub-nav 6 item: Dashboard, Pemasukan, Pengeluaran, Jurnal, Akun, Laporan
├── payment-form.tsx           → form pemasukan (4 tab: manual/toko/donasi/event) — nama pembayar/
│                                 donatur via autocomplete anggota (fallback ketik manual), bukti
│                                 pembayaran (label dinamis: Bukti Transfer / Tanda Terima)
├── member-name-autocomplete.tsx → cari nama dari /api/ref/tenant-members, kirim {id,phone,email}
│                                 saat dipilih — dipakai payment-form.tsx (manual + donasi)
├── proof-upload-field.tsx     → upload+preview bukti pembayaran, kirim ke /api/finance/payment-proof
├── payment-proof-thumbnail.tsx → thumbnail+lightbox bukti di halaman detail payment (klik = popup)
├── payment-detail-client.tsx  → tombol konfirmasi/tolak di halaman detail payment
├── disbursement-form.tsx      → form pengeluaran baru (purposeType, amount, recipient, method)
├── disbursement-detail-client.tsx → tombol approve/paid/cancel di halaman detail disbursement
├── journal-form.tsx           → form jurnal manual (multi-baris, validasi balance Debit = Kredit)
├── account-tree.tsx           → tampilan hierarkis chart of accounts
└── account-mappings-form.tsx  → form konfigurasi routing akun otomatis
└── laporan-client.tsx         → UI pilih jenis laporan (5 tipe) + filter periode + export CSV/Excel
```

---

## 9. Server Actions (`finance/actions.ts`)

### Pemasukan
| Action | Deskripsi |
|--------|-----------|
| `createManualPaymentAction(slug, data)` | Buat pemasukan manual, status langsung `submitted` |
| `confirmPaymentAction(slug, paymentId)` | Konfirmasi → status `paid` + auto-journal |
| `rejectPaymentAction(slug, paymentId, reason)` | Tolak dengan alasan |

### Pengeluaran
| Action | Deskripsi |
|--------|-----------|
| `createDisbursementAction(slug, data)` | Buat pengeluaran, status `draft` |
| `approveDisbursementAction(slug, id)` | Setujui `draft` → `approved` |
| `markDisbursementPaidAction(slug, id, proofUrl?)` | Bayar `approved` → `paid` + auto-journal |
| `cancelDisbursementAction(slug, id)` | Batalkan `draft` atau `approved` |

### Jurnal Manual
| Action | Deskripsi |
|--------|-----------|
| `createJournalAction(slug, data)` | Buat jurnal multi-baris, validasi balance sebelum insert |

### Chart of Accounts
| Action | Deskripsi |
|--------|-----------|
| `createAccountAction(slug, data)` | Buat akun baru (cek duplikat kode) |
| `updateAccountAction(slug, id, data)` | Update nama/kode/tipe/parent |
| `toggleAccountActiveAction(slug, id)` | Non-aktifkan (guard: tidak boleh ada entries) |
| `saveAccountMappingsAction(slug, mappings)` | Simpan routing akun ke settings |

### Helpers (internal)
| Helper | Deskripsi |
|--------|-----------|
| `resolveAccountMappings(tenantDb)` | Baca dari settings, fallback lookup by kode |
| `lookupAccountByCode(db, schema, code)` | Cari UUID akun by kode |
| `pickCashAccount(method, mappings)` | Routing method → UUID akun kas/bank |
| `pickIncomeAccount(sourceType, mappings)` | Routing sourceType → UUID akun pendapatan |

---

## 10. DB Helpers (`packages/db/src/helpers/finance.ts`)

```typescript
// Buat jurnal lengkap (multi-entry, validasi balance di dalam)
recordJournal(tenantDb, { date, description, referenceNumber, createdBy, entries[] })
  → Promise<{ id: string }> // returns transaction

// Shortcut: jurnal 2 baris untuk pemasukan
recordIncome(tenantDb, { date, description, referenceNumber, createdBy,
                          amount, cashAccountId, incomeAccountId })

// Shortcut: jurnal 2 baris untuk pengeluaran
recordExpense(tenantDb, { date, description, referenceNumber, createdBy,
                          amount, expenseAccountId, cashAccountId })

// Shortcut: transfer antar akun
recordTransfer(tenantDb, { date, description, referenceNumber, createdBy,
                            amount, fromAccountId, toAccountId })

// Generate nomor dokumen 620-PAY/DIS/JNL-YYYYMM-NNNNN (atomic, SELECT FOR UPDATE)
generateFinancialNumber(tenantDb, type: "payment"|"disbursement"|"journal", now?)
```

**Tanda tangan penting:** semua helper menerima `tenantDb` (hasil `createTenantDb(slug)`) secara
penuh — bukan destructured `{ db, schema }`. Ini berbeda dari pola di modul lain.

---

## 11. Fitur Belum Diimplementasikan

| Fitur | Status | Catatan |
|-------|--------|---------|
| Laporan Keuangan (5 jenis) | ✅ Selesai | Neraca Saldo, Laba Rugi, Arus Kas, **Arus Kas Bulanan**, Buku Besar — query nyata, export CSV (4 tipe) + Excel `.xlsx` sungguhan (Arus Kas Bulanan) |
| Akun 4400 Pendapatan Event | ✅ Selesai | Di-seed untuk tenant baru; tenant lama: `docs/migration-keuangan-event-income.sql` |
| `income_toko`/`income_event`/`dana_titipan` mapping — kini AKTIF di jurnal | ✅ Selesai (2026-08-15) | Opsi B — lihat § 14.4. `pickIncomeAccount()` sekarang dipanggil per-domain via `resolveIncomeSplitForBilling()`, bukan lagi dari `payments.sourceType` mentah (yang untuk cart-checkout SELALU `"invoice"`) — cabang ini sekarang genuinely tereksekusi di 4 titik konfirmasi. **Kecuali** 1 jalur lama (`confirmPaymentAction`, halaman generik `/finance/pemasukan/[id]`) yang masih pakai `payments.sourceType` mentah — lihat catatan gap di § 14.4 |
| Klasifikasi Toko/Tiket/Donasi di laporan Arus Kas + jurnal | ✅ Selesai (2026-08-15) | Opsi A (laporan) DAN Opsi B (jurnal, pencatatan baru + koreksi data historis lokal) sama-sama SELESAI — lihat § 14. Laba Rugi/Neraca Saldo/Buku Besar (baca `transaction_entries`) otomatis ikut benar karena Opsi B membenarkan jurnal-nya langsung, bukan cuma laporan Arus Kas |
| Anggaran (Budget) | ⚠️ Schema ada | Tabel `budgets` + `budget_items` ada di DDL, belum ada UI route |
| Routing per tujuan pengeluaran | ⚠️ Tidak ada | Semua pengeluaran ke 1 akun beban (5100), tidak ada split per `purposeType` |
| Export laporan PDF | ⚠️ Belum ada | CSV/Excel sudah tersedia; PDF butuh Playwright (belum diimplementasikan) |

---

## 12. Integrasi dengan Modul Lain

> ⚠️ **Dua jalur berbeda per modul — legacy (sourceType spesifik) vs cart universal
> (sourceType selalu `"invoice"`)**. Bagian di bawah ini mendeskripsikan mapping yang
> `pickIncomeAccount()` DUKUNG secara kode — tapi untuk transaksi checkout modern (via
> `/keranjang`→`/checkout`, dominan sejak Billing Universal), `sourceType` payment SELALU
> `"invoice"` generik, jadi mapping `income_toko`/`dana_titipan`/`income_event` di bawah HANYA
> berlaku untuk sisa transaksi via jalur legacy (`addPaymentToOrderAction`/
> `confirmDonationAction`, jarang/tidak pernah dipakai lagi). Lihat § 14 untuk detail lengkap +
> rencana perbaikan (Opsi B, belum dieksekusi).

### Modul Toko
- **Legacy** (`toko/actions.ts`'s `addPaymentToOrderAction`, tabel `orders` lama): source type
  `"order"` → maps ke `income_toko` (4300)
- **Cart universal** (checkout produk via `/keranjang`): source type SELALU `"invoice"` →
  jatuh ke `income_manual` (4100), BUKAN `income_toko`

### Modul Donasi
- **Legacy** (`donasi/actions.ts`'s `confirmDonationAction`, tabel `donations` lama): source
  type `"donation"` → maps ke `dana_titipan` (2200) — bukan pendapatan langsung.
  Pertimbangkan apakah ini semantik yang benar untuk organisasi target
- **Cart universal** (donasi via `/campaign/{slug}` → keranjang): source type SELALU
  `"invoice"` → jatuh ke `income_manual` (4100), BUKAN `dana_titipan`

### Modul Event
- Payment source type `"event_registration"` ada di enum schema DAN `pickIncomeAccount()`
  sudah handle-nya (→ `income_event`/4400) — tapi **tidak ada satu pun titik insert
  `payments` di codebase yang lagi menciptakan payment dengan sourceType ini** (dicek lewat
  grep menyeluruh, § 14). Tiket event via cart selalu `sourceType="invoice"` juga.

### Payment Categories di Settings
Rekening bank dan QRIS di settings punya field `categories` array (`["general"]`, `["toko"]`, dll).
Ini terpisah dari account mappings — rekening bank di settings = info display untuk user (nomor rek mana yang ditampilkan).
Account mappings di keuangan = routing double-entry journal (akun buku besar mana yang dicatat).

---

## 13. Keputusan Desain yang Dikunci

- **Jurnal immutable**: tidak ada action `deleteJournal` atau `updateJournal`. Setelah entry dibuat, tidak bisa dihapus.
- **Akun non-aktif, bukan hapus**: `toggleAccountActiveAction` guard mencegah non-aktifkan jika ada entries.
- **Manual payment langsung `submitted`**: admin yang input pembayaran manual diasumsikan sudah verifikasi sendiri.
- **`uniqueCode = 0` untuk manual**: hanya pembayaran dari publik (toko/donasi) yang punya unique code 3-digit.
- **Mapping via settings**: routing akun disimpan di `settings` JSONB bukan hardcode — admin bisa override per tenant.
- **Fallback by kode**: jika mapping belum dikonfigurasi, fallback ke lookup kode akun standar. Ini memungkinkan sistem berjalan sebelum admin setup mapping.
- **Nama pembayar/donatur — autocomplete anggota, fallback manual (2026-07-22)**: field "Nama
  Pembayar" (tab Manual) dan "Nama Donatur" (tab Donasi) di `/finance/pemasukan/new` pakai
  `MemberNameAutocomplete` — cari via `/api/ref/tenant-members` (endpoint yang sudah lama dipakai
  `RecipientCombobox` modul Surat). Kalau admin memilih dari hasil pencarian, `payments.memberId`
  (Manual) atau `donations.memberId` (Donasi) ikut terisi — dua kolom FK yang sudah lama ADA di
  skema tapi sebelumnya tidak pernah diisi dari jalur ini. Kalau admin mengetik manual (tidak
  memilih dari dropdown), `memberId` tetap null — bukan bug, itu memang berarti pembayar bukan
  anggota terdaftar atau admin sengaja tidak menautkannya.
- **Telepon/email auto-isi HANYA saat memilih dari dropdown, TIDAK auto-clear saat mengetik
  manual**: begitu admin pilih anggota, `payerPhone`/`payerEmail` (kolom baru, migration
  `0040_payment_payer_contact.sql`) langsung terisi dari kontak anggota tapi tetap bisa diedit.
  Kalau admin lanjut mengetik nama secara manual (bukan pilih ulang dari dropdown), field
  telepon/email TIDAK dikosongkan otomatis — mencegah kehilangan data yang sudah diisi admin
  secara tidak sengaja hanya karena mengubah teks nama.
- **Bukti pembayaran: satu field, label dinamis by metode**: `ProofUploadField` selalu SATU
  widget upload (opsional, bukan wajib — pencatatan manual admin diasumsikan sudah terverifikasi
  sendiri, sama seperti keputusan "Manual payment langsung submitted" di atas) — labelnya berubah
  "Bukti Transfer" (transfer/qris) vs "Tanda Terima / Kwitansi" (cash), BUKAN dua field terpisah
  dan BUKAN generate PDF otomatis. Upload ke `POST /api/finance/payment-proof?tenant=` (admin-only,
  beda dari `/api/invoice/proof-upload` publik yang dipakai jalur customer self-service) — path
  generik `payments/manual/{uuid}.webp` karena payment belum tercipta saat upload terjadi (beda
  dari proof-upload publik yang path-nya per-`invoiceId`, invoice-nya sudah ada duluan).

---

## 14. Klasifikasi Toko/Tiket/Donasi — Opsi A (Selesai) + Opsi B (Rencana)

> Investigasi dipicu laporan user: laporan keuangan "masih rancu antara invoice dari toko,
> invoice dari tiket, invoice dari donasi". Ditemukan DUA masalah terpisah dengan akar yang
> sama, di dua lapisan berbeda — bukan satu bug tunggal.

### 14.1 Akar masalah

**Semua payment dari alur cart universal (checkout, konfirmasi COD tenant/mitra, submit bukti
transfer) hardcode `payments.sourceType = "invoice"`**, terlepas dari isi invoice-nya (produk,
tiket, donasi, atau campuran). Dikonfirmasi via grep SEMUA titik `insert(schema.payments)` di
seluruh app (7 titik):

| File | Fungsi | `sourceType` | Jalur |
|---|---|---|---|
| `finance/billing/actions.ts:900` | `confirmInvoicePaymentAction` | `"invoice"` | Cart universal (admin konfirmasi manual) |
| `finance/billing/actions.ts:3050` | konfirmasi COD (tenant) | `"invoice"` | Cart universal |
| `akun/mitra/pesanan/actions.ts` | `confirmMitraCodReceivedAction` | `"invoice"` | Cart universal (COD mitra) |
| `cart/actions.ts` | `submitPaymentProofAction` | `"invoice"` | Cart universal (customer submit bukti) |
| `toko/actions.ts` | `addPaymentToOrderAction` | `"order"` | **Legacy** (tabel `orders`, jarang/tidak dipakai lagi) |
| `donasi/actions.ts` | `confirmDonationAction` | `"donation"` | **Legacy** (tabel `donations`, jarang/tidak dipakai lagi) |
| `finance/actions.ts` | `createManualPaymentAction` | `"manual"` / dinamis | Pencatatan manual admin (`/finance/pemasukan/new`), tidak terkait invoice_items |

**5 dari 7 titik — semua jalur modern — selalu `"invoice"`.** Hanya 2 titik legacy yang masih
punya label spesifik, dan keduanya sudah lama digantikan alur cart (lihat lesson lama CLAUDE.md
"Donasi = Alur Cart Universal, Qurban = Variasi Hewan" — `donations` tabel legacy sejak awal).

Data ini punya DUA konsumen yang SAMA-SAMA terpengaruh, tapi lewat mekanisme berbeda:

1. **Laporan Arus Kas & Arus Kas Bulanan** (`getLaporanArusKasAction`/
   `getLaporanArusKasBulananAction`, `finance/actions.ts`) — `GROUP BY payments.sourceType`
   langsung. Semua uang cart universal jatuh ke satu baris "Tagihan", tidak bisa dipecah.
2. **Jurnal double-entry** (Laba Rugi, Neraca Saldo, Buku Besar — semua baca dari
   `transaction_entries`/`accounts`) — `pickIncomeAccount(sourceType, mappings)` di
   `finance/actions.ts` route akun pendapatan berdasarkan `sourceType` yang SAMA:
   ```typescript
   function pickIncomeAccount(sourceType: string, mappings: AccountMappings): string | null {
     if (sourceType === "order")              return mappings.income_toko;
     if (sourceType === "donation")           return mappings.dana_titipan;
     if (sourceType === "event_registration") return mappings.income_event ?? mappings.income_manual;
     return mappings.income_manual;   // ← "invoice" selalu jatuh ke sini
   }
   ```
   Karena `sourceType` yang dikirim SELALU `"invoice"` untuk cart universal, akun
   `income_toko`/`income_event`/`dana_titipan` yang admin sudah konfigurasi di
   `/finance/akun` **praktis tidak pernah kepakai** — semua pendapatan cart (Toko+Tiket+Donasi
   campur) masuk ke satu akun `income_manual` ("Pendapatan Iuran"/generik). Efeknya: Laba
   Rugi, Neraca Saldo, dan Buku Besar SEMUA menumpuk pendapatan campuran ke satu baris akun,
   sejak transaksi dicatat — bukan cuma soal tampilan laporan, tapi salah target akun di jurnal
   itu sendiri. **Ditemukan sekalian**: `income_donasi` (akun 4200) dikonfigurasi di UI settings
   tapi genuinely TIDAK PERNAH dibaca `pickIncomeAccount()` sama sekali — dead key murni.

**Kabar baik**: `payments.sourceId` untuk `sourceType='invoice'` SELALU menunjuk `invoices.id`
— rantai JOIN `payments → invoices → invoice_items(itemType)` tetap ada dan akurat. Ini gap di
level QUERY LAPORAN dan ROUTING JURNAL, bukan kehilangan data — masih bisa dipetakan balik.

### 14.2 Bukti empiris (data lokal, 2026-08-15)

Semua 7 payment yang ada di dua tenant lokal (`pc-ikpm-jogjakarta`, `forcreator`) berstatus
`sourceType='invoice'` — 100%, tidak ada satu pun yang masih pakai label legacy. Dicek juga
apakah invoice-nya genuinely campuran (>1 `itemType`): **tidak ada** — semua 7 invoice lokal
single-domain (murni salah satu: produk, tiket, atau donasi). Jadi di skala lokal, split
proporsional selalu berujung 100% ke satu kategori — tapi arsitektur cart universal MENGIZINKAN
invoice campuran (checkout produk+tiket+donasi dalam satu keranjang), jadi logika pembagian
proporsional (bukan cuma "ambil kategori pertama yang ketemu") tetap perlu untuk kasus produksi
yang lebih ramai.

Contoh nyata yang dicek manual — payment `396e6637...` (pc-ikpm-jogjakarta): `amount=174000`,
invoice-nya berisi HANYA item `product` (`total=150000`) + 1 baris `invoice_shipping_lines`
(`cost=24000`). `150000 + 24000 = 174000` — persis cocok dengan payment amount, membuktikan
ongkos kirim memang bagian dari nominal yang dibayar dan harus ikut dihitung sebagai domain
Toko (bukan diabaikan).

### 14.3 Opsi A — SELESAI (2026-08-15)

**Scope**: perbaiki KEDUA laporan Arus Kas (single-period & bulanan) supaya kategori pemasukan
dipecah benar per domain — TANPA menyentuh jurnal/Chart of Accounts sama sekali (aman, tidak
invasif, retroaktif berlaku ke semua data historis tanpa migrasi).

**Implementasi** — helper baru `splitIncomeByDomain()` (privat, `finance/actions.ts`, dipakai
`getLaporanArusKasAction` & `getLaporanArusKasBulananAction`):
1. Payment non-`invoice` (legacy `order`/`donation`/`manual`) — TIDAK disentuh, tetap label
   lama dari `SOURCE_TYPE_LABELS`.
2. Payment `sourceType='invoice'` — batch-fetch `invoice_items` (GROUP BY invoiceId+itemType,
   SUM total) + `invoice_shipping_lines` (GROUP BY invoiceId, SUM cost) untuk SEMUA invoice
   yang direferensikan sekaligus (satu query per tabel, bukan N+1 per payment). Ongkos kirim
   digabung ke bucket `product` (domain Toko — ongkir hanya relevan untuk barang fisik).
   Nominal payment dipecah **proporsional** terhadap subtotal tiap domain:
   ```
   kontribusi(label) = payment.amount × (subtotal_domain / total_semua_domain_di_invoice_ini)
   ```
   Label hasil split di-MERGE dengan label legacy yang sudah ada (`SOURCE_TYPE_LABELS.order`
   = "Penjualan Toko", `.event_registration` = "Pendaftaran Event", `.donation` =
   "Donasi / Infaq") — supaya sisa transaksi legacy dan hasil derivasi dari invoice tampil
   sebagai SATU baris gabungan di laporan, bukan dua baris terpisah untuk sumber yang sama.
   Item `custom` mendapat label baru "Item Kustom" (tidak ada legacy equivalent).
3. Fallback `"Tagihan (Tidak Terklasifikasi)"` — hanya untuk kasus defensif (invoice tidak
   ditemukan / tidak punya item sama sekali, denominator=0) — total tidak pernah hilang diam-
   diam.

**Jaminan matematis**: total pemasukan (grand total) TIDAK BERUBAH — kontribusi hasil split
untuk satu payment selalu menjumlah persis ke `payment.amount` asal (proporsi selalu jumlah ke
1). Perubahan HANYA di breakdown kategori, bukan di angka total — ini yang membuat perubahan
ini aman untuk data historis tanpa perlu migrasi/koreksi apa pun.

**Scope yang SENGAJA tidak disentuh** (dicatat eksplisit, bukan lupa):
- **Tenant vs mitra** (`invoice_items.sellerType`) — item milik mitra tetap ikut porsi
  "Penjualan Toko" tenant, tidak dipisah. Ini axis "rancu" LAIN yang tidak diminta di task ini.
- **Pengeluaran/disbursements** — tidak ada ambiguitas serupa di sisi ini (disbursement bukan
  konfirmasi invoice cart, `purposeType` sudah cukup spesifik sejak awal), tidak disentuh.
- **Laba Rugi, Neraca Saldo, Buku Besar** — MASIH menampilkan pendapatan cart tercampur di
  akun `income_manual` seperti sebelumnya. Ini Opsi B (§ 14.4), belum dieksekusi.

**File yang diubah**: `apps/web/app/(dashboard)/app/[tenant]/finance/actions.ts` — helper baru
`splitIncomeByDomain()` + 2 konstanta (`CUSTOM_ITEM_LABEL`, `UNCLASSIFIED_INVOICE_LABEL`) + fetch
raw payment rows (bukan `GROUP BY` SQL langsung) di kedua fungsi laporan Arus Kas. UI
(`laporan-client.tsx`) dan export Excel (`api/finance/laporan/arus-kas-bulanan/export/route.ts`)
TIDAK disentuh — keduanya sudah render `{r.label}` generik, tidak ada string hardcode yang
perlu disesuaikan.

**Verifikasi**: `tsc --noEmit` 0 error. `bun run build --filter=@jalajogja/web` genuine
(`Cached: 0 cached`) sukses, kedua route (`/finance/laporan`, `/api/finance/laporan/
arus-kas-bulanan/export`) terkonfirmasi ter-compile di build output. Cross-check empiris ke
data lokal (§ 14.2) — nominal per payment dipetakan ulang benar ke domain yang sesuai. **Belum
diverifikasi visual di browser** (buka `/finance/laporan`, pilih Arus Kas/Arus Kas Bulanan, dan
konfirmasi baris "Penjualan Toko"/"Donasi / Infaq"/"Pendaftaran Event" muncul menggantikan
"Tagihan") — perlu dicoba user sebelum dianggap final secara visual.

### 14.4 Opsi B — SELESAI (2026-08-15)

**Tujuan**: perbaiki akar masalah di level jurnal — supaya Laba Rugi, Neraca Saldo, dan Buku
Besar JUGA benar sejak transaksi dicatat (bukan cuma dikoreksi di query laporan seperti Opsi A).

**Keputusan akuntansi (dijawab user, verbatim)**:
> *"1. ya harus terpisah permanen. 2. donasi adalah dana titipan bukan pendapatan. 3. data yg
> sudah masuk kalau bisa diperbaiki lebih baik karena agar memiliki laporan yang benar."*

Konsekuensi: (1) akun Pendapatan permanen terpisah per domain di Chart of Accounts (bukan cuma
pemisahan level-laporan) — `income_toko` (4300), `income_event` (4400) dipakai genuinely saat
jurnal ditulis, bukan hanya dibaca laporan; (2) `dana_titipan` (2200, akun KEWAJIBAN) TETAP
satu-satunya tujuan untuk donasi — `income_donasi` (4200) TIDAK PERNAH dipakai `pickIncomeAccount()`,
baik sebelum maupun sesudah Opsi B (field ini ada di `AccountMappings`/UI settings tapi genuinely
dead — lihat gap di bawah); (3) data historis yang sudah salah masuk `income_manual` dikoreksi
via jurnal koreksi berimbang (BUKAN edit langsung baris lama) — sudah dieksekusi untuk kedua
tenant LOKAL, PRODUCTION belum (lihat "Koreksi data historis" di bawah).

**Implementasi (`apps/web/app/(dashboard)/app/[tenant]/finance/actions.ts`)**:

`pickIncomeAccount(sourceType, mappings)` — logic TIDAK berubah secara struktural, tapi sekarang
dipanggil dari fungsi baru di bawah dengan `sourceType` VIRTUAL per-domain (bukan lagi dari
`payments.sourceType` mentah yang untuk cart-checkout selalu `"invoice"`):
```typescript
function pickIncomeAccount(sourceType: string, mappings: AccountMappings): string | null {
  if (sourceType === "order")              return mappings.income_toko  ?? mappings.income_manual;
  if (sourceType === "donation")           return mappings.dana_titipan;   // TIDAK PERNAH fallback
  if (sourceType === "event_registration") return mappings.income_event ?? mappings.income_manual;
  return mappings.income_manual;
}
```
`"order"`/`"event_registration"` fallback ke `income_manual` kalau tenant belum mengisi akun
spesifiknya (backward-compat untuk tenant lama) — `"donation"` SENGAJA TIDAK fallback (donasi
wajib tetap `dana_titipan`, sesuai keputusan #2; kalau akun ini belum dikonfigurasi, seluruh
resolusi gagal dan caller wajib tampilkan "Konfigurasi mapping akun belum lengkap", bukan diam-
diam salah rute lagi).

**`computeInvoiceDomainBucket(tenantClient, invoiceId, sellerFilter?)`** (baru, private) —
breakdown Rupiah per domain (`{product, ticket, donation, custom}`) untuk SATU invoice, scoped
opsional ke satu seller (`{sellerType, sellerId?}` — dipakai COD tenant/mitra yang cuma boleh
menjurnal porsi miliknya sendiri). Ongkos kirim (`invoice_shipping_lines`) digabung ke domain
`product` (Toko), di-filter seller yang sama dengan item.

**`resolveIncomeSplitForBilling(tenantDb, method, invoiceId, amount, sellerFilter?)`** (baru,
exported) — satu sumber kebenaran "bagaimana memecah nominal jadi baris jurnal", dipakai
KEEMPAT titik konfirmasi di bawah (cegah 4 implementasi terpisah drift). Return `{cashAccountId,
lines: {accountId, amount}[]} | null` (`null` = mapping akun belum lengkap). Baris dengan akun
yang sama digabung; baris TERAKHIR menyerap sisa pembulatan floating-point supaya
`sum(lines.amount)` selalu persis `amount` (syarat `recordJournal`/`recordIncomeSplit`).

**`recordIncomeSplit()`** (baru, `packages/db/src/helpers/finance.ts`, exported dari
`@jalajogja/db`) — wrapper tipis di atas `recordJournal()` yang sudah ada: satu debit kas/bank
(`sum(lines.amount)`), N kredit pendapatan/kewajiban (`lines`).

**4 titik konfirmasi yang diupdate** (semua pakai pola sama: pre-check di luar transaction untuk
early-exit UX, resolve ULANG di dalam transaction untuk korektnes — konsisten pola lock+guard
yang sudah berkali-kali dikunci di project ini):
1. `confirmInvoicePaymentAction` (`finance/billing/actions.ts`)
2. `verifySubmittedPaymentAction` (`finance/billing/actions.ts`)
3. `confirmCodPaymentAction` (`finance/billing/actions.ts`, porsi tenant)
4. `confirmMitraCodReceivedAction` (`akun/mitra/pesanan/actions.ts`, porsi mitra — self-service,
   `resolveIncomeSplitForBilling` diimpor lintas route group karena murni fungsi resolusi tanpa
   auth/session di dalamnya)

**Gap yang DITEMUKAN, SENGAJA TIDAK difix (di luar scope, dilaporkan ke user)**:
`confirmPaymentAction` (`finance/actions.ts`, dipakai tombol "Konfirmasi Pembayaran" di halaman
generik `/finance/pemasukan/[id]` — BUKAN halaman detail invoice) masih memanggil
`pickIncomeAccount(payment.sourceType, mappings)` dengan `payment.sourceType` MENTAH — untuk
payment `sourceType="invoice"` (hasil cart checkout), ini jatuh ke `income_manual` persis bug
yang baru diperbaiki di 4 titik lain. **Diverifikasi empiris (2026-08-15, data lokal)**: KEDUA
tenant lokal (`forcreator`, `pc-ikpm-jogjakarta`) — SELURUH payment `sourceType='invoice'`
(7 baris total) punya `transaction_id = NULL`, membuktikan 0 dari 7 pernah dikonfirmasi lewat
jalur ini di praktiknya — admin selalu memakai halaman detail invoice (`/finance/billing/
invoice/[id]`) yang benar. Fungsi ini JUGA tidak pernah mengupdate `invoices.paidAmount`/
`status` sama sekali (beda bug, invoice-state-desync — lebih besar dari sekadar salah akun) —
menggabungkan dua bug berbeda dalam satu fix dinilai scope creep, TIDAK dieksekusi tanpa
konfirmasi eksplisit user.

**Koreksi data historis** — dieksekusi via script sekali-pakai (ditulis, dijalankan, dihapus —
tidak masuk repo), memakai jurnal koreksi BERIMBANG (debit `income_manual` mengeluarkan nominal
yang salah, kredit akun yang benar sesuai breakdown item invoice — TIDAK PERNAH edit baris
`transaction_entries` lama). Diagnosa: cari `transaction_entries` kredit pada akun `income_manual`
yang `transaction.description` cocok pola `'Pelunasan invoice %'` atau `'COD %'` (2 pola yang
dipakai 4 titik konfirmasi di atas — pola `'Konfirmasi pembayaran %'` milik `confirmPaymentAction`
sengaja TIDAK disentuh, itu bukan bagian dari bug yang sama, lihat gap di atas).

Hasil diagnosa+koreksi LOKAL (2026-08-15):
| Tenant | Invoice | Domain | Nominal | Akun lama → benar |
|---|---|---|---|---|
| forcreator | 620-INV-202608-00002 | produk+ongkir | Rp114.000 | 4100 → 4300 |
| forcreator | 620-INV-202608-00003 | produk | Rp100.000 | 4100 → 4300 |
| forcreator | 620-INV-202608-00005 | donasi | Rp10.000 | 4100 → 2200 |
| pc-ikpm-jogjakarta | 620-INV-202605-00007 | produk+ongkir | Rp174.000 | 4100 → 4300 |
| pc-ikpm-jogjakarta | 620-INV-202605-00008 | donasi | Rp100.000 | 4100 → 2200 |
| pc-ikpm-jogjakarta | 620-INV-202605-00009 | donasi | Rp50.000 | 4100 → 2200 |

Ke-6 entri SEMUA single-domain (tidak ada invoice campuran di data lokal saat ini) — jadi
koreksinya sederhana (1 debit + 1 kredit per invoice), bukan multi-baris. Diverifikasi setelah
eksekusi: saldo bersih akun `4100 Pendapatan Iuran` (income_manual) untuk KEDUA tenant kembali
ke `Rp 0` (seluruh nominal yang salah masuk sudah dipindah keluar), saldo `4300`/`2200` bertambah
persis sesuai tabel di atas.

**PRODUCTION BELUM DIKOREKSI** — environment sesi ini tidak punya akses SSH. Kalau perlu
dijalankan di production, query diagnosa read-only berikut bisa dijalankan dulu (ganti
`{tenant_slug}` dan cari `account_id` akun `income_manual`/kode `4100` tenant itu via
`SELECT id FROM tenant_{slug}.accounts WHERE code='4100'` lebih dulu):
```sql
SELECT te.id, te.amount, t.date, t.description
FROM tenant_{slug}.transaction_entries te
JOIN tenant_{slug}.transactions t ON t.id = te.transaction_id
WHERE te.type = 'credit' AND te.account_id = '{income_manual_account_id}'
  AND (t.description LIKE 'Pelunasan invoice %' OR t.description LIKE 'COD %');
```
Kalau hasilnya tidak kosong, koreksinya bisa direplikasi dengan script yang sama (minta ditulis
ulang, dijalankan via SSH oleh user sendiri — bukan Claude, tidak ada akses production).
