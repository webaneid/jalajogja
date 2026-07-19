# Arsitektur Diskon & Voucher

> **Dokumen terkait:**
> - `docs/arsitektur-billing.md` — alur invoice universal, cart, checkout (integrasi utama)
> - `docs/arsitektur-kode-unik.md` — kode unik transaksi (interaksi dengan voucher 100% di § 8)
> - `docs/arsitektur-keuangan.md` — double-entry journal (interaksi dengan checkout Rp 0 di § 6)

**Status implementasi: ✅ Fase 1 SELESAI** (2026-07-19)
- Schema + migration (`0034_vouchers.sql`) + `create-tenant-schema.ts`: ✅ Selesai
- Helper resolver murni (`packages/db/src/helpers/voucher.ts`): ✅ Selesai
- Integrasi `checkoutAction` (resolusi, potongan per-item, Rp 0 auto-lunas, kode unik): ✅ Selesai
- UI input kode voucher + preview live: ✅ Selesai (di halaman **checkout**, bukan keranjang — lihat § 7)
- Admin CRUD (`/app/{slug}/finance/billing/voucher/*`): ✅ Selesai
- Pembatalan invoice → rollback kuota voucher: ✅ Selesai
- **Belum dijalankan di VPS**: migrasi `0034_vouchers.sql` — WAJIB dijalankan sebelum deploy kode
  (urutan standar project: migrate DB dulu, baru restart PM2)
- **Belum dites manual di browser** — semua verifikasi sejauh ini `tsc --noEmit` + `bun run build`
  di kedua package. Skenario manual (§ 9) belum dicoba end-to-end.

Fase 2 (diskon otomatis tanpa kode, target produk mitra, target per kategori) — **belum
direncanakan detail**, lihat § 10 "Di Luar Scope Fase 1".

---

## 1. Konsep & Prinsip yang Dikunci

Voucher/diskon memotong harga **item spesifik** yang ditargetkan (produk/tiket/donasi), **bukan
pernah invoice secara keseluruhan**. Contoh: customer beli kaos (ditarget voucher) + daftar tiket
event (tidak ditarget) dalam satu checkout → hanya baris kaos yang terpotong, tiket tetap harga
penuh.

**Voucher 100% harus bisa membuat tagihan jadi Rp 0** — contoh nyata: pemenang lomba dapat tiket
nonton gratis. Dan pada kondisi ini, **kode unik transaksi (§ arsitektur-kode-unik.md) TIDAK BOLEH
muncul** — tidak ada gap antara tagihan Rp 0 dengan kode unik yang tetap nongol seolah masih ada
yang harus ditransfer.

Dua keputusan scope yang dikunci sejak awal (dikonfirmasi eksplisit oleh user sebelum
implementasi dimulai):
1. **Fase 1 hanya produk milik TENANT** — produk mitra (`products.mitraId` terisi) dikecualikan
   dari targeting. Sistem komisi mitra untuk alur invoice/cart universal memang belum dibangun
   sama sekali (arsip lama di `order_items`) — memotong harga produk mitra tanpa mekanisme
   kompensasi komisi akan langsung memotong pendapatan mereka tanpa persetujuan.
2. **Fase 1 hanya voucher BERKODE** — customer input kode secara eksplisit di halaman checkout.
   Diskon otomatis tanpa kode (mis. "Diskon Lebaran 20% semua kaos") adalah Fase 2.

---

## 2. Data Model

### `vouchers` (tenant schema, baru)

```
id                       uuid PK
code                     text NOT NULL UNIQUE       -- disimpan UPPERCASE, dibandingkan case-insensitive
name                     text NOT NULL              -- label internal admin, TIDAK ditampilkan ke customer
description              text
discount_type            text enum('percentage','fixed') NOT NULL
discount_value           numeric(15,2) NOT NULL     -- 20 (=20%) atau 50000 (=Rp50rb)
target_type              text enum('product','ticket','donation') NOT NULL
                                                     -- TIDAK ada 'all' — voucher wajib eksplisit
                                                     -- ditarget ke minimal satu tipe
target_item_ids          jsonb NOT NULL DEFAULT '[]'  -- kosong = berlaku utk SEMUA item tipe ini
usage_limit              integer NULL               -- null = tak terbatas
usage_limit_per_customer integer NULL               -- null = tak terbatas per orang
used_count               integer NOT NULL DEFAULT 0 -- global counter, diupdate dengan lock
restrict_phone           text NULL                  -- normalizePhone() E.164 — voucher personal
restrict_email           text NULL
valid_from               timestamptz NULL
valid_until              timestamptz NULL
is_active                boolean NOT NULL DEFAULT true
created_by               uuid NULL                  -- tenant.users.id
created_at / updated_at
```

**Kenapa `target_item_ids` array JSONB, bukan tabel relasi terpisah**: konsisten dengan pola
sederhana yang sudah dipakai project ini untuk relasi kecil (mis. `attendee_stats_by JSONB` di
events). Jumlah target per voucher realistis kecil (belasan item paling banyak) — tidak butuh
tabel junction dengan index BTREE terpisah.

### `voucher_redemptions` (tenant schema, baru — audit trail wajib)

```
id             uuid PK
voucher_id     uuid NOT NULL   -- FK -> vouchers.id, CASCADE
invoice_id     uuid NOT NULL   -- FK -> invoices.id, CASCADE
customer_phone text NULL       -- snapshot, untuk cek usage_limit_per_customer
customer_email text NULL
discount_total numeric(15,2) NOT NULL  -- total potongan yang benar-benar terjadi di invoice ini
cancelled_at   timestamptz NULL  -- diisi saat invoice terkait dibatalkan (§ 6)
created_at     timestamptz
```

Kenapa tabel terpisah (bukan cuma `used_count` counter di `vouchers`):
- `usage_limit_per_customer` butuh cara menghitung "berapa kali NOMOR HP/EMAIL INI pakai voucher
  INI" — counter tunggal tidak cukup.
- Audit/laporan "voucher mana dipakai di invoice mana, berapa potongannya" — semangat sama dengan
  seluruh audit akurasi nominal yang sudah dikunci sebelumnya di `docs/arsitektur-billing.md`
  (WAJIB ada jejak, bukan cuma angka akhir).
- Kalau invoice dibatalkan, redemption bisa ditandai `cancelled_at` per-invoice — bukan sekadar
  decrement counter yang rawan race/tidak reversible per baris.

### Kolom baru di tabel existing

`invoice_items` — 2 kolom baru:
```
discount_amount  numeric(15,2) NOT NULL DEFAULT 0   -- nominal potongan baris ini (bukan persen)
voucher_id       uuid NULL                          -- FK -> vouchers.id
```
`total` (kolom yang sudah ada sejak awal) sekarang dihitung `(unitPrice*quantity) - discountAmount`,
di-clamp minimal 0 per baris.

`invoices` — 3 kolom baru untuk akses cepat (hindari JOIN setiap render):
```
voucher_id             uuid NULL
voucher_code           text NULL   -- snapshot kode, tetap kebaca meski voucher dihapus nanti
voucher_discount_total numeric(15,2) NOT NULL DEFAULT 0
```

`carts` — **TIDAK ditambah kolom apa pun**. Kode voucher hanya dikirim SEKALI SAAT SUBMIT
checkout (mirip pola `shipping` yang sudah ada), bukan disimpan permanen di cart.

---

## 3. Resolusi Harga — Reuse, Bukan Reimplement

**Prinsip kunci**: voucher TIDAK punya jalur resolusi harga sendiri terpisah dari `checkoutAction`'s
loop re-fetch harga yang sudah ada. Resolver voucher beroperasi **SETELAH** `unitPrice` final
sudah di-resolve — cukup menyisipkan satu langkah tambahan: hitung `discountAmount` dari
`unitPrice` yang SUDAH benar.

`packages/db/src/helpers/voucher.ts` — 3 fungsi kecil murni (bukan satu fungsi monolitik) supaya
bisa dipakai baik untuk preview (baca saja, tanpa lock) maupun checkout sungguhan (dengan lock, di
dalam transaction) tanpa duplikasi logic validasi/perhitungan:

```typescript
findVoucherByCode(db, schema, code, forUpdate?)
  → cari voucher case-insensitive (selalu UPPERCASE). forUpdate=true WAJIB dipakai di dalam
    transaction checkout sungguhan (kunci row supaya dua checkout bersamaan tidak sama-sama
    lolos cek usageLimit) — TIDAK dipakai untuk preview.

countCustomerRedemptions(db, schema, voucherId, {phone, email})
  → berapa kali nomor HP/email ini SUDAH memakai voucher ini (cancelledAt IS NULL saja).

computeVoucherDiscount(voucher, customer, existingRedemptions, resolvedItems)
  → fungsi PURE (tidak akses DB). Validasi isActive/validFrom/validUntil/usageLimit/
    restrictPhone/restrictEmail/usageLimitPerCustomer, lalu hitung discount per item yang
    match targetType + targetItemIds + BUKAN milik mitra (mitraId null). Return per-item
    Map<index, discount> + totalDiscount, atau {error} kalau tidak ada satu item pun yang match.
```

**Kalau tidak ada satu pun item di cart yang match target voucher** → error eksplisit ("Voucher
tidak berlaku untuk item di keranjang Anda"), BUKAN silently sukses dengan discount 0 — customer
harus tahu kenapa kodenya tidak berefek.

### Semantik `target_item_ids` untuk donasi/qurban

`invoice_items.itemId` untuk donasi biasa = `campaigns.id`. Untuk qurban, `itemId` =
`qurban_animals.id` (bukan `campaigns.id` — qurban adalah varian per-hewan dari campaign, lihat
`docs/arsitektur-donasi.md`). Admin target picker untuk `targetType='donation'` menampilkan DUA
sumber sekaligus: campaign biasa (label "Donasi: {title}") dan varian qurban per-hewan (label
"Qurban: {campaign title} — {animalType}") — supaya admin men-target ID yang benar-benar dipakai
sebagai `itemId` di cart, bukan salah mengira campaign qurban bisa ditarget sebagai satu kesatuan.

---

## 4. Alur Checkout Dengan Voucher

Di dalam `checkoutAction` (`apps/web/app/(public)/[tenant]/cart/actions.ts`), urutan presisi di
dalam transaction yang sama (lock cart yang sudah ada, tidak berubah):

1. Lock cart (sudah ada)
2. Resolve harga per item ke `resolvedItems` (sudah ada — loop product/ticket re-fetch harga dari
   DB, tidak percaya snapshot cart)
3. **Voucher** — kalau `voucherCode` diisi: `findVoucherByCode(..., forUpdate=true)` (lock row) →
   `countCustomerRedemptions` → `computeVoucherDiscount`. Error → `return {error}`, transaction
   rollback total, cart tetap utuh untuk dicoba lagi.
4. `subtotal = Σ(unitPrice*qty − discountAmount per item, clamp ≥ 0)`, `total = subtotal +
   shippingTotal`
5. `isFullyPaid = total <= 0`
6. `uniqueCode = (uniqueCodeEnabled && total > 0) ? generateUniqueCode(tenantDb) : 0` — syarat
   `total > 0` inilah yang menutup celah "kode unik tetap muncul walau tagihan nol"
7. `status = isFullyPaid ? "paid" : "pending"`, `paidAmount = isFullyPaid ? total : 0`
8. Insert invoice (`voucherId`, `voucherCode`, `voucherDiscountTotal`) + invoice_items
   (`discountAmount`, `voucherId` per baris yang kena potongan)
9. Kalau voucher dipakai: `UPDATE vouchers SET used_count = used_count + 1` (masih di dalam lock
   yang sama) + `INSERT voucher_redemptions`
10. Hapus cart (sudah ada)

### Checkout Rp 0 (voucher 100%) — auto lunas, tanpa langkah bayar

Kalau `isFullyPaid`, SEMUA efek samping yang biasanya baru terjadi saat admin konfirmasi
pembayaran ikut dipicu — pola identik blok `if (newStatus === "paid")` di
`confirmInvoicePaymentAction`/`verifySubmittedPaymentAction` (§ arsitektur-billing.md):
- Sync `collected_amount` campaign dari item donasi (net of discount)
- Auto-create `event_registrations` (status `confirmed`) dari item tiket — parse attendee data
  dari `cart_items.notes`, generate nomor registrasi
- Notifikasi WA: `payment_confirmed` (amount = "Rp 0") lalu `event_registered` per tiket
- **TIDAK ada jurnal** (`recordIncome`) — nominal 0, tidak ada uang masuk untuk dicatat. Guard
  eksplisit: hanya panggil jurnal kalau `total > 0`.

**Duplikasi yang disengaja (bukan lupa)**: blok efek-samping-invoice-lunas ini sekarang ada di
**3 tempat** — `confirmInvoicePaymentAction`, `verifySubmittedPaymentAction`, dan `checkoutAction`
(untuk kasus Rp 0). Ini konsisten dengan pola duplikasi-demi-isolasi yang sudah berulang di
project ini (`generateEventRegNumber`, `formatEventDateWib`). Kalau nanti dibutuhkan salinan
KEEMPAT di modul lain, itu sinyal kuat untuk ekstraksi ke helper bersama
`applyInvoicePaidSideEffects(tx, schema, invoiceId)` — belum dilakukan di Fase 1.

---

## 5. Admin CRUD

Route `/app/{slug}/finance/billing/voucher/*` — sejajar dengan `/cicilan/`, ditambahkan sebagai
tab ketiga di `BillingTabs` (`components/keuangan/billing/billing-tabs.tsx`).

```
voucher/page.tsx              → list: kode, target, diskon, dipakai X/Y, status aktif
voucher/new/page.tsx          → form create
voucher/[id]/page.tsx         → detail: info + toggle aktif + riwayat redemption (invoice mana,
                                 berapa potongan, kapan, dibatalkan atau tidak)
voucher/[id]/edit/page.tsx    → form edit (dual-mode dengan new/page.tsx via `VoucherForm`)
```

Server actions (`finance/billing/actions.ts`, co-located dengan cicilan) — **guard permission
`hasFullAccess`/`hasReadAccess` ke modul `"keuangan"` sejak awal di setiap action**, bukan
ditambah belakangan (pelajaran langsung dari insiden 4 action billing yang sempat tanpa guard di
sesi audit sebelumnya):
```
getVoucherTargetOptionsAction(slug, targetType)   → hasReadAccess — opsi item untuk picker target
getVoucherListAction(slug)                        → hasReadAccess
createVoucherAction(slug, data)                   → hasFullAccess
updateVoucherAction(slug, voucherId, data)         → hasFullAccess
toggleVoucherActiveAction(slug, voucherId)         → hasFullAccess
getVoucherDetailAction(slug, voucherId)            → hasReadAccess
```

**Target item picker** (`components/keuangan/billing/voucher-target-picker.tsx`) — multi-select
ringan (search + checkbox list + chip display terpilih), bukan `Combobox` yang sudah ada (yang
hanya single-value). Opsi difetch ulang setiap `targetType` berganti; kosongkan pilihan = berlaku
untuk semua item tipe itu.

**Kode voucher & uniqueness**: `code UNIQUE` constraint di DB. `createVoucherAction`/
`updateVoucherAction` catch unique-violation dan translate ke pesan ramah — pola sama dengan
deteksi NIK duplicate di modul Anggota (`members_nik_not_null_unique`).

---

## 6. Pembatalan Invoice — Redemption Ikut "Dikembalikan"

`cancelInvoiceAction` (`finance/billing/actions.ts`) sudah punya lock `FOR UPDATE` + re-check
status di dalam transaction (pola standar project ini). Ditambah: kalau `lockedInv.voucherId`
ada →
```sql
UPDATE vouchers SET used_count = GREATEST(used_count - 1, 0) WHERE id = ...
UPDATE voucher_redemptions SET cancelled_at = NOW()
  WHERE voucher_id = ... AND invoice_id = ... AND cancelled_at IS NULL
```
`GREATEST(..., 0)` — jaga-jaga `used_count` tidak pernah minus meski ada race/data anomali.
Redemption **ditandai** `cancelledAt`, **tidak dihapus** — audit trail tetap utuh, cuma tidak
dihitung lagi ke `usageLimit`/`usageLimitPerCustomer` (lihat `countCustomerRedemptions`, yang
memfilter `cancelledAt IS NULL`).

Invoice dengan `status='paid'` atau `paidAmount > 0` tidak bisa dibatalkan langsung (guard yang
sudah ada sebelum fitur ini) — jadi rollback voucher hanya terjadi untuk invoice yang memang
belum ada pembayaran sungguhan.

---

## 7. UI Kode Voucher — Ditempatkan di Halaman Checkout, Bukan Keranjang

**Deviasi dari rencana awal, keputusan pragmatis saat implementasi**: rencana awal menaruh input
kode voucher di halaman keranjang (`/keranjang`). Saat eksekusi, ditemukan bahwa arsitektur
publik yang sesungguhnya memisahkan dua halaman:
- `/keranjang` (`cart-client.tsx`) — cuma daftar item + qty control + link `<a>` ke `/checkout`,
  **tidak pernah memanggil `checkoutAction`**.
- `/checkout` (`checkout-form.tsx`) — SATU-SATUNYA komponen yang memanggil `checkoutAction`,
  sudah mengumpulkan `phone`/`email` di Step 1 (multi-step: pemesan → tujuan pengiriman → kurir).

Menaruh input voucher di halaman keranjang akan butuh mekanisme tambahan untuk membawa kode itu
melintasi navigasi halaman penuh ke `/checkout` (cookie tambahan atau query param) — sementara
menaruhnya langsung di `checkout-form.tsx` (yang sudah render di halaman yang sama tempat
`checkoutAction` dipanggil, dan sudah punya `phone`/`email` untuk validasi personal voucher yang
lebih akurat) tidak butuh mekanisme lintas-halaman sama sekali. Prinsip fitur (voucher di-preview
sebelum submit final, potongan per-item terlihat sebelum bayar) tetap terpenuhi penuh — hanya
lokasi filenya berbeda dari rencana awal.

`previewVoucherAction(slug, code, {phone?, email?})` (`cart/actions.ts`) — **preview murni**:
TIDAK mengunci voucher row, TIDAK menaikkan `usedCount`, TIDAK mutasi apa pun. Boleh sedikit stale
(race window sampai checkout sungguhan) — `checkoutAction` SELALU re-validasi dari nol di dalam
transaction-nya sendiri. Melakukan resolusi harga+mitraId per item PERSIS seperti loop di
`checkoutAction` (supaya preview tidak pernah menampilkan diskon untuk produk mitra yang nanti
dikecualikan saat checkout sungguhan).

Di `checkout-form.tsx`: input kode + tombol "Terapkan" di panel Ringkasan Pesanan (tampil di
semua step) → hasil preview menampilkan garis-coret harga per baris item yang kena potongan +
baris "Diskon Voucher" di ringkasan total. Kode yang berhasil di-preview disimpan di state
komponen (bukan server) → diteruskan sebagai parameter ke `checkoutAction` saat klik tombol final
("Buat Invoice").

---

## 8. Interaksi dengan Fitur Lain

**Kode unik** (`docs/arsitektur-kode-unik.md`) — voucher 100% membuat `total = 0` →
`generateUniqueCode` di-skip (§ 4 langkah 6). Voucher parsial (mis. diskon 20%) tidak mengganggu
kode unik sama sekali — kode unik tetap dihitung dari `total` (yang sudah net-of-discount) seperti
biasa.

**Cicilan** (`docs/arsitektur-billing.md` § Cicilan) — `convertInvoiceToInstallmentAction` SELALU
memecah dari `invoice.total` yang SEBENARNYA (bukan `plan.totalAmount`, yang cuma saran/default
tampilan). Kalau `invoice.total` sudah mencerminkan potongan voucher SEBELUM konversi ke cicilan,
tidak perlu perubahan apa pun di modul cicilan — voucher dan cicilan otomatis kompatibel tanpa
kode tambahan. `findEligibleInstallmentPlan` mencocokkan `installment_plans.sourceId` (=
`event_tickets.id`) terhadap `invoice_items.itemId` — voucher tidak pernah mengubah `itemId`, cuma
`total`/`discountAmount` snapshot, jadi pencocokan tetap valid. Invoice yang sudah `status='paid'`
(termasuk hasil voucher 100%) otomatis tidak eligible untuk konversi cicilan (tidak ada yang perlu
dicicil) — tanpa guard tambahan.

**Sistem Mitra** — produk mitra (`products.mitraId` terisi) dikecualikan dari targeting DI
RESOLVER (`computeVoucherDiscount`, cek `item.mitraId`), bukan cuma di UI picker admin — jadi
meski admin secara sengaja/tidak sengaja menargetkan ID produk yang ternyata sudah pindah
kepemilikan ke mitra, baris itu tetap tidak terpotong saat checkout sungguhan.

---

## 9. Skenario Verifikasi Manual (Belum Dicoba — Butuh Browser)

1. Kaos diskon 20% (target: produk spesifik) + tiket event tanpa diskon dalam 1 cart → cuma kaos
   yang terpotong di ringkasan checkout, tiket harga penuh.
2. Voucher 100% ke tiket event → checkout menghasilkan invoice `status='paid'` langsung, **tanpa**
   kode unik ditampilkan, `event_registrations` otomatis `confirmed`.
3. Voucher personal (`restrictPhone` diisi) dicoba dengan nomor HP lain → ditolak dengan pesan
   jelas, baik di preview maupun di checkout sungguhan.
4. Voucher `usageLimit=1`, dicoba 2× oleh orang yang sama → percobaan kedua ditolak.
5. Invoice dengan voucher dibatalkan admin → `vouchers.usedCount` berkurang lagi, orang yang sama
   bisa pakai kode itu lagi (kalau limitnya memang mengizinkan).
6. Cek Buku Besar/Laporan Keuangan (`/finance/laporan`) — tidak ada entri jurnal untuk transaksi
   yang totalnya Rp 0.
7. Dua tab browser mencoba checkout dengan voucher `usageLimit=1` yang sama nyaris bersamaan →
   hanya satu yang berhasil (lock `FOR UPDATE` pada `vouchers` row menahan yang kedua sampai yang
   pertama commit, lalu re-check `usedCount` di dalam transaction menolaknya).

---

## 10. Di Luar Scope Fase 1 (Dicatat Eksplisit)

1. **Diskon otomatis tanpa kode** — desain data model (`vouchers`) sudah kompatibel maju: tambah
   kolom `requiresCode boolean DEFAULT true` + `autoApplyPriority integer` nanti, tidak perlu
   redesain skema.
2. **Produk mitra sebagai target** — kalau dibuka nanti, perlu keputusan produk baru: potongan
   ditanggung siapa (tenant subsidi penuh, atau otomatis kurangi komisi mitra proporsional).
3. **Target per kategori produk** (bukan per-item) — `targetItemIds` bisa diperluas dengan kolom
   tambahan `targetCategoryIds` nanti tanpa breaking change.
4. **Voucher untuk jalur di luar cart** (`registerForEventAction` alur langsung non-cart,
   `createInvoiceAction` admin-manual) — Fase 1 cuma cart/checkout, jalur mayoritas traffic
   publik. Alur admin-manual sudah punya kontrol penuh (admin bisa isi harga manual sendiri).
5. **Stacking voucher** (lebih dari satu kode per checkout) — tidak didukung, satu voucher per
   checkout. Perubahan besar ke resolver kalau dibutuhkan nanti (perlu urutan aplikasi antar
   diskon).
6. **Celah harga produk variable & qurban** yang ditemukan saat riset (produk variable mengirim
   `itemId = product_variations.id`, tapi `checkoutAction` re-fetch harga dengan
   `WHERE products.id = itemId` — tidak pernah match, diam-diam jatuh balik ke snapshot cart yang
   tidak tervalidasi; donasi/qurban juga tidak pernah di-re-fetch harga sama sekali) — celah ini
   **sudah ada sebelum fitur voucher**, tidak diperkenalkan oleh fitur ini. Direkomendasikan
   sebagai audit keamanan harga terpisah, **belum dieksekusi**.
7. **Komisi mitra untuk voucher** — tidak relevan karena mitra dikecualikan Fase 1.
