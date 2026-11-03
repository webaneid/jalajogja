# Pencairan Dana Produsen — RENCANA (belum ada kode)

> Status: **RENCANA 2026-11-04** — keputusan D1–D8 + jawaban T1–T6 (putaran 2) sudah masuk; SEMUA pertanyaan terjawab (T7–T8, D12) — siap mulai C1 bila user bilang mulai.
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
| **D3** (direvisi putaran 2) | Janji ke produsen: pengajuan diproses **maksimal 3 hari kerja** (informasi, bukan batas teknis). Bila bendahara siap, boleh dicairkan LEBIH CEPAT kapan saja. Hari Senin = jadwal standar tenant untuk memproses & pengingat ke bendahara (keterbatasan SDM), bukan pembatas sistem. |
| **D4** | **Biaya transfer ditanggung produsen**, dipotong dari pencairannya. Ada KOLOM biaya transfer saat bendahara memproses: terisi otomatis **Rp0 bila sesama bank, Rp7.500 (bawaan; diatur tenant) bila beda bank** — dideteksi dari kode bank rekening produsen vs rekening sumber yang dipilih bendahara — dan bendahara boleh mengubahnya sebelum konfirmasi (dengan batas atas). Nilai akhir disimpan sebagai snapshot di pencairan. |
| **D5** | **Minimum pencairan Rp200.000** (saldo yang bisa dicairkan). |
| **D9** (baru) | **Pencairan per KELOMPOK PENGIRIMAN** (satu invoice × satu produsen). Setiap pengiriman punya status sendiri: Menunggu → Bisa dicairkan → Diajukan → **Sudah dicairkan (nomor pencairan)**, sehingga jelas pengiriman mana yang sudah/belum cair. Produsen **mengajukan** pencairan (manual) sesuai haknya dan melihat **laporan lengkap per pengiriman**: harga dibayar pembeli, persentase tenant, bagian produsen, ongkir diteruskan, potongan hutang/biaya transfer, total. |
| **D10** (baru) | **Pengingat saldo menganggur:** bila ada saldo ≥ minimum yang bisa dicairkan tetapi tak ada pengajuan selama **30 hari**, kirim **email** ke produsen (bukan WA) memberi tahu nominalnya dan mengajak mengajukan; diulang paling sering sekali per 30 hari. |
| **D2b** | Otomatis selesai bila pembeli lupa: **maksimal 10 hari sejak dikirim**; "lebih cepat lebih baik" → bila pelacakan RajaOngkir menyatakan terkirim, selesai +2 hari (dalam anggaran kuota § 10 T2). **Tanpa masa tahan tambahan** setelah selesai (T1). |
| **D12** (putaran 3) | **Satuan pencairan = PENGIRIMAN** (satu invoice × satu produsen = `invoice_shipping_lines` per produsen), BUKAN produk dan BUKAN batch. Alasan: peristiwa "selesai" (barang diterima/terlacak) dan ongkir melekat pada paket; batch pengiriman hanya pengelompokan operasional produsen (cetak label, bisa memuat banyak invoice & berubah) sehingga tak cocok jadi dasar uang. **Tampilan tetap berurutan Produk → Pesanan → Dibayar → Bagi hasil**: satu baris pengiriman bisa dibuka dan menampilkan baris produknya masing-masing (harga dibayar, persen tenant, bagian produsen). Perhitungan memang per baris produk (snapshot K25) lalu dijumlah per pengiriman; refund satu produk = baris ledger pengurang untuk produk itu saja. |
| **D13** | **Ongkir = milik produsen penuh** (T7 jawaban user): ongkir yang dibayar pembeli diteruskan seluruhnya ke produsen (D1), produsen menanggung biaya kurir. Tak ada input ongkir aktual. |
| **D14** (putaran 4) | **Gratis ongkir & voucher MENGURANGI keuntungan penanggungnya — tanpa pemotongan tambahan.** Gratis ongkir: pembeli membayar ongkir lebih kecil/Rp0 → ongkir yang diteruskan ke produsen (D13) ikut lebih kecil/Rp0, sementara produsen tetap membayar kurir sendiri (D1) → selisihnya otomatis jadi biaya produsen. Voucher: sudah diatur K23 — Promo Produsen mengurangi bagian produsen, Promo Tenant mengurangi bagian tenant (snapshot `discount_funded_by`). Sistem hanya MENAMPILKAN (info) "Ongkir yang Anda tanggung (gratis ongkir)" = `invoice_shipping_lines.free_shipping_discount` di laporan per pengiriman; angka itu kutipan, bukan tagihan kurir, jadi TIDAK dipakai menghitung pencairan. **Admin tidak ikut campur**: untuk produk milik produsen, gratis ongkir hanya diatur produsen (kartu di form admin hanya terbaca; server `updateProductAction`/`createProductAction` mengabaikan nilai dari admin, dan mereset ke "tidak" bila pemilik produk berpindah). Kesepakatan yang mengikat admin–produsen hanya bagi hasil. |
| **D11** | **Pengajuan manual oleh produsen** (T5); batas Hutang refund tak terlunasi: cukup dicatat & ditandai, ditagih di luar sistem (T6). |
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
- `producer_payout_lines`: snapshot per kelompok pengiriman (`shipping_line_id`, harga dibayar, persen, bagian produsen, ongkir, status cair + `payout_id`) — dasar laporan lengkap D9.
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

## 10. Status pertanyaan
Terjawab (putaran 2): T1 tanpa masa tahan; 3 hari = informasi SLA maksimal, bendahara boleh lebih cepat (D3). T2 10 hari maksimal, lebih cepat lebih baik (D2b) — pelacakan dibatasi anggaran: jatah `track` terpisah di `ro_api_usage` (kuota gratis RajaOngkir **100 panggilan/hari dibagi SEMUA tenant**, `docs/arsitektur-alamat.md` § 21), hanya pengiriman yang lewat hari ke-3 tanpa konfirmasi, maks. sekali/hari per pengiriman. T3 cut-off dibatalkan oleh D3 revisi (tak ada batch kaku). T4 kolom biaya transfer (D4). T5 manual (D11). T6 dicatat saja (D11).
**TERBUKA:**
- ~~**T7**~~ (TERJAWAB: D13) "Ongkir aktual" pada laporan per pengiriman = **ongkir yang dibayar pembeli** (usul/D1; angka dari checkout, tanpa input) — atau **tagihan kurir sebenarnya** yang diinput produsen? Bila yang kedua, butuh bukti + batas atas agar tidak melebihi anggaran (ongkir kutipan), dan ini mengubah D1.
- ~~**T8**~~ (TERJAWAB: setuju, D3) Konfirmasi aturan waktu: SLA "maks. 3 hari kerja" ditampilkan ke produsen; hari Senin hanya jadwal standar/pengingat digest ke bendahara (tak ada cut-off Minggu). Setuju?

## 11. Draf teks email pengingat saldo (D10)
Subjek: `Saldo Anda di {Tenant} siap dicairkan — Rp {nominal}`
Isi: "Halo {nama}, saat ini ada **Rp {nominal}** dari {n} pengiriman yang sudah selesai dan siap Anda cairkan. Dana ini hak Anda dan tersimpan di {Tenant}. Silakan ajukan pencairan lewat Portal Produsen → Pencairan; pengajuan diproses paling lambat 3 hari kerja. [Ajukan Pencairan]" (tautan ke portal; tanpa data rekening di email).
