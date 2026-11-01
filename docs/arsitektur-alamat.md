# Arsitektur Alamat (Buku Alamat + Data Tujuan RajaOngkir lokal)

> Status: **RENCANA 2026-11-02 — belum ada kode.** Diskusi dengan user malam 2026-11-02. Urutan kerja & keputusan di bawah.

## 1. Latar belakang
Alamat tersebar di 9 tempat dan dua sistem yang tidak nyambung (Kemendagri: `public.addresses`, `profiles`, `producers.custom_*`; RajaOngkir: `producer_warehouses`, `products.origin_city_*`, `mitras.rajaongkir_city_*`, config add-on; teks bebas: `invoices.shipping_address`). Pembeli mengetik alamat tiap checkout; gudang/asal produk tak bisa dipakai bersama. Cache RajaOngkir saat ini hanya di memori proses (TTL 3 menit — `lib/rajaongkir.server.ts`), hilang tiap restart.

## 2. Keputusan user (2026-11-02)
1. **RajaOngkir hanya untuk ongkos kirim transaksi toko.** Kemendagri (domisili anggota, direktori, statistik) TIDAK diubah.
2. **Buku alamat melekat pada ORANG** (`member_id` atau `profile_id`), di schema `public`, ikut ke semua tenant — seperti data identitas lain. Pemakaian khusus: alamat kirim/asal kirim berbasis RajaOngkir.
3. **Pembeli tamu/anonim:** BELUM diputuskan — lihat § 5.
4. **Gudang & asal produk lama BOLEH dihapus total** (belum banyak dipakai) lalu diganti struktur baru. Dilakukan dengan cadangan DB dulu + SELECT isi aktual sebelum DROP.
5. **Cache ongkir di database**, masa berlaku default **6 jam** (konstanta, bisa diatur).

## 3. Rancangan data
**`public.ro_destinations`** — salinan lokal data tujuan RajaOngkir (satu baris per kelurahan, ±80 ribu baris, ~20 MB): `id` (ID RajaOngkir, PK), `label`, `province_name`, `city_name`, `district_name`, `subdistrict_name`, `zip_code`, `search_text` (huruf kecil, untuk pencarian), `synced_at`. Pencarian tujuan dilayani Postgres (nol token). Terisi lewat (a) crawl bertahap per provinsi→kota→kecamatan→kelurahan dan (b) upsert otomatis dari setiap hasil pencarian/pemuatan API ("chunk": apa pun yang dimuat sekali tidak dimuat lagi).
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
| Isi data awal | crawl bertahap (cron, sebagian per jalan), sekali; lalu hanya refresh berkala |

## 7. Langkah
- **P0 (spike, ±15 panggilan):** `apps/web/scripts/spike-rajaongkir-hierarchy.ts` — verifikasi endpoint provinsi/kota/kecamatan/kelurahan, bentuk respons, apakah ID kelurahan = ID pencarian = ID yang diterima API ongkir, dan pola harga per berat (menentukan kunci cache). Dijalankan user di VPS. Juga: **baca syarat layanan Komerce** soal menyimpan/menyalin data tujuan.
- P1 `ro_destinations` + crawl + pencarian lokal (ganti `/api/ongkir/cities` & `resolveDestination`). 
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
