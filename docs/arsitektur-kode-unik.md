# Arsitektur Kode Unik Transaksi

> **Dokumen terkait:**
> - `docs/arsitektur-billing.md` — alur invoice universal, cart, checkout
> - `docs/arsitektur-keuangan.md` — double-entry journal, account mapping

**Status implementasi: ✅ SELESAI** (commit `769599a`, `0d1f767`, lanjut fix bug di `64eeea5`, `141776e` — 2026-07-12)
- Schema + migration: ✅ Selesai
- Helper `generateUniqueCode`: ✅ Selesai
- Integrasi `createLinkedInvoice`: ✅ Selesai
- Display invoice publik + admin: ✅ Selesai
- Update konfirmasi pembayaran: ✅ Selesai (termasuk fix bug `submitPaymentProofAction` — lihat § 12)
- Settings UI toggle: ✅ Selesai

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

- **Rencana awal salah** — dokumen ini semula bilang "tidak ada perubahan logic",
  padahal `submitPaymentProofAction` MEMBUAT payment record sendiri dengan
  `amount = remaining` hasil hitungnya sendiri. Rencana ini lupa bahwa hitungan
  itu juga wajib include `uniqueCode`, bukan cuma tampilan UI. Bug nyata terjadi
  akibat ini — lihat § 12.
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

### [2026-07-12] Bug: `submitPaymentProofAction` tidak include `uniqueCode`

**Gejala**: Customer submit bukti transfer via halaman invoice publik (upload
bukti), admin verifikasi → invoice nyangkut status **"partial"** terus meski
customer sudah transfer sesuai nominal yang ditampilkan di layar (yang sudah
benar, termasuk kode unik).

**Root cause**: Halaman invoice publik (`invoice-public-client.tsx` +
`invoice/[id]/page.tsx`) menghitung `remaining = (total + uniqueCode) - paid`
dengan BENAR untuk *tampilan*. Tapi `submitPaymentProofAction` (server action
yang benar-benar mencatat `payments.amount`) menghitung ulang `remaining`
sendiri secara independen — dan versi ini LUPA menambahkan `uniqueCode`:

```typescript
// SALAH — sebelum fix
const remaining = parseFloat(String(inv.total)) - parseFloat(String(inv.paidAmount));

// BENAR — setelah fix
const amountDue = parseFloat(String(inv.total)) + (inv.uniqueCode ?? 0);
const remaining = amountDue - parseFloat(String(inv.paidAmount));
```

Akibatnya payment yang tercatat SELALU kurang persis sejumlah kode unik
(Rp 100–999), padahal customer sudah transfer nominal yang benar. Admin
verifikasi payment tersebut → invoice tetap `partial` karena `paid_amount`
tidak pernah mencapai `amount_due`.

**Efek berantai ke Bug #2 (nama peserta event hilang)**: Auto-create
`event_registrations` dari tiket yang dibeli via cart hanya jalan di dalam
blok `if (newStatus === "paid")`. Karena bug di atas membuat status selalu
nyangkut `partial`, peserta yang beli tiket event via cart **tidak pernah**
tercatat di `event_registrations` — meski sudah bayar (kurang persis sejumlah
kode unik). Nama peserta "hilang" dari daftar padahal invoice-nya ada.

**Aturan yang dikunci**: setiap tempat yang MENGHITUNG ULANG `remaining`/
`amountDue` dari invoice (bukan cuma menampilkannya) — baik di server action
maupun di helper — WAJIB selalu pakai `total + uniqueCode`, jangan pernah
`total` saja. Ada 3 titik yang harus konsisten: `confirmInvoicePaymentAction`
(admin manual), `verifySubmittedPaymentAction` (admin verifikasi), dan
`submitPaymentProofAction` (customer submit) — kalau salah satu lupa, invoice
nyangkut partial selamanya.

> **⚠️ KOREKSI (2026-08-12)**: aturan "3 titik" di atas TIDAK LENGKAP — lihat
> lesson di bawah untuk titik ke-4 yang terlewat lama (notifikasi WA
> `invoice_created`, kategori berbeda dari 3 titik ini karena bukan soal
> mencatat pembayaran, tapi soal MENAMPILKAN nominal ke customer via kanal
> lain di luar halaman invoice itu sendiri).

### [2026-08-12] Bug FATAL: Notifikasi WA `invoice_created` Kirim Nominal Tanpa Kode Unik

**Gejala** (dilaporkan user langsung, contoh nyata invoice `620-INV-202608-00053`,
tenant `visikita`): notifikasi WhatsApp "Invoice Baru" menampilkan `Total: Rp
350.000` — tapi begitu link invoice di klik, nominal yang HARUS ditransfer
(sudah termasuk kode unik) berbeda, misal `Rp 350.347`. Customer transfer
sesuai angka di WhatsApp (tanpa kode unik) → payment yang tercatat SELALU
kurang persis sejumlah kode unik, invoice nyangkut `partial` — persis kelas
akibat yang sama dengan bug `submitPaymentProofAction` di atas, cuma sumber
angkanya kali ini dari notifikasi, bukan dari form submit.

**Root cause**: `checkoutAction` (`app/(public)/[tenant]/cart/actions.ts`,
alur checkout publik — cart produk/tiket/donasi) menghitung `uniqueCode` DI
DALAM `db.transaction()` (dipakai benar untuk `invoices.uniqueCode` saat
insert), tapi TIDAK menyertakannya di `TxResult` yang dikembalikan keluar
transaction. Notifikasi `invoice_created` di luar transaction lalu kirim:
```typescript
// SALAH — sebelum fix, txResult tidak punya field uniqueCode sama sekali
amount: waRupiah(txResult.total),
```
Jalur ADMIN MANUAL (`createInvoiceAction`, `finance/billing/actions.ts`)
TERNYATA SUDAH BENAR sejak awal (`const amountDue = total + uniqueCode;`) —
bug ini HANYA di jalur cart publik, membuatnya lebih berbahaya karena itu
jalur paling sering dipakai (event registration, donasi, toko).

**Fix**: `uniqueCode` ditambahkan ke type `TxResult` dan ke objek yang
dikembalikan transaction, notifikasi diubah jadi
`amount: waRupiah(txResult.total + txResult.uniqueCode)`.

**Audit menyeluruh dilakukan sekalian** (bukan cuma tambal 1 titik yang
dilaporkan) — SEMUA 24 pemanggilan `notifyWa(...)` di seluruh app digrep dan
dicek konteksnya satu per satu. Hasil: HANYA titik ini yang bug. Titik lain
yang SEKILAS mirip tapi TERNYATA benar, dengan alasan masing-masing:
- `payment_submitted`/`installment_payment_submitted` — kirim `data.amount`
  (nominal yang CUSTOMER SENDIRI ketik saat submit bukti, prinsip "Fidelitas
  ke Nominal yang Customer Submit" sudah dikunci sebelumnya) — BUKAN
  recalculation "apa yang seharusnya dibayar", jadi tidak butuh `+uniqueCode`.
- `payment_confirmed` (admin konfirmasi manual maupun verifikasi bukti) —
  kirim nominal yang ADMIN konfirmasi/verifikasi sungguhan, sama alasannya.
- `invoice_reminder` (cron) — sudah benar `(total + uniqueCode) - paidAmount`.
- `installment_reminder`/`installment_due_today` (cron cicilan) — `amount`
  per-termin sudah benar pakai kode unik PER TERMIN
  (`installmentSchedules.uniqueCode`, mekanisme terpisah dari kode unik
  invoice-level — lihat § "Kode Unik PER TERMIN" di `docs/arsitektur-billing.md`);
  `remaining` (total invoice tersisa) sengaja TIDAK tambah `uniqueCode`
  invoice-level karena kolom itu MEMANG di-nolkan permanen saat invoice
  dikonversi jadi cicilan (`invoices.uniqueCode = 0` sejak konversi).
- `donation_received` — kirim nominal PER ITEM donasi (`invoiceItems.total`),
  tidak terkait kode unik invoice-level sama sekali.

**Aturan yang ditegaskan**: perluasan langsung dari "3 titik" di atas — kode
unik bukan cuma soal MENCATAT pembayaran (payment actions), tapi juga soal
MENAMPILKAN nominal ke customer lewat KANAL APA PUN (notifikasi WA, email,
dsb) yang menyatakan "ini yang harus Anda bayar/transfer". Kalau kanal itu
me-refer ke `total` invoice secara langsung (bukan nominal yang sudah
dikonfirmasi/di-submit orang), WAJIB `total + uniqueCode`. Setiap kali
menambah kanal notifikasi BARU yang menyebut nominal invoice, cek dulu: apakah
ini "berapa yang harus dibayar" (butuh +uniqueCode) atau "berapa yang sudah
dibayar/dikonfirmasi" (pakai nominal aktual apa adanya, TIDAK ditambah kode
unik lagi)?

### [2026-07-12] Bug: Loop auto-create tiket jalan tanpa guard `sourceType`

Loop yang mengubah invoice item `itemType="ticket"` jadi `event_registrations`
(di `confirmInvoicePaymentAction` + `verifySubmittedPaymentAction`) berjalan
untuk SEMUA invoice, termasuk invoice dari alur lama (`registerForEventAction`,
`sourceType="event_registration"`) yang **sudah** insert `event_registrations`
langsung sebelum invoice dibuat. Invoice alur lama itu juga punya invoiceItem
`itemType="ticket"` (dari `createLinkedInvoice`) — tanpa guard, loop ini insert
ENTRI DUPLIKAT dengan nama = nama tiket (bukan nama peserta asli), karena
`description` item itu tidak pernah diisi JSON attendee.

**Fix**: loop auto-create hanya jalan jika `inv.sourceType === "cart"`. Untuk
`sourceType === "event_registration"`, status registrasi di-update di blok
terpisah (`UPDATE event_registrations SET status='confirmed'`) — blok ini
sebelumnya ada di `verifySubmittedPaymentAction` tapi HILANG di
`confirmInvoicePaymentAction`, sudah disamakan.

### [2026-07-12] Bug: Race condition klik ganda "Konfirmasi Pembayaran"

`confirmInvoicePaymentAction` membaca status invoice SEBELUM masuk
`db.transaction()` dan tidak mengunci baris. Dua request hampir bersamaan
(klik ganda admin, atau retry karena network lambat) bisa sama-sama lolos
pengecekan "belum lunas" sebelum salah satu commit → 2 payment untuk 1
pembayaran nyata, invoice jadi over-paid.

**Fix**: validasi status + hitung `remaining` dipindah ke DALAM transaction,
invoice di-lock via `SELECT ... WHERE id = ? FOR UPDATE` sebelum insert
payment — pattern yang sama dengan lock kuota tiket event
(`docs/arsitektur-event.md` § SELECT FOR UPDATE). Kasus nyata: invoice
`620-INV-202607-00014` (tenant visikita) sempat ke-double-confirm, payment
duplikat dihapus manual + `paid_amount`/`status` di-recompute — lihat
`docs/diagnosa-double-payment.sql` untuk query diagnosa yang dipakai.

**Aturan**: setiap action yang mengubah state "sekali jalan" (status → paid,
konfirmasi, dll) berdasarkan baca-lalu-tulis pada baris yang sama WAJIB kunci
baris itu di dalam transaction — jangan andalkan `disabled={pending}` di
client saja, itu tidak mencegah race condition di server.
