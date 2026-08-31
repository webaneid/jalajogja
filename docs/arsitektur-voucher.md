# Arsitektur Diskon & Voucher

> **Dokumen terkait:**
> - `docs/arsitektur-billing.md` — alur invoice universal, cart, checkout (integrasi utama)
> - `docs/arsitektur-kode-unik.md` — kode unik transaksi (interaksi dengan voucher 100% di § 8)
> - `docs/arsitektur-keuangan.md` — double-entry journal (interaksi dengan checkout Rp 0 di § 6)

**Status implementasi: ✅ Fase 1 SELESAI + audit pasca-implementasi SELESAI** (2026-07-19,
audit lanjutan 2026-08-08)
- Schema + migration (`0034_vouchers.sql`) + `create-tenant-schema.ts`: ✅ Selesai
- Helper resolver murni (`packages/db/src/helpers/voucher.ts`): ✅ Selesai
- Integrasi `checkoutAction` (resolusi, potongan per-item, Rp 0 auto-lunas, kode unik): ✅ Selesai
- UI input kode voucher + preview live: ✅ Selesai (di halaman **checkout**, bukan keranjang — lihat § 7)
- Admin CRUD (`/app/{slug}/finance/billing/voucher/*`): ✅ Selesai
- Pembatalan invoice → rollback kuota voucher: ✅ Selesai
- Audit docs-vs-kode + 4 bug/gap ditemukan+difix: ✅ Selesai — lihat § 11
- Migrasi `0034_vouchers.sql` — sudah live di production (`visikita.com` genuinely memakai
  voucher per laporan user 2026-08-08), status commit VPS terkini tidak terverifikasi dari sini
  (tidak ada akses SSH langsung) — dokumen lama sempat bilang "belum di VPS", sudah tidak akurat
- Bug UX ditemukan dari testing langsung user: input voucher tidak terlihat di alur checkout
  (tersembunyi di kolom kanan, jatuh di bawah tombol submit saat mobile) — ✅ Difix, lihat § 12
- **Bug KRITIS ditemukan dari laporan user (2026-08-08)**: voucher tidak pernah match untuk
  produk BERVARIASI (mismatch `product_variations.id` vs `products.id` di targeting) —
  ✅ Difix, lihat § 13. Belum di-commit/push/deploy — lihat § 13 untuk status verifikasi.
- Sisa skenario manual (§ 9) masih perlu dicoba end-to-end
- **Voucher di invoice manual admin** (buat baru & pasca-buat) — ✅ Selesai + di-deploy VPS
  (2026-08-31), lihat § 15
- **Bug KRITIS ditemukan dari laporan user (2026-08-31), di HARI YANG SAMA dengan § 15**: kode
  unik tidak pernah dinolkan/di-skip untuk invoice manual admin yang totalnya jadi Rp 0 karena
  voucher — invoice tampil "Rp 0" tapi tetap dianggap belum dibayar. ✅ Difix, lihat § 16.
  Belum di-commit/push/deploy.

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
deteksi NIK duplicate di modul Anggota (`members_nik_hash_not_null_unique`, sejak NIK
dienkripsi at-rest — lihat `docs/arsitektur-keanggotaan.md` § "Deteksi Duplikasi Anggota").

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
8. Buka invoice hasil checkout dengan voucher — baik di dashboard admin
   (`/finance/billing/invoice/[id]`) maupun halaman publik (`/invoice/[id]`) — pastikan baris
   "Diskon Voucher (KODE): -Rp X" muncul, angka Subtotal/Diskon/Total konsisten (Subtotal −
   Diskon = jumlah sebelum ongkir, bukan dipotong dobel), dan badge kode voucher tampil di list
   admin (§ 11 poin 2).
9. Voucher personal dengan `restrictEmail` diisi huruf kecil semua (mis. `john@x.com`), customer
   checkout dengan email huruf besar (`John@X.com`) → voucher tetap diterima (§ 11 poin 1).
10. Voucher dengan `validUntil` = hari ini → masih bisa dipakai sampai akhir hari (tenant
    timezone), bukan expire pagi hari (§ 11 poin 3).

---

## 10. Di Luar Scope Fase 1 (Dicatat Eksplisit)

1. **Diskon otomatis tanpa kode** — desain data model (`vouchers`) sudah kompatibel maju: tambah
   kolom `requiresCode boolean DEFAULT true` + `autoApplyPriority integer` nanti, tidak perlu
   redesain skema.
2. **Produk mitra sebagai target** — kalau dibuka nanti, perlu keputusan produk baru: potongan
   ditanggung siapa (tenant subsidi penuh, atau otomatis kurangi komisi mitra proporsional).
3. **Target per kategori produk** (bukan per-item) — `targetItemIds` bisa diperluas dengan kolom
   tambahan `targetCategoryIds` nanti tanpa breaking change.
4. **`registerForEventAction` alur langsung non-cart** — masih di luar scope, jalur legacy yang
   tidak lewat cart universal. ~~`createInvoiceAction` admin-manual~~ **SUPERSEDED (2026-08-31)**
   — voucher sekarang didukung penuh untuk invoice manual admin, lihat § 15.
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

---

## 11. Audit Pasca-Implementasi — 4 Bug/Gap Ditemukan+Difix (2026-07-19)

User eksplisit minta re-check dokumentasi vs kode aktual + cari bug/gap sebelum lanjut fitur
berikutnya. Audit menyeluruh (resolver, checkoutAction, admin CRUD, DDL vs Drizzle schema,
invoice display) menemukan 4 masalah nyata — semua sudah difix di sesi yang sama:

**1. Bug — `restrictEmail` dibandingkan case-sensitive, padahal disimpan lowercase.**
`createVoucherAction`/`updateVoucherAction` menyimpan `restrictEmail` via `.toLowerCase()`, tapi
`computeVoucherDiscount()` dan `countCustomerRedemptions()` membandingkan terhadap
`customer.email` yang HANYA di-`.trim()` (tidak di-lowercase) di kedua caller (`checkoutAction`
dan `previewVoucherAction`). Customer yang mengetik email dengan casing berbeda dari yang
tersimpan (mis. `John@Example.com` vs `john@example.com`) akan ditolak voucher personal yang
seharusnya berlaku untuknya — dan sebaliknya, dua submission dengan casing email berbeda bisa
dihitung sebagai "orang berbeda" oleh `usageLimitPerCustomer`, membuka celah bypass limit.
**Fix**: normalisasi HANYA di titik perbandingan (bukan di titik simpan `customerEmail`, supaya
casing asli tetap tersimpan untuk display) — `computeVoucherDiscount` bandingkan
`customer.email?.toLowerCase()`, `countCustomerRedemptions` pakai `sql\`lower(...)\`` di kedua sisi.
Kedua fungsi ini satu-satunya sumber kebenaran dipakai baik preview maupun checkout sungguhan,
jadi fix ini otomatis berlaku di kedua alur tanpa perlu sentuh caller.

**2. Gap — Invoice detail (admin DAN publik) tidak pernah menampilkan kode voucher/potongan yang
dipakai**, meski data-nya tersimpan lengkap di DB (`invoices.voucherCode`,
`invoices.voucherDiscountTotal`, `invoice_items.discountAmount`). `getInvoiceDetailAction`,
`InvoiceDetail` type, halaman publik `/invoice/[id]`, dan `PublicInvoiceData` type semuanya hanya
membaca `invoices.discount` (field LEGACY untuk invoice manual admin) — voucher sama sekali tidak
tersentuh. Admin yang buka invoice hasil checkout dengan voucher tidak akan tahu potongan itu
berasal dari mana, dan customer tidak melihat konfirmasi kode voucher mereka terpakai.
**Fix**: `voucherCode`+`voucherDiscountTotal` ditambah ke `InvoiceDetail`/`PublicInvoiceData` +
query terkait; `discountAmount` per-baris ditambah ke `items[]` di kedua type. UI: baris
"Diskon Voucher (KODE): -Rp X" di footer tabel item (admin `invoice-detail-client.tsx` + publik
`invoice-public-client.tsx`), badge kecil "− Rp X voucher" di bawah `item.total` untuk baris yang
kena potongan, dan badge kode voucher di list admin (`invoice-list-client.tsx` — `InvoiceListItem`
ditambah `voucherCode`).

**Bug turunan yang ditemukan SAAT mengerjakan fix #2**: draf pertama menampilkan
`Subtotal: invoice.subtotal` lalu `Diskon Voucher: -voucherDiscountTotal` — TAPI
`invoices.subtotal` untuk invoice hasil checkout SUDAH net-of-voucher (dihitung
`Σ(unitPrice*qty - discountAmount)` di `checkoutAction`, § 4), BEDA dari `invoices.discount`
(legacy, invoice manual admin) yang dipotong DARI subtotal gross. Menampilkan keduanya berjajar
seolah subtotal itu gross akan memotong diskon DUA KALI secara visual (angka tidak akan pernah
cocok ke `invoice.total`). **Fix**: rekonstruksi subtotal gross untuk tampilan —
`invoice.subtotal + invoice.voucherDiscountTotal` — SEBELUM menampilkan baris "Diskon Voucher".
Untuk invoice tanpa voucher (`voucherDiscountTotal = 0`), formula ini otomatis kembali ke
`invoice.subtotal` apa adanya — zero regresi ke tampilan invoice manual admin yang sudah ada.

**3. Gap — `validFrom`/`validUntil` di-parse sebagai UTC mentah, bukan dianchor ke timezone
tenant.** `new Date("2026-07-19")` (dari `<input type="date">`) = tengah malam UTC = jam 07:00 WIB
— voucher yang "berlaku sampai 19 Juli" akan expire jam 7 pagi WIB tanggal itu, bukan akhir hari
seperti yang dimaksud admin. Ini melanggar aturan yang SUDAH dikunci sesi-sesi sebelumnya di
project ini ("setiap kode yang menghitung/membandingkan tanggal untuk LOGIC BISNIS wajib anchor
ke kalender timezone tenant, bukan UTC mentah — lihat `lib/tenant-timezone.ts`"), yang sebelumnya
sudah diterapkan ke modul Event dan Invoice/Billing tapi terlewat di Voucher (dibangun setelah
aturan itu dikunci, seharusnya sudah otomatis ikut sejak awal). **Fix**: helper baru
`resolveVoucherDateRange()` di `finance/billing/actions.ts` — `validFrom` dianchor ke `00:00`
tenant-local, `validUntil` ke `23:59` tenant-local (supaya "berlaku sampai tanggal X" berarti bisa
dipakai sepanjang tanggal X), keduanya via `localDatetimeToUtcIso()` yang sudah ada. Dipanggil di
`createVoucherAction`+`updateVoucherAction` setelah fetch `getTenantTimezone(tenantDb)`.

**4. Defensif — `usageLimit`/`usageLimitPerCustomer` tidak divalidasi terhadap `NaN`.**
`parseInt("abc", 10)` = `NaN`, dan `NaN < 1` di JavaScript evaluasi `false` — input non-numerik
dari client bisa lolos `validateVoucherData` (yang cuma cek `< 1`) dan berpotensi bikin
`db.insert()` gagal dengan pesan generik "Gagal membuat voucher." tanpa penjelasan jelas ke admin
kenapa. Severity rendah (field `type="number"` sudah membatasi sebagian besar input tidak valid
di browser modern, dan kegagalan tetap ter-`catch`, tidak merusak data), tapi murah untuk
ditutup. **Fix**: `validateVoucherData` sekarang cek `Number.isNaN(...) || ... < 1` untuk kedua
field.

**Yang DICEK dan TERKONFIRMASI AMAN (tidak butuh fix)**:
- DDL (`create-tenant-schema.ts`) vs migration (`0034_vouchers.sql`) vs Drizzle schema
  (`billing.ts`) — kolom, tipe, default, FK, urutan pembuatan tabel (vouchers dibuat SEBELUM
  invoices/invoice_items yang mereferensikannya) semua konsisten.
- `restrictPhone` — TIDAK kena bug case-sensitivity yang sama (nomor telepon dinormalisasi via
  `normalizePhone()` di SEMUA titik simpan maupun banding, E.164 tidak punya masalah casing).
- Interaksi dengan cicilan (`convertInvoiceToInstallmentAction`) — selalu memecah dari
  `invoice.total` yang sebenarnya (net-of-voucher), tidak butuh perubahan.
- Kode unik (`generateUniqueCode`) — syarat `total > 0` sudah menutup kasus voucher 100% dengan
  benar sejak Fase B, dikonfirmasi ulang di kode aktual.

**Yang DICATAT tapi TIDAK difix (severity rendah/di luar scope permintaan)**:
- `VoucherTargetPicker` mem-fetch opsi HANYA item aktif/published — kalau item yang sudah
  ditarget sebelumnya berubah jadi non-aktif, chip-nya "menghilang" dari tampilan saat admin
  membuka form edit (walau `targetItemIds` di data tetap utuh, tidak ikut terhapus). Kosmetik,
  bukan bug data.
- Duplikat-tiket detection di `checkoutAction` (§ Alur Checkout langkah "Deteksi duplikat")
  berjalan SEBELUM resolusi voucher — kalau customer kena jalur redirect-ke-invoice-lama ini
  sambil membawa kode voucher valid, kode itu diam-diam tidak pernah dipakai/divalidasi (redirect
  ke invoice lama yang dibuat tanpa voucher). Skenario sangat jarang (duplikat tiket + voucher
  bersamaan), tidak diubah — mengubah urutan deteksi berisiko melemahkan proteksi anti-duplikat
  yang sudah terbukti berfungsi.

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan, sesuai SOP project). Migration
`0034_vouchers.sql` tetap belum dijalankan di VPS — audit ini murni perbaikan kode, tidak
mengubah struktur skema.

---

## 12. Bug Ditemukan Dari Testing Langsung User (2026-07-19) — Input Voucher Tidak Terlihat

Setelah migrasi dijalankan di lokal, user langsung mencoba alur penuh (buat voucher → checkout)
dan melaporkan: sampai invoice terbentuk, tidak pernah menemukan tempat memasukkan kode voucher.

**Root cause**: input kode voucher (§ 7) ditaruh di panel "Ringkasan Pesanan" — kolom KANAN dari
`grid lg:grid-cols-[1fr_360px]` di `checkout-form.tsx`. Di layout 2-kolom ini urutan DOM = urutan
render kolom kiri dulu (form + tombol navigasi), baru kolom kanan (ringkasan). Grid tanpa `order`
eksplisit mempertahankan urutan DOM saat stack jadi 1 kolom di mobile (`grid-cols-1` default,
`lg:` baru mengaktifkan 2 kolom) — artinya di mobile, urutan visual jadi: form → tombol
"Buat Invoice" → (scroll lebih jauh) → ringkasan pesanan → input voucher. Customer wajar berhenti
begitu melihat tombol submit, tidak pernah scroll melewatinya untuk menemukan input voucher yang
"tersembunyi" di bawah.

**Fix**: input kode voucher (card "Punya Kode Voucher?", lengkap dengan badge applied/hapus dan
pesan error) dipindah ke KOLOM KIRI — ditaruh setelah konten per-step (Step 1/2/3, apapun step
aktif) dan SEBELUM blok "Tombol navigasi", di luar kondisi `step === X` manapun (sama seperti
sebelumnya, tetap tampil di semua step). Kolom kanan (Ringkasan Pesanan) sekarang HANYA
menyisakan baris "Diskon Voucher: -Rp X" sebagai display read-only (bukan input) — tetap
konsisten menampilkan potongan begitu voucher diterapkan, tapi interaksinya sendiri sekarang
dijamin muncul SEBELUM tombol submit di urutan baca apa pun (mobile maupun desktop).

**Aturan digeneralisasi**: untuk form checkout/pembayaran dengan layout 2-kolom (form kiri +
ringkasan kanan) yang di-collapse jadi 1 kolom di mobile, elemen INTERAKTIF yang wajib
ditemukan SEBELUM tombol submit (kode voucher, pilihan metode bayar, dll) tidak boleh ditaruh di
kolom ringkasan/kanan — kolom itu di mobile selalu jatuh SETELAH seluruh kolom kiri termasuk
tombol submit-nya. Kolom kanan aman untuk elemen DISPLAY-ONLY (breakdown harga, daftar item)
yang tidak butuh aksi user sebelum submit.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses. Belum
diverifikasi visual di browser oleh Claude (keterbatasan environment) — user diminta konfirmasi
tampilan baru sudah sesuai setelah reload.

---

## 13. Bug Kritis — Voucher Tidak Match untuk Produk Bervariasi (2026-08-08)

User laporkan: ada yang memasukkan kode voucher di `visikita.com` tapi tidak bisa dipakai.
Diminta cek ketidakkonsistenan di alur input voucher.

**Root cause ditemukan lewat pembacaan kode 3 file, bukan tebakan** — `product-detail-
client.tsx` (baris ~166) mengirim `itemId = isVariable ? activeVariation.id : product.id` ke
`addToCartAction` — untuk produk BERVARIASI, `cart_items.itemId` yang tersimpan adalah
**`product_variations.id`, BUKAN `products.id`**. Sementara `VoucherTargetPicker` (dan
`getVoucherTargetOptionsAction`'s cabang `targetType==="product"`) HANYA PERNAH menyimpan
`products.id` sebagai `targetItemIds` — picker-nya sendiri query `schema.products` langsung,
tidak pernah menawarkan variasi individual sebagai opsi target.

`checkoutAction` dan `previewVoucherAction` (`cart/actions.ts`) sama-sama melakukan re-fetch
harga dengan `WHERE schema.products.id = item.itemId` — untuk item bervariasi, query ini
**TIDAK PERNAH match** (`prod` selalu `undefined`). Efeknya BERLAPIS TIGA:
1. `unitPrice`/`mitraId` jatuh balik ke default lokal (`item.unitPrice` snapshot cart,
   `mitraId = null`) — bukan hasil re-fetch DB yang seharusnya (celah harga, sudah dicatat di
   § 10 poin 6 sebagai "belum dieksekusi", tapi TERNYATA harus dieksekusi juga untuk menutup
   bug voucher ini — tidak bisa dipisah).
2. `mitraId` SELALU resolve jadi `null` untuk item bervariasi — kalau kebetulan variasi itu
   milik produk MITRA, guard `if (item.mitraId) return;` di `computeVoucherDiscount` (pengecuali
   produk mitra dari Fase 1) tidak pernah terpicu — celah eksklusi mitra.
3. **`voucher.targetItemIds.includes(item.itemId)` TIDAK PERNAH `true`** untuk produk
   bervariasi yang ditarget spesifik — `item.itemId` (variasi) tidak akan pernah sama dengan
   ID yang tersimpan di `targetItemIds` (produk induk). Voucher yang admin targetkan ke produk
   tertentu SELALU gagal untuk SEMUA variasi produk itu, dengan pesan "Voucher tidak berlaku
   untuk item di keranjang Anda" — persis gejala yang dilaporkan.

**Fix — helper baru `resolveProductCartItem()`** (`packages/db/src/helpers/resolve-product-
item.ts`, di-export dari barrel `@jalajogja/db`): coba `products.id = itemId` dulu (kasus
simple, paling umum); kalau tidak ketemu, fallback ke `product_variations.id = itemId` (JOIN
ke `products` induk untuk `mitraId` + fallback harga — `COALESCE(variation.price,
product.price)`, pola yang sama dipakai `resolveVariantPriceRanges()` di `lib/product-
variation-price.server.ts`). Return `{productId, price, mitraId}` — `productId` SELALU ID
PRODUK INDUK, dipakai KHUSUS untuk cocokkan `voucher.targetItemIds` (field baru
`voucherTargetId` di `resolvedItems`, terpisah dari `itemId` asli yang tetap dipertahankan
untuk `invoice_items`/tracking SKU — variasi mana yang benar-benar dibeli TIDAK BOLEH hilang
dari catatan pesanan).

Dipakai IDENTIK di KEDUA titik (`checkoutAction` DAN `previewVoucherAction`) — bukan
duplikasi terpisah, karena staleness di sini genuinely berbahaya (preview yang bilang "voucher
berlaku" tapi checkout sungguhan menolak, atau sebaliknya, akan jadi bug baru yang sama
kelasnya). Ini mengikuti rasional yang sama dengan `voucher.ts` sendiri — satu sumber
kebenaran untuk logic yang harus identik di dua pemanggil.

**Diverifikasi EMPIRIS terhadap data real** (disposable script, dihapus setelah) — produk
"Kaos IKPM Jogja" (tenant `forcreator`, 12 variasi, tenant-owned) di DB lokal: (a) query lama
`WHERE products.id = variation.id` dikonfirmasi 0 baris (bukti root cause); (b)
`resolveProductCartItem()` untuk `products.id` biasa → resolve benar (`price=150000,
mitraId=null`); (c) untuk `product_variations.id` → resolve ke `productId` INDUK yang benar +
harga VARIASI sendiri (`100000`, bukan harga induk `150000` — fallback COALESCE bekerja
benar meski di kasus ini variasi punya harga sendiri); (d) ID yang genuinely tidak ada → `null`
tanpa crash; (e) **reproduksi bug**: voucher 20% ditarget ke produk induk, cart berisi
variasinya, matching pakai `itemId` mentah (variasi) → `computeVoucherDiscount` GAGAL match
("Voucher tidak berlaku untuk item di keranjang Anda") — persis gejala dilaporkan; (f)
**verifikasi fix**: matching yang sama tapi pakai `voucherTargetId` (hasil resolve, = produk
induk) → MATCH, `totalDiscount = 20000` (tepat 20% dari harga variasi `100000`).

**Titik lain yang DICEK dan DIKONFIRMASI AMAN (tidak butuh fix)**:
- Normalisasi email (case-insensitive) — masih benar sejak fix § 11 poin 1, dicek ulang di
  kode aktual.
- Normalisasi phone — `checkoutAction` DAN `previewVoucherAction` SAMA-SAMA memanggil
  `normalizePhone(customer.phone)` sebelum dibandingkan ke `voucher.restrictPhone` (yang
  disimpan ter-normalisasi sejak `createVoucherAction`/`updateVoucherAction`) — konsisten,
  tidak ada mismatch format E.164.
- Semantik `itemId` untuk donasi/qurban — `getVoucherTargetOptionsAction`'s cabang
  `targetType==="donation"` SUDAH benar sejak awal membedakan campaign biasa (`campaigns.id`)
  dari varian qurban (`qurban_animals.id`), sesuai `itemId` yang genuinely dipakai cart untuk
  masing-masing (§ 3 "Semantik target_item_ids untuk donasi/qurban") — tidak ada mismatch
  serupa produk bervariasi di jalur donasi.
- Tiket event — entitas flat (`event_tickets.id`), tidak ada konsep variasi, `itemId` yang
  dipakai cart dan yang ditarget picker selalu sama.
- Kode voucher itu sendiri (case, whitespace) — `findVoucherByCode()` selalu `.trim().
  toUpperCase()` di server, terlepas apa yang dikirim client.
- State UI `checkout-form.tsx` — kode yang berhasil di-preview (`voucherPreview.valid`) baru
  dikirim ke `checkoutAction` saat submit final, form input reset preview ke `null` saat
  diketik ulang (tidak ada state basi yang salah dikirim).

**Dicatat sebagai edge case TERPISAH, TIDAK difix sesi ini** (di luar scope laporan, severity
rendah): kalau voucher personal (`restrictPhone`/`restrictEmail`) berhasil di-preview untuk
satu nomor/email, lalu customer mengubah nomor/email di Step 1 SEBELUM submit final, UI tidak
otomatis menjalankan ulang preview — `checkoutAction` tetap benar menolak di server (re-
validasi identitas terbaru), tapi UI sempat menampilkan "voucher diterapkan" yang sudah basi
sampai submit ditolak. Hanya relevan untuk voucher personal (fitur sempit), tidak untuk
voucher publik biasa seperti yang dilaporkan di `visikita.com`.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (percobaan pertama). `bun
run build --filter=@jalajogja/web` genuine sukses (dev server dimatikan port 6202, `.next`
dibersihkan, `Cached: 0 cached, 1 total`, 51.86 detik, dev server direstart, `curl` 200 OK).
File disentuh: `packages/db/src/helpers/resolve-product-item.ts` (baru), `packages/db/src/
index.ts` (export), `apps/web/app/(public)/[tenant]/cart/actions.ts` (checkoutAction +
previewVoucherAction). Nol migrasi DB — murni perbaikan logika resolusi, skema tidak berubah.
Sudah di-commit (`d4b3e6d`) dan di-push.

## 14. Bug Kritis — Kode Voucher Diketik Tapi Tidak Pernah Diterapkan, Checkout Lanjut Diam-Diam (2026-08-09)

Menyusul § 13 (sudah di-deploy), user laporkan satu kasus lagi: seorang customer sudah
mendaftar via kode voucher `SYUKRONSAHABAT620` (100% off, target tiket event "Ikut Reuni
2026" spesifik) — tapi di dashboard admin, invoice-nya tercatat SEBAGAI HARGA PENUH tanpa
voucher sama sekali, padahal voucher itu sendiri valid, belum pernah dipakai customer ini, dan
menargetkan tiket yang tepat (BUKAN kasus § 13 — produk/tiket ini tidak bervariasi).

**Investigasi menyeluruh, dua hipotesis diuji lewat pembacaan kode penuh (bukan tebakan)**:
1. *Apakah klik "Terapkan" sendiri bisa membuat invoice?* — Dibaca penuh `previewVoucherAction`
   (`cart/actions.ts`): 100% read-only, cuma `SELECT` (carts, cartItems, `findVoucherByCode`,
   `countCustomerRedemptions`), nol `.insert()`/`.update()`. **Terbukti tidak mungkin.**
2. *Apakah `checkoutAction` bisa diam-diam membuat invoice dari kode voucher yang gagal
   validasi?* — Dibaca ulang alur `checkoutAction`: kalau `voucherCode` dikirim TAPI gagal di
   `findVoucherByCode`/`computeVoucherDiscount`, SELURUH transaksi di-abort
   (`return { error: result.error }`) — **tidak ada invoice yang tercipta sama sekali** dalam
   skenario ini (all-or-nothing, bukan fallback diam-diam ke harga penuh).

Kesimpulan dari kedua fakta ini: satu-satunya cara invoice bisa tercipta dengan harga PENUH
adalah kalau parameter `voucherCode` yang dikirim ke `checkoutAction` **memang kosong/`undefined`**
— bukan karena ditolak server, tapi karena tidak pernah dikirim sama sekali dari client.

**Root cause ditemukan di `checkout-form.tsx`'s `doCheckout()`** (satu-satunya titik pemanggil
`checkoutAction`, dipanggil dari 2 handler step berbeda — checkout tanpa ongkir dan checkout
dengan ongkir): parameter voucher yang dikirim adalah `voucherPreview?.valid ?
voucherInput.trim() : undefined` — **TIDAK ADA GUARD** yang mencegah submit final kalau
customer sudah MENGETIK kode voucher di kolom input tapi **lupa/gagal klik tombol "Terapkan"**
sebelum klik tombol checkout akhir. Efeknya: customer ketik kode, yakin sudah "pakai" kode itu
(kode terlihat jelas di kolom input), klik "Selesaikan Pendaftaran" — checkout lanjut TANPA
voucher, TANPA peringatan apa pun, invoice langsung tercipta harga penuh. Customer baru sadar
setelah transfer/dikonfirmasi admin bahwa kodenya ternyata tidak pernah dipakai.

**Fix** — tambah guard di awal `doCheckout()`, sebelum `startTransition`:
```typescript
const pendingVoucherCode = voucherInput.trim();
if (pendingVoucherCode && !voucherPreview?.valid) {
  setError(`Kode voucher "${pendingVoucherCode}" belum diterapkan — klik "Terapkan" dulu, atau
kosongkan kolom voucher jika tidak ingin memakainya.`);
  return;
}
```
Kalau kolom voucher berisi teks TAPI belum berhasil di-preview (`voucherPreview.valid` bukan
`true`), checkout diblokir dengan pesan jelas — bukan lanjut diam-diam. Titik ini SATU-SATUNYA
pemanggil `checkoutAction` di file ini, jadi cukup ditutup di sini untuk kedua alur (dengan/
tanpa ongkir).

**Dicek dan dikonfirmasi AMAN (tidak berkontribusi ke bug ini)**:
- `onChange` di kolom input voucher SUDAH me-reset `voucherPreview` ke `null` di setiap
  keystroke — state basi (kode diedit tapi preview lama masih `valid`) secara struktural tidak
  mungkin terjadi.
- Panel voucher (sticky bottom bar "Punya Kode Voucher?") dirender UNCONDITIONAL di semua step
  (1/2/3) — bukan soal panelnya hilang di step tertentu.
- Tombol checkout adalah `<button type="button">`, bukan native form submit — tidak ada risiko
  submit-via-Enter yang melewati handler `onClick`.

**Koreksi data untuk kasus yang sudah terlanjur terjadi** — invoice `620-INV-202608-00024`
(tenant `visikita`), customer Yusbiantoro (`+6283830371821`, `yusbi86@gmail.com`), tiket
"Ikut Reuni 2026". Karena `checkoutAction`'s efek samping "invoice Rp 0 → auto-lunas" (sync
`event_registrations`, dst — lihat § 4) HANYA terpicu di dalam alur checkout itu sendiri, dan
customer tidak bisa/tidak perlu diminta checkout ulang untuk kasus yang jelas murni bug UI,
**database dikoreksi manual secara langsung** menggantikan yang seharusnya terjadi kalau
voucher berhasil diterapkan saat checkout:
1. `invoices` — `voucherId`/`voucherCode`/`voucherDiscountTotal` diisi, `subtotal`/`total`/
   `paidAmount`/`uniqueCode` di-nol-kan, `status → 'paid'` (subtotal WAJIB net-of-discount,
   bukan gross — lihat lesson CLAUDE.md soal ini).
2. `invoice_items` — `discountAmount`/`voucherId` diisi, `total → 0`.
3. `voucher_redemptions` — baris baru dicatat (identitas customer + jumlah diskon), supaya
   voucher ini tidak bisa dipakai ulang oleh customer yang sama di luar batas `usageLimitPer
   Customer`.
4. `vouchers.usedCount` — dinaikkan 1, sinkron dengan kuota (`usageLimit`) yang tersisa.
5. `event_registrations` — baris baru dibuat manual (nomor registrasi via increment atomic
   `event_registration_sequences`, format `EVT-{yyyymm}-{5 digit}`), attendee data diambil
   dari `invoice_items.description` (JSON custom field jawaban pendaftaran yang tersimpan di
   sana sejak checkout awal — satu-satunya sumber yang masih menyimpannya setelah
   `cart_items`/`carts` dihapus pasca-checkout). Status langsung `'confirmed'`, sama seperti
   yang terjadi otomatis untuk invoice Rp 0 yang lunas normal.

Diverifikasi: precondition dicek dulu (`status='pending'`, belum ada `voucher_redemptions`
untuk invoice ini) sebelum menulis apa pun. Hasil akhir dikonfirmasi via SELECT — invoice
`paid`/`total=0`, registrasi `EVT-202608-00022` (Yusbiantoro, `confirmed`), `used_count`
voucher naik jadi 4. **Koreksi ini dijalankan LANGSUNG di production (tenant `visikita`)** —
bukan di lokal, karena datanya memang cuma ada di production.

**Verifikasi kode**: `tsc --noEmit` bersih, `bun run build --filter=@jalajogja/web` genuine
sukses (dev server dimatikan+`.next` dibersihkan+direstart). File disentuh:
`apps/web/components/billing/checkout-form.tsx` (guard baru di `doCheckout()`). Nol migrasi
DB — murni perbaikan logika client + koreksi data manual satu invoice. **Sudah di-commit,
belum di-deploy ke VPS** — perlu `git pull && bun run build --filter=@jalajogja/web && pm2
restart jalajogja --update-env` di server sebelum fix ini aktif untuk customer berikutnya.

---

## 15. Voucher di Invoice Manual Admin — Buat Baru & Pasca-Buat (2026-08-31)

Menutup item 4 § 10 di atas: admin sekarang bisa menerapkan kode voucher di `/finance/billing/
invoice` untuk **dua skenario**, tanpa perlu edit/cancel invoice untuk memberi diskon.

**1. Saat buat invoice baru** (`createInvoiceAction`) — admin isi kode voucher di form, sistem
preview (`previewInvoiceVoucherAction`, read-only, dipanggil saat klik "Terapkan") lalu
`createInvoiceAction` dibungkus `db.transaction()` — voucher dikunci `FOR UPDATE` +
divalidasi ULANG di dalam transaction (bukan cuma percaya hasil preview) sebelum item+invoice
ditulis. **Sekalian menutup celah atomicity lama**: sebelumnya insert invoice dan insert
invoice_items adalah dua statement lepas tanpa transaction sama sekali — sekarang satu unit atomik.

**2. Ke invoice yang sudah ada** (`applyVoucherToInvoiceAction`) — widget "Terapkan Voucher" di
halaman detail invoice, HANYA tampil kalau `paidAmount === 0` DAN belum pernah pakai voucher
DAN status bukan `paid`/`cancelled`. Scope sengaja sempit — begitu ada pembayaran masuk
sedikit pun, invoice tidak bisa lagi diberi voucher lewat jalur ini (menghindari kompleksitas
recompute status/jurnal untuk invoice yang sudah partial-paid). Mengunci invoice row sebelum
menulis, prinsip sama dengan alur checkout publik.

**File**: `apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts` (kedua action baru
+ rewrite `createInvoiceAction`), `invoice-create-form.tsx` (UI form baru), `invoice-detail-client.tsx`
(widget "Terapkan Voucher"). Reuse penuh core engine yang sudah ada (`findVoucherByCode`,
`countCustomerRedemptions`, `computeVoucherDiscount` dari `@jalajogja/db`) — nol perubahan ke
resolver, nol migrasi DB.

`tsc --noEmit` bersih kedua package + `bun run build --filter=@jalajogja/web` genuine sukses.
**Sudah di-commit, push, dan di-deploy ke VPS** (2026-08-31).

---

## 16. Bug Kritis — Kode Unik Tidak Dinolkan untuk Invoice Manual Admin Rp 0 (2026-08-31)

Laporan user (di hari yang sama § 15 di-deploy): *"kode voucher di input benar ... ketika sudah
create invoice, tagihan nol, tp tagihan kode unik pembayaran masih dianggap belum dibayar."*

**Root cause — dua titik, prinsip § 1 ("Voucher 100% harus Rp 0 TANPA kode unik") tidak pernah
diterapkan ke invoice manual admin, hanya ke `checkoutAction`:**

1. **`createInvoiceAction`** — `uniqueCode = uniqueCodeEnabled ? await generateUniqueCode(tenantDb)
   : 0` dipanggil UNCONDITIONAL, tanpa cek `total > 0`. Invoice dengan `total=0` (voucher
   menghabiskan seluruh tagihan) tetap dapat kode unik nonzero, status tetap `"pending"` —
   `amountDue = total + uniqueCode` (dipakai semua titik konfirmasi pembayaran, lihat
   `docs/arsitektur-kode-unik.md`) jadi tidak pernah 0 meski tampilan total sudah Rp 0.
2. **`applyVoucherToInvoiceAction`** (terapkan voucher ke invoice yang SUDAH ADA) — lebih parah:
   TIDAK PERNAH menyentuh `uniqueCode` sama sekali. Kalau invoice sudah punya kode unik dari
   saat dibuat (total awalnya > 0), lalu voucher diterapkan belakangan sampai `total` jadi 0,
   kode unik LAMA tetap nongol — persis skenario "update invoice" yang dilaporkan user.

**Fix — replikasi pola `isFullyPaid` dari `checkoutAction` (cart/actions.ts) ke KEDUA action**,
via helper baru `applyInvoiceZeroTotalSettlement()` (dipakai bersama, di file yang sama):
- `uniqueCode` di-skip/dinolkan kalau `total <= 0` — tidak pernah digenerate baru
  (`createInvoiceAction`), dan dinolkan eksplisit kalau sebelumnya sudah ada
  (`applyVoucherToInvoiceAction`).
- Invoice langsung ditandai `status: "paid"`, `paidAmount: total` (= "0.00") — TIDAK dibiarkan
  "pending" menunggu admin klik konfirmasi pembayaran Rp 0 secara manual.
- Efek samping "langsung lunas" direplikasi (bukan cuma status): sync `campaigns.collectedAmount`
  untuk item donasi, auto-create `event_registrations` untuk item tiket (reuse
  `createEventRegistrationsFromInvoiceTickets()`, SATU-SATUNYA implementasi — lihat
  `lib/event-registration-sync.server.ts`) dengan guard `sourceType === "event_registration"`
  (alur lama) yang sama dengan `confirmInvoicePaymentAction`. **TIDAK ADA jurnal** — nominal 0,
  tidak ada uang masuk untuk dicatat, konsisten `checkoutAction`.
- Notifikasi WA: `payment_confirmed` (amount "Rp 0") + `event_registered` per tiket — bukan
  `invoice_created` — pola sama `checkoutAction`.
- `activateForumMembershipIfApplicable` SENGAJA TIDAK direplikasi — invoice admin manual tidak
  pernah punya `invoice_items.forGabungRegistration=true` (flag itu murni konsep alur publik
  `/gabung`, lihat `docs/arsitektur-backbone-ikpm.md`), jadi tidak relevan di sini.

**File**: `apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts` — helper baru
`applyInvoiceZeroTotalSettlement()`, `createInvoiceAction` dan `applyVoucherToInvoiceAction`
diperluas. Return type publik `applyVoucherToInvoiceAction` (`ActionResult<{ total: number }>`)
TIDAK berubah — nol perubahan diperlukan di `invoice-detail-client.tsx` (client cukup
`router.refresh()` setelah sukses, status "paid" baru langsung terbaca dari DB).

`tsc --noEmit` bersih kedua package + `bun run build --filter=@jalajogja/web` genuine sukses
(dev server dimatikan+`.next` dibersihkan+direstart, `Cached: 0 cached, 1 total`, 50.5 detik).
Nol migrasi DB. **SUDAH di-commit (`a9feb22`), di-push, dan di-deploy ke VPS** (user konfirmasi
`git pull`+build+`pm2 restart` sukses) — **koreksi data historis 2 invoice production yang
sudah terlanjur "nyantol" (voucher diterapkan sebelum fix ini live) juga sudah dikerjakan
manual** via SQL yang mereplikasi persis logic `applyInvoiceZeroTotalSettlement()`
(`docs/diagnostik/` — invoice `620-INV-202608-00221` dan `620-INV-202608-00105`, tenant
`visikita`, masing-masing dinolkan kode uniknya + di-set `paid` + dibuatkan
`event_registrations`-nya). Belum ada konfirmasi user mencoba skenario BARU (voucher 100% pada
invoice yang genuinely dibuat setelah fix ini live) langsung di admin UI.

## 17. Bug Kritis — Voucher Tidak Match untuk Produk Bervariasi di `applyVoucherToInvoiceAction` (2026-08-31)

**Sama persis dengan § 13 (2026-08-08)** — tapi di fungsi yang BEDA. § 13 memperbaiki
`checkoutAction`/`previewVoucherAction` (cart publik) via `resolveProductCartItem()`. Fungsi
`applyVoucherToInvoiceAction` (§ 15, "Terapkan Voucher" di halaman detail invoice
`/finance/billing/invoice/[id]` — untuk invoice yang SUDAH ADA) dibuat BELAKANGAN (2026-08-31)
dan tidak pernah dapat perbaikan yang sama, meski root cause-nya IDENTIK: item produk
bervariasi tersimpan di `invoice_items.itemId` sebagai `product_variations.id` (benar, untuk
keperluan fulfillment/SKU), sementara `VoucherTargetPicker` hanya pernah menargetkan
`products.id` (produk induk) — dibandingkan mentah-mentah, tidak pernah cocok.

**Ditemukan lewat laporan user + diagnosa data langsung** (bukan tebakan): user laporkan
"voucher untuk produk... tidak bisa dipakai" di invoice `8531135c-c0fc-4ca8-9a44-254d68ebfcbb`
(tenant `visikita`). Query silang `invoice_items` × `vouchers` menunjukkan item "Kaos Spinker
620... — L" punya `item_id = d48d0f8e-...`, sementara voucher `HUTANG2015` (target_type=product)
menargetkan `4fd00c26-...`. Query lanjutan ke `products` mengonfirmasi: `4fd00c26-...` ADALAH
produk induk ("Kaos Spinker 620...", `product_type=variable`), sementara `d48d0f8e-...` TIDAK
ADA di `products` sama sekali — bukti langsung itu adalah `product_variations.id` (varian "L"),
bukan `products.id`. Invoice ini kemungkinan besar dibuat lewat `/toko/pesanan/new`
(`createOrderAction`, yang punya picker varian) — bukan `/finance/billing/invoice/new`
(`searchBillingProductsAction` di alur itu tidak pernah menawarkan variasi individual sama
sekali, jadi kelas bug ini TIDAK relevan untuk `createInvoiceAction`/`previewInvoiceVoucherAction`).

**Fix**: import `resolveProductCartItem` (dari `@jalajogja/db`, helper yang SAMA persis dipakai
§ 13, TIDAK ditulis ulang) ke `finance/billing/actions.ts`. Di `applyVoucherToInvoiceAction`,
sebelum membangun `voucherResolvedItems`, tiap item bertipe `"product"` di-resolve dulu
(`resolveProductCartItem(tx, schema, it.itemId)`) — hasilnya `resolved.productId` (produk induk)
dipakai sebagai `itemId` untuk pencocokan voucher, dan `resolved.mitraId` (resolusi ASLI, bukan
lagi hardcode `null`) menutup sekalian gap eksklusi-mitra yang sama seperti § 13 poin 2. Item
non-product (ticket/donation/custom) tidak disentuh — tidak punya konsep variasi. Urutan array
dipertahankan (`Promise.all` atas `items.map`, bukan reduce/sequential) supaya
`voucherResult.perItemDiscount.get(i)` (di-key by index, dipakai untuk update tiap baris
`invoice_items` setelahnya) tetap sinkron 1:1 dengan `items[i]` — tidak ada pergeseran index.

**`createInvoiceAction`/`previewInvoiceVoucherAction` TIDAK disentuh** — item di alur itu SELALU
berasal dari `searchBillingProductsAction` yang query `products` langsung tanpa join variasi,
jadi `itemId`-nya tidak pernah bisa jadi ID varian di titik itu. Gap mitraId hardcode `null` di
kedua fungsi itu (dicatat di komentar § "createInvoiceAction", baris ~227) TETAP belum
diperbaiki — beda kelas masalah (fungsi itu tidak punya cara resolve ke item DB manapun karena
item-nya belum pernah di-persist saat validasi berjalan), di luar scope perbaikan ini.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web`. `bun run build --filter=@jalajogja/web`
genuine sukses (dev server dimatikan+`.next` dibersihkan+direstart, `Cached: 0 cached, 1 total`,
49.2 detik). Nol migrasi DB — murni perbaikan logika resolusi, reuse helper yang sudah ada, sama
seperti § 13. **Belum di-commit/push/deploy ke VPS, belum diverifikasi lewat klik ulang
"Terapkan Voucher" di invoice `8531135c-...` yang sesungguhnya** — user perlu coba lagi setelah
deploy.
