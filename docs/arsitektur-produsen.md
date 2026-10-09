# Arsitektur — Produsen Produk (data admin-only)

> **Status: ✅ SELESAI fase 1–3 + DEPLOYED (2026-10-09; migration `0070_producers.sql` sudah jalan di VPS, dikonfirmasi user)** — type-check +
> `bun run build` bersih, uji aturan fallback lulus; **terverifikasi user di browser (2026-10-09)**. Fase 4 (opsional) sengaja belum. Dokumen ini adalah satu-satunya sumber keputusan untuk fitur ini.

## 1. Tujuan

Mencatat **siapa produsen** (pemasok/pembuat barang) tiap produk TENANT, supaya admin bisa cek cepat dan
menghubungi produsen (WhatsApp) saat ada masalah. Fondasi untuk pengembangan berikutnya: laporan ke produsen
(uang modal yang harus ditransfer) dan login khusus produsen — **bukan bagian pekerjaan ini**.

**ADMIN-ONLY.** Data produsen TIDAK PERNAH tampil di front-end publik, API publik, maupun props komponen yang
dipakai halaman publik. Hanya dashboard admin, hanya pengguna `hasFullAccess(toko)`.

## 2. Tiga jenis produsen (keputusan user)

| Jenis | Arti | Sumber data |
|---|---|---|
| **Internal** | produsennya tenant itu sendiri | pengaturan tenant: `general.site_name`, `contact.contact_phone`, `contact.contact_address` |
| **Anggota** | produsen terdaftar sebagai anggota tenant | usaha (`member_businesses`) / pesantren milik anggota (`member_owned_pesantren`) / profesional (`member_professionals`) |
| **Custom** | produsen bukan anggota | diketik admin (nama, WhatsApp, alamat) |

- **Pesantren = `member_owned_pesantren`** (milik/dikelola anggota), BUKAN direktori global `pesantren` (tidak punya
  pemilik anggota, diverifikasi platform).
- **Internal = default**: `products.producer_id IS NULL` berarti internal. Semua produk yang ada otomatis internal,
  tanpa migrasi data. Tidak ada baris produsen untuk internal.
- **Hanya produk TENANT** (`seller_type = tenant`). Produk mitra tidak punya produsen di sini (mitra = anggota yang
  menjual produknya sendiri, model terpisah; harga/komisi mitra dibahas di sesi lain). Form menyembunyikan produsen
  untuk produk mitra.

## 3. Data yang diambil

1. **Nama** — usaha: `name` (+ `brand` bila beda); pesantren: `name`; profesional: `{title} {nama anggota}` + jenis profesi
   atau `institution` (profesional tidak punya nama sendiri); custom: diketik.
2. **WhatsApp** — rantai fallback (keputusan user): **WhatsApp usaha → telepon usaha → WhatsApp pemilik (anggota)**.
   Pesantren/profesional sama (kontak sumber → kontak pemilik). Selalu dengan **label sumber** ("WA usaha",
   "Telepon usaha", "WA pemilik") karena nomor pemilik = nomor pribadi anggota. Tautan `wa.me` hanya untuk nomor
   WhatsApp (`toWaDigits`); telepon biasa tampil sebagai teks.
3. **Alamat** — alamat sumber → **alamat rumah pemilik** bila sumber tak punya (keputusan user), dengan label sumber.
   Dirakit lewat `composeAddress()` (urutan: detail → desa → kec → kab → prov → kodepos).

Semua dihitung **saat dibaca (referensi hidup)**, bukan disalin: anggota mengganti nomor → admin langsung melihat yang
terbaru. Hanya `name_cache` (nama) yang disimpan sebagai cadangan kalau baris sumber kelak dihapus.

## 4. Model data (schema TENANT, pola ADR-0003: Drizzle pgSchema factory, FK via DDL, enum-as-text)

```
tenant_{slug}.producers
  id            uuid pk
  type          text  'member' | 'custom'         -- internal = tanpa baris
  source_type   text  'usaha' | 'pesantren' | 'profesional'   -- hanya type=member
  source_id     uuid  -- id baris di public.member_businesses / member_owned_pesantren / member_professionals
  member_id     uuid  -- pemilik (FK public.members via DDL) — untuk cek keanggotaan + fallback kontak
  name_cache    text  -- cadangan nama kalau sumber hilang
  custom_name, custom_whatsapp (E.164), custom_address_detail,
  custom_province_id, custom_regency_id, custom_district_id, custom_village_id, custom_postal_code   -- hanya type=custom
  notes         text
  is_active     boolean default true
  created_by, created_at, updated_at

tenant_{slug}.products
  + producer_id uuid NULL  -- FK producers(id) ON DELETE SET NULL via DDL; NULL = internal
```

Alasan tabel produsen terpisah (bukan kolom di produk): satu produsen memasok banyak produk (cegah duplikat
ketik ulang), dan fondasi laporan per produsen + login produsen nanti. Alamat custom disimpan sebagai kolom tenant
yang merujuk tabel referensi wilayah (`public.ref_*`, read-only), BUKAN memasukkan baris ke `public.addresses`
(tabel shared lintas tenant — jangan dicemari data custom satu tenant).

Migration `0070_producers.sql` (loop tenant aktif; `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE products ADD COLUMN IF NOT EXISTS`)
+ DDL `create-tenant-schema.ts` + Drizzle `schema/tenant/producers.ts`. Jalankan di VPS SEBELUM deploy kodenya.

## 5. Keamanan & isolasi (poin Critical)

- **Isolasi tenant**: tabel sumber ada di schema `public`. Memilih produsen anggota WAJIB divalidasi SERVER-SIDE:
  (a) `member_id` punya baris `tenant_memberships` untuk `access.tenant.id` dengan aturan keanggotaan di bawah;
  (b) baris sumber benar milik `member_id` itu (`source.member_id = member_id`). `source_id`/`member_id` dari client
  TIDAK dipercaya. Tanpa ini admin tenant A bisa memasukkan usaha anggota tenant B (IDOR).
- **Aturan "anggota tenant"** — SATU fungsi bersama dengan Harga Anggota (`lib/session-type.server.ts`; sekarang
  duplikat di `event/actions.ts`): `tenant_memberships.status IN ('active','alumni')`; tenant forum wajib
  `forum_status = 'active'`. ⚠️ Kata user semula "anggota tenant **aktif**" — implementasi sekarang ikut aturan tiket
  event (aktif + alumni). **Kalau user mau "aktif saja", ubah di SATU fungsi itu** (berlaku juga untuk Harga Anggota).
- **Hak akses**: semua aksi/halaman produsen = `getTenantAccess(slug)` + `hasFullAccess(tenantUser, "toko")`. Pengguna
  baca-saja tidak melihat kartu produsen (nomor pribadi anggota).
- **Anti-kebocoran publik**: query produk publik wajib `select` kolom eksplisit (sudah begitu) — `producer_id` tidak
  boleh ikut. Data produsen tidak dikirim ke komponen client publik; di admin hanya ke pengguna berhak (pelajaran
  `lessons-learned` [2026-10-09]: payload client = publik).
- **Validasi input**: WhatsApp custom lewat `<PhoneInput>` + `normalizePhone()`; wilayah lewat `WilayahSelect`; semua
  dropdown Combobox (standar UI project). Server memvalidasi ulang.
- **Perilaku saat data berubah**: anggota keluar tenant → kartu tampil lencana "bukan anggota lagi", **data TETAP tampil** (keputusan user
  2026-10-09: alat internal admin untuk menghubungi produsen; admin yang memutuskan). Versi review sempat menyembunyikan kontak —
  DITARIK atas permintaan user; baris sumber dihapus → tampil `name_cache` + "data sumber dihapus"; produsen dipakai produk → tidak bisa
  dihapus, hanya dinonaktifkan; produk yang merujuk produsen nonaktif tetap tampil dengan tanda.

## 6. Lapisan baca — `lib/producer.server.ts` (admin-only)

`resolveProducer(tenantClient, tenant, producerId | null)` → `{ kind: internal|member|custom, name, nameSource, whatsapp:
{ value, source, isWhatsapp }, address: { text, source }, owner?: { memberId, name }, membership: ok|left, sourceMissing }`.
Satu fungsi dipakai halaman detail, daftar produsen, dan (nanti) export — supaya fallback tidak terduplikasi (pelajaran
"satu sumber aturan" dari harga). Batch variant untuk daftar (hindari N+1).

## 7. UI admin

1. **`/app/{slug}/toko/produsen`** — daftar + tambah/edit/nonaktifkan. Tambah anggota: pilih jenis (usaha/pesantren/profesional)
   → Combobox sumber (server-side search, hanya anggota tenant ini, 20 hasil, tampil nama sumber + nama pemilik + lencana
   "ada WA"). Tambah custom: form nama + WhatsApp + alamat.
2. **Form produk** — field "Produsen" (Combobox): *Internal (nama tenant)* default + daftar produsen aktif. Disembunyikan untuk produk mitra.
3. **Detail produk admin** — kartu "Produsen": nama, jenis, WhatsApp (tombol buka WhatsApp + label sumber), alamat (+ label sumber),
   lencana status. Hanya `hasFullAccess(toko)`.
4. **Opsional fase berikut**: kolom "Produsen" di daftar produk; kolom Produsen + WhatsApp di export laporan produk.

## 8. API pendukung

`GET /api/ref/producer-sources?slug=&type=usaha|pesantren|profesional&q=` — `getTenantAccess` + `hasFullAccess(toko)`; JOIN
`tenant_memberships` (aturan di § 5); max 20 hasil; response hanya yang dibutuhkan picker (id sumber, nama, nama pemilik,
ada-tidaknya WhatsApp) — **tidak** mengirim nomor/alamat ke picker. Tidak ada endpoint publik.

## 9. Fase pengerjaan (urut)

1. ✅ Schema Drizzle (`schema/tenant/producers.ts`, `products.producer_id`) + DDL + migration `0070` + fungsi keanggotaan bersama
   (`lib/tenant-membership.server.ts`; `session-type.server.ts` memakainya — `event/actions.ts` SENGAJA tidak disentuh, aturannya
   beda: tidak cek forum_status) + `lib/producer-resolve.ts` (murni, 12 skenario fallback diuji) + `lib/producer.server.ts`.
2. ✅ API picker `/api/ref/producer-sources` + `toko/produsen/actions.ts` + halaman `/toko/produsen` (+ menu "Produsen" di TokoNav).
3. ✅ Combobox "Produsen" di form produk (edit + baru; disembunyikan untuk produk mitra) + kartu "Produsen" di detail produk admin.
4. (Opsional) kolom daftar produk + export.

## 10. Di luar cakupan (sengaja)

Laporan per produsen, login/portal produsen, input data pengiriman oleh produsen, produsen untuk produk mitra, snapshot
produsen per transaksi (sama seperti modal: perubahan produsen pada produk tidak membekukan histori).

## 11. Keputusan user yang sudah dikunci (2026-10-09)

Admin-only (tidak pernah publik) · pesantren = milik anggota · fallback WhatsApp usaha→telepon usaha→WhatsApp pemilik · fallback alamat ke
alamat rumah pemilik · daftar produsen terpisah yang dipakai banyak produk · aturan anggota tenant sama dengan Harga Anggota ·
produsen hanya untuk produk tenant. **Terbuka satu hal**: apakah alumni dihitung anggota (lihat § 5).

## 12. Catatan implementasi (2026-10-09)

- Custom: hanya **nama wajib**; WhatsApp & alamat opsional (WhatsApp lewat `PhoneInput` + `normalizePhone`, error bila tak valid).
- Produsen anggota: hanya **catatan** yang bisa diubah (data lain mengikuti profil anggota); ganti sumber = buat produsen baru.
  Duplikat sumber ditolak. Hapus hanya bila tidak dipakai produk; selain itu nonaktifkan.
- `updateProductAction`/`createProductAction`: `producerId` `undefined` = tidak diubah, `null` = internal, string = divalidasi (ada di
  tabel producers tenant + aktif, kecuali sudah jadi produsen produk itu; produk mitra ditolak).
- Form produk hanya menerima id + nama produsen (tanpa nomor/alamat); kartu detail produk memuat kontak hanya untuk `hasFullAccess(toko)`.
- Tidak ada `select()` penuh pada `products` di jalur publik (dicek) → `producer_id` tidak bocor ke payload publik.

**Cara tes manual**: (1) `/app/{slug}/toko/produsen` → kartu Internal tampil (nama + kontak + alamat dari pengaturan tenant). (2) Tambah → Dari
Anggota → pilih usaha/pesantren/profesional: hanya anggota tenant ini yang muncul; produsen tersimpan dengan WhatsApp usaha, atau WA
pemilik berlabel "WA pemilik (anggota)" bila usaha tak punya. (3) Tambah Custom (nama saja cukup). (4) Edit produk → pilih Produsen →
simpan → detail produk menampilkan kartu Produsen (tombol WhatsApp). (5) Produk tanpa pilihan = Internal. (6) Buka halaman publik produk
(view-source) → tidak ada data produsen. (7) Pengguna akses baca-saja → halaman Produsen menolak, kartu tidak muncul.

## 13. Hasil security review (2026-10-09, pasca-eksekusi, sebelum deploy)

Lolos: `getTenantAccess` + `hasFullAccess(toko)` di semua action/API/halaman; `slug` divalidasi session; sumber dimuat ulang dari `public` dan pemilik
wajib anggota sah tenant saat DIPILIH (cegah IDOR lintas tenant); picker JOIN `tenant_memberships` & tidak mengirim nomor/alamat; validasi UUID;
whitelist field custom; semua query Drizzle terparameter; produk mitra tidak bisa punya produsen; tidak ada `select()` penuh `products` di jalur
publik; form produk hanya menerima id+nama produsen. **Diperbaiki**: `normalizePhone` tidak pernah `null` untuk teks non-kosong sehingga validasi
WhatsApp custom tak efektif → server kini wajib `^\+\d{8,15}$`; tautan `wa.me` hanya digit. **Dipertimbangkan lalu DITARIK atas keputusan user**:
menyembunyikan kontak pemilik yang sudah keluar tenant (privasi) — user memilih data tetap tampil dengan lencana, karena ini alat internal admin.
**Diterima (risiko rendah)**: tidak ada unique index `(source_type, source_id)` — dua klik bersamaan bisa membuat duplikat (admin-only).
