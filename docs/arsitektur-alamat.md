# Arsitektur Alamat (Buku Alamat + Data Tujuan RajaOngkir lokal)

> Status: **RENCANA 2026-11-02 — belum ada kode.** Diskusi dengan user malam 2026-11-02. Urutan kerja & keputusan di bawah.

## 1. Latar belakang
Alamat tersebar di 9 tempat dan dua sistem yang tidak nyambung (Kemendagri: `public.addresses`, `profiles`, `producers.custom_*`; RajaOngkir: `producer_warehouses`, `products.origin_city_*`, `mitras.rajaongkir_city_*`, config add-on; teks bebas: `invoices.shipping_address`). Pembeli mengetik alamat tiap checkout; gudang/asal produk tak bisa dipakai bersama. Cache RajaOngkir saat ini hanya di memori proses (TTL 3 menit — `lib/rajaongkir.server.ts`), hilang tiap restart.

## 2. Keputusan user (2026-11-02)
1. **RajaOngkir hanya untuk ongkos kirim transaksi toko.** Kemendagri (domisili anggota, direktori, statistik) TIDAK diubah.
2. **Buku alamat melekat pada ORANG** (`member_id` atau `profile_id`), di schema `public`, ikut ke semua tenant — seperti data identitas lain. Pemakaian khusus: alamat kirim/asal kirim berbasis RajaOngkir.
3. **Pembeli tamu/anonim:** untuk SEKARANG ikuti perilaku yang ada (pilihan A di § 5). Arah jangka panjang user: SEMUA pengguna wajib login, sistem login disederhanakan, checkout tamu kemungkinan dihapus, posisi tamu/user/anggota dirombak total — sebagai pekerjaan terpisah SETELAH refactor alamat ini selesai. Buku alamat tidak boleh bergantung pada konsep tamu.
4. **Gudang & asal produk lama BOLEH dihapus total** (belum banyak dipakai) lalu diganti struktur baru. Dilakukan dengan cadangan DB dulu + SELECT isi aktual sebelum DROP.
5. **Cache ongkir di database**, masa berlaku default **6 jam** (konstanta, bisa diatur).

## 3. Rancangan data
**`public.ro_destinations`** — salinan lokal data tujuan RajaOngkir (satu baris per kelurahan, ±80 ribu baris, ~20 MB): `id` (ID RajaOngkir, PK), `label`, `province_name`, `city_name`, `district_name`, `subdistrict_name`, `zip_code`, `search_text` (huruf kecil, untuk pencarian), `synced_at`. Pencarian tujuan dilayani Postgres (nol token). Terisi HANYA dari permintaan pengunjung (read-through, lihat § 11) — TIDAK ada crawl massal.
**`public.address_book`** — `id`, `member_id`|`profile_id` (tepat satu terisi), `label` ("Rumah", "Indah Permata"), `recipient_name`, `phone` (E.164), `destination_id` → `ro_destinations`, `detail` (jalan/RT/RW), `postal_code`, `is_default`, `deleted_at`. Nama wilayah TIDAK disalin — diambil lewat JOIN (lebih ringan, koreksi satu tempat).
**`public.ro_cost_cache`** — `origin_id, destination_id, weight, courier` → `payload jsonb`, `fetched_at`; dipakai `fetchDomesticCost` sebelum memanggil API.
**Tenant (`tenant_{slug}`)**: tabel asal-kirim baru (gudang produsen + asal default toko) dengan bentuk kolom yang SAMA (`destination_id`, `detail`, `label`) dan komponen yang sama. Pengganti: `producer_warehouses`, `products.origin_city_*`, `mitras.rajaongkir_city_*`, `origin_city_*` di config add-on (butuh keputusan rinci saat P4, termasuk mitra).
**Invoice tetap menyimpan SNAPSHOT teks** alamat (nama, HP, label, detail, wilayah) — mengubah buku alamat tidak boleh mengubah pesanan lama.

## 4. Komponen (satu untuk semua)
`<AddressForm>` (label, penerima, HP, cari tujuan dari DB lokal, detail) + `<AddressPicker>` (pilih alamat tersimpan / tambah baru / ubah). Dipakai: checkout, halaman akun (buku alamat), gudang produsen, asal default toko, pesanan manual admin, pendaftaran mitra.

## 5. Identitas pembeli — fakta kode saat ini & pilihan (keputusan #3 TERBUKA)
Fakta (`checkoutAction` + `resolveIdentity`):
- **Login:** invoice terhubung ke `member_id`/`profile_id` dari sesi.
- **Tidak login, nomor HP SUDAH terdaftar:** wajib OTP; setelah OTP, invoice terhubung ke `member_id`/`profile_id` pemilik nomor. Kalau tenant tak punya kanal OTP sama sekali → "tamu tak tertaut" (tidak terhubung; celah kecil).
- **Tidak login, nomor BELUM terdaftar:** tamu murni — invoice hanya menyimpan nama/HP/email; TIDAK ada baris identitas global. Tidak ada OTP.
Pilihan untuk buku alamat:
- **A (sederhana, awal):** pemilik buku alamat hanya `member_id`/`profile_id` yang login atau lolos OTP. Tamu murni mengetik tiap kali; ditawari daftar akun (alur register + OTP sudah ada).
- **B (sesuai usul user):** "profil bayangan" untuk tamu: setelah nomor DIVERIFIKASI OTP, buat baris `profiles` tanpa login (`better_auth_user_id` NULL — sudah nullable). Syarat: `profiles.email` kini NOT NULL UNIQUE → harus dibuat nullable (migration) dan alur klaim saat nanti mendaftar dengan nomor yang sama harus diaudit. Profil TIDAK boleh dibuat dari nomor yang belum terverifikasi (cegah penanaman alamat palsu pada nomor korban).
- Rekomendasi: **A dulu, B sebagai tahap lanjutan** setelah struktur identitas dirapikan.
Aturan keamanan: alamat adalah data pribadi — hanya tampil ke pemiliknya (sesi login atau OTP terbukti); tenant hanya melihat snapshot di invoice-nya sendiri.

## 6. Hemat token — peta
| Sumber pemakaian token | Solusi |
|---|---|
| Cari tujuan (autocomplete, `resolveDestination`) | `ro_destinations` lokal → nol token; juga menghapus false-negative audit L1 |
| Hitung ongkir tiap checkout | `ro_cost_cache` DB 6 jam; kunci berat disesuaikan hasil tes P0 |
| Isi data | read-through dari permintaan pengunjung (§ 11); TANPA crawl massal (user pernah diblokir karena pengambilan sekaligus) |

## 7. Langkah
- **P0 (spike, ±15 panggilan):** `apps/web/scripts/spike-rajaongkir-hierarchy.ts` — verifikasi endpoint provinsi/kota/kecamatan/kelurahan, bentuk respons, apakah ID kelurahan = ID pencarian = ID yang diterima API ongkir, dan pola harga per berat (menentukan kunci cache). Dijalankan user di VPS. Juga: **baca syarat layanan Komerce** soal menyimpan/menyalin data tujuan.
- P1 `ro_destinations` + `ro_search_log` + `ro_api_usage` + pencarian lokal-dulu (ganti `/api/ongkir/cities` & `resolveDestination`) — rancangan § 11.
- P2 komponen + `address_book` + halaman akun.
- P3 integrasi checkout (pilih alamat tersimpan, snapshot invoice).
- P4 asal-kirim tenant (hapus struktur lama setelah cadangan).
- P5 `ro_cost_cache`.
- (Nanti) Merapikan identitas pembeli (pilihan B) dan memetakan Kemendagri↔RajaOngkir bila perlu.

## 8. Risiko
- ID RajaOngkir bisa berubah/berbeda antar endpoint → diverifikasi P0; `synced_at` + refresh berkala; alamat tersimpan juga menyimpan label snapshot agar bisa di-resolve ulang.
- Syarat layanan penyalinan data (belum diperiksa).
- Menghapus struktur gudang/asal lama memutus ongkir sampai struktur baru terpasang → dilakukan dalam satu rilis, dengan cadangan.
- Ekstensi `pg_trgm` perlu hak DB; kalau tidak ada, pencarian awalan (`ILIKE 'x%'`) + indeks biasa.

## 9. Hasil spike P0 (dijalankan user di VPS, 2026-11-02, 11 panggilan)
- **Endpoint hierarki ADA dan jalan:** `/destination/province` (34 provinsi — data lama, tanpa provinsi Papua baru), `/destination/city/{provinsi}`, `/destination/district/{kota}`, `/destination/sub-district/{kecamatan}` (kelurahan + `zip_code`). Bentuk: `{id, name}` (+`zip_code` di kelurahan). Contoh: DIY → 5 kota; Kota Yogyakarta → 14 kecamatan; Tegalrejo → 4 kelurahan (BENER id 31397, kode pos 55243).
- **API ongkir MENERIMA ID kelurahan dari hierarki** (31397 dipakai sebagai asal, harga JNE keluar) → ID hierarki valid untuk ongkir.
- **TIDAK TERSIMPULKAN:** apakah ID hierarki = ID hasil pencarian. Tes mencari "BENER" mengembalikan 30 hasil dari seluruh Indonesia (Aceh dulu), kelurahan Yogyakarta tak termasuk — itu kegagalan desain tes, bukan bukti ID berbeda. Perlu tes ulang dengan "BENER TEGALREJO" (lihat § 10).
- **Pola harga JNE:** 900g/1000g/1001g sama (REG 16.000), 1500g/2000g sama (REG 32.000). Jadi harga naik per kilogram dengan toleransi (khas JNE: ±300 g). Pembulatan ke kilogram untuk kunci cache TIDAK aman (1001 g≠1500 g, tetapi bucket "ceil kg" akan menyamakan 1001 g dengan 2000 g); toleransi tiap kurir bisa berbeda dan hanya JNE yang diuji → **kunci cache memakai gram persis** (aman; hit-rate cukup karena kombinasi berat produk berulang), dievaluasi dari data nyata.
- **Crawl hierarki DIBATALKAN** (≈7.550 panggilan; kuota user 100/hari; user pernah diblokir karena pengambilan massal). Diganti read-through § 11.

## 10. Tes lanjutan sebelum P1 (dua perintah singkat, ±2 panggilan)
1. Cari "BENER TEGALREJO": apakah ada hasil ber-ID 31397 (ID hierarki = ID pencarian)?
2. Cari dengan `limit=1000`: berapa baris dikembalikan per halaman (kalau besar, mengisi data via pencarian berhalaman jauh lebih hemat daripada 7.000 panggilan hierarki).

## 11. Revisi 2026-11-02 malam — read-through, bukan crawl (disepakati konsepnya dengan user)
**Fakta:** paket gratis RajaOngkir/Komerce = **100 panggilan/hari**; user pernah diblokir karena pengambilan massal. Data bersifat PUBLIK dan dibagi semua tenant (schema `public`, seperti `ref_*`) — satu panggilan dari tenant mana pun menguntungkan semua.

**Alur pencarian tujuan (autocomplete):** cari di `ro_destinations` dulu → cukup? pakai lokal : panggil API → simpan semua baris hasil → jawab. Masalah inti: "ada sebagian hasil di data kita" ≠ "hasilnya lengkap". Solusi: `ro_search_log(query_norm, limit, result_count, fetched_at)`. Pertanyaan boleh dijawab lokal bila (a) query yang SAMA persis pernah diambil, atau (b) ada query-induk (awalan) yang pernah diambil dan hasilnya tidak terpotong (`result_count < limit`) — hasil query yang lebih panjang pasti himpunan bagiannya. Selain itu → API (1 panggilan), hasil + log disimpan. Ukuran halaman API (`limit`) menentukan seberapa sering terpotong → tes terbuka § 10 no. 2.
**`resolveDestination(id)` tidak lagi memanggil API:** pembeli hanya bisa memilih id dari hasil pencarian kita, jadi baris itu SUDAH ada di `ro_destinations`. Id yang tak ada di tabel = ditolak (nol panggilan). Ini juga menutup temuan audit L1 (false-negative).
**Hitung ongkir:** `ro_cost_cache` di DB, dibagi semua tenant (tarif sama), kunci = asal+tujuan+**gram persis**+kurir. TTL default 6 jam (usul: 12–24 jam mengingat kuota). Bila kuota harian habis dan ada cache KADALUARSA → pakai itu (lebih baik daripada checkout gagal); tanpa cache → "ongkir tidak bisa diverifikasi".
**Anggaran harian `ro_api_usage(day, kind, count)`** (hari WIB): batas keras sebelum memanggil API — FINAL (disepakati): pencarian publik ≤ 20, pemulihan tujuan saat checkout (`resolve`) ≤ 10 (terpisah supaya tak bisa dihabiskan pencarian publik), ongkir ≤ 60, cadangan 10. Pencarian saat habis → hanya hasil lokal + pesan; ongkir mendapat prioritas karena checkout bergantung padanya. Konstanta dapat diubah (naik saat paket berbayar). Penghitung diperbarui atomik; pada respons 429 dari upstream → berhenti memanggil sampai besok.
**Penyegaran:** tiap kali baris terlihat lagi dari API, `synced_at` diperbarui; data basi hanya bisa diperbaiki dengan pencarian baru (alamat tersimpan menyimpan label snapshot untuk di-resolve ulang bila ID berubah).
**Catatan kuota:** 100/hari cukup untuk tahap uji beberapa tenant, tidak untuk lalu lintas nyata (tiap paket checkout yang belum ada di cache = 1 panggilan; tiap ketikan yang belum tercakup = 1 panggilan). Paket berbayar kemungkinan diperlukan saat tenant bertambah.

## 12. Status P1 (2026-11-02)
**KODE SELESAI** (type-check + build bersih + smoke test 14 skenario lulus dengan DB lokal & API palsu): migration `0084_ro_destinations.sql` (3 tabel publik), `lib/ro-budget.server.ts` (anggaran harian atomik), `lib/ro-destinations.server.ts` (`searchDestinationsLocalFirst`, `resolveDestination` lokal), `/api/ongkir/cities` lokal-dulu, `shipping-verify` memakai tujuan lokal, `fetchDomesticCost` kini menghabiskan anggaran `cost` pada cache miss.
Keputusan final: cache ongkir 12 jam (P5, BELUM), cache kedaluwarsa boleh dipakai saat kuota habis (P5, BELUM), anggaran di atas.
Audit `security-auditor` P1: 0 Critical, 1 High, 3 Medium, 3 Low — DIPERBAIKI: galat upstream tak lagi dicatat sebagai "tercakup" (hanya 404 = kosong; 0 hasil dipercaya 24 jam), gerbang per-IP ketat (4/menit, 20/jam) khusus jalur yang memanggil API, jatah `resolve` terpisah + fallback 1 query, query < 3 huruf tak memicu API, single-flight per query, pesan "dibatasi" generik, sinyal degraded di resolve → "tak bisa diverifikasi" (bukan "kota tidak valid").
**Dasar terverifikasi:** lihat § 13 (tes user 2026-11-02 menggantikan asumsi awal di sini).
**Deploy:** jalankan `0084` SEBELUM build; `pg_trgm` dipakai bila tersedia (NOTICE bila tidak). Tidak ada konfigurasi baru (key tetap `RAJAONGKIR_PLATFORM_KEY` di `.env`).
**Berikutnya:** P5 (cache ongkir di DB 12 jam + pakai-yang-kedaluwarsa) paling mendesak untuk kuota 100/hari — tiap verifikasi checkout sekarang = 1 panggilan per paket bila cache memori 3 menit kosong; lalu P2 (komponen + buku alamat).

## 13. Hasil tes lanjutan + revisi logika pencarian (2026-11-02 malam)
**Fakta dari tes user di VPS:**
1. **ID hierarki = ID pencarian** (BENER = 31397 di keduanya) → satu tabel, ID valid untuk ongkir.
2. **Pencarian multi-kata API bersifat ATAU**: "BENER TEGALREJO" memuat KARANGWARU/KRICAK (hanya cocok "tegalrejo"). Jadi himpunan jawaban DAN (yang kita tampilkan) ⊆ hasil SATU kata mana pun dalam query.
3. **Halaman besar dihormati**: `search=jakarta&limit=1000` → 268 baris. `SEARCH_PAGE` = **250** (terbukti ≥268; jangan dinaikkan melewati angka yang terbukti — bila API diam-diam membatasi di bawahnya, hasil terpotong akan dianggap lengkap). Satu panggilan kini bisa menyimpan ratusan lokasi.
**Algoritma (menggantikan "hanya exact untuk multi-kata"):**
- *Tercakup* bila (a) query persis sama pernah diambil, atau (b) SALAH SATU kata (≥3 huruf) / awalan-nya (≥3) pernah diambil dan TIDAK terpotong → saring DAN lokal eksak.
- Bila belum tercakup: kandidat = kata ≥3 huruf yang BELUM punya log segar (kata yang sudah diambil tidak diambil ulang — datanya sama). Urut dari yang paling sedikit cocok di data lokal (kata langka = kelurahan, bukan kota), seri → urutan ketik. Ambil satu per satu (maks 3 jangkar) sampai ada yang tidak terpotong → jawaban eksak; query asli dicatat. Bila semua yang dicoba terpotong → jawab apa adanya + pesan "hasil mungkin belum lengkap, tambahkan kata yang lebih spesifik" (TIDAK mengklaim tercakup).
- `resolveDestination`: tabel lokal; fallback maks 2 query (kode pos, lalu kelurahan) dengan jatah `resolve`.
**Audit ronde 3 (fokus cakupan): 0 Critical, 1 High, 2 Medium, 2 Low — DIPERBAIKI:** High (jangkar "kata terpanjang" hampir selalu nama kota yang terpotong lalu query asli dicatat tercakup 90 hari) → jangkar kini kata paling langka + naik ke kata berikutnya; Medium (kata terpotong diambil ulang tiap ketukan; single-flight tidak atomik) → kata yang sudah diambil tak diambil ulang, single-flight didaftarkan sinkron per query; Low (notice menyesatkan untuk query pendek) → `source: local` tanpa notice. Smoke test 21 pemeriksaan lulus.
**Sisa/dicatat:** single-flight hanya per proses (PM2 mode cluster = satu map per instance; saat ini `fork`, 1 instance). Urutan 250 baris pertama dari API untuk kata sangat umum tak dijamin stabil; kata langka yang dipilih sebagai jangkar menghindarinya.

## 14. P5 — cache ongkir di database (rancangan 2026-11-02)
**Tujuan:** tarif sama (asal, tujuan, berat) dipakai ulang oleh semua pembeli/tenant selama 12 jam; kuota ongkir 60/hari tidak habis oleh pembeli yang membuka halaman yang sama.
- **Tabel `public.ro_cost_cache`** — kunci `(origin_id, destination_id, weight, courier)`, `weight` = **gram persis** (tes JNE: 1001 g ≠ 1500 g, pembulatan kg tidak aman), `courier` = SATU kode, `payload jsonb` (array opsi dari API untuk kurir itu — boleh kosong `[]` = kurir tak melayani rute itu), `fetched_at`. Data tarif publik, dibagi semua tenant; hanya berisi jawaban upstream.
- **Per kode kurir, bukan per permintaan:** satu panggilan multi-kurir (`jne:tiki:pos`, dari form checkout) mengisi satu baris per kode (termasuk `[]` untuk kurir yang tak punya layanan). Verifikasi saat submit (satu kurir) lalu **kena cache** — tidak membakar jatah lagi.
- **Alur `fetchDomesticCost`:** baca baris segar (< 12 jam) → kode yang kurang saja yang dikirim ke API (1 jatah `cost`) → simpan → gabungkan. Single-flight per kunci.
- **Degradasi:** jatah `cost` habis, API 429, atau API gagal → pakai baris KEDALUWARSA (maks **2 hari** — diperpendek dari 7 setelah audit) bila ada untuk SEMUA kode yang kurang; selain itu galat ("tak bisa diverifikasi"). Pemakaian dicatat di log.
- **Kebersihan:** baris > 14 hari dihapus oportunistik saat menulis. Pertumbuhan dibatasi anggaran (jatah `cost` membatasi panggilan API/hari).
- Menggantikan cache memori 3 menit di `rajaongkir.server.ts`.

## 15. Status P5 (2026-11-02)
**KODE SELESAI** (type-check + build bersih + smoke test `scripts/smoke-ro-cost.ts` 21 pemeriksaan lulus): migration `0085_ro_cost_cache.sql`, `roCostCache` di schema, `fetchDomesticCost` kini cache-DB-dulu per kode kurir (12 jam; berat gram persis), single-flight sinkron, cadangan kedaluwarsa ≤ 2 hari, bentuk opsi divalidasi (biaya > 0), simpan non-fatal.
**Anggaran harian final:** pencarian publik 20 · pemulihan tujuan checkout 10 · ongkir form publik (`cost`) 35 · ongkir verifikasi checkout (`costverify`) 25 · cadangan 10. Form publik dan verifikasi dipisah supaya berat/tujuan acak lewat `/api/ongkir/cost` tidak menghabiskan jatah pembeli yang sudah sampai tahap bayar. Cache miss lewat endpoint publik juga dibatasi per IP (4/menit, 20/jam) dan berat maksimum 200 kg.
**Audit P5: 0 Critical, 1 High, 3 Medium, 3 Low — DIPERBAIKI:** High (jatah dihabiskan berat acak) → jatah dipisah + gerbang per-IP + batas berat; Medium (respons kosong menimpa cache baik, termasuk cadangan) → kosong tak menimpa tarif positif; negatif ([]) hanya dipercaya 30 menit dan hanya disimpan bila ada bukti upstream sehat; Medium (tarif kedaluwarsa menagih pembeli) → batas 7 → 2 hari, [] kedaluwarsa tak dipakai; Low (simpan/purge gagal membuang hasil) → non-fatal; Low (bentuk payload) → difilter; kode kurir asing diabaikan.
**Keputusan bisnis yang TERBUKA:** menagih dengan tarif kedaluwarsa (≤ 2 hari) saat kuota habis tidak diberi penanda ke pembeli/admin — hanya `console.warn`. Bila ingin lebih ketat: tandai invoice atau batasi hanya untuk verifikasi bila tarif tidak lebih rendah dari yang ditampilkan.
**Risiko sisa:** (1) dengan jatah publik 35/hari, serangan dari banyak IP (atau header IP dipalsukan bila Nginx tak menimpa `X-Real-IP`/`X-Forwarded-For`) masih bisa menghabiskan jatah form publik sampai besok — cek konfigurasi Nginx (`real_ip`) dan pertimbangkan pembulatan berat ke 100 g ke atas (aman untuk toleransi JNE di kelipatan 100 g, belum teruji untuk kurir lain); (2) cache hanya efektif bila beban nyata berulang pada kombinasi (asal, tujuan, berat) yang sama.
**Deploy:** jalankan `0084` DAN `0085` SEBELUM build.
**Berikutnya:** P2 (komponen alamat + buku alamat per orang di halaman akun).
