# Arsitektur Kode Unik Transaksi

> **Dokumen terkait:**
> - `docs/arsitektur-billing.md` — alur invoice universal, cart, checkout
> - `docs/arsitektur-keuangan.md` — double-entry journal, account mapping

**Status implementasi:**
- Schema + migration: ⬜ Belum
- Helper `generateUniqueCode`: ⬜ Belum
- Integrasi `createLinkedInvoice`: ⬜ Belum
- Display invoice publik + admin: ⬜ Belum
- Update konfirmasi pembayaran: ⬜ Belum
- Settings UI toggle: ⬜ Belum

---

## 1. Konsep

Kode unik adalah nominal kecil (**Rp 100–999**) yang ditambahkan ke total akhir
invoice sehingga setiap invoice memiliki jumlah transfer yang unik. Admin dapat
mengidentifikasi pembayaran masuk hanya dari 3 digit terakhir nominal transfer.

```
Invoice A: total Rp 500.000 + kode unik 523 → customer bayar Rp 500.523
Invoice B: total Rp 500.000 + kode unik 847 → customer bayar Rp 500.847

Admin lihat transfer Rp 500.523 → langsung tahu itu Invoice A
Admin lihat transfer Rp 500.847 → langsung tahu itu Invoice B
```

Kode unik **bukan** biaya tambahan yang dikembalikan — ia dicatat sebagai bagian
dari penerimaan kas tenant (income). Jurnal mencatat `total + unique_code` sebagai
jumlah yang diterima.

---

## 2. Keputusan Desain yang Dikunci

| Keputusan | Nilai | Alasan |
|-----------|-------|--------|
| Range kode | Rp 100 – Rp 999 | Menghindari kode terlalu kecil (Rp 1 terkesan salah hitung) |
| Cakupan metode bayar | Semua (cash, transfer, QRIS) | Konsistensi — satu perilaku untuk semua metode |
| Perlakuan jurnal | Ikut sebagai pendapatan | Sederhana, tidak perlu akun adjusting terpisah |
| Kapan di-generate | Saat invoice dibuat (`createLinkedInvoice`) | Satu titik generate, idempotent |
| Nilai fallback | `0` (tidak ada kode) | Berlaku saat fitur mati atau semua kode 100–999 terpakai |
| Keunikan scope | Per tenant, hanya invoice pending/partial/waiting | Cukup untuk ratusan invoice concurrent |
| Race condition | Tidak pakai SELECT FOR UPDATE | Risk collision sangat rendah untuk skala IKPM; kode unik bukan safety-critical |

---

## 3. Schema Database

### Kolom baru di tabel `invoices`

```sql
unique_code  INTEGER  NOT NULL  DEFAULT 0
```

- `0` → tidak ada kode unik (fitur mati, atau fallback saat semua kode terpakai)
- `100–999` → kode aktif

```typescript
// packages/db/src/schema/tenant/billing.ts
uniqueCode: integer("unique_code").notNull().default(0),
```

### Settings key baru

Disimpan di `tenant_{slug}.settings`:

```
key  = "unique_code_enabled"
group = "payment"
value = true | false
```

Tidak ada setting range — range Rp 100–999 di-hardcode di helper.

---

## 4. Generate Kode Unik

### Helper: `generateUniqueCode(tenantDb)`

Lokasi: `packages/db/src/helpers/billing.ts`

```typescript
async function generateUniqueCode(
  tenantDb: TenantDb,
): Promise<number> {
  const { db, schema } = tenantDb;

  // Ambil semua kode yang sedang dipakai oleh invoice aktif
  const usedRows = await db
    .select({ code: schema.invoices.uniqueCode })
    .from(schema.invoices)
    .where(
      and(
        sql`${schema.invoices.uniqueCode} > 0`,
        inArray(schema.invoices.status, [
          "pending",
          "partial",
          "waiting_verification",
        ]),
      )
    );

  const usedCodes = new Set(usedRows.map((r) => r.code));

  // Kumpulkan kode yang tersedia (100–999)
  const available: number[] = [];
  for (let i = 100; i <= 999; i++) {
    if (!usedCodes.has(i)) available.push(i);
  }

  // Tidak ada kode tersedia → fallback 0 (tidak ada kode unik)
  if (available.length === 0) return 0;

  // Pick random dari yang tersedia
  return available[Math.floor(Math.random() * available.length)];
}
```

### Integrasi di `createLinkedInvoice`

```typescript
// packages/db/src/helpers/billing.ts
export async function createLinkedInvoice(tenantDb, input) {
  // ...existing logic...

  // Ambil setting kode unik
  const paymentSettings = await getSettings(tenantDb, "payment");
  const isEnabled = paymentSettings["unique_code_enabled"] === true;

  const uniqueCode = isEnabled ? await generateUniqueCode(tenantDb) : 0;

  await db.insert(schema.invoices).values({
    // ...existing fields...
    uniqueCode,
  });
}
```

> **Catatan:** `generateUniqueCode` dipanggil di luar transaction invoice agar tidak
> memperlambat transaction utama. Race condition (dua invoice concurrent dapat kode
> sama) sangat jarang dan tidak berbahaya — kode tetap dapat membedakan invoice
> selama total keduanya berbeda.

---

## 5. Display: Invoice Publik

File: `components/billing/invoice-public-client.tsx`

Tampilan bagian ringkasan harga:

```
Subtotal                    Rp 500.000
Diskon                     -Rp  10.000
─────────────────────────────────────
Total                       Rp 490.000
Kode Unik                  +Rp     523   ← hanya muncul jika unique_code > 0
─────────────────────────────────────
Total yang Harus Dibayar    Rp 490.523   ← angka yang di-bold / highlight
```

Teks penjelasan di bawah (hanya jika unique_code > 0):

> *"Kode unik ditambahkan untuk memudahkan identifikasi pembayaran Anda."*

**Aturan display:**
- Jika `invoice.uniqueCode === 0` → baris Kode Unik tidak muncul sama sekali
- "Total Harus Dibayar" (`amountDue`) = `invoice.total + invoice.uniqueCode`
- Label "Total" di atas = nilai subtotal-diskon sebelum kode (tetap tampil)

### Type perubahan di `PublicInvoiceData`

```typescript
type PublicInvoiceData = {
  // ...existing fields...
  uniqueCode:  number;   // 0 jika tidak ada kode
  amountDue:   number;   // total + uniqueCode (pre-computed di server)
};
```

---

## 6. Display: Admin Invoice Detail

File: `components/keuangan/billing/invoice-detail-client.tsx`

Tampilan sama dengan invoice publik — admin juga melihat baris Kode Unik dan
nilai `amountDue` agar tahu nominal yang seharusnya diterima dari customer.

Banner kecil jika kode unik aktif:

> **Nominal yang diharapkan: Rp 490.523** (total Rp 490.000 + kode Rp 523)

---

## 7. Konfirmasi Pembayaran

### Admin konfirmasi manual (`confirmInvoicePaymentAction`)

- Expected amount = `total + uniqueCode` (bukan hanya `total`)
- Validasi: `data.amount > remaining` → perlu hitung `remaining` berdasarkan
  `(total + uniqueCode) - paidAmount`
- Jurnal mencatat `data.amount` (jumlah aktual yang dikonfirmasi admin) sebagai
  penerimaan kas — bukan hanya `total`

### Customer upload bukti (`submitPaymentProofAction`)

- Tidak ada perubahan logic
- UI tampil "Transfer sejumlah Rp 490.523" (bukan Rp 490.000) agar customer
  tidak salah transfer

### Admin verifikasi bukti (`verifySubmittedPaymentAction`)

- Tampil "Nominal yang diharapkan: Rp 490.523" di panel verifikasi admin
- Tidak ada perubahan logic inti

---

## 8. Settings UI

Route: `app/(dashboard)/app/[tenant]/settings/payment/`

Blok baru di bawah bagian rekening bank:

```
┌──────────────────────────────────────────────────────┐
│  Kode Unik Transaksi                                 │
│                                                      │
│  [Toggle ON/OFF]  Aktifkan kode unik                 │
│                                                      │
│  Tambahkan nominal unik Rp 100–999 di setiap         │
│  invoice untuk memudahkan identifikasi transfer      │
│  masuk. Kode unik dicatat sebagai bagian dari        │
│  penerimaan kas.                                     │
└──────────────────────────────────────────────────────┘
```

Server action: `savePaymentSettingsAction` (yang sudah ada) — cukup tambah
key `unique_code_enabled` ke payload yang di-save.

---

## 9. Daftar File yang Diubah

| File | Perubahan |
|------|-----------|
| `packages/db/src/schema/tenant/billing.ts` | Tambah kolom `uniqueCode` ke `createInvoicesTable` |
| `packages/db/src/helpers/create-tenant-schema.ts` | Tambah `unique_code INTEGER NOT NULL DEFAULT 0` ke DDL |
| `packages/db/migrations/XXXX_invoice_unique_code.sql` | Migration untuk tenant existing |
| `packages/db/src/helpers/billing.ts` | `generateUniqueCode()` + update `createLinkedInvoice` |
| `apps/web/app/(dashboard)/app/[tenant]/settings/payment/page.tsx` | Toggle UI |
| `apps/web/app/(dashboard)/app/[tenant]/settings/actions.ts` | Save `unique_code_enabled` |
| `apps/web/app/(public)/[tenant]/invoice/[id]/page.tsx` | Pass `uniqueCode` + `amountDue` ke client |
| `apps/web/components/billing/invoice-public-client.tsx` | Display baris Kode Unik + `amountDue` |
| `apps/web/app/(dashboard)/app/[tenant]/finance/billing/invoice/[id]/page.tsx` | Pass `uniqueCode` + `amountDue` ke client |
| `apps/web/components/keuangan/billing/invoice-detail-client.tsx` | Display kode unik + expected amount |
| `apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts` | Update `remaining` calc di confirm/verify |

**Tidak perlu diubah:**
- `checkoutAction` — invoice sudah via `createLinkedInvoice`
- `createOrderAction` — sama
- Alur event, donasi, toko — semua lewat `createLinkedInvoice`

---

## 10. Migration untuk Tenant Existing

```sql
-- Jalankan per tenant: docs/migration-kode-unik.sql
ALTER TABLE "tenant_{slug}".invoices
  ADD COLUMN IF NOT EXISTS unique_code INTEGER NOT NULL DEFAULT 0;
```

Invoice lama otomatis dapat `unique_code = 0` → tidak ada kode unik ditampilkan.
Fitur baru hanya berlaku untuk invoice yang dibuat setelah setting diaktifkan.

---

## 11. Edge Cases

| Kondisi | Perilaku |
|---------|----------|
| Semua kode 100–999 sudah terpakai (900+ invoice pending) | `generateUniqueCode` return `0` → invoice tanpa kode unik |
| Fitur dinonaktifkan di settings | `createLinkedInvoice` skip generate → `uniqueCode = 0` |
| Invoice lama (migrasi) | `uniqueCode = 0` → tidak tampil baris kode unik |
| Dua invoice concurrent dapat kode sama | Bisa terjadi (tidak ada lock) — total berbeda tetap membedakan invoice; dua invoice dengan total sama dan kode sama sangat jarang |
| Customer salah transfer tanpa kode unik | Admin tetap bisa konfirmasi manual — kode hanya alat bantu, bukan syarat |

---

## 12. Lessons Learned

*(Akan diisi setelah implementasi)*
