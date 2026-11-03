# Arsitektur: Produsen Mengelola Produk Sendiri + Voucher Dua Jenis + Model Bagi Hasil

> **Status: KEPUTUSAN TERKUNCI 2026-11-03 (§ 12) — eksekusi per PR.** Ditulis SEBELUM eksekusi sesuai aturan kerja proyek.
> Arahan user: produsen boleh **mengunggah, mengubah, dan menghapus produknya sendiri, KECUALI produk yang sudah ada pemesannya**;
> voucher ada dua jenis (promo tenant vs. promo produsen); bagi hasil ditanggung bersama (K18); rencana dipecah menjadi beberapa PR/fase agar commit konsisten.
>
> **Dokumen terkait:** `docs/arsitektur-pengajuan-produsen.md` (K1–K20; batas produk K3; § 17 bagi hasil), `docs/arsitektur-portal-produsen.md` (portal, § 7 halaman Produk baca-saja, § 29 pesanan vs produsen),
> `docs/arsitektur-product.md` (model produk + harga berlapis), `docs/arsitektur-voucher.md` (voucher Fase 1), `docs/decisions/adr-0005-pengiriman-per-produsen.md`.

---

## 1. Titik awal (diverifikasi di kode 2026-11-03)

| Hal | Kondisi sekarang |
|---|---|
| Portal produsen › Produk (`portal-produsen/produk`, `produk/[id]`) | **BACA-SAJA**: daftar produk milik produsen + detail memakai komponen bersama dengan admin (`components/toko/product-detail/*`) |
| Form produk | `components/toko/product-form.tsx` (±900 baris, dipakai admin): Tiptap, `MediaPicker` (Media Library **tenant**), SeoPanel, variasi, gratis ongkir, lokasi ambil sendiri, asal kirim |
| Aksi produk | `toko/actions.ts` (`createProductAction`, `updateProductAction`, `deleteProductAction`…) — semuanya `hasFullAccess(access.tenantUser, "toko")`; **produsen BUKAN tenant user** → tidak bisa memakainya |
| Foto | Media Library tenant butuh akses tenant user. Produsen = anggota biasa → punya **Media Library anggota** (`public.member_media`, `MemberMediaPicker`, ada `variants`) |
| Batas produk | `producers.product_limit` (NULL = default 3, K3) sudah tersimpan; **belum ditegakkan** (belum ada jalur produsen membuat produk) |
| Voucher | `vouchers` (tenant-schema) dibuat hanya oleh admin; potongan per-item; tidak ada konsep "pemilik/penanggung" |
| Kepemilikan pesanan | snapshot `invoice_items.producer_id` saat checkout (opsi A dipertahankan, `arsitektur-portal-produsen.md` § 29.5) |

## 2. Prinsip (diturunkan dari keputusan user — jangan dilanggar)
1. **Pemilik produk = produsen dari SESI**, tidak pernah dari body/URL. Produk lain/internal/mitra → 404. (pola sama `loadProductDetail(..., { ownerProducerId })`)
2. **Server memutuskan semuanya**: batas produk, "sudah ada pemesan", kepemilikan — klien hanya menampilkan.
3. **Produk yang sudah ada pemesannya TERKUNCI** dari ubah/hapus oleh produsen (§ 5). Kunci dicek di dalam transaksi yang sama dengan perubahan (bukan cek-lalu-ubah terpisah).
4. **Tidak ada role/modul baru.** Produsen tetap STATUS pada akun anggota; penyetuju tetap izin yang sudah ada.
5. **Satu komponen bersama**: form produsen memakai bagian form yang sama dengan admin (bukan salinan), dengan **daftar field yang diizinkan** dikendalikan di server (allow-list), bukan disembunyikan di klien saja.
6. Tiap PR: dokumen → kode → `type-check` + build → uji data nyata → audit `security-auditor` → commit. Push hanya bila user minta.

## 3. Model bagi hasil final (K18, K20 — diputuskan user 2026-11-03)
- Pemohon menawarkan **persentase** (`producers.revenue_share_percent`); ini **bagian TOKO** atas harga yang benar-benar dibayar pembeli untuk barang itu.
- **Diskon anggota ditanggung bersama:** persentase tetap sama untuk harga umum maupun harga anggota.
  Contoh tawaran 10%: harga umum Rp10.000 → toko Rp1.000, produsen Rp9.000; harga anggota Rp9.000 → toko Rp900, produsen Rp8.100.
- Persentase **tidak boleh diubah produsen**; **hanya admin** (setelah komunikasi), dengan catatan perubahan (siapa, kapan, lama → baru). UI admin: PR akhir fase pencairan, bukan fase ini.
- **Dasar hitung = harga satuan setelah diskon anggota, SEBELUM voucher** (lihat § 4: voucher punya aturan penanggung sendiri).
- Pencairan/penghitungan nominal yang dibayarkan ke produsen **di luar fase ini** (`pengajuan pembayaran` — tahap tersendiri). Fase ini hanya memastikan data yang dibutuhkan nanti ikut tersimpan (snapshot, § 4.4).

## 4. Voucher dua jenis (arahan user 2026-11-03)

### 4.1 Definisi
| Jenis | Dibuat oleh | Siapa yang menanggung potongan | Boleh menarget |
|---|---|---|---|
| **Promo Tenant** | Admin toko (yang sekarang) | **Tenant** — pendapatan produsen **tidak berkurang** | produk mana pun (termasuk produk produsen) |
| **Promo Produsen** | Produsen sendiri di portal | **Produsen** — bagian tenant **tidak berkurang** ("tenant tidak ikut campur") | **hanya produk miliknya sendiri** |

### 4.2 Akibat ke perhitungan (usulan — butuh konfirmasi, lihat § 9 pertanyaan 4)
Harga dasar bagi hasil = harga setelah diskon anggota, **sebelum voucher** (§ 3).
- Voucher Promo Tenant: pembeli membayar lebih sedikit; **kekurangannya ditutup tenant** → bagian produsen dihitung dari harga sebelum voucher.
- Voucher Promo Produsen: pembeli membayar lebih sedikit; **kekurangannya ditutup produsen** → bagian tenant dihitung dari harga sebelum voucher (produsen menerima sisanya).
Contoh (tawaran 10%, harga Rp10.000, voucher Rp2.000): Promo Tenant → produsen tetap Rp9.000, tenant menerima Rp1.000 − Rp2.000 = **−Rp1.000** (tenant menombok); Promo Produsen → tenant tetap Rp1.000, produsen menerima Rp9.000 − Rp2.000 = **Rp7.000**.

### 4.3 Skema (additif)
- `vouchers.owner_producer_id UUID NULL` (FK ke `producers`, `ON DELETE RESTRICT`): NULL = Promo Tenant; terisi = Promo Produsen. Indeks parsial. Kode voucher tetap **unik satu tenant** (UNIQUE sudah ada).
- Produsen **hanya** mengelola baris dengan `owner_producer_id = produsen sesi`. `targetItemIds` divalidasi di server: semua id (produk/variasi) harus milik produsen itu; target "semua produk" TIDAK tersedia bagi produsen.
- Batas keamanan untuk Promo Produsen: tipe potongan persen/nominal tidak boleh membuat harga negatif (sudah dijaga resolver); diskon 100% **diizinkan?** — pertanyaan 5.

### 4.4 Snapshot untuk pencairan nanti
Saat checkout memakai voucher, catatan pemakaian (`voucher_redemptions` / baris item) harus menyimpan: `owner_producer_id` voucher (penanggung), nominal potongan **per item**. Tanpa ini, tahap pencairan tidak bisa menentukan siapa menanggung. Dirancang di PR-V1 (migration additif), diuji dengan data nyata sebelum PR berikutnya bergantung padanya.

## 5. Aturan "produk yang sudah ada pemesannya" (terkunci)
- **Definisi pemesan:** ada baris di `invoice_items` (alur keranjang) **atau** `order_items` (alur lama) yang merujuk ke produk itu **atau variasinya**, pada pesanan/invoice berstatus apa pun **kecuali `cancelled`/`draft`**? — usulan: **status apa pun yang bukan dibatalkan** (pesanan yang masih menunggu bayar juga mengunci). Pertanyaan 3.
- Bila terkunci: produsen **tidak bisa mengubah isi** (nama, harga, deskripsi, foto, variasi) **dan tidak bisa menghapus**. Yang masih boleh (usulan): **ubah stok** dan **arsipkan/aktifkan kembali** (menyembunyikan dari toko tanpa merusak pesanan). Pertanyaan 2.
- Penegakan: di dalam transaksi yang mengunci baris produk (`SELECT … FOR UPDATE`) lalu cek pemesan; mencegah celah "pembeli checkout tepat saat produsen mengedit".
  Catatan: checkout pembeli saat ini tidak mengunci baris produk; PR-P3 mengukur apakah perlu penanganan tambahan (harga di keranjang sudah snapshot — risikonya kecil tapi diuji).
- Pesan galat ke produsen harus jelas ("Produk ini sudah dipesan — tidak bisa diubah/dihapus. Hubungi pengurus."). Admin tetap bisa mengubah/menghapus lewat aturan yang sudah ada.

## 6. Penyimpanan foto (usulan)
Produsen memakai **Media Library anggota** (`MemberMediaPicker`, `public.member_media`) — satu perpustakaan pribadi yang juga bisa dipakai ulang (jawab keluhan "tidak bisa pakai ulang").
Saat produk disimpan, item foto yang dipilih diubah ke bentuk `ProductImage` yang dipakai tampilan toko (`url`, `variants.square`/`square-large`, `alt`). Server **memverifikasi** bahwa tiap `member_media.id` milik anggota pemilik produsen itu (bukan percaya URL dari klien).
Konsekuensi yang perlu disadari: foto produk bersifat **publik-baca** (memang untuk etalase); menghapus file dari Media Library anggota akan membuat foto produk rusak → `/akun/media` harus menolak/memperingatkan penghapusan file yang sedang dipakai produk (diperiksa di PR-P2). Pertanyaan 6.

## 7. Rencana PR/fase (commit konsisten)

| PR | Isi | Migration? | Bergantung |
|---|---|---|---|
| **PR-E** | **Email seketika ke penyetuju** saat pengajuan baru (perbaikan notifikasi, § 8) — reuse `producer-application-notify.server.ts`; digest PJ tetap | tidak | — |
| **PR-P1** | **Fondasi**: `lib/producer-products.server.ts` — `requireOwnedProduct`, `countsTowardLimit`, `hasOrders`, `assertCanCreate` (batas), allow-list field; uji unit/regresi data nyata | tidak | — |
| **PR-P2** | **Buat produk** (portal): form allow-list (nama, deskripsi, kategori, foto via `MemberMediaPicker`, harga publik + harga anggota, stok, berat, tipe sederhana dulu; **variasi menyusul di PR-P4**), tersimpan `draft`; penegakan batas produk (atomik) | tidak | P1 |
| **PR-P3** | **Ubah + Hapus + kunci "sudah ada pemesan"** (§ 5), arsip/aktif, stok; tombol/pesan jelas di UI | tidak | P1, P2 |
| **PR-P4** | **Variasi produk** untuk produsen (reuse `attribute-group-editor`/`variation-table` dengan allow-list), asal kirim = gudang produsen (otomatis, bukan input bebas) | tidak | P2 |
| **PR-P5** | **Tayang**: alur status draft → aktif (langsung atau lewat persetujuan — pertanyaan 1), notifikasi ke pengurus bila ada tinjauan | mungkin (kolom status tinjauan) | P2 |
| **PR-V1** | **Voucher dua jenis — fondasi**: `vouchers.owner_producer_id`, snapshot penanggung di pemakaian, resolver menghormati pemilik (target hanya produk sendiri), migration additif | **ya** | P1 |
| **PR-V2** | **Voucher produsen di portal**: CRUD terbatas (kode, nilai, periode, kuota, target = produk sendiri); admin melihat voucher produsen (dengan label pemilik) | tidak | V1, P2 |
| **PR-Z** | **Penutup**: smoke test data nyata (skrip regresi), audit akhir `security-auditor`, dokumen + runbook deploy, evaluasi total | — | semua |

Urutan eksekusi yang disarankan: **E → P1 → P2 → P3 → V1 → V2 → P4 → P5 → Z**. Tiap PR = 1 commit (atau 2 bila ada migration terpisah), dan dapat di-deploy sendiri; push hanya saat user minta.

## 8. Perbaikan email notifikasi (PR-E)
Saat ini pengurus hanya melihat lencana, dashboard, dan digest harian PJ. Perubahan: begitu pengajuan **dikirim** (status `pending`), kirim **email** ke penyetuju — pemegang izin `anggota:full` + `toko:read` di tenant itu (Owner/Ketua/Sekretaris).
Aturan: fire-and-forget (tidak boleh menggagalkan pengajuan), kanal email saja (K16), satu email per penyetuju, isi **tanpa data pribadi/berkas** (nama pemohon + brand + tautan ke halaman tinjauan), subjek disanitasi, tanpa duplikasi saat pengajuan dikirim ulang.

## 9. Pertanyaan untuk user (jawaban memengaruhi rancangan; belum ada kode)
1. **Tayang langsung atau lewat persetujuan?** Produk baru produsen: (a) langsung `aktif` karena produsen sudah dikurasi lewat pengajuan, atau (b) `draft` → "ajukan tayang" → pengurus menyetujui. Saran saya: **(b)** pada produk-produk awal tiap produsen — tapi ini mekanisme tambahan, jadi saya tanya dulu.
2. **Produk terkunci (sudah dipesan): apa yang masih boleh?** Usulan: hanya **stok** dan **arsipkan/aktifkan**. Atau betul-betul tak boleh apa pun?
3. **Pesanan yang mengunci:** semua status kecuali dibatalkan (termasuk menunggu bayar), atau hanya yang sudah dibayar?
4. **Penanggung voucher** seperti § 4.2 (Promo Tenant ditanggung tenant, Promo Produsen ditanggung produsen, bagian pihak lain tidak terpengaruh) — benar begitu?
5. **Voucher produsen:** boleh diskon 100% / ada batas maksimal (mis. ≤ 50%)? Boleh menarget variasi tertentu? Boleh voucher personal (nomor HP/email)?
6. **Foto** lewat Media Library anggota (§ 6) — setuju? Dan file yang sedang dipakai produk **dilarang dihapus** dari Media Library?
7. **Harga Dasar (modal):** pada produk produsen, `price` (modal) tidak relevan bagi produsen (dia menjual dengan bagi hasil). Usulan: kolom modal **diisi otomatis** dari rumus (harga jual − bagian toko) atau 0 dan laporan keuntungan produk produsen memakai bagi hasil. Perlu dibahas dengan model laporan (`arsitektur-product.md` § Laporan Produk).
8. **Jenis produk:** fase ini hanya produk fisik (sesuai K-awal). Digital/jasa tetap tahap sendiri — setuju?

## 10. Risiko utama yang akan diaudit
- IDOR produk/variasi/foto antar-produsen dan antar-tenant (semua id dari klien divalidasi terhadap sesi).
- Mass assignment: klien tidak boleh mengirim `producerId`, `mitraId`, `status`, `price`(modal), `origin`, dll. di luar allow-list.
- Race: dua tab (hapus vs pesan), dua permintaan buat produk bersamaan melewati batas (kunci advisory per produsen).
- XSS deskripsi produk (Tiptap): render lewat renderer yang sudah diperketat (2026-11-03) + sanitasi.
- Voucher produsen menarget produk orang lain / "semua" lewat manipulasi `targetItemIds`.
- Foto: `member_media.id` milik anggota lain dipasang ke produk.
- Penghapusan foto di Media Library yang masih dipakai produk.

## 11. Status (diringkas; rinci per PR di § 13)
Lihat **§ 13** untuk status eksekusi terkini. Bagian lama (rencana awal PR-P5 tinjauan, kunci produk) digantikan § 12.

## 12. KEPUTUSAN TERKUNCI (user, 2026-11-03) — menggantikan usulan di § 5, § 6, § 9
Jawaban § 9: K21–K29. Bila bertentangan dengan teks di atas, **bagian ini yang berlaku**.

- **K21 Langsung tayang.** Produk baru produsen berstatus `active` begitu disimpan lengkap. Tidak ada antrean persetujuan (produsen sudah dikurasi lewat pengajuan). PR-P5 (alur tinjauan) DIBATALKAN.
- **K22 Produk yang sudah dipesan BEBAS diubah** (harga, stok, arsip, gambar, galeri, dll.) — pesanan lama memakai harga saat checkout. § 5 "kunci produk" DIBATALKAN. Satu-satunya pembatas:
  **hapus ditolak bila ada pesanan LUNAS** (cukup arsipkan); hapus boleh bila belum ada pesanan lunas. Pesanan lunas = invoice berstatus `paid` yang memuat produk itu atau variasinya (alur keranjang) atau pesanan lama berstatus bukan `cancelled` (`order_items`).
- **K23 Voucher dua jenis.** Potongan = nilai dari HARGA, dikurangkan dari bagian PENANGGUNG: Promo Tenant → bagian tenant berkurang (produsen tetap); Promo Produsen → bagian produsen berkurang (tenant tetap). Contoh tawaran 10%, harga Rp10.000, diskon Rp500: Promo Tenant → tenant Rp500 / produsen Rp9.000; Promo Produsen → tenant Rp1.000 / produsen Rp8.500.
  Promo Tenant boleh membuat bagian tenant negatif (peringatan di form admin). **Batas Promo Produsen: potongan ≤ persentase bagian tenant** (persen: ≤ `revenue_share_percent`; nominal per unit: ≤ harga × persen). Voucher personal (HP/email) dan target variasi tertentu BOLEH. Produsen hanya boleh menarget produk miliknya.
- **K24 Harga dasar (modal) otomatis, read-only** = harga jual publik × (100 − persen tenant) / 100, dihitung server saat simpan dan disinkronkan ulang bila admin mengubah persentase produsen. Produsen hanya mengisi **harga jual publik** dan **harga anggota** (boleh kosong = sama dengan publik).
- **K25 Laba/pencairan produk produsen = persentase × uang yang benar-benar dibayar** (harga setelah diskon anggota, voucher mengikuti K23) — BUKAN harga jual dikurangi modal. Persentase dan penanggung voucher **dicatat per baris pesanan saat checkout** (migration additif di PR-V1) agar perubahan harga/persentase kemudian tidak mengubah riwayat.
- **K26 Batas produk: SEMUA produk produsen dihitung — draf, aktif, DAN arsip.** Hanya menghapus yang membebaskan slot (tujuan: produsen memilih produk unggulan). Batas = `producers.product_limit` ?? 3. Ditegakkan atomik (kunci advisory per produsen).
- **K27 Tidak tersedia untuk produsen (fase ini):** gratis ongkir, lokasi ambil sendiri khusus produk, SEO manual, asal kirim bebas (otomatis = gudang produsen), produk mitra. Berat WAJIB. Harga anggota opsional.
- **K28 Foto: Media Library anggota** (`MemberMediaPicker`). **Foto yang dipakai produk apa pun (termasuk arsip) tidak boleh dihapus**; begitu diganti/produk dihapus, langsung bebas. Pengecekan lintas SEMUA tenant tempat anggota itu menjadi produsen: foto utama, galeri, foto variasi. Diuji dua arah.
- **K29 Hanya produk fisik** pada fase ini.

### 12.1 Rencana PR setelah keputusan
| PR | Isi | Migration |
|---|---|---|
| **PR-E** | Email penyetuju — SELESAI KODE | — |
| **PR-P1** | Fondasi `lib/producer-products.server.ts`: kepemilikan, batas (K26), aturan hapus (K22), harga dasar (K24), foto (K28) | tidak |
| **PR-P2** | Buat produk di portal (form allow-list, langsung `active`) | tidak |
| **PR-P3** | Ubah / arsip / hapus + pengecekan foto dipakai di `/akun/media` | tidak |
| **PR-V1** | Voucher dua jenis: skema + resolver + snapshot K25 saat checkout | ya |
| **PR-V2** | Voucher produsen di portal | tidak |
| **PR-P4** | Variasi untuk produsen | tidak |
| **PR-Z** | Smoke test data nyata, audit akhir, runbook, evaluasi, push | — |

## 13. STATUS EKSEKUSI (2026-11-03) — semua kode SELESAI, type-check + build bersih; belum di-deploy
| PR | Hasil | Uji data nyata |
|---|---|---|
| **PR-E** | Email ke penyetuju saat pengajuan dikirim (`notifyApproversNewApplication`) | isi aman (escape + subjek 1 baris); sampai tahap kirim di DB lokal; email SUNGGUHAN belum diuji (VPS) |
| **PR-P1** | `lib/producer-products.ts` (parse/sanitasi deskripsi/harga dasar) + `.server.ts` (kepemilikan, batas K26, hapus K22, foto K28, `findMediaInUse`) | `scripts/smoke-producer-products.ts` |
| **PR-P2** | Tambah produk di portal (`produk/baru`), langsung tayang; editor deskripsi mode `basic` | idem + balapan batas (6 serentak → 1 lolos) |
| **PR-P3** | Ubah / arsip / hapus (`produk/[id]/ubah`, tombol di header detail); `/api/akun/media/[id]` DELETE menolak foto yang dipakai produk (409, fail-closed 503) | idem (arsip tetap kunci foto; setelah diganti langsung bebas) |
| **PR-V1** | Migration **0093** (`vouchers.owner_producer_id`, `invoice_items.producer_share_percent` + `discount_funded_by`), resolver `computeVoucherDiscount` (pemilik + batas), `checkoutAction`/`previewVoucherAction` mengisi snapshot | `scripts/smoke-voucher-owner.ts` memanggil `checkoutAction` NYATA (21 pengecekan) |
| **PR-V2** | Voucher produsen di portal (`/voucher`, menu sidebar), admin: label "Promo Produsen" + tidak bisa mengubah isinya (hanya nonaktifkan) | `scripts/smoke-producer-vouchers.ts` |
| PR-P4 | **DITUNDA** — variasi produk untuk produsen (lihat § 13.2) | — |
| PR-P5 | **DIBATALKAN** (K21 langsung tayang) | — |

### 13.1 Deploy (urutan)
1. `git pull`; migration `0093` (aman diulang): `docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0093_voucher_owner_and_share_snapshot.sql` → `NOTICE: OK tenant_<slug>` per tenant.
2. `bun install && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env && pm2 flush jalajogja`.
3. Tanpa perubahan Nginx/cron/env baru. Tidak ada saklar baru: fitur produk & voucher tersedia untuk produsen yang SUDAH punya akses portal + persentase bagi hasil terisi.
4. Produsen lama yang dibuat admin (tanpa persentase) TIDAK bisa membuat produk/voucher sampai persentase ditetapkan (pesan jelas di portal). Produsen dari alur pengajuan sudah punya persentase.

### 13.2 Batasan yang diketahui / belum dikerjakan
- **Variasi produk untuk produsen (PR-P4)** belum ada: produk bervariasi (dipasang admin) tidak bisa diubah dari portal dan tidak bisa jadi target voucher produsen. Perlu keputusan: harga dasar & batas voucher per variasi.
- **Mengubah persentase bagi hasil** (K20) — lihat § 13.3.
- **Voucher produsen hanya berlaku di checkout publik** (keranjang). Pesanan manual admin & invoice manual tidak pernah mencocokkan Promo Produsen (fail-closed, disengaja).
- Produk yang dihapus produsen tetap bisa masih ada di keranjang pembeli lain → checkout menolak "sudah tidak tersedia" (perilaku lama, aman).
- Hapus produk memeriksa pesanan lunas lalu menghapus; pembayaran yang dikonfirmasi tepat di antara dua langkah itu tidak dikunci (pesanan tetap menyimpan nama sebagai salinan; dampak: tautan produk di riwayat tidak bisa dibuka).
- Foto produk memakai varian anggota (`large` untuk detail, `square` untuk kartu); tidak ada `square-large` (hanya ada di Media Library tenant) — tampilan toko jatuh ke `url`.
- `memberPriceTenantOnly` produk produsen memakai nilai bawaan (`false` = Harga Anggota berlaku untuk semua anggota IKPM). Ubah ke "khusus anggota tenant" bila diinginkan.

### 13.3 Persentase bagi hasil (K20/K24) — UI admin SELESAI KODE
- `/app/{slug}/toko/produsen` → tombol **"Bagi hasil: X%"** per produsen anggota (`SharePercentForm`, `setProducerSharePercentAction`): admin menetapkan/mengubah (0 < p < 100). Hanya admin (penjaga `guard` yang sama dengan aksi produsen lain); produsen tidak punya jalur mengubahnya.
- Dalam transaksi yang sama, **harga dasar** semua produk SEDERHANA milik produsen itu dihitung ulang: `ROUND(harga_publik × (100 − p)/100, 2)` (diuji = `computeBaseCost`). Produk bervariasi menunggu fase variasi. Pesanan lama tidak berubah (snapshot K25).
- Produsen buatan admin (tanpa persentase) wajib diisi dulu sebelum bisa menambah produk/voucher.
- **Belum**: catatan riwayat perubahan (siapa/kapan/lama→baru) yang diminta K20 — memerlukan tabel baru; ditunda ke fase pencairan, tercatat di sini agar tidak lupa.

### 13.4 Audit keamanan (subagent `security-auditor`, 2026-11-03) — 0 Critical, 0 High, 1 Medium, 6 Low
Tidak ada IDOR, mass assignment, SQL injection, XSS baru, atau kebocoran lintas tenant/produsen; batas potongan voucher ditegakkan di checkout dari data DB.
| Temuan | Tindakan |
|---|---|
| MEDIUM — produsen bisa mengaktifkan kembali produk yang diarsipkan admin; aksi status bisa menayangkan baris `draft` | **Diperbaiki sebagian**: transisi hanya `active ⇄ archived` (draft ditolak, klik ganda idempoten). **Terbuka (keputusan produk):** belum ada penanda "dibekukan admin" — produk yang diarsipkan admin masih bisa diaktifkan produsen. Lihat § 13.5. |
| LOW — `findMediaInUse` hanya memindai tenant di `tenant_memberships` | Diperbaiki: memindai SEMUA tenant aktif |
| LOW — `hasPaidOrders` hanya `paid` | Diperbaiki: `paid` + `partial` (uang sudah masuk) |
| LOW — URL protocol-relative (`//host`, `/\host`) dan skema tersamar karakter kontrol lolos di `letter-render` | Diperbaiki + diuji (6 skenario tambahan) |
| LOW — pesan hapus produsen tak menyebut voucher | Diperbaiki |
| LOW — `renderBody` melempar bila attrs bertipe salah (halaman penulis sendiri rusak) | Dicatat, tidak diubah (bukan celah; whitelist produsen menutup jalurnya) |
| LOW — `sanitizeEmbedHtml` mengizinkan `style` bebas (sudah ada sebelumnya) | Dicatat (renderer bersama; penulis dengan akses website saja) |
| LOW — kode voucher unik se-tenant: produsen bisa menebak kode / pesan "sudah dipakai" | Risiko diterima |
| LOW — email penyetuju: batas hanya per anggota & di memori | Risiko diterima (isi email tanpa data pribadi; maks 20 penerima) |

### 13.5 Keputusan produk yang masih terbuka
1. ~~Moderasi admin atas produk produsen~~ — **DIPUTUSKAN user 2026-11-03: admin boleh membekukan → K30 (§ 14).**
2. Variasi produk produsen (PR-P4) dan harga dasar/batas voucher per variasi.
3. Catatan riwayat perubahan persentase (K20).
4. Nilai `memberPriceTenantOnly` bawaan produk produsen.


## 14. K30 — Pembekuan produk oleh admin (diputuskan user 2026-11-03)
**Keputusan:** admin boleh membekukan produk produsen; produsen tidak bisa membalikkannya.

**Rancangan (sengaja minimal):**
- Status produk baru **`frozen`** ("Dibekukan") — tidak ada kolom baru. Toko publik hanya menampilkan `active`, jadi produk beku otomatis hilang dari toko, pencarian, dan checkout (tanpa mengubah satu pun kueri publik).
- **Migration `0094`** (wajib sebelum kode): CHECK `products.status` di tiap tenant diperluas dengan `'frozen'` (idempotent; DDL tenant baru di `create-tenant-schema.ts` ikut).
- **Admin**: opsi "Dibekukan" di pilihan Status form produk — hanya untuk produk yang punya produsen (server menolak membekukan produk internal). Admin membuka kembali lewat Status → Aktif / tombol "Aktifkan".
- **Produsen**: produk beku tampil berlabel "Dibekukan pengurus"; tombol Arsipkan/Aktifkan disembunyikan; server menolak pengubahan status dari portal dengan pesan jelas. **Ubah isi produk tetap boleh** (agar produsen bisa memperbaiki yang dipermasalahkan; status tidak ikut berubah). **Hapus tetap boleh** (aturan pesanan lunas tetap berlaku); produk beku tetap menghitung batas (K26).
- Pesanan yang sudah ada tidak terpengaruh (snapshot).
- Tidak ada alasan/catatan pembekuan (belum diminta; ditambahkan bila diperlukan).
- **Checkout**: `resolveProductCartItem` menganggap produk beku TIDAK dapat dipesan (`producerActive=false`) → keranjang dan checkout publik menolak ("sedang tidak tersedia"), termasuk item yang sudah terlanjur di keranjang. Pemanggil admin (invoice manual) tidak terpengaruh.
- **Status: KODE SELESAI + diuji** (`smoke-producer-products.ts`: 7 pengecekan beku; semua regresi lain lulus). **Deploy: migration `0094` DULU**, baru build/restart.
- **Catatan terbuka (pra-ada, bukan bagian K30):** produk berstatus `archived`/`draft` yang sudah terlanjur di keranjang pembeli tidak ditolak checkout (hanya `frozen` & produsen nonaktif yang ditolak). Perlu keputusan bila mau diseragamkan.

## 15. REFAKTOR — satu `ProductForm` bersama (K31–K33; arahan user 2026-11-03) — KODE SELESAI R1–R3, audit selesai (0C/0H/2M/3L)
**Latar:** form produsen buatan sendiri (`components/producer/producer-product-form.tsx`, 174 baris) diputuskan sepihak dan kurang lengkap (tanpa gudang, variasi, pilihan status). User: cukup beri akses ke produsen pada arsitektur yang sudah ada. Form admin (`components/toko/product-form.tsx`, 906 baris) sudah punya semuanya.

**Keputusan:**
- **K31 Satu form.** `ProductForm` menerima `mode="admin" | "producer"`. Mode produsen menyembunyikan: gratis ongkir, ambil sendiri per produk, SEO manual, pemilih produsen, produk mitra; menampilkan harga dasar **read-only**. Menyembunyikan di UI BUKAN pengamanan — server tetap menegakkan.
- **K32 Status (koreksi K21).** "Langsung tayang" = produsen BOLEH menayangkan sendiri (tanpa moderasi), BUKAN membuang status lain. Produsen memilih **Draft / Aktif / Diarsipkan** seperti admin. `frozen` (K30) tidak bisa dipilih atau diubah produsen. Konsekuensi: aturan lama "draft tidak bisa ditayangkan produsen" (temuan audit Medium) dicabut untuk produk MILIKNYA; batas produk tetap menghitung semua status (K26).
- **K33 Variasi & harga dasar variasi** — logika SAMA dengan "Harga & stok" admin: harga publik variasi kosong → ikut harga induk; harga anggota kosong → ikut induk; stok produk bervariasi = Σ stok variasi aktif (stok utama diabaikan); berat variasi kosong → ikut induk. Harga dasar (`price`) tiap variasi **dihitung server** = harga jual efektif variasi × (100 − persen)/100 (K24), produsen tidak bisa mengisinya; ikut disinkronkan saat admin mengubah persentase (sekarang hanya produk sederhana).
- **Gudang:** wajib dipilih dari gudang MILIK produsen itu (otomatis bila hanya satu). Server memakai `originBelongsTo` yang sudah ada.

**Batas aman (tidak berubah):** jalur simpan ke server TETAP khusus produsen (`getProducerAccess`, `producerId` dari sesi, whitelist field, harga dasar dihitung server, kepemilikan produk/variasi diverifikasi). Yang dibagi hanya tampilan.

**Fase:**
| Fase | Isi |
|---|---|
| R1 (server) | Simpan variasi untuk produsen (diff-upsert seperti admin, kepemilikan diverifikasi, `price` dihitung server); gudang di create/update; status tiga arah (frozen terkunci); sinkron harga dasar variasi saat persentase berubah; uji lokal |
| R2 (UI) | `ProductForm mode="producer"` + halaman portal memakainya; hapus `producer-product-form.tsx` setelah lolos uji |
| R3 | Voucher produsen boleh menarget produk bervariasi (resolver sudah per-harga-baris; tinggal pemilih target); audit `security-auditor`; docs; push; deploy |

### 15.1 Status eksekusi (2026-11-03)
- **R1 server** ✔: parser diperluas (status draft/aktif/arsip — bawaan draft; `originId`; `productType`; atribut; variasi) di `lib/producer-products.ts`; `createProducerProduct`/`updateProducerProduct` menyimpan variasi dalam transaksi (diff-upsert, UUID dipertahankan, hanya variasi MILIK produk itu yang disentuh), harga dasar induk + variasi ber-harga-sendiri dihitung server, gudang diverifikasi (`originBelongsTo`; wajib dipilih bila produsen punya >1 gudang), foto induk & variasi hanya dari Media Library anggota (foto lama dipertahankan), `frozen` tidak diubah dari jalur produsen; `setProducerProductStatus` tiga arah (draft/aktif/arsip) dan menolak produk beku; `syncBaseCosts` (dipakai `setProducerSharePercentAction`) menghitung ulang harga dasar produk sederhana, induk bervariasi, dan variasi ber-harga-sendiri.
- **R2 UI** ✔: `ProductForm` menerima prop `producer` (mode produsen): menyembunyikan slug, SKU induk, SEO, gratis ongkir, ambil sendiri, pemilih produsen, centang "khusus anggota tenant", tombol toggle status; harga dasar read-only (induk dan di dialog variasi); foto dari `MemberMediaPicker`; editor deskripsi mode `basic`; pilihan status Draft/Aktif/Diarsipkan (Dibekukan → pesan, tak bisa diubah); generate variasi di klien (`lib/variation-combos.ts`, murni). Halaman `produk/baru` dan `produk/[id]/ubah` memakai form itu; `components/producer/producer-product-form.tsx` (form terpisah) DIHAPUS. Jalur simpan tetap Server Action produsen (`getProducerAccess`, whitelist, harga dasar server).
- **R3** ✔: voucher produsen boleh menarget produk bervariasi; batas nominal = harga TERENDAH di antara induk dan variasi aktif (`lowestPrices`); persentase tidak bergantung harga. Checkout dengan item = id variasi teruji (`smoke-voucher-owner.ts`: harga variasi 40.000, voucher 50% dibatasi 4.000).
- Tombol cepat di detail produk: Draft → "Tayangkan", Aktif → "Arsipkan", Arsip → "Aktifkan".
- **Regresi (DB lokal):** `smoke-producer-products` (variasi, gudang, status, sinkron persentase, beku), `smoke-producer-vouchers`, `smoke-voucher-owner`, `smoke-producer-application` semua lulus; type-check + build bersih.
- **Belum teruji di browser:** tampilan form bersama di portal produsen (mobile & desktop), pemilih foto anggota di dialog variasi, tombol Generate Variasi, hapus lewat form.
- Perilaku yang berubah: temuan audit lama "draft tidak bisa ditayangkan produsen" dicabut untuk produk milik produsen (K32).

### 15.2 Audit keamanan R1–R3 (subagent `security-auditor`, 2026-11-03) — 0 Critical, 0 High, 2 Medium, 3 Low
Tidak ada mass-assignment/IDOR (harga dasar, `producerId`, `frozen` tak bisa dikirim; id variasi milik produk lain jadi INSERT baru, tak menyentuh variasi orang lain), foto, gudang, batas produk, voucher variasi, dan halaman baru dinyatakan aman.
| Temuan | Tindakan |
|---|---|
| MEDIUM — produk beku bisa DIHAPUS produsen lalu dibuat ulang (pembekuan terlewati + slot kembali) | **Diperbaiki**: `deleteProducerProduct` menolak produk `frozen`; teruji |
| MEDIUM — keranjang/checkout tidak memeriksa `status='active'` (draft/arsip hanya tersembunyi dari halaman publik; pra-ada) | **DIPUTUSKAN user & DIPERBAIKI (K34, 2026-11-03)** — semula: dengan K32 produsen mengandalkan draft/arsip sebagai kontrol penjualan. Usulan: `resolveProductCartItem` menolak status selain `active` (jalur publik saja; invoice manual admin tetap boleh). Akibat: item draft/arsip yang terlanjur di keranjang pembeli ditolak saat checkout |
| LOW — variasi yang sudah ada di pesanan ikut terhapus | **Diperbaiki**: hanya dinonaktifkan bila dirujuk `invoice_items`/`order_items` (juga saat kembali ke produk sederhana); teruji |
| LOW — persentase dibaca di luar transaksi (harga dasar bisa basi bila admin mengubah persentase persis di sela) | **Diperbaiki**: dibaca di dalam transaksi dengan kunci baca pada baris produsen |
| LOW — nama/SKU/atribut tanpa pembatasan karakter (formula injection di ekspor CSV) | Dicatat. Render React aman; belum ditemukan ekspor CSV yang memakai kolom ini (satu-satunya `text/csv` di `lib/` bukan ekspor produk). Cek bila ekspor baru dibuat |
Tidak bisa diverifikasi dari kode: unique index pada `sku` (galat 23505 di create diasumsikan bentrok slug dan diulang 3×).

## 16. K34 — Keranjang/checkout publik hanya menerima produk berstatus `active` (disetujui user 2026-11-03)
`resolveProductCartItem` → `producerActive` kini juga `false` bila `products.status` bukan `active` (draft/arsip/dibekukan), selain produsen dinonaktifkan. Berlaku di `addToCartAction` dan `checkoutAction` (item di keranjang yang terlanjur draft/arsip ditolak: "sedang tidak tersedia"). Invoice manual admin tidak memakai flag ini → tetap boleh. Berlaku untuk SEMUA produk (bukan hanya produsen). Teruji di `smoke-producer-products.ts`. Tanpa migration.

## 17. Perbaikan hasil uji browser (2026-11-03) — K35–K38 (arahan user; sebagian merevisi K27/K31)
Setelah deploy R1–R3, uji browser menemukan 5 hal sederhana:
| # | Temuan | Keputusan / perbaikan |
|---|---|---|
| 1–2 | Slug & SKU tidak ada di form produsen | **K35** (merevisi K31): kolom Slug & SKU kini tampil sama dengan admin. Slug opsional (kosong saat buat = otomatis dari nama + akhiran acak; kosong saat ubah = slug lama dipertahankan), format `a-z0-9-` maks. 80, unik per tenant; SKU maks. 64, unik per tenant. Bentrok → pesan jelas (dicek sebelum simpan). |
| 3 | Tidak ada SEO & Meta | **K36** (merevisi K27): `SeoPanel` yang SAMA, dengan prop `restricted` untuk produsen. Boleh: Meta title/description, Focus keyword, OG title/description, Twitter card. **Disembunyikan & diabaikan server**: OG Image (butuh Media Library tenant), Canonical URL & Robots (bisa membelokkan/menghilangkan produk dari mesin pencari tenant), Schema/structured data. Teks dibatasi panjang & karakter kontrol dibuang. |
| 4 | Editor tanpa tabel & gambar dari media library | **K37** (merevisi K21/K28): toolbar produsen punya Tabel dan Gambar. Gambar dipilih lewat `MemberMediaPicker` (Media Library ANGGOTA). Server menyimpan node gambar HANYA sebagai `{mediaId, alt}`, lalu `resolveDescriptionImages` membangun ulang `src` dari baris `member_media` milik anggota pemilik produsen — `src` dari klien tak pernah dipakai, gambar milik orang lain/bertujuan khusus dibuang; maks. 20 gambar. Tabel hanya struktur (colspan/rowspan 1–10). Embed, galeri, tautan terkait, code tetap tak tersedia. Gambar di deskripsi dihitung "sedang dipakai" oleh `findMediaInUse` (foto tak bisa dihapus dari Media Library selama dipakai). |
| 5 | Header form (breadcrumb "Produk" + badge status) menutupi judul & sidebar ("Harga & Stok") | **K38**: penyebab = pembungkus `-m-4 h-[calc(100%+2rem)]` (tinggi persen terhadap `<main>` yang tak punya tinggi pasti → form lebih tinggi dari area). Diganti `<main className="relative">` + pembungkus `absolute inset-0`, sehingga form menempel tepat pada area konten (sama seperti di dashboard admin). **Belum diverifikasi visual di browser.** |
Teruji: `smoke-producer-products.ts` (parse slug/SKU/SEO, simpan, bentrok slug/SKU, SEO terlarang diabaikan, tabel/gambar deskripsi, gambar orang lain dibuang, gambar deskripsi dihitung dipakai). Tanpa migration (kolom sudah ada).

### 17.1 Audit K35–K38 (subagen `security-auditor`, 2026-11-03) — 0 Critical, 0 High, 0 Medium, 4 Low
Gambar/URL asing di deskripsi, canonical/robots/OG image lewat payload, IDOR slug/SKU, dan injeksi LIKE dinyatakan aman.
- LOW mediaId huruf besar melewati guard "foto dipakai" → **diperbaiki** (`mediaId` di-lowercase saat sanitasi; teruji).
- LOW 23505 pada update (balapan slug/SKU) → **diperbaiki** (pesan jelas).
- LOW pesan "slug/SKU sudah dipakai" menjadi oracle keberadaan slug/SKU produk lain → **diterima** (trade-off UX, dibatasi rate limit; slug publik toh terlihat).
- LOW gambar deskripsi sisipan admin (Media Library tenant) hilang bila produsen menyimpan → **dicatat** (fail-closed; admin sebaiknya tak menyisipkan gambar di deskripsi produk produsen).
- Catatan: produsen boleh menaruh tautan `https://` eksternal di teks (bukan XSS); slug produk beku masih bisa diubah produsen — keputusan produk bila ingin dikunci.

### 17.2 Koreksi K38 (2026-11-04) — akar masalah header yang sebenarnya
`absolute inset-0` saja tidak cukup. Header form memakai `sticky top-0` di dalam `<main>` yang berpadding (`p-6`): posisi sticky mengikuti batas padding, sehingga header TURUN 1,5rem dari tepi atas dan menimpa 1,5rem teratas isi form (judul & label "HARGA & STOK"). Terukur di halaman replika (header di y=80 vs form di y=56). Perbaikan: header `shrink-0` (bukan sticky) — body di bawahnya sudah scroll sendiri; terukur header y=56, body y=105. Di dashboard admin (main tanpa padding) tidak ada perubahan perilaku.
