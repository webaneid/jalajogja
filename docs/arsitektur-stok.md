# Arsitektur Stok Produk

> Status: **✅ Kode SELESAI (2026-09-09).** `bun run type-check` 0 error di semua workspace.
> Migration sudah jalan di dev lokal. Security review (`jalakarta-security-review` via subagent
> `security-auditor`) sudah dijalankan — 2 temuan (1 Critical, 1 Medium), keduanya sudah diperbaiki
> (lihat § "Temuan Security Review" di bawah). **Belum di-commit/push, belum dijalankan di VPS,
> belum diverifikasi visual di browser** (perlu login admin — tidak ada kredensial di sesi ini).
> **Belum ada test end-to-end sungguhan** (checkout produk → bayar → cek stok berkurang) —
> cuma dicek lewat baca-kode-teliti + type-check, bukan uji manual.

## Masalah yang Diselesaikan

Investigasi 2026-09-09 menemukan: **stok produk (`products.stock` / `product_variations.stock`)
tidak pernah berkurang sama sekali di jalur pembelian publik** (cart → checkout → invoice →
konfirmasi bayar).

- Pengurangan stok **hanya ada** di alur lama `orders` table
  (`confirmOrderPaymentAction`/`cancelOrderAction` di `toko/actions.ts:1002-1127`) — dipakai
  kalau admin bikin pesanan manual sendiri. **Tidak disentuh** di eksekusi ini — sudah benar,
  refactor-ke-helper-bersama sengaja DIBATALKAN untuk minimalkan risiko regresi ke kode yang
  sudah jalan (lihat § "Keputusan yang Diambil Saat Eksekusi" poin 1).
- Alur modern (cart universal → invoice, yang benar-benar dipakai front-end publik) — `grep
  "stock"` di `cart/actions.ts`, `finance/billing/actions.ts` sebelumnya **nol hasil**. Ini yang
  ditutup di eksekusi ini.
- Produk simple (`isOutOfStock` di-hardcode `false` di `product-detail-client.tsx`) tidak pernah
  menolak beli meski stok 0 — root cause-nya lebih dalam dari sekadar logic salah: tipe data
  `ProductCardData` (dipakai halaman detail produk) **tidak punya field stok sama sekali** untuk
  produk simple. Sudah diperbaiki.

## Keputusan Bisnis (dari user, 2026-09-09 — final, bukan lagi opsi)

1. **Stok fisik HANYA berkurang saat invoice `paid`** — bukan saat checkout/pending.
2. **Notifikasi "stok habis"** — silent selain itu, cuma dikirim ke **pemesan** (bukan admin)
   kalau stok invoice pending-nya ternyata sudah tidak cukup lagi (laku duluan ke orang lain).
   Pesan: *"Stock produk telah habis, silahkan konfirmasi terlebih dahulu sebelum Anda
   melakukan pembayaran."* Channel: WA dan/atau Email, tergantung fasilitas yang tenant sudah
   setup — bukan wajib dua-duanya.
3. **Reminder jatuh tempo** — TETAP jalan seperti sebelumnya (H-1, cron `invoice-reminder`),
   tidak diubah.
4. **Toggle baru "Auto-cancel Pesanan"** di `/toko/pengaturan` (khusus invoice dengan item
   produk — BUKAN kebijakan invoice-wide, sengaja tidak disatukan dengan `dueDate`
   donasi/tiket event):
   - **OFF** (default) → persis seperti sebelumnya: invoice pending yang lewat jatuh tempo
     dibiarkan menggantung, tidak ada aksi otomatis. Notifikasi stok-habis (poin 2) tetap jalan
     terlepas toggle ini.
   - **ON** → setting durasi tambahan (default **2 hari** setelah `dueDate` lewat). Begitu
     terlewati tanpa pembayaran: invoice **otomatis dibatalkan** + notifikasi ke pemesan
     *"Pesanan Anda telah dibatalkan."*
5. **Invoice yang dibatalkan (manual maupun auto-cancel) bisa diaktifkan kembali oleh admin** —
   sistem cek dulu apakah stok masih tersedia sebelum mengizinkan.

## Desain Teknis

### Stok tersedia — computed, bukan kolom tersimpan
```
stok_tersedia = stok_fisik − SUM(qty invoice_items produk ini
                                  WHERE invoice.status IN ('pending','waiting_verification','partial'))
```
Dihitung ulang tiap dibutuhkan (checkout, tampilan publik, reaktivasi) — BUKAN kolom yang
disimpan, menghindari kelas bug "reservasi drift" (persis pola bug kode-unik/voucher yang sudah
3x kejadian independen di project ini, lihat `docs/arsitektur-voucher.md` § 16-18).

### Helper bersama — `packages/db/src/helpers/stock.ts`
Satu-satunya tempat baca/ubah `products.stock`/`product_variations.stock` dari alur invoice:
- `getAvailableStock(db, schema, itemId, opts?)` — stok tersedia untuk satu produk/variasi.
  `itemId` bisa `products.id` ATAU `product_variations.id` (dicoba produk dulu, fallback
  variasi — pola sama `resolve-product-item.ts`).
- `checkStockAvailability(tx, schema, items)` — **hard gate**, dipanggil di checkout
  (`cart/actions.ts`) dan reaktivasi invoice (`reactivateInvoiceAction`). Mengunci baris
  produk/variasi (`FOR UPDATE`, sintaks sama dengan lock cart yang sudah ada) sebelum menghitung
  — checkout dua orang hampir bersamaan jadi serial di baris stok yang sama.
- `decrementStockForInvoiceItems(tx, schema, items)` — **tidak pernah menolak**, clamp ke 0
  (`GREATEST`). Dipanggil di SEMUA titik transisi invoice → `paid` (6 lokasi, lihat § "Titik
  Panggil Decrement" di bawah). Admin yang eksplisit konfirmasi bayar (COD, invoice manual,
  dst) tetap final authority — tidak diblokir mekanisme stok.
- `restoreStockForInvoiceItems(tx, schema, items)` — kebalikan decrement, untuk refund invoice
  yang sudah paid. **Belum ada caller** — project ini belum punya fitur refund invoice paid sama
  sekali (`cancelInvoiceAction` cuma bisa membatalkan invoice yang `paidAmount = 0`, jadi tidak
  pernah ada yang perlu dikembalikan). Disediakan untuk simetri API + kalau fitur refund
  dibangun nanti, tinggal panggil ini — bukan dead code yang perlu dihapus.
- `getProductInvoiceItems(db, schema, invoiceId)` — ambil item produk dari satu invoice.

### Titik Panggil Decrement (6 lokasi, semua di `finance/billing/actions.ts` + `cart/actions.ts`)
| Lokasi | Kondisi |
|---|---|
| `checkoutAction` (`cart/actions.ts`) | Invoice langsung lunas (voucher 100%/Rp 0) |
| `applyInvoiceZeroTotalSettlement()` (dipanggil 2x: `createInvoiceAction` + `applyVoucherToInvoiceAction`) | Invoice manual admin langsung lunas |
| `confirmInvoicePaymentAction` | Admin konfirmasi bayar manual, `newStatus === "paid"` |
| `verifySubmittedPaymentAction` | Admin verifikasi bukti transfer customer, `newStatus === "paid"` |
| `confirmCodPaymentAction` | COD dikonfirmasi, `newStatus === "paid"` — **scoped ke `sellerType='tenant'` saja**, item mitra TIDAK ikut (di luar tanggung jawab action ini) |

`applyInvoiceZeroTotalSettlement()` sengaja dipilih sebagai SATU titik untuk 2 pemanggilnya
(bukan panggil `decrementStockForInvoiceItems` terpisah di `createInvoiceAction` DAN
`applyVoucherToInvoiceAction`) — fungsi ini sudah ada sebelumnya sebagai tempat terpusat efek
samping "invoice baru saja jadi paid Rp 0" (sync donasi, auto-create tiket event), stok tinggal
ikut pola yang sama.

### Checkout — validasi (soft, bukan hard lock lintas-invoice)
`checkoutAction` (`cart/actions.ts`) memanggil `checkStockAvailability` SEBELUM invoice dibuat —
menolak checkout kalau qty diminta melebihi stok tersedia. **Bukan jaminan mutlak** — 2 checkout
hampir bersamaan tetap bisa sama-sama lolos kalau stoknya cukup untuk masing-masing sendiri tapi
tidak untuk keduanya sekaligus. Itu ditutup oleh notifikasi stok-habis (cron), bukan lock
lintas-invoice yang jauh lebih kompleks — trade-off yang disengaja, konsisten dengan prinsip
"stok fisik cuma berkurang saat paid" (kalau ada 2 invoice pending untuk unit terakhir yang
sama, keduanya SAH ada sampai salah satu benar-benar dibayar duluan).

### Reaktivasi invoice dibatalkan — `reactivateInvoiceAction`
Baru, di `finance/billing/actions.ts`, tombol "Aktifkan Kembali" muncul di
`invoice-detail-client.tsx` untuk invoice berstatus `cancelled`. Panggil
`checkStockAvailability` — **hard gate**, ditolak kalau stok sudah tidak cukup. Invoice yang
dibatalkan SELALU `paidAmount = 0` (`cancelInvoiceAction` maupun cron auto-cancel keduanya cuma
menyentuh invoice yang belum ada pembayaran) — jadi TIDAK PERNAH ada stok fisik yang perlu
dikembalikan saat reaktivasi, murni pindah status `cancelled` → `pending` + `dueDate` baru
(+3 hari dari sekarang, supaya tidak langsung ke-cancel lagi di cron berikutnya kalau
auto-cancel aktif).

### Setting toko — `lib/toko-settings.ts` (`TokoSettings`)
- `autoCancelEnabled: boolean` (default `false`)
- `autoCancelDaysAfterDue: number` (default `2`)
Disimpan di `settings` group `"toko"`, key `auto_cancel_enabled`/`auto_cancel_days_after_due` —
pola persis sama dengan `codEnabled`/`pickupEnabled` yang sudah ada. UI di
`toko-settings-form.tsx`, section baru "Auto-cancel Pesanan Belum Dibayar".

### Cron baru — `apps/web/app/api/cron/stock-check/route.ts`
Pola identik `invoice-reminder` (auth `x-cron-secret`, loop tenant aktif). Dua pekerjaan:
1. **Stok habis** — scan invoice pending dengan item produk, `stockAlertSentAt IS NULL`. Untuk
   tiap item, hitung `getAvailableStock(..., {excludeInvoiceId})` — kalau kurang dari qty
   invoice ini, kirim notifikasi (sekali, guard kolom `stockAlertSentAt`), TIDAK mengubah status
   invoice apa pun.
2. **Auto-cancel** — HANYA kalau `tokoSettings.autoCancelEnabled`. Invoice pending dengan item
   produk yang `dueDate <= (hari ini − autoCancelDaysAfterDue)` → status jadi `cancelled` +
   notifikasi.

**⚠️ Perlu didaftarkan manual di crontab VPS** — repo ini tidak punya daftar crontab
ter-version-control (cron lain seperti `invoice-reminder` juga cuma didaftarkan langsung di
VPS, bukan di kode). Tambahkan baris baru mengikuti pola cron lain yang sudah jalan, jadwal
harian.

### Notifikasi — `apps/web/lib/notify-customer.ts` (BARU)
Dispatcher WA+Email ke pemesan (bukan admin) — `notifyStockOut()` dan
`notifyOrderAutoCancelled()`. Masing-masing coba KEDUA channel independen:
- WA lewat `notifyWa()` yang sudah ada (2 event baru: `product_stock_out`,
  `order_auto_cancelled` — didaftarkan di `WaNotifKey`, `WA_TEMPLATE_DEFAULTS`
  (`lib/wa-templates.ts`), dan toggle UI `/settings/notifications`
  (`whatsapp-setup-client.tsx`) — default OFF, tenant wajib aktifkan sendiri seperti semua
  event WA lain).
- Email lewat `sendTenantMail()` yang SUDAH ADA (`lib/mail.ts`) tapi SEBELUMNYA cuma dipakai
  tombol "Test Email" — sekarang pertama kalinya dipakai untuk notifikasi transaksi
  sungguhan. Ambil `smtp_config` dari `settings` group `"mail"` (BUKAN `"email"` — nama group
  di kode beda dari nama route `/settings/email`, lihat catatan di bawah).
- Keduanya sudah handle "belum dikonfigurasi" secara graceful (return early, tidak throw) —
  dispatcher tidak perlu pre-check konfigurasi sendiri, cukup coba dan biarkan yang tidak
  terkonfigurasi diam-diam tidak terkirim.

### Tampilan publik — `product-detail-client.tsx` + `produk/[productSlug]/page.tsx`
- `ProductCardData` (`lib/product-card-templates.ts`) dapat field baru `availableStock?: number
  | null` — OPSIONAL, cuma diisi di halaman detail produk (card grid/list/related TIDAK
  mengisi, sengaja, tidak perlu tampilan stok di situ).
- Produk simple: `availableStock` dihitung server-side (`getAvailableStock`), dikirim ke client.
  `isOutOfStock` sekarang benar-benar mengecek angka ini (sebelumnya hardcode `false`).
- Produk variable: nilai `stock` per variasi (field yang SUDAH ada di `ProductVariationData`)
  sekarang diisi stok TERSEDIA, bukan stok fisik mentah — client-side logic (yang sudah benar
  sebelumnya) tidak perlu diubah sama sekali, cuma angka yang mengalir masuk yang dikoreksi.
- Blok tampilan "Stok: N" (`stockInfo`) diperluas — sebelumnya cuma tampil untuk variasi yang
  sudah dipilih, sekarang tampil juga untuk produk simple.
- Halaman ini `export const revalidate = 60` (ISR) — angka stok bisa basi sampai 60 detik, itu
  wajar untuk tampilan (bukan titik validasi otoritatif, itu di checkout).

## Keputusan yang Diambil Saat Eksekusi (penyesuaian dari rencana awal)

1. **TIDAK merefactor alur `orders` lama** (`confirmOrderPaymentAction`/`cancelOrderAction` di
   `toko/actions.ts`) untuk pakai helper bersama — rencana awal mengusulkan ini demi konsistensi,
   tapi kode itu SUDAH BENAR dan sudah teruji, jadi menyentuhnya cuma menambah risiko regresi
   tanpa manfaat fungsional (user tidak minta perbaikan di situ, cuma minta yang di alur invoice
   yang memang belum ada). Helper baru di `packages/db/src/helpers/stock.ts` KHUSUS dipakai alur
   invoice yang sebelumnya nol logic.
2. **TIDAK menyatukan `stock_reservation_days` dengan `dueDate` invoice donasi/tiket event** —
   rencana awal mengusulkan satu setting global. Keputusan final user: toggle auto-cancel
   scoped ke Toko saja (setting baru di `/toko/pengaturan`), invoice non-produk tidak
   terpengaruh sama sekali. `dueDate` invoice (hardcoded +3 hari di `checkoutAction`/
   `createInvoiceAction`) TIDAK diubah — reminder H-1 tetap pakai itu seperti sebelumnya, auto-
   cancel pakai perhitungan terpisah (`dueDate + autoCancelDaysAfterDue`).
3. **Admin TIDAK dinotifikasi** — rencana awal merekomendasikan admin+customer. Keputusan final
   user: cuma pemesan (customer), lewat WA dan/atau Email tergantung fasilitas tenant.
4. **Tidak ada perubahan di `product-table-client.tsx`** (menampilkan stok_fisik vs
   stok_tersedia berdampingan) — item ini di rencana awal § 7, TIDAK dikerjakan untuk
   minimalkan scope (bukan bagian dari permintaan fungsional inti). Admin saat ini cuma lihat
   `stock` (fisik) di tabel produk — kalau nanti dianggap membingungkan (angka publik beda dari
   yang admin lihat), ini follow-up terpisah.

## File yang Disentuh
```
packages/db/src/helpers/stock.ts                              → BARU
packages/db/src/index.ts                                      → export helper stok
packages/db/src/schema/tenant/billing.ts                      → kolom stockAlertSentAt
packages/db/src/helpers/create-tenant-schema.ts                → DDL stock_alert_sent_at
packages/db/migrations/0064_invoice_stock_alert.sql            → BARU, migration tenant existing
apps/web/app/(public)/[tenant]/cart/actions.ts                 → checkStockAvailability + decrement saat lunas-langsung
apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts → decrement di 6 titik paid + reactivateInvoiceAction BARU
apps/web/app/(dashboard)/app/[tenant]/toko/pengaturan/actions.ts → validasi+simpan auto_cancel_*
apps/web/app/(dashboard)/app/[tenant]/toko/pengaturan/toko-settings-form.tsx → UI toggle+input
apps/web/lib/toko-settings.ts                                  → field autoCancelEnabled/autoCancelDaysAfterDue
apps/web/lib/notify-customer.ts                                → BARU — dispatcher WA+Email ke pemesan
apps/web/lib/wa-templates.ts                                   → 2 template baru
apps/web/lib/whatsapp.ts                                       → 2 WaNotifKey + WA_NOTIF_DEFAULTS baru
apps/web/components/settings/whatsapp-setup-client.tsx         → 2 toggle baru di UI notifikasi
apps/web/app/api/cron/stock-check/route.ts                     → BARU
apps/web/components/keuangan/billing/invoice-detail-client.tsx → tombol "Aktifkan Kembali"
apps/web/app/(public)/[tenant]/produk/[productSlug]/page.tsx   → hitung+kirim availableStock
apps/web/components/toko/public/product-detail-client.tsx      → pakai availableStock, fix isOutOfStock
apps/web/lib/product-card-templates.ts                         → field availableStock opsional
docs/arsitektur-stok.md                                        → dokumen ini
docs/arsitektur-product.md                                     → pointer ke dokumen ini
```

## Temuan Security Review (2026-09-09)

Dijalankan via subagent `security-auditor` (skill `jalakarta-security-review`) terhadap semua
file baru/diubah di fitur ini. 2 temuan, keduanya sudah diperbaiki di sesi yang sama:

1. **CRITICAL — `addToCartAction` tidak memvalidasi `quantity`** (`cart/actions.ts`). Action
   publik ini cuma validasi `name`+`unitPrice`, `quantity` dari client dipakai mentah — bisa
   dikirim negatif (bypass UI, panggil action langsung) untuk membatalkan/membalik hard-gate
   `checkStockAvailability` yang baru dibangun, bahkan berpotensi MENAMBAH stok tanpa
   pembayaran lewat `decrementStockForInvoiceItems` dengan qty negatif pada jalur lunas-Rp0.
   Ini gap PRA-EXISTING di `addToCartAction` (bukan diperkenalkan fitur stok), tapi baru jadi
   berbahaya sekarang karena hard-gate stok bergantung pada `quantity` yang valid. **Fix**:
   tambah validasi `Number.isInteger(quantity) && quantity >= 1` di awal action, diterapkan ke
   jalur insert baru maupun update qty item existing.
2. **MEDIUM — auto-cancel di cron `stock-check` update status invoice tanpa lock/re-cek
   status** (`api/cron/stock-check/route.ts`). Beda dari SEMUA transisi status invoice lain di
   codebase ini (yang selalu `FOR UPDATE` + re-cek status di dalam transaction), loop
   auto-cancel langsung `UPDATE` invoice hasil `SELECT` sebelumnya tanpa lock — race window
   nyata dengan `submitPaymentProofAction`/`confirmInvoicePaymentAction` yang berjalan hampir
   bersamaan (bukti bayar/pelunasan yang sah bisa tertimpa jadi `cancelled`). **Fix**: dibungkus
   `tdb.transaction()`, lock invoice `FOR UPDATE`, re-cek status masih `PENDING_STATUSES`
   sebelum update — pola sama `reactivateInvoiceAction`/`cancelInvoiceAction`.

## Belum Dikerjakan (batas jujur, bukan lupa)
- Tampilan admin `stok_fisik` vs `stok_tersedia` berdampingan (§ "Keputusan yang Diambil" poin 4).
- Registrasi cron baru di crontab VPS — instruksi manual, bukan bagian kode.
- Verifikasi visual di browser (login admin) dan uji end-to-end sungguhan (checkout produk asli
  → bayar → cek stok berkurang, cek notifikasi WA/Email benar-benar terkirim).
