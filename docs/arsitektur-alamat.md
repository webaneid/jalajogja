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

## 16. P2 — komponen alamat + buku alamat per orang (rancangan 2026-11-02)
**Cakupan:** tabel `public.address_book`, pustaka server, halaman `/akun/alamat` (anggota & akun publik), komponen bisa pakai ulang `AddressFields`. TIDAK termasuk: pemakaian di checkout (P3), gudang/asal kirim tenant (P4).
- **Tabel `public.address_book`** (migration `0086`): `id`, `member_id` XOR `profile_id` (CHECK tepat satu terisi; FK `ON DELETE CASCADE`), `label` (≤40, "Rumah", "Indah Permata"), `recipient_name` (2–100), `phone` (E.164 via `normalizePhone`), `destination_id` → `ro_destinations(id)`, `detail` (5–300: jalan/RT/RW/patokan), `is_default`, `created_at/updated_at`. Satu alamat utama per orang dijaga indeks unik parsial (per `member_id` dan per `profile_id`). Maks **20 alamat/orang**. Hapus = hard delete (invoice menyimpan snapshot sendiri, § 3).
- **Kepemilikan dari SESI:** pemilik ditentukan server dari `getAkunIdentity(session.user.id)` (`memberId`/`profileId`) — TIDAK pernah dari input. Semua query `WHERE id = ? AND <kolom pemilik> = ?` (anti-IDOR). Buku alamat tak punya konsep tenant (ikut orangnya ke semua tenant); `slug` hanya untuk perutean.
- **Validasi server** (`lib/address-book.ts`, murni, dipakai server action & uji): label, penerima, HP wajib valid E.164, `destination_id` harus ADA di `ro_destinations` (cek lokal, nol panggilan API — pembeli hanya bisa memilih dari hasil pencarian kita), detail. Alamat pertama otomatis utama; menjadikan utama = transaksi (cabut yang lain lalu set); menghapus yang utama → alamat terbaru berikutnya jadi utama.
- **Aksi** (`akun/alamat/actions.ts`, server action): `saveAddressAction` (tambah/ubah), `deleteAddressAction`, `setDefaultAddressAction`; mengembalikan daftar terbaru. Pembatas laju per pengguna untuk penulisan.
- **Komponen:** `components/address/address-fields.tsx` — terkendali, tanpa logika simpan (label, penerima, `PhoneInput`, `RajaOngkirCityPicker`, detail) supaya dipakai ulang P3/P4. `RajaOngkirCityPicker` menampilkan `notice` bila pencarian dibatasi.
- **Navigasi:** item "Alamat" (ikon MapPin) di `MEMBER_NAV_ITEMS` & `PUBLIC_NAV_ITEMS`; bottom-nav mobile ikut otomatis (masuk drawer "Lainnya").
- **Keamanan/privasi:** alamat = data pribadi; hanya pemilik (sesi) yang membaca/ubah; tenant tidak punya jalur baca buku alamat orang (hanya snapshot di invoice pada P3).

## 17. Status P2 (2026-11-02)
**KODE SELESAI** (type-check + build bersih; rute `/{slug}/akun/alamat` terdaftar; smoke test `scripts/smoke-address-book.ts` 19 pemeriksaan lulus dengan DB lokal NYATA — CRUD, isolasi antar pemilik, batas 20, CHECK/indeks unik database, CASCADE). Migration `0086_address_book.sql` (setelah `0084`). Berkas: `schema/public/address-book.ts`, `lib/address-book.ts` (validasi murni), `lib/address-book-store.server.ts` (CRUD terikat pemilik + advisory lock per pemilik), `lib/address-book.server.ts` (pemilik dari sesi), `akun/alamat/{page,actions,alamat-client}`, `components/address/address-fields.tsx` (dipakai ulang P3/P4), nav "Alamat", `RajaOngkirCityPicker` menampilkan `notice`.
**Audit `security-auditor`: 0 Critical, 0 High, 2 Medium, 4 Low. Tidak ada IDOR/kebocoran lintas-tenant.** DIPERBAIKI: redirect loop untuk pengguna login tanpa identitas (pengurus murni) — `resolveAddressOwnerState` membedakan "belum login" dari "tanpa identitas".
**Batas yang DIKETAHUI (tidak diubah):**
- Pengguna yang punya baris `members` DAN `profiles` dengan `betterAuthUserId` sama selalu dianggap anggota (`getAkunIdentity` memeriksa anggota dulu); alamat milik profil-nya tak tampil. Kode saat ini tidak punya alur yang membuat keadaan ganda itu (tak ada aksi "tautkan profil ke anggota"; `deleteProfileAction` adalah penghapusan admin yang memang menghapus alamatnya lewat CASCADE). Bila alur penautan dibuat kelak: pindahkan baris `address_book` dari `profile_id` ke `member_id` dalam satu transaksi.
- `ro_destinations` TIDAK boleh dihapus/di-`TRUNCATE ... CASCADE` di DB berisi `address_book` (FK tanpa ON DELETE; skrip smoke hanya aman di DB lokal).
- Hak hapus data anggota (`members`) butuh prosedur di luar kode (tak ada hard-delete anggota di aplikasi); CASCADE akan menghapus alamatnya.
- Pembatas laju penulisan di memori satu proses (PM2 `fork` = satu proses, aman saat ini).
**CATATAN WAJIB UNTUK P3:** invoice menyimpan SNAPSHOT alamat (nama, HP, label, detail, wilayah), BUKAN referensi `address_book.id` yang bisa di-JOIN tenant; jangan masukkan buku alamat ke ekspor pembeli/log.
**Deploy:** jalankan `0084`, `0085`, lalu `0086` SEBELUM build. Belum diuji di browser (halaman butuh login): tambah/ubah/hapus/jadikan utama, pencarian lokasi, tampilan mobile.

## 18. P3 — checkout memakai buku alamat + snapshot di invoice (rancangan 2026-11-02)
**Cakupan:** (1) pembeli login memilih/menambah/mengubah alamat langsung di checkout; (2) invoice menyimpan SNAPSHOT penerima + alamat; (3) label/halaman pesanan memakai penerima snapshot; (4) menu "Alamat Kirim" (rename dari "Alamat"). Buku alamat TIDAK pernah dibaca tenant/admin/penjual.
- **Server yang menurunkan alamat.** Payload checkout membawa `shipping.addressId` (opsional). `checkoutAction` memuat alamat itu lewat `getAddress(owner, id)` — `owner` dari SESI, query terikat pemilik — lalu MENIMPA `cityId`, `cityName` (label tujuan), `address` (detail) dan menurunkan penerima (nama, HP). Kiriman klien untuk field-field itu diabaikan bila `addressId` ada. `addressId` milik orang lain / tak ada → ditolak. Tanpa `addressId` (tamu / ketik manual) → perilaku lama; penerima = pembeli.
- **Snapshot di invoice** (migration `0087`, DDL tenant baru, Drizzle): kolom baru `invoices.shipping_recipient_name`, `shipping_recipient_phone` (NULL = penerima = pembeli). `shipping_address`/`shipping_city_id`/`shipping_city_name` yang sudah ada tetap jadi snapshot alamat. TIDAK menyimpan `address_book.id` (tenant tak boleh bisa JOIN ke buku alamat).
- **Pemakaian penerima snapshot** (`recipient ?? pembeli`): label pengiriman (`lib/shipping-label/build.server.ts`), halaman detail pesanan admin, detail pesanan portal produsen, halaman invoice publik pembeli. Pencarian/nama pelanggan di daftar tetap nama pembeli.
- **UI:** komponen bersama `AddressFormDialog` (dipakai halaman Alamat Kirim DAN checkout) + `AddressPicker` (kartu alamat tersimpan, alamat utama terpilih otomatis, "Tambah alamat", "Ubah", tautan "Kelola alamat", opsi "Ketik alamat lain" untuk manual). Di checkout, memilih alamat mengisi tujuan (id, label, provinsi, kota) + detail; pembeli tamu tetap memakai form lama.
- **Admin/penjual:** pesanan manual admin (`order-create-client`) TIDAK memakai buku alamat pembeli (privasi) — tetap input manual.
- **Pengujian:** `getAddress` terikat pemilik (smoke test), type-check, build, audit; uji browser (login) oleh user.

## 19. Status P3 (2026-11-02)
**KODE SELESAI** (type-check + build bersih; smoke test buku alamat 22 pemeriksaan termasuk `getAddress` terikat pemilik, pencarian, cache ongkir: semua lulus di DB lokal). Migration **`0087_invoice_shipping_recipient.sql`** (kolom `shipping_recipient_name/phone` di `invoices`, aditif, + DDL tenant baru + Drizzle).
**Yang dikerjakan:** menu "Alamat Kirim" (rename; `/{slug}/akun/alamat`); komponen bersama `AddressFormDialog` + `AddressPicker`; checkout pembeli login memilih/menambah/mengubah alamat (utama terpilih otomatis, "Kelola alamat", "Ketik alamat lain"); `checkoutAction` menurunkan tujuan/detail/penerima dari `shipping.addressId` di SERVER (pemilik dari sesi) dan MENIMPA kiriman klien; invoice menyimpan snapshot penerima; penerima snapshot dipakai di label PDF, portal produsen, pesanan mitra, detail admin ("Penerima Paket"), dan halaman invoice pembeli. Tamu / mode manual = perilaku lama.
**Audit P3: 0 Critical/High/Medium, 3 Low — DIPERBAIKI:** pembatas laju checkout dipindah SEBELUM pencarian alamat; galat `address_not_found` membuang alamat basi dari daftar klien (tidak buntu); `addressId` hanya dikirim bila ada baris kurir. Catatan Low dari audit P2 juga ditutup: skrip smoke tidak lagi `TRUNCATE ro_destinations` (dirujuk FK `address_book`) dan menolak jalan di DB non-lokal.
**Deploy:** jalankan `0084`, `0085`, `0086`, `0087` berurutan SEBELUM build. Pesanan LAMA: kolom penerima NULL → tampil seperti dulu (penerima = pembeli).
**Belum diuji di browser (butuh login + API RajaOngkir asli):** pilih/tambah/ubah alamat di checkout, ongkir sesuai tujuan alamat tersimpan, penerima di label, alamat dihapus di tab lain, tamu & mode manual, tampilan mobile.
**Berikutnya:** P4 — gudang produsen / asal kirim toko memakai komponen alamat yang sama, menggantikan struktur lama (cadangan DB + SELECT isi aktual dulu).

## 20. P4 — Asal Kirim (gudang/pabrik/toko) satu struktur (rancangan 2026-11-02)
**Masalah:** asal kirim tersebar di empat tempat dengan bentuk berbeda: `producer_warehouses` (satu gudang/produsen), `products.origin_city_id/name` (override per produk, kota saja), `tenant_addon_installations.config.origin_city_*` (asal default toko, kota saja), `mitras.rajaongkir_city_*` (asal mitra). Produsen hanya bisa punya SATU gudang; admin/toko tidak punya alamat asal yang bisa dikelola (hanya kota).
**Keputusan user (2026-11-02):** gudang & asal produk lama boleh dihapus total setelah cadangan; admin (sebagai produsen/toko) dan produsen bisa menambah/mengurangi/mengubah banyak alamat asal ("alamat pabrik"), dengan komponen yang sama.

### 20.1 Struktur baru
- **Tabel tenant `shipping_origins`:** `id`, `producer_id` (NULL = milik toko/internal; FK `producers` RESTRICT), `label` (≤60: "Gudang Utama", "Pabrik Sleman"), `detail` (alamat lengkap ≤300), `destination_id` → `public.ro_destinations(id)`, `is_default`, timestamps. Satu "utama" per pemilik (indeks unik parsial; NULL-owner juga satu). Maks 10 per pemilik.
- **`products.origin_id`** (NULL = ikut asal utama pemilik; FK `shipping_origins` RESTRICT) menggantikan `origin_city_id/name`. Produk hanya boleh menunjuk asal milik produsennya (atau milik toko bila tanpa produsen) — divalidasi server.
- **Urutan penentuan asal produk tenant (menggantikan "gudang → override per-produk → default toko"):** (1) `products.origin_id` (pilihan eksplisit admin/produsen) → (2) asal utama produsen → (3) asal utama toko. Produk mitra tetap memakai kota mitra (`mitras.rajaongkir_city_*`) — **di luar cakupan P4** (alur daftar mitra berbeda; diputuskan kemudian).
- **Satu sumber kode:** `lib/shipping-origins.server.ts` (indeks + penentu asal + CRUD terikat pemilik) dipakai `buildSellerGroups`, halaman pesanan manual admin, label (alamat pengirim), dan pickup. `loadDefaultWarehouses` dipertahankan sebagai pembungkus tipis (tipe `WarehouseOrigin` sama) supaya pemakai lain tidak berubah.
- **UI:** `OriginManager` (satu komponen, memakai `AddressFields` tanpa kolom penerima): Portal Produsen → Profil (produsen kelola asalnya sendiri; id produsen dari SESI), halaman admin baru **Toko → Asal Kirim** (asal toko + kelola atas nama produsen mana pun, `hasFullAccess(toko)`), form produk (Combobox "Asal pengiriman": ikuti asal utama / pilih salah satu). Pengaturan add-on RajaOngkir tidak lagi memuat kota asal (hanya kurir; tautan ke Asal Kirim).

### 20.2 Migrasi bertahap (deploy step by step)
- **Tahap A — `0088_shipping_origins.sql` (ADITIF, aman):** buat `shipping_origins` + `products.origin_id`; salin data lama: gudang produsen → asal produsen; asal default toko (config add-on) → asal toko; override per-produk → asal pemilik produk + `origin_id`. Baris `public.ro_destinations` yang belum ada dibuat dari label RajaOngkir lama (format "KEL, KEC, KOTA, PROV, KODEPOS"; yang tidak bisa diurai DILEWATI + NOTICE). Tabel/kolom lama TIDAK disentuh. Penyalinan data hanya terjadi pada jalan PERTAMA tiap tenant (saat `shipping_origins` belum ada); menjalankan ulang sesudah UI dipakai tidak menghidupkan kembali data yang sudah diubah/dihapus. Kode baru hanya membaca struktur baru.
- **Verifikasi:** asal terbaca benar, ongkir checkout sesuai, label pengirim benar.
- **Tahap B — `0089_drop_legacy_origins.sql` (DESTRUKTIF, setelah CADANGAN DB + verifikasi):** hapus `producer_warehouses`, `products.origin_city_id/name`; definisi Drizzle lama dihapus pada commit yang sama. (`origin_city_*` di config add-on diabaikan kode; boleh dibersihkan.)

### 20.3 Keamanan
Pemilik asal dari sesi/otorisasi (produsen: `getProducerAccess`; admin: `getTenantAccess`+`hasFullAccess(toko)`); `producerId` dari input admin divalidasi ada di tenant; `destination_id` harus ada di `ro_destinations` lokal; hapus asal yang dipakai produk ditolak; alamat asal bukan data publik (hanya label kota "KOTA, PROVINSI" untuk pembeli; alamat lengkap hanya untuk pickup yang dipilih pembeli & label pengirim).

## 21. Status P4 Tahap A (2026-11-02)
**KODE SELESAI** (type-check + build bersih; smoke test `scripts/smoke-shipping-origins.ts` 30 pemeriksaan lulus dengan DB lokal NYATA — CRUD, isolasi antar pemilik, indeks, urutan penentuan asal, `buildSellerGroups` refaktor, gagal-tertutup; migrasi 0088 diuji dengan data benih: gudang, asal toko dari config add-on, override produk, label rusak dilewati+NOTICE, jalan ulang tidak menghidupkan data lama). Migration **`0088_shipping_origins.sql`**.
**Dikerjakan:** tabel `shipping_origins` + `products.origin_id`; `lib/shipping-origins(.server).ts` (satu sumber: indeks, penentu asal, CRUD terikat pemilik); `buildSellerGroups`, pesanan manual admin, label pengirim, dan pickup memakai sumber yang sama; UI: `OriginManager` (Portal Produsen → Profil: banyak asal, id produsen dari SESI; Admin → Toko → **Asal Kirim**: asal toko + atas nama produsen), Combobox "Asal Pengiriman" di form produk (menggantikan kolom "Kota Asal"), pengaturan add-on RajaOngkir hanya kurir.
**Urutan penentuan asal berubah** (didokumentasikan): `products.origin_id` → asal utama produsen → asal utama toko (dulu: gudang produsen → override per-produk → default toko).
**Audit P4: 0 Critical, 1 High, 3 Medium, 4 Low — DIPERBAIKI:** High (galat baca asal → indeks kosong → paket dilewati → ongkir Rp0 diam-diam) → `loadOriginIndex` mode strict melempar di `buildSellerGroups` (checkout gagal-tertutup) + asal toko TERAKHIR tidak bisa dihapus saat ongkir RajaOngkir aktif; Medium (label wilayah lengkap produsen — kelurahan & kode pos — terkirim ke pembeli: regresi privasi) → `originCityName` ke klien = label aman "KOTA, PROVINSI"; Medium (hapus produsen yang punya asal diblokir pesan menyesatkan) → asalnya ikut dihapus atomik bila produsen tak dipakai produk; Medium (migrasi tak aman diulang) → penyalinan data hanya pada jalan pertama + cast aman. **Catatan/diketahui (tidak diubah):** (a) pickup produsen memakai asal UTAMA produsen (sama dengan yang diturunkan server saat checkout), bukan asal khusus produk; (b) migrasi membuat baris `ro_destinations` dari label RajaOngkir lama bila id belum ada — periksa pratinjau sebelum jalan; (c) pengguna dengan akses BACA Toko dapat melihat alamat gudang di pesanan manual (keputusan terbuka b di CLAUDE.md); (d) kunci advisory lock "tenant" sama antar tenant (hanya serialisasi); (e) mitra TIDAK dicakup (tetap `mitras.rajaongkir_city_*`).
**Deploy bertahap:** (1) jalankan `0084`–`0088` berurutan LALU build — SEBELUM itu lihat pratinjau: `SELECT rajaongkir_city_id, rajaongkir_city_label FROM tenant_<slug>.producer_warehouses` & config add-on, dan baca NOTICE hasil `0088` (tidak boleh ada "DILEWATI" tanpa dipahami; jumlah asal harus = gudang lama); (2) VERIFIKASI: asal tampil di Toko → Asal Kirim & Portal Produsen → Profil, ongkir checkout sesuai, label pengirim benar; (3) **Tahap B**: CADANGKAN DB (`scripts/backup-db.sh`), lalu `0089` (hapus `producer_warehouses`, `products.origin_city_id/name`, definisi Drizzle lama) — file dibuat SETELAH verifikasi, bukan sekarang.
**Belum diuji di browser:** semua UI di atas (butuh login), tampilan mobile, ongkir end-to-end dengan API RajaOngkir asli.

## 22. P4 Tahap B — hapus struktur asal kirim lama (2026-11-02)
**Tahap A TERVERIFIKASI di VPS** (user, 2026-11-02): migration 0084–0088 jalan, `forbis` (gudang 1, asal toko 1, override produk 2) terbawa benar, checkout/asal tampil sesuai.
**Kode Tahap B SELESAI** (type-check + build bersih; 4 smoke test lulus dengan DB lokal SETELAH 0089 dijalankan — membuktikan tak ada kode yang membaca kolom lama): definisi Drizzle `producer_warehouses` & `products.origin_city_*` dihapus; DDL tenant baru tidak lagi membuatnya; migration **`0089_drop_legacy_origins.sql`** (satu transaksi; pengaman: BATAL bila tenant belum punya `shipping_origins` atau gudang lama lebih banyak daripada asal produsen baru — diuji lokal; idempotent).
**URUTAN DEPLOY (terbalik dari migrasi aditif — kode DULU, baru hapus kolom):**
1. `git pull` → `bun install && bun run build && pm2 restart jalajogja && pm2 flush jalajogja` (kolom lama masih ada; kode yang tak mengenalnya aman).
2. Uji ringan (Toko → Asal Kirim, form produk, satu checkout) — memastikan build baru sehat sebelum menghapus apa pun.
3. **CADANGAN penuh** lalu pastikan berkas wajar:
   `docker compose exec -T postgres pg_dump -U jalakarta -Fc jalakarta > ~/pra-0089-$(date +%F_%H%M).dump && ls -lh ~/pra-0089-*.dump`
   (opsional cek isi: `docker compose exec -T postgres pg_restore -l < ~/pra-0089-*.dump | head`). Skrip penuh `scripts/backup-db.sh` (termasuk MinIO + rclone) juga boleh.
4. `docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0089_drop_legacy_origins.sql` — baca NOTICE: tiap tenant "OK … dihapus"; bila ada "BATAL" tidak ada yang terhapus (baca pesannya).
5. Pemulihan bila perlu: `pg_restore` dari berkas cadangan (`scripts/restore-db.sh`).
**Tidak disentuh:** `mitras.rajaongkir_city_*` (mitra di luar cakupan), `invoice_shipping_lines.origin_city_*` (snapshot pesanan).
**Sisa pekerjaan alamat:** mitra memakai struktur asal yang sama (belum diputuskan); alamat asal pickup khusus produk; keputusan terbuka viewer-toko melihat alamat gudang.

### 22.1 Hasil deploy Tahap B (user, VPS, 2026-11-02)
Kode `f332df2` ter-deploy (build + restart); cadangan `pg_dump -Fc` 6,3 MB (valid: `pg_restore -l` terbaca); `0089` sukses di 5 tenant — `forbis`: gudang lama=1, asal produsen baru=2 (pengaman lolos); log error PM2 kosong. **Seluruh refactor alamat P0–P5 + P4 Tahap A/B sekarang DEPLOYED.** Simpan berkas cadangan beberapa hari (berisi data pribadi — jangan dibagikan; hapus setelah yakin).
**Masih perlu uji browser oleh user (belum dikonfirmasi):** buku alamat (`/akun/alamat`) tambah/ubah/hapus/utama; checkout memilih/menambah alamat; nama penerima di label & halaman pesanan; ongkir sesuai tujuan; tampilan mobile.

## 23. Perbaikan UI checkout multi-paket (2026-11-02, masukan user setelah uji browser)
Saat keranjang berisi barang dari beberapa penjual/produsen/asal (≥ 2 paket), langkah pengiriman di checkout menampilkan **"<produk> dikirim dari <kota - provinsi>"** per paket (dulu hanya nama toko, mis. "forbis (SLEMAN)"), sehingga pembeli tahu produk mana dikirim dari mana. Berlaku di: pilihan Metode Pengiriman (Kurir/Ambil Sendiri), daftar "Paket dikirim dari", kartu pilihan kurir (langkah 3), dan ringkasan ongkir. Satu paket saja = tampilan lama. Daftar produk dipotong "+N produk lain" setelah 3 nama; wilayah memakai label AMAN (`publicCityLabel`: tanpa kelurahan/kode pos, juga untuk asal mitra). Murni tampilan (`components/billing/checkout-form.tsx`, fungsi `packageTitle`); tidak mengubah perhitungan/penyimpanan. Belum diterapkan di halaman invoice pembeli (masih memakai nama penjual pada baris pengiriman).
