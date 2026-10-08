# Arsitektur — Produsen Produk (data admin-only)

> **Status: RENCANA — BELUM DIEKSEKUSI (2026-10-09).** Disetujui user ("ikut saran"), menunggu persetujuan
> eksplisit untuk mulai kode. Dokumen ini adalah satu-satunya sumber keputusan untuk fitur ini.

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
- **Perilaku saat data berubah**: anggota keluar tenant → kartu tampil lencana "bukan anggota lagi" (data tetap tampil, admin
  memutuskan); baris sumber dihapus → tampil `name_cache` + "data sumber dihapus"; produsen dipakai produk → tidak bisa
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

1. Schema Drizzle + DDL + migration `0070` + fungsi keanggotaan bersama (refactor `session-type.server.ts` + `event/actions.ts`
   memakai satu fungsi) + `lib/producer.server.ts` + uji aturan fallback (skenario: usaha punya WA / hanya telepon / kosong →
   pemilik; sumber dihapus; anggota keluar).
2. API picker + halaman `/toko/produsen` (CRUD).
3. Field di form produk + kartu di detail produk.
4. (Opsional) kolom daftar produk + export.

## 10. Di luar cakupan (sengaja)

Laporan per produsen, login/portal produsen, input data pengiriman oleh produsen, produsen untuk produk mitra, snapshot
produsen per transaksi (sama seperti modal: perubahan produsen pada produk tidak membekukan histori).

## 11. Keputusan user yang sudah dikunci (2026-10-09)

Admin-only (tidak pernah publik) · pesantren = milik anggota · fallback WhatsApp usaha→telepon usaha→WhatsApp pemilik · fallback alamat ke
alamat rumah pemilik · daftar produsen terpisah yang dipakai banyak produk · aturan anggota tenant sama dengan Harga Anggota ·
produsen hanya untuk produk tenant. **Terbuka satu hal**: apakah alumni dihitung anggota (lihat § 5).
