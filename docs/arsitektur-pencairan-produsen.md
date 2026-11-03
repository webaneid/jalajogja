# Pencairan Dana Produsen — RENCANA (belum ada kode)

> Status: **RENCANA 2026-11-04** — keputusan D1–D8 diberikan user; T1–T6 masih TERBUKA (jawab dulu sebelum kode).
> Konteks: bagi hasil K18–K25 di `docs/arsitektur-produk-produsen.md`; pengiriman per produsen ADR-0005; keuangan `docs/arsitektur-keuangan.md`;
> notifikasi PJ `docs/arsitektur-notifikasi-pengurus.md`. Pembayaran tetap MANUAL (ADR-0002) — tidak ada transfer otomatis lewat API bank.

## 1. Prinsip
Uang bagian produsen **bukan milik tenant** — itu **hutang** tenant kepada produsen (D8). Karena itu pencairan dibangun sebagai **buku besar saldo (ledger)**
per produsen, bukan "transfer per pesanan": tiap pesanan menambah saldo, refund/biaya mengurangi, pencairan mengosongkan. Saldo selalu bisa diaudit
dari baris-barisnya (append-only), dan angka tiap baris dibekukan (snapshot K25) sehingga perubahan persentase/harga kemudian tidak mengubah riwayat.

## 2. Keputusan terkunci (arahan user 2026-11-04)
| # | Keputusan |
|---|---|
| **D1** | **Produsen membayar kurir sendiri** (produsen yang wajib mengirim). Ongkir yang DIBAYAR pembeli diteruskan penuh ke produsen = `invoice_shipping_lines.cost` (snapshot; tanpa input manual). Gratis ongkir (K39) → ongkir pembeli Rp0 → tidak ada yang diteruskan; produsen menanggung ongkirnya. Selisih ongkir kutipan vs tagihan kurir sebenarnya = risiko/untung produsen, TIDAK mengubah angka pencairan → tenant tidak pernah menombok ("over budget" mustahil by design). |
| **D2** | Pesanan **selesai** = **pembeli mengonfirmasi** barang diterima. Bila pembeli lupa: pelacakan RajaOngkir dipakai sebagai patokan (lihat T2 — kuota API sangat terbatas) dan ada batas waktu otomatis. |
| **D3** | Pembayaran dieksekusi **hanya hari Senin** (satu batch mingguan) — karena keterbatasan SDM tenant. |
| **D4** | **Biaya transfer ditanggung produsen**, dipotong dari pencairannya (contoh: BRI → BCA ±Rp7.500). Besarnya diatur tenant (T4). |
| **D5** | **Minimum pencairan Rp200.000** (saldo yang bisa dicairkan). |
| **D6** | Yang menyetujui **Bendahara atau Ketua** (salah satu cukup). Usulan pengaman: pengurus yang sekaligus produsen tidak boleh menyetujui pencairannya sendiri. |
| **D7** | **Refund setelah dana cair → menjadi hutang produsen.** Dua cara pelunasan: (a) **dipotong otomatis** dari pencairan/pesanan berikutnya, atau (b) **produsen mentransfer** dan bendahara mencatat penerimaannya. Refund SEBELUM cair hanya membatalkan kredit pesanan itu. |
| **D8** | Bagian produsen = **hutang tenant** (akun kewajiban "Hutang Produsen"), bukan pendapatan. Dicatat sejak pembayaran pembeli dikonfirmasi (preseden: donasi → "Dana Titipan" 2200 lewat `resolveIncomeSplitForBilling`, `finance/actions.ts`). |

Asumsi (belum dibantah user): kode unik transfer TIDAK dibagi (hanya identifikasi pembayaran, milik tenant); pesanan batal sebelum dikirim = refund penuh tanpa dampak ke produsen.

## 3. Komponen uang per pengiriman (satu invoice × satu produsen)
```
Uang produk produsen = Σ baris:  dasar × (100 − persen_tenant)/100  −  (potongan voucher bila penanggungnya produsen)
   dasar   = harga satuan setelah diskon anggota × jumlah, SEBELUM voucher     (K25; = total + discount_amount)
   persen  = invoice_items.producer_share_percent (snapshot)   penanggung = invoice_items.discount_funded_by (K23)
Ongkir diteruskan    = invoice_shipping_lines.cost (setelah gratis ongkir; D1)
Kredit pesanan       = uang produk + ongkir
Saat dicairkan:  − hutang refund yang dipotong (D7a)  − biaya transfer (D4)  = DITRANSFER
```
Rumus dihitung SERVER dari baris yang tersimpan — tidak pernah dari input klien.

## 4. Siklus kredit pesanan
`Dibayar (lunas)` → **Menunggu** (saldo tertahan; terlihat produsen) → pesanan **selesai** (D2) → **Bisa dicairkan** → masuk batch Senin → **Dibayar**.
Refund/pembatalan saat **Menunggu** → kredit dibatalkan. Refund saat **Bisa dicairkan** → kredit dibatalkan. Refund setelah **Dibayar** → hutang (D7).
Pengajuan pencairan: `diajukan → disetujui (bendahara/ketua) → ditransfer (bukti diunggah) → selesai`, atau `ditolak/dibatalkan` (saldo kembali).

## 5. Model data (usulan; migration additif, aman tenant lama)
- `producer_ledger_entries` (append-only): `producer_id, kind (sale|shipping|refund_debt|transfer_fee|payout|adjustment), amount (bertanda), invoice_id, shipping_line_id, status (pending|available|reserved|paid|void), available_at, payout_id, note`. **Unik per (`shipping_line_id`, `kind`)** agar tidak pernah ganda (idempoten).
- `producer_bank_accounts`: bank, no. rekening (**terenkripsi** seperti kunci SMTP), nama pemilik, `effective_at` (jeda aktif), riwayat.
- `producer_payouts`: nomor, `producer_id`, bruto, potongan hutang, biaya transfer, neto, `scheduled_for` (Senin), status, snapshot rekening, `requested_at`, `approved_by/at`, `paid_at`, bukti, `disbursement_id`.
- `invoice_shipping_lines`: `buyer_confirmed_at`, `completion_source (buyer|tracking|auto)`.
- Pengaturan tenant (`settings`, group `payment`/`toko`): minimum, biaya transfer, hari eksekusi, cut-off, batas otomatis selesai.
- Tabel riwayat persentase bagi hasil (utang lama K20) ikut fase ini.

## 6. Alur uang ke Keuangan
- Pembayaran dikonfirmasi: kredit **Hutang Produsen** sebesar bagian produsen (produk + ongkir), sisanya pendapatan toko — perluasan `resolveIncomeSplitForBilling` (satu sumber kebenaran, jangan 5 implementasi — lihat lesson kode unik/voucher).
- Pencairan dibayar: debit Hutang Produsen, kredit Kas/Bank (+ biaya transfer yang dipotong tidak menjadi biaya tenant: nominal transfer sudah neto). Otomatis via `disbursements` (`purposeType` baru `producer_payout`) + jurnal.
- Refund: balik jurnal sesuai sumbernya; hutang refund tercatat di ledger, bukan piutang akuntansi sampai diputuskan bendahara.
- Perlu akun baru "Hutang Produsen" (kewajiban) di bagan akun default + migration tenant aktif + mapping di Pengaturan Keuangan.

## 7. Notifikasi & SLA
Pengajuan masuk → bendahara & ketua (kanal PJ yang sudah ada: WA bila aktif, jika tidak email; tautan verifikasi tanpa login seperti verifikasi pembayaran). Produsen dikabari saat disetujui / ditolak / dibayar (+ bukti). Pengingat ke bendahara bila lewat jadwal Senin. Target proses: dieksekusi pada Senin jadwalnya (D3), bukan "3 hari".

## 8. Keamanan (wajib)
`producerId` dari SESI (`getProducerAccess`, fail-closed T&C); nominal HANYA hitung server; pengajuan atomik (kunci advisory per produsen, satu pengajuan aktif); idempoten (unik ledger); rekening: nama pemilik wajib, perubahan baru aktif setelah jeda + notifikasi ke bendahara; persetujuan memakai `hasFullAccess(keuangan)` dan menolak persetujuan atas pencairan sendiri; semua perubahan status tercatat (siapa/kapan); batas laju; tidak ada endpoint webhook/transfer otomatis (ADR-0002).

## 9. Pembagian PR (urut; tiap PR: type-check → audit → commit)
| PR | Isi |
|---|---|
| **C1** | Ledger + saldo di portal produsen (Menunggu / Bisa dicairkan), konfirmasi "Barang diterima" oleh pembeli, otomatis selesai (T2), akun Hutang Produsen + split jurnal, riwayat persentase |
| **C2** | Rekening produsen + pengaturan pencairan tenant |
| **C3** | Pengajuan + persetujuan + batch Senin + disbursement + jurnal + bukti |
| **C4** | Notifikasi bendahara/produsen + pengingat |
| **C5** | Refund → hutang, pelunasan (potong otomatis / transfer) |

## 10. TERBUKA — dijawab user sebelum kode
- **T1** Masa tahan setelah "selesai": langsung bisa dicairkan (usul) atau tambah N hari?
- **T2** Bila pembeli tak konfirmasi: tracking RajaOngkir menyatakan "delivered" → selesai (usul +2 hari), dan batas otomatis N hari sejak dikirim (usul 10 hari). **Kuota gratis RajaOngkir = 100 panggilan/hari dibagi SEMUA tenant** (`docs/arsitektur-alamat.md` § 21) — pengecekan massal tidak boleh; usul: jatah `track` terpisah dalam `ro_api_usage`, hanya pengiriman yang lewat hari ke-3 tanpa konfirmasi, maks. sekali sehari per pengiriman.
- **T3** Cut-off pengajuan agar ikut Senin (usul: Minggu 23.59 WIB).
- **T4** Biaya transfer: dua angka — sesama bank (usul Rp0) dan beda bank (usul Rp7.500) — diatur tenant?
- **T5** Pengajuan manual oleh produsen (usul, sesuai permintaan awal) — atau semua saldo ≥ minimum otomatis masuk daftar Senin?
- **T6** Hutang refund yang tak kunjung bisa dipotong (produsen berhenti berjualan): ditagih di luar sistem — cukup dicatat dan ditandai?
