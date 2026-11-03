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

## 12. RENCANA TEKNIS C1 (2026-11-04) — dibagi C1a (ledger/portal) dan C1b (akuntansi)
Temuan penyelidikan kode yang menentukan rancangan:
- **Tombol "Konfirmasi Sudah Diterima" pembeli SUDAH ada** (`confirmDeliveryAction`, `app/(public)/[tenant]/actions.ts`, tampil di `/akun/transaksi`) tetapi hanya mengubah `status → delivered`. Status `delivered` juga bisa diisi admin/produsen → **tak boleh dijadikan dasar uang**. Ditambah kolom `buyer_confirmed_at` yang HANYA diisi aksi pembeli itu.
- **Saldo "Menunggu" tidak perlu baris ledger**: dihitung saat dibaca dari invoice lunas + pengiriman produsen yang belum selesai. Baris ledger dibuat HANYA saat pengiriman **selesai** (idempoten, unik) → hanya satu titik tulis, bukan lima titik pembayaran.
- **Selesai** = `buyer_confirmed_at` terisi, ATAU `shipped_at` + 10 hari (otomatis; cron harian menyapu), dan invoice berstatus `paid`. Pelacakan RajaOngkir (+2 hari bila terkirim) **ditunda ke C1c**: endpoint `/api/ongkir/track` sekarang publik & TANPA anggaran; jatah `ro_api_usage` saat ini (20+10+35+25) hanya menyisakan 10 → butuh keputusan realokasi kuota.
- Pencatatan keuangan: `resolveIncomeSplitForBilling` (finance/actions.ts) sudah jadi satu sumber untuk pemecahan jurnal, tetapi laporan (`splitIncomeByDomain`) punya logika paralel; ongkir saat ini dihitung masuk pendapatan Toko. Itu menyentuh jurnal produksi → dikerjakan terpisah sebagai **C1b** dengan audit sendiri.
### C1a — isi
1. Migration `0095` (aditif, idempoten, loop tenant aktif; tenant tanpa tabel dilewati): `invoice_shipping_lines` + `buyer_confirmed_at`, `completed_at`, `completion_source (buyer|auto)`; tabel `producer_ledger_entries`; tabel `producer_percent_history`. DDL tenant baru di `create-tenant-schema.ts`, Drizzle di schema tenant.
2. `producer_ledger_entries`: `producer_id`, `kind (sale|shipping)` (+ `refund_debt|transfer_fee|payout|adjustment` untuk fase berikut), `amount` bertanda NUMERIC(15,2), `invoice_id`, `invoice_item_id` / `shipping_line_id`, `status (available|reserved|paid|void)`, `meta JSONB` (dasar, persen, penanggung voucher, diskon — bahan audit), unik `(kind, invoice_item_id)` dan `(kind, shipping_line_id)`.
3. Helper murni+DB `producer-ledger` (packages/db): `computeShipmentCredit` (rumus § 3, dari snapshot; baris tanpa persen tersimpan → TIDAK dikreditkan dan ditandai "perlu ditinjau", bukan ditebak), `completeProducerShipment(tx, shippingLineId, source)` (kunci baris, cek `paid`, cek produsen terisi, insert idempoten), `sweepProducerSettlements(tc)`.
4. Hook: `confirmDeliveryAction` mengisi `buyer_confirmed_at` lalu menyelesaikan; cron `/api/cron/producer-settlement` (harian; pola cron yang ada, rahasia cron) memanggil sapuan.
5. Portal produsen: halaman **Saldo** (`/portal-produsen/saldo`) — kartu Menunggu / Bisa dicairkan / Sudah dicairkan (0 sampai C3), tabel per PENGIRIMAN yang bisa dibuka menjadi baris produk (D12), info "Ongkir yang Anda tanggung" (D14). Item sidebar baru. Hanya baca; `producerId` dari sesi (`getProducerPageAccess`).
6. Riwayat persentase (K20): tabel `producer_percent_history` (siapa, kapan, lama → baru), ditulis di `setProducerSharePercentAction` dalam transaksi yang sama; ditampilkan di dialog "Bagi hasil" admin.
### Risiko & pengaman
Kredit ganda (unik + kunci baris), invoice belum lunas (tidak dikreditkan), persen hilang (ditandai), pembeli palsu mengonfirmasi (kepemilikan invoice dari sesi sudah ada), produsen melihat produsen lain (semua query berfilter `producer_id` sesi). Uji: `scripts/smoke-producer-ledger.ts` dengan data nyata DB lokal (rumus K23 kedua jenis voucher, variasi, gratis ongkir, idempoten, belum lunas, persen null, otomatis 10 hari).

### 12.1 Status C1a (2026-11-04) — KODE SELESAI; audit `security-auditor` 0 Critical, 0 High, 3 Medium, 3 Low
Teruji data nyata DB lokal: `scripts/smoke-producer-ledger.ts` (rumus K23 kedua jenis voucher, ongkir/gratis ongkir, idempoten, balapan 6 penyelesaian bersamaan → kredit sekali, invoice belum lunas, persentase hilang, sapuan 10 hari, isolasi antar-produsen, indeks unik) + `scripts/smoke-cron-auth.ts` (cron fail-closed). Migration `0095` dijalankan ulang → idempoten.
| Temuan | Tindakan |
|---|---|
| MEDIUM cron `producer-settlement` belum ada | **Diperbaiki**: dibuat fail-closed + timing-safe (pola cleanup-pengajuan-produsen), tenant gagal dilaporkan; teruji 5 kasus |
| MEDIUM auto-selesai 10 hari memakai `shipped_at` yang bisa diisi produsen/admin sendiri (resi palsu → saldo terbit tanpa barang tiba) | **Risiko diterima untuk C1a (hanya baca, belum ada uang keluar). WAJIB sebelum C3**: mekanisme TAHAN (admin menahan satu pengiriman bermasalah/dalam sengketa; pengiriman tertahan tak ikut dicairkan) + jejak siapa mengisi `shipped_at` |
| MEDIUM tak ada pembalikan kredit bila invoice dibatalkan/refund SETELAH selesai | **WAJIB sebelum C3** (= PR C5 dimajukan): pembatalan/refund → baris `refund_debt`/void; saat ini aman karena belum ada pencairan |
| LOW `confirmDeliveryAction` UPDATE tak bersyarat status | **Diperbaiki** (UPDATE `WHERE status='shipped'` + `returning`; klik ganda yang kedua kalah) |
| LOW `ON CONFLICT DO NOTHING` tanpa target menelan pelanggaran unik apa pun | **Diperbaiki**: setelah insert, jumlah baris diverifikasi; kurang → transaksi dibatalkan (pengiriman tak ditandai selesai) |
| LOW riwayat persentase: 500 baris global + `catch` menelan semua galat | **Diperbaiki**: 5 terbaru PER produsen; hanya galat 42P01 (tabel belum ada) yang dimaklumi |
**Perilaku yang perlu diketahui sebelum deploy:** pengiriman produsen LAMA (sebelum 0095) punya `completed_at` NULL → sapuan pertama akan mengkreditkan secara retroaktif semua yang dikirim > 10 hari lalu, lunas, dan persentasenya tercatat (yang persentasenya kosong → "perlu ditinjau"). Itu hak produsen yang sah; bila ada data uji yang tak boleh ikut, bersihkan dulu.
**Deploy C1a:** migration `0095` DULU (`docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0095_producer_ledger.sql`; harapkan `NOTICE: OK tenant_<slug>`), baru build/restart; tambah crontab harian `GET /api/cron/producer-settlement` dengan header `x-cron-secret` (pola cron lain).

## 13. IMPLEMENTASI C1b–C5 (2026-11-04, dikerjakan penuh dalam satu sesi) — KODE SELESAI
Semua keputusan D1–D14 diwujudkan. Hal yang diputuskan SAAT implementasi (user tidur; bisa diubah bila tidak sesuai):
### 13.1 Keputusan implementasi
- **Pengakuan hutang (D8) dilakukan saat PENGIRIMAN SELESAI, bukan saat pembayaran dikonfirmasi.** Alasan keamanan: jalur konfirmasi pembayaran (5 titik + laporan paralel) menyentuh pembukuan produksi; menyentuhnya tanpa tinjauan manusia terlalu berisiko. Konsekuensi: pada pembayaran lunas seluruh uang tetap tercatat sebagai Pendapatan Toko; saat pengiriman selesai terbit jurnal otomatis **Dr Pendapatan Toko / Cr Hutang Produsen (2300)** sebesar hak produsen (produk + ongkir). Antara "lunas" dan "selesai" pendapatan toko tampak lebih besar dari yang sebenarnya (maksimal ±10 hari). Pembuat jurnal otomatis = pemilik tenant tertua (pembeli/cron tak punya pengguna dashboard). Akun/aktor tak ada → pengiriman TIDAK diselesaikan (dilaporkan `akun_belum_dikonfigurasi`), tidak ditebak.
- **Akun baru `2300 Hutang Produsen`** (kewajiban) — di migration 0096 (tenant aktif) dan seed tenant baru; mapping opsional `hutang_produsen` di `account_mappings`, jika kosong dicari menurut kode.
- **Jurnal lain** (semua atomik dalam transaksi yang sama dengan perubahan ledger): refund dibebankan = Dr Hutang Produsen / Cr Pendapatan Toko; pelunasan hutang via transfer = Dr Kas-Bank / Cr Hutang Produsen; pencairan dibayar = Dr Hutang Produsen / Cr Kas-Bank sebesar **jumlah pencairan** (transfer + biaya transfer yang dipotong dari produsen; biaya itu bukan beban tenant).
- **Rekening produsen:** daftar bank baku (`helpers/banks.ts`), nomor terenkripsi (`encryptPii`, kunci `MEMBER_PII_ENCRYPTION_KEY` — sudah dipakai NIK), UI hanya 4 digit terakhir; nomor utuh didekripsi HANYA di halaman admin keuangan untuk transfer. **Rekening pertama langsung berlaku; penggantian berlaku 24 jam kemudian** (anti-pembajakan) + bendahara diberi tahu; pengajuan menyimpan snapshot rekening.
- **Pengajuan:** produsen mengajukan SELURUH hak yang bisa dicairkan (bukan memilih pesanan); minimum, satu pengajuan aktif per produsen (indeks unik partial + kunci advisory), saldo `reserved` selama proses. Produsen boleh membatalkan hanya saat "diajukan".
- **Persetujuan:** `hasFullAccess(keuangan)` (Bendahara/Ketua/Owner); **memproses pencairan milik sendiri ditolak** (member pengurus = member produsen). Alur: diajukan → disetujui → ditransfer (atau ditolak dengan alasan wajib; saldo kembali).
- **Bukti transfer WAJIB** untuk menandai dibayar (dan untuk pelunasan hutang): id media tenant divalidasi ke tabel `media` (gambar/PDF), URL dibangun SERVER dari baris DB. Produsen melihat bukti di detail pencairan. Biaya transfer: kolom, otomatis **sesama bank Rp0 / beda bank Rp7.500 (diatur tenant)** dari perbandingan bank produsen vs rekening sumber (pengaturan pembayaran tenant) dan bisa diubah bendahara (0..Rp50.000, < jumlah pencairan).
- **Refund → hutang (D7):** tidak ada alur refund invoice lunas di sistem (invoice lunas tak bisa dibatalkan) → disediakan alat admin "Refund" per pengiriman (nominal ≤ sisa hak, alasan wajib) yang membuat baris ledger `refund_debt` (negatif) + jurnal; otomatis ikut memotong pencairan berikutnya; atau produsen mentransfer dan bendahara mencatat "pelunasan" (bukti wajib).
- **Tahan (sengketa/resi palsu):** admin menahan satu pengiriman → tak ikut diajukan (hutang/pelunasan tetap ikut); tak bisa menahan yang sudah masuk pengajuan.
- **Notifikasi:** bendahara = PJ Keuangan (+cadangan) lewat mesin PJ yang ada (kanal mengikuti `channel_mode` tenant: bawaan email-dulu, WA cadangan — BUKAN selalu WA seperti kata user; ubah di Pengaturan Notifikasi bila ingin WA-dulu), jika PJ belum diatur → semua pengurus ber-izin Keuangan penuh via email. Produsen: disetujui/ditolak/dibayar (nominal + tautan bukti). **Cron harian pengingat 30 hari (email)**.
### 13.2 Rute & berkas
Admin (Toko → Pencairan): `/app/{slug}/toko/pencairan` (daftar+ringkasan+pengaturan), `/[id]` (rekening utuh, rincian, setujui/tolak/catat transfer), `/pengiriman` (tahan, refund, hutang). Produsen: `/portal-produsen/pencairan` (ringkasan, rincian yang akan diajukan, rekening, riwayat), `/[id]` (status, rincian, bukti). Layanan: `packages/db/src/helpers/{producer-payout,producer-accounting,producer-ledger,banks}.ts`; aksi: `…/pencairan/actions.ts` (admin & produsen); notifikasi: `lib/producer-payout-notify.server.ts`; cron: `/api/cron/producer-settlement`, `/api/cron/producer-balance-reminder`.
### 13.3 Pengujian (data nyata DB lokal; semua LULUS)
`smoke-producer-ledger.ts` (saldo + jurnal pengakuan hutang), `smoke-producer-payout.ts` (67 pengecekan: rekening+jeda 24 jam+enkripsi, minimum, balapan 5 pengajuan, batal/tolak/setujui, larangan memproses milik sendiri, bayar TANPA bukti ditolak, biaya transfer batas, jurnal pencairan berimbang, refund parsial & melebihi, pelunasan, netting hutang, tahan/lepas, pengaturan), `smoke-cron-auth.ts`.
### 13.4 Deploy (urut)
1. `git pull`; 2. migration **`0095`** lalu **`0096`** (`docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/009x_….sql`; harapkan `NOTICE: OK tenant_<slug>` tiap tenant); 3. pastikan `MEMBER_PII_ENCRYPTION_KEY` dan `CRON_SECRET` ada di env server; 4. `bun install && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env && pm2 flush jalajogja`; 5. crontab harian (pola cron lain): `GET /api/cron/producer-settlement` dan `GET /api/cron/producer-balance-reminder` dengan header `x-cron-secret`; 6. pastikan akun `2300 Hutang Produsen` ada (migration membuatnya) dan Keuangan → Mapping akun memiliki Pendapatan Toko & Kas/Bank.
### 13.5 Belum dikerjakan / catatan
- **C1c** (pelacakan RajaOngkir → selesai +2 hari) DITUNDA: butuh keputusan realokasi kuota (100/hari bersama semua tenant); sementara selesai = konfirmasi pembeli atau 10 hari.
- Refund TIDAK otomatis (tak ada alur refund invoice); admin mencatatnya manual lewat alat di atas.
- Pengiriman produsen lama dikreditkan retroaktif oleh sapuan pertama (lihat § 12.1).
- Laporan Keuangan (`splitIncomeByDomain`) belum memisahkan Hutang Produsen dari Pendapatan Toko pada periode lunas→selesai.

### 13.6 Audit `security-auditor` (2026-11-04) — 0 Critical, 0 High, 2 Medium, 9 Low → semua yang penting DIPERBAIKI
| Temuan | Tindakan |
|---|---|
| MEDIUM larangan memproses milik sendiri bisa dilewati (`member_id` NULL) & hanya menutup 3 dari 6 aksi | **Diperbaiki**: cek dua identitas (member DAN akun login Better Auth) di lapis aksi untuk SEMUA aksi uang (setujui, tolak, bayar, refund, pelunasan, tahan/lepas) |
| MEDIUM bukti transfer tak terikat & bisa dihapus (route hapus media tanpa cek peran — pra-ada) | **Diperbaiki**: mime hanya jpeg/png/webp/PDF (tanpa SVG); bukti tak boleh dipakai ulang; bukti pencairan harus diunggah SETELAH pengajuan dibuat; `/api/media/delete` kini wajib akses penuh modul media (matriks CLAUDE.md) DAN menolak menghapus bukti pencairan/pelunasan (409) |
| LOW biaya transfer bebas 0–50.000 | **Diperbaiki**: harus salah satu angka pengaturan, selain itu wajib CATATAN alasan |
| LOW TOCTOU tahan vs pengajuan | **Diperbaiki**: `setShipmentHold` memakai kunci advisory produsen yang sama |
| LOW aksi uang tampak gagal bila langkah pasca-commit error | **Diperbaiki**: notifikasi dijalankan terpisah (try/catch sendiri) |
| LOW ganti rekening tak memberi tahu pemilik | **Diperbaiki**: pemilik rekening juga dikabari (pengingat keamanan) |
| LOW pelunasan atas hutang yang sudah ter-reserve (bayar dua kali) | **Diperbaiki**: pelunasan hanya atas hutang `available` |
| LOW tak ada CHECK DB untuk invarian uang | **Diperbaiki**: `producer_payouts_money_chk` (paid ⇒ bukti+jurnal+net konsisten; subtotal>0; fee<subtotal) di migration 0096 + DDL |
| LOW `confirmDeliveryAction` memakai slug mentah | **Diperbaiki**: `isActiveTenant` sebelum menyentuh schema |
| LOW akun jurnal tak divalidasi tipe/aktif; migration 0096 `ON CONFLICT (code) DO NOTHING` bisa memakai akun 2300 lama bermakna lain | **Dicatat**: cek di server sebelum deploy — `SELECT code,name,type FROM tenant_<slug>.accounts WHERE code='2300'` harus kosong atau "Hutang Produsen" |
| LOW teks bebas (nama pemilik rekening) masuk pesan bendahara; limiter in-memory | **Dicatat** (tak ada XSS/relay; penerima tetap) |
Catatan operasional dari auditor: pastikan `MEMBER_PII_ENCRYPTION_KEY` terisi & DICADANGKAN terpisah (hilang = semua rekening produsen tak terbaca); bucket MinIO tenant bersifat publik-baca → tautan bukti (UUID) bisa dibuka siapa pun yang memegangnya; belum ada pembalikan otomatis bila invoice lunas dibatalkan (alat Refund manual tersedia).
