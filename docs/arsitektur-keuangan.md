# Arsitektur Modul Keuangan — jalajogja

**Status: DIIMPLEMENTASIKAN (2026-04)**
- Core (Pemasukan, Pengeluaran, Jurnal, Akun): ✅ Selesai
- Laporan (4 jenis + CSV export): ✅ Selesai
- Integrasi Toko/Donasi/Event → universal payments: ✅ Selesai
- Akun 4400 Pendapatan Event + `event_income` mapping: ✅ Selesai
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

Prefix `620` adalah kode internal jalajogja — konsisten di semua dokumen keuangan.

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
  income_donasi:   "<UUID akun 2200>",   // Dana Titipan, bukan income langsung
  income_manual:   "<UUID akun 4100>",
  dana_titipan:    "<UUID akun 2200>",
  expense_default: "<UUID akun 5100>",
}
```

Jika mapping belum dikonfigurasi → fallback lookup by kode akun default.
Jika kode akun tidak ada di DB → konfirmasi/pembayaran gagal dengan pesan error eksplisit.

UI pengaturan mapping: `/finance/akun` → komponen `AccountMappingsForm`.

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
└── laporan/page.tsx      → LaporanClient (UI ada, query BELUM diimplementasikan)
```

**Catatan routing:** Route folder adalah `finance` (bukan `keuangan`), tapi label sidebar dan
folder komponen menggunakan `keuangan`. Konsistensi: `sidebar-nav.tsx` pakai `path: "finance"`.

---

## 8. Komponen

```
components/keuangan/
├── keuangan-nav.tsx           → sub-nav 6 item: Dashboard, Pemasukan, Pengeluaran, Jurnal, Akun, Laporan
├── payment-form.tsx           → form pemasukan manual (amount, method, payerName, transferDate)
├── payment-detail-client.tsx  → tombol konfirmasi/tolak di halaman detail payment
├── disbursement-form.tsx      → form pengeluaran baru (purposeType, amount, recipient, method)
├── disbursement-detail-client.tsx → tombol approve/paid/cancel di halaman detail disbursement
├── journal-form.tsx           → form jurnal manual (multi-baris, validasi balance Debit = Kredit)
├── account-tree.tsx           → tampilan hierarkis chart of accounts
└── account-mappings-form.tsx  → form konfigurasi routing akun otomatis
└── laporan-client.tsx         → UI pilih jenis laporan + filter periode (PLACEHOLDER — tidak ada data)
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
| Laporan Keuangan (4 jenis) | ✅ Selesai | Neraca Saldo, Laba Rugi, Arus Kas, Buku Besar — query nyata, export CSV |
| Akun 4400 Pendapatan Event | ✅ Selesai | Di-seed untuk tenant baru; tenant lama: `docs/migration-keuangan-event-income.sql` |
| `event_income` mapping | ✅ Selesai | `pickIncomeAccount` handle `event_registration` → 4400, fallback ke 4100 |
| Anggaran (Budget) | ⚠️ Schema ada | Tabel `budgets` + `budget_items` ada di DDL, belum ada UI route |
| Routing per tujuan pengeluaran | ⚠️ Tidak ada | Semua pengeluaran ke 1 akun beban (5100), tidak ada split per `purposeType` |
| Export laporan PDF | ⚠️ Belum ada | CSV sudah tersedia; PDF butuh Playwright (belum diimplementasikan) |

---

## 12. Integrasi dengan Modul Lain

### Modul Toko
- `confirmOrderPaymentAction` di `toko/actions.ts` memanggil `recordIncome()` dari helpers
- Source type `"order"` → maps ke `income_toko` (4300)

### Modul Donasi
- Konfirmasi donasi memanggil `recordIncome()`
- Source type `"donation"` → maps ke `dana_titipan` (2200) — bukan pendapatan langsung
- Pertimbangkan apakah ini semantik yang benar untuk organisasi target

### Modul Event
- Payment source type `"event_registration"` ada di enum schema
- Belum ada routing khusus di `pickIncomeAccount` — fallback ke `income_manual` (4100)

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
