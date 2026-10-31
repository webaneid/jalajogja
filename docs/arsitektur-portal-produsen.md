# Arsitektur Portal Produsen — produsen login, lihat produknya sendiri (baca-saja)

> **Status: RENCANA (2026-10-31), belum ada kode.** Keputusan user sudah dikunci di § 9. Eksekusi dimulai setelah perbaikan audit (`arsitektur-produsen.md` § 15).
> Terkait: `docs/arsitektur-produsen.md` (data produsen, admin-only; § 15 = perbaikan hasil audit yang
> dikerjakan SEBELUM portal), `docs/arsitektur-role-user.md` (pengurus), `docs/arsitektur-akun.md` (3 level akses).

## 1. Tujuan & batas (permintaan user 2026-10-31)

Produsen (pemasok/pembuat barang) bisa **masuk ke dashboard** dan hanya bisa:
1. membuka **Toko**, lalu
2. melihat **daftar produk yang terikat dengannya** (yang didaftarkan admin), dan
3. membuka **detail** produk itu.

**Tidak bisa:** membuat produk, mengedit, menghapus, mengubah stok/harga/status, melihat produk produsen lain atau
produk internal tenant, melihat pesanan/pembeli/laporan, atau membuka modul lain (Pengaturan, Media, Keuangan, dst).
Ini akses tahap awal; halaman produk akan dikembangkan kemudian (§ 10).

## 2. Temuan penting yang menentukan rancangan

Pengurus tenant disimpan di `tenant_{slug}.users` (role owner/ketua/sekretaris/bendahara/custom), dan
`getTenantAccess(slug)` (`lib/tenant.ts`) mengembalikan non-null untuk **siapa pun yang punya baris di tabel itu**.
Dihitung 2026-10-31: **175 file** memakai `getTenantAccess`, dan banyak di antaranya TIDAK memeriksa level modul sama
sekali — hanya "dia pengurus tenant ini":
`/api/media/{upload,delete,list,[id]/metadata,[id]/recrop}`, `/api/wa/{status,qr}`, `/api/instagram/oauth/*`,
`/api/ref/{customer-search,tenant-members,post-authors,public-links}`, `/api/documents/[id]/file`, `/api/letters/[id]/generate-pdf`,
`/api/events/[id]/certificate/...`, seluruh `settings/*/page.tsx` (menu Pengaturan "selalu tampil untuk semua role"),
dan sebagian `toko/{pesanan,kategori,mitra,pengaturan}/page.tsx` yang hanya bersandar pada guard layout.

Akibatnya: **menambahkan produsen sebagai baris `tenant.users` dengan role baru tidak aman** — produsen otomatis bisa
mengunggah/menghapus media, melihat QR WhatsApp tenant, membuka pengaturan, dst. Mengamankannya berarti mengaudit dan
menambal ratusan titik, dan setiap fitur baru di masa depan yang lupa cek level akan otomatis terbuka bagi produsen
(**gagal-terbuka / fail-open**). Itu bertentangan dengan prinsip "tolak secara bawaan".

## 3. Keputusan rancangan: produsen = STATUS pada akun, bukan role pengurus (keputusan user 2026-10-31)

Produsen adalah "peningkatan" dari akun anggota biasa: tetap anggota, tetapi punya **status produsen** di satu tenant yang membuka satu pintu
khusus ke dashboard. Status disimpan di tabel **public** (bukan di `tenant.users`):

```
public.producer_logins
  id           uuid PK
  user_id      text NOT NULL    -- public."user".id (Better Auth), ON DELETE CASCADE. UNIQUE = satu akun hanya bisa jadi produsen di SATU tenant
  tenant_id    uuid NOT NULL    -- tenant tempat dia produsen
  producer_id  uuid NOT NULL    -- tenant_{slug}.producers.id (FK lewat aplikasi; dibersihkan saat produsen dihapus)
  granted_at   timestamptz, granted_by uuid  -- jejak audit (tenant.users.id admin)
  UNIQUE(tenant_id, producer_id)            -- satu produsen = satu akun (produsen anggota = satu pemilik); dilonggarkan kelak bila perlu banyak staf
```

- **Satu tenant saja**: dijamin `UNIQUE(user_id)` di tingkat database (tabel tenant terpisah per schema, jadi aturan ini hanya bisa ditegakkan di tabel public).
  Di tenant lain orang itu tetap anggota biasa dan tidak bisa masuk admin.
- `getTenantAccess()` untuk akun produsen mengembalikan **null** → seluruh rute/API admin yang ada otomatis menolak (fail-closed). Tidak ada dari 175 file
  pemakai `getTenantAccess` yang perlu diubah.
- Portal memakai pintu sendiri `getProducerAccess(slug)` (§ 5). Pencarian "tenant mana milik akun ini" cukup satu query ke `producer_logins` (tidak ada loop per tenant).
- Satu orang boleh sekaligus pengurus dan produsen (dua pintu terpisah). Kelak fitur baru ditambahkan ke pintu produsen satu per satu secara sengaja — bukan lewat role yang mewarisi banyak hak.

Alasan bukan role di `tenant.users`: lihat § 2 (fail-open) dan § 11.

## 4. Siapa yang bisa punya login (keputusan user)

Hanya **anggota** yang berstatus produsen (`producers.type = 'member'`). Produsen custom (bukan anggota) **belum** bisa login di tahap ini.

| Kondisi pemilik | Cara memberi akses |
|---|---|
| Anggota sudah punya akun Better Auth (`members.better_auth_user_id`) | Admin menekan "Beri akses login" di kartu produsen → baris `producer_logins` dibuat (tanpa kata sandi baru) |
| Anggota belum punya akun | Tombol dinonaktifkan dengan keterangan "anggota belum punya akun"; tautan undangan email menyusul sebagai langkah terpisah (P3b) bila perlu |

Penegasan user 2026-10-31: **harus anggota aktif DAN sudah mengklaim akunnya.** Anggota forum berstatus "Pending Claim" (`forum_status='active'` tetapi `members.better_auth_user_id` kosong, lihat `lib/forum-status-badge.ts`) TIDAK bisa diberi akses — harus klaim akun dulu; anggota `pending`/`suspended`/`rejected` ditolak oleh `isTenantMember`. Aturan ini diperiksa di server pada pemberian akses (P3) dan pada setiap request portal (`getProducerAccess`).

Syarat saat diberi akses: pemilik anggota sah tenant itu (`isTenantMember`), produsen aktif, dan akunnya belum menjadi produsen di tenant lain (ditolak dengan pesan jelas).

## 5. Lapisan akses

`lib/producer-access.server.ts` — `getProducerAccess(slug)` dibungkus `React.cache`:
1. sesi Better Auth ada;
2. ada baris `public.producer_logins` untuk `user_id = session.user.id` **dan** `tenant_id` = tenant dari `slug` (slug tenant lain → null);
3. tenant `is_active`, produsen (`tenant_{slug}.producers`) ada dan `is_active = true`, dan pemilik masih anggota sah tenant (`isTenantMember`);
4. mengembalikan `{ tenant: {id, slug, name}, producer: {id, displayName}, userId }`, selain itu `null`.

Semua halaman portal memanggilnya di AWAL **setiap page** (bukan hanya layout — pelajaran
`lessons-learned` [2026-10-30]: layout, page, dan `generateMetadata` dirender paralel; guard layout tidak melindungi page).
Portal **tidak punya Server Action sama sekali** — jaminan baca-saja yang paling kuat: tidak ada mutasi untuk disalahgunakan.

## 6. Rute & tampilan

```
app/(producer)/app/[tenant]/portal-produsen/
  layout.tsx        shell sendiri: header (nama tenant + nama produsen + menu pengguna/keluar) + navigasi satu item "Produk"
  page.tsx          redirect ke ./produk
  produk/page.tsx   daftar produk milik produsen ini (pencarian, filter status, paginasi)
  produk/[id]/page.tsx   detail baca-saja
```

- Route group `(producer)` terpisah dari `(dashboard)`, jadi layout dashboard (yang memanggil `getTenantAccess` dan
  mengalihkan ke `/dashboard-redirect`) TIDAK membungkus portal.
- `dashboard-redirect/page.tsx`: bila `getFirstTenantForUser()` tidak menemukan baris `tenant.users`, cari baris `producer_logins`
  untuk sesi (satu query, tanpa loop tenant) → `redirect('/app/{slug}/portal-produsen')`. Sebelum jatuh ke `/no-tenant-access`.
  Bila orang itu pengurus sekaligus produsen: tetap ke dashboard admin; tautan "Portal Produsen" ditambahkan di menu pengguna.
- Gaya visual mengikuti shell Toko (daftar + detail), tanpa menu lain. Mobile: strip navigasi seperti `toko-nav.tsx`.

## 7. Data yang terlihat (keputusan user: terbuka semua untuk produknya sendiri)

Karena data produk itu berasal dari produsen, **semua field produk miliknya terlihat** (nama, foto, deskripsi, kategori, status, stok/variasi, berat,
Harga Dasar, Harga Publik, Harga Anggota, SEO ringan). Tetap baca-saja. Yang **tidak** terlihat di tahap ini: produk produsen lain / produk internal / produk mitra,
pesanan & pembeli (menyusul pada upgrade), laporan keuangan tenant, kontak produsen lain, pengaturan tenant.

Query tetap memakai `select` kolom eksplisit dengan syarat `producer_id = <produsen dari sesi> AND mitra_id IS NULL`. `id` produk dari URL **tidak dipercaya**: detail dimuat
`WHERE id = $1 AND producer_id = <produsen sesi>`; tidak ketemu → `notFound()` (UUID divalidasi dulu via `lib/is-uuid.ts`).

## 8. Perilaku & kasus tepi (keputusan user 2026-10-31)

- **Keluar dari keanggotaan tenant**: data produsen & produknya tetap ada, tetapi **akses portal hilang** — `getProducerAccess` memeriksa `isTenantMember` pada setiap request
  (aturan keanggotaan bersama, `lib/tenant-membership.server.ts`). Kartu produsen di admin tetap menampilkan lencana "Bukan anggota lagi".
- **Produsen dinonaktifkan oleh admin** (`is_active=false`): (a) portal langsung menolak, (b) **semua produk milik produsen itu tidak bisa dipesan** — disembunyikan dari
  etalase dan ditolak di keranjang/checkout. Dihitung sebagai aturan saat dibaca (bukan menulis ulang status tiap produk), sehingga mengaktifkan kembali langsung memulihkan.
  Ini mengubah alur publik/checkout → fase terpisah P6 dengan security review sendiri.
- **Cabut akses login** (tanpa menonaktifkan produsen): hapus baris `producer_logins`; produknya tetap dijual.
- **Produk dilepas dari produsen** (admin mengganti produsen produk): hilang dari daftar produsen lama pada request berikutnya.
- **Produsen dihapus**: hanya bila tidak dipakai produk (sudah ada); baris `producer_logins`-nya ikut dihapus.
- **Pengurus sekaligus produsen**: login ke dashboard admin seperti biasa; tautan "Portal Produsen" ditambahkan di menu pengguna.
- **Domain kustom (`{domain}/admin/*`)**: diperiksa pada pengujian akhir (§ 12).

## 9. Keputusan terkunci (user, 2026-10-31)

| # | Keputusan |
|---|---|
| D1 | Produsen = **status** pada akun anggota (tabel `public.producer_logins`), bukan role pengurus. Pintu terpisah ke dashboard dengan satu menu: Produk |
| D2 | Hanya anggota berstatus produsen; terikat **satu tenant saja** (`UNIQUE(user_id)`). Produsen custom belum |
| D3 | Semua data produknya sendiri terbuka, tetap baca-saja untuk sementara |
| D4 | Rute `/app/{slug}/portal-produsen/produk` (grup rute `(producer)` terpisah dari `(dashboard)`) |
| D5 | Keluar keanggotaan → data tetap, akses hilang. Produsen dinonaktifkan → portal tertutup **dan** produknya tidak bisa dipesan |

## 10. Arah pengembangan (bukan tahap ini)

Berikutnya produsen akan bisa: melihat **pesanan masuk** untuk produknya, **mengirim paket** (input resi), **mencetak label**, dan seterusnya. Tiap fitur ditambahkan sebagai halaman portal baru
dengan guard `getProducerAccess` dan aksi yang memeriksa kepemilikan (`producer_id` produk = produsen sesi) — satu per satu, masing-masing dengan dokumen + security review.
Membuat/mengedit produk oleh produsen (kemungkinan lewat persetujuan admin) dan laporan uang modal (`arsitektur-produsen.md` § 14) juga termasuk arah ini.

## 10b. Integrasi dengan Mitra (arah, dicatat 2026-10-31)

Mitra kelak menjadi status anggota yang lebih lengkap; status produsen dirancang searah dengannya (status pada anggota, pintu portal per status, aturan keanggotaan satu fungsi bersama).
Catatan lengkap + hal yang sengaja belum diputuskan: `docs/arsitektur-mitra.md` § "Rencana Integrasi dengan Status Produsen". Konsekuensi untuk rancangan ini: menu portal disusun dari
daftar status akun (bukan hardcode), dan `producer_logins` tidak diberi asumsi yang menghalangi akun yang sama punya status mitra.

## 11. Alternatif yang ditimbang

1. **Role `produsen` di `tenant.users`** — ditolak (fail-open, § 2).
2. **Akun publik (`public.profiles`) tanpa kaitan ke `tenant.users`** — untuk custom, memungkinkan akun tanpa anggota; ditunda sampai D2 diputuskan,
   karena menambah jalur pendaftaran baru.
3. **Halaman portal di dalam `/toko`** — ditolak: bergantung pada guard layout Toko yang sengaja menolak non-pengurus.

## 12. Rencana eksekusi (tiap fase: tsc → security review → commit; push hanya bila diminta)

Prasyarat: perbaikan audit `arsitektur-produsen.md` § 15 (Langkah 1–5) selesai lebih dulu.

| Fase | Isi | Migration |
|---|---|---|
| P1 | Tabel `public.producer_logins` (Drizzle `schema/public` + migration; UNIQUE(user_id), index (tenant_id, producer_id)) | 0076 (jalankan di VPS SEBELUM deploy) |
| P2 | `lib/producer-access.server.ts` → `getProducerAccess(slug)` (sesi + tenant aktif + `producer_logins` + produsen aktif + `isTenantMember`), `React.cache` | — |
| P3 | Admin: "Beri akses login" / "Cabut akses" di kartu `/toko/produsen` (syarat § 4, hanya `hasFullAccess(toko)`); (P3b opsional: undangan email untuk anggota tanpa akun) | — |
| P4 | Portal: grup `(producer)`, layout (satu menu Produk), daftar, detail — tanpa Server Action; `dashboard-redirect` mengarahkan produsen ke portal | — |
| P5 | Pengerasan: matriks uji di bawah + audit `security-auditor` | — |
| P6 | Produsen nonaktif → produknya tidak bisa dipesan (etalase publik, kartu/landing, keranjang, checkout, sitemap); rencana detail ditulis sebelum kode karena menyentuh jalur uang | tergantung desain |

**Matriks uji (wajib lulus sebelum deploy P1–P5):** (1) produsen A tidak bisa membuka produk produsen B via URL/ID; (2) produk internal dan produk mitra tidak bisa dibuka;
(3) `/app/{slug}/dashboard`, `/toko`, `/settings`, `/api/media/*`, `/api/wa/*` menolak akun produsen; (4) produsen tenant X tidak bisa membuka portal tenant Y (satu akun = satu tenant);
(5) produsen nonaktif / akses dicabut / pemilik keluar keanggotaan langsung ditolak; (6) tidak ada tombol/aksi tulis di halaman; (7) payload halaman hanya memuat produk miliknya
(periksa view-source / respons RSC); (8) `UNIQUE(user_id)` benar-benar menolak pemberian akses kedua di tenant lain.

## 13. Status eksekusi

- [x] **P1 — SELESAI KODE 2026-10-31** (belum deploy): `packages/db/src/schema/public/producer-logins.ts` (+ export di `index.ts`) dan migration `0076_producer_logins.sql` (CREATE TABLE IF NOT EXISTS + 3 index).
      Diuji di Postgres sementara (bukan DB asli): idempotent (jalan 2×), akun yang sama jadi produsen di tenant ke-2 ditolak, dua akun untuk satu produsen ditolak, hapus user ikut menghapus status (CASCADE). `tsc` bersih.
      Tidak mengubah tabel/data yang ada. Migration dijalankan di VPS SEBELUM deploy kode P2+.
- [x] **P2 — SELESAI KODE 2026-10-31** (belum dipakai halaman mana pun, jadi tanpa efek bagi pengguna): `lib/producer-access.ts` (keputusan MURNI `decideProducerAccess`, 9 fakta, fail-closed) dan
      `lib/producer-access.server.ts` (`getProducerAccess(slug)`, `React.cache`, `server-only`). Urutan pemeriksaan: sesi → tenant ada+aktif (SEBELUM `createTenantDb`) → baris `producer_logins` akun ini di tenant ini →
      baris produsen di schema tenant (aktif + `type='member'`) → akun login = akun pemilik (`members.better_auth_user_id`, cegah tautan basi) → pemilik masih anggota sah tenant (`isTenantMember`). Nama tampilan via
      `listProducerOptions({ onlyId })` (tanpa kontak/alamat). Diuji: 10 kasus kebijakan + uji fail-closed (mematikan tiap fakta satu per satu selalu menolak) lulus; `tsc` bersih. Security review: slug tidak menyentuh schema sebelum
      tervalidasi; id produsen berasal dari DB bukan klien; tidak ada data sensitif di hasil; tidak ada mutasi. Catatan: repo belum punya test suite, jadi uji kebijakan dijalankan sebagai skrip sementara (tidak disimpan).
- [x] **P3 — SELESAI KODE 2026-10-31** (belum deploy; butuh migration 0076 di VPS): `grantProducerLoginAction` / `revokeProducerLoginAction` di `toko/produsen/actions.ts` + tombol "Beri akses login" / "Cabut akses login" + keterangan status di kartu produsen anggota
      (`producer-manage-client.tsx`, data `portal` dari `produsen/page.tsx`); `deleteProducerAction` ikut membersihkan baris `producer_logins`. Syarat beri akses (diperiksa SERVER): produsen anggota & aktif · pemilik punya akun (`members.better_auth_user_id`, dari DB bukan klien) ·
      pemilik anggota sah tenant (`isTenantMember`) · belum ada akses · akun belum jadi produsen di tempat lain (UNIQUE(user_id) → pesan generik tanpa menyebut tenant lain). Cabut: dibatasi `tenant_id` dari session (SQL diperiksa lewat `toSQL()`:
      `WHERE tenant_id=$1 AND producer_id=$2`). Security review (skill `jalakarta-security-review`, dijalankan inline): guard `getTenantAccess`+`hasFullAccess(toko)` di kedua aksi · UUID divalidasi · semua tulis ke tabel lintas-tenant diberi filter tenant dari session ·
      tanpa kebocoran lintas-tenant di pesan error · race ditahan unique index (23505). Sesi produsen yang sudah login tidak perlu dihapus saat dicabut: `getProducerAccess` memeriksa ulang di setiap request. `tsc` bersih. Belum dites browser.
      Catatan keputusan: anggota yang belum punya akun → tombol nonaktif + keterangan (undangan email = P3b, ditunda).
- [x] **P4 — SELESAI KODE 2026-10-31** (belum deploy; butuh migration 0076; `tsc` + `bun run build` produksi bersih, rute `/app/[tenant]/portal-produsen[/produk[/[id]]]` terdaftar): grup rute `app/(producer)/app/[tenant]/portal-produsen/` — `layout.tsx` (shell: nama tenant, nama produsen,
      menu pengguna, satu menu "Produk", `noindex`), `page.tsx` (alihkan ke produk), `produk/page.tsx` (daftar: cari, filter status, paginasi 20; kolom Produk/Harga Dasar/Harga Publik/Stok/Status; produk bervariasi = rentang harga + jumlah stok variasi aktif),
      `produk/[id]/page.tsx` (detail baca-saja: foto, harga Dasar/Publik/Anggota, stok, berat, kategori, deskripsi lewat `renderBody` yang disanitasi, tabel variasi). `lib/producer-access.server.ts` + `findProducerPortalSlug()`; `app/dashboard-redirect/page.tsx` mengarahkan akun yang bukan pengurus
      ke portal HANYA bila `getProducerAccess` lolos (cegah loop); layout/page yang ditolak → `/no-tenant-access` (bukan `/dashboard-redirect`, juga untuk cegah loop; teks halaman itu kini menyebut "pengurus maupun produsen aktif").
      Security review inline: SETIAP file portal memanggil `getProducerAccess` (diperiksa grep) · **nol Server Action dan nol `"use client"`** di portal (diperiksa grep; satu-satunya komponen client adalah `UserMenu` bawaan, hanya menerima nama/email sendiri) · produk dimuat
      `WHERE id AND producer_id = <produsen dari SESI> AND mitra_id IS NULL` (id dari URL divalidasi UUID, produsen lain/internal/mitra → 404) · pencarian `escapeLike`, status di-whitelist · variasi dimuat berdasarkan id produk yang sudah terverifikasi · slug tervalidasi sebelum menyentuh schema ·
      deskripsi disanitasi (`sanitize-html` di `renderBody`). Belum dites browser (butuh data nyata).
      Catatan sisa: custom domain (`{domain}/admin/*`) belum diuji untuk portal; `UserMenu` tetap menampilkan label "Produsen" sebagai peran.
- [x] **P5 — SELESAI 2026-10-31** (audit subagent `security-auditor`, read-only, 8 pertanyaan di atas): **0 Critical, 1 High, 2 Medium, 4 Low, 4 Info. TIDAK ada celah di fitur Portal Produsen yang membuka data produsen lain / tenant lain**; isolasi antar-produsen, fail-closed akun produsen, `getProducerAccess`,
      grant/revoke/delete, payload, loop, middleware/custom domain, dan migration 0075/0076 lolos dengan bukti file:baris.
      **Temuan BARU (fitur ini) — SUDAH DIPERBAIKI:** (1) pesan 23505 saat grant dua klik untuk produsen yang sama menyesatkan → kini dicek ulang, "Produsen ini sudah punya akses login"; (2) `?page=` sangat besar → OFFSET melebihi bigint → 500 → di-clamp 1..10.000.
      **Temuan Info — diperbaiki:** komentar diagnosa di header `0075` memakai `replace(slug,'-','_')` (SALAH — nama schema = `tenant_` + slug APA ADANYA dengan tanda hubung) → diganti `format('%I', 'tenant_' || slug)`, diuji di Postgres sementara dengan slug `pc-ikpm-jogja`.
      **Temuan LAMA — DIPERBAIKI 2026-10-31 atas permintaan user (lihat bagian "Perbaikan temuan lama" di bawah). Daftar aslinya:** [HIGH] `settings/addons/rajaongkir/actions.ts` `saveRajaOngkirConfigAction` — Server Action TANPA autentikasi/otorisasi, mengubah `tenant_addon_installations.config` berdasarkan `installationId` dari klien (diverifikasi manual: memang tanpa guard);
      [MEDIUM] open redirect `?redirect=` di login publik tenant (`(public)/[tenant]/login/login-form.tsx`, `page.tsx`); [MEDIUM] `api/mitra/products` + `api/mitra/status` memakai `slug` mentah ke `createTenantDb` tanpa `isActiveTenant` (500 + noise log); [LOW] redirect login admin menerima `/\evil.com` (perlu dicek manual di browser).
      **Perlu keputusan/cek manual:** apakah portal harus ikut gating modul per paket tenant (Starter/Standar/Pro) — saat ini hanya cek tenant aktif; `/no-tenant-access` di custom domain ikut di-rewrite middleware (UX, bukan keamanan); migration 0075 mengunci `products`/`producers` sebentar → jalankan di luar jam ramai; keputusan D5 (produk produsen nonaktif tak bisa dipesan) = P6, belum diaudit.
- [x] **P6 — SELESAI KODE 2026-10-31** (belum deploy, TANPA migration; `tsc` bersih; belum dites browser): produsen dinonaktifkan admin (`producers.is_active=false`) → **produknya tidak bisa dipesan**. Detail rancangan di § 14.

## 14. P6 — Produsen nonaktif → produk tidak bisa dipesan (rancangan + realisasi)

**Aturan (keputusan user 2026-10-31, D5):** hanya penonaktifan produsen oleh admin yang menutup penjualan. Produsen internal (`producer_id` NULL) dan produsen aktif tidak terpengaruh. Anggota yang keluar dari keanggotaan hanya kehilangan akses portal (produknya tetap dijual).
Dihitung SAAT DIBACA (tanpa menulis ulang status tiap produk) → mengaktifkan kembali langsung memulihkan semuanya.

**Satu sumber aturan:** `packages/db/src/helpers/product-orderable.ts` → `producerActiveSql(schema)` = `NOT EXISTS (SELECT 1 FROM producers WHERE producers.id = products.producer_id AND producers.is_active = false)` (semua identifier terkualifikasi schema tenant — diperiksa lewat `toSQL()`).
Semantik diuji di Postgres sementara: produk internal lolos, produsen aktif lolos, produsen nonaktif tersaring, diaktifkan lagi → lolos kembali.

**Dua lapis penegakan:**
1. **Otoritatif (server, jalur uang):** `resolveProductCartItem` (dipakai checkout/preview voucher/billing admin) kini mengembalikan `producerActive`. `checkoutAction` MENOLAK item dengan pesan `"<nama>" sedang tidak tersedia. Hapus dari keranjang lalu coba lagi.` — berlaku juga untuk item yang sudah ada di keranjang sebelum produsen dinonaktifkan.
   `addToCartAction` menolak produk nonaktif sejak awal ("Produk ini sedang tidak tersedia.") — hanya menolak bila TERBUKTI nonaktif; item yang tak ter-resolve diperlakukan seperti sebelumnya.
2. **Etalase (disembunyikan):** `producerActiveSql` ditambahkan ke query publik: arsip `/produk`, kategori, halaman detail `/produk/{slug}` (+ `generateMetadata`, produk terkait → 404 bila nonaktif), section landing "Produk", hitungan produk di hero, strip modul "Toko", pencarian `api/search`, `sitemap`, produk tertaut donasi pada event (`agenda/[slug]`).

**Sengaja tidak diubah:** (a) pemanggil admin (invoice manual, `toko/actions`, `finance/billing`) memakai resolver yang sama tetapi mengabaikan `producerActive` — admin yang bertanggung jawab atas pesanan manual; (b) invoice yang sudah terbit tidak dibatalkan; (c) halaman keranjang/checkout hanya menampilkan item — penolakan terjadi saat checkout; (d) `gabung/page.tsx` (produk syarat daftar forum) tidak difilter, ditolak oleh checkout; (e) `api/ref/public-links` (picker admin).
**Cache:** halaman publik memakai `revalidate = 60` — etalase menyusut/pulih paling lama ±60 detik setelah admin menekan Nonaktifkan/Aktifkan; keranjang/checkout langsung (dicek ke DB).
**Risiko / catatan:** resolver kini menambah satu query kecil per item (juga untuk panggilan admin); `NOT EXISTS` ke tabel produsen yang kecil. Pelanggan yang sudah punya produk itu di keranjang akan melihat penolakan saat checkout (pesan jelas), bukan produk hilang diam-diam.
**Uji manual setelah deploy:** (1) nonaktifkan produsen yang punya produk → ±1 menit kemudian produk hilang dari `/produk`, landing, pencarian; `/produk/{slug}` 404; (2) produk yang sudah ada di keranjang → checkout ditolak dengan pesan; (3) tambah ke keranjang lewat tombol → ditolak; (4) aktifkan lagi → produk kembali; (5) produk internal tidak terpengaruh.

## 15. Perbaikan temuan audit lama (2026-10-31, setelah P6)

| Temuan | Perbaikan |
|---|---|
| [HIGH] `saveRajaOngkirConfigAction` tanpa autentikasi | Signature kini `(slug, installationId, config)`: `getTenantAccess` + `hasFullAccess(toko)`; `UPDATE ... WHERE id AND tenant_id = <tenant sesi>` (baris instalasi tenant lain tidak bisa disentuh) `RETURNING`; `installationId` divalidasi UUID; `config` divalidasi di server (kota = null/int>0, nama ≤150, kurir wajib ⊂ daftar 16 kode — satu sumber `lib/rajaongkir-couriers.ts` dipakai form dan action). |
| [MEDIUM] open redirect `?redirect=` login publik tenant | `lib/safe-redirect.ts` `safeInternalPath()` (hanya path internal; tolak `//`, `\`, skema, karakter kontrol/CRLF; 13 kasus diuji) dipakai di `(public)/[tenant]/login/page.tsx` dan `login-form.tsx` (defense in depth). |
| [LOW] login admin menerima `/\evil.com` | `(dashboard)/app/login/page.tsx` memakai helper yang sama. |
| [MEDIUM] `api/mitra/*` memakai slug mentah | `isActiveTenant(slug)` sebelum `createTenantDb` di `products` (GET/POST), `products/[id]`, `status` (404 bila tenant tak ada) dan `apply` (POST + DELETE) — termasuk 2 titik yang tidak tercatat auditor (`products/[id]`, `apply`). |

`tsc` bersih. Catatan: `selfInstallAddonAction` (`settings/addons/actions.ts`) masih memakai cek role manual `["owner","admin"]` ('admin' bukan role tenant yang valid) — belum disentuh, dicatat untuk putaran berikutnya.

## 16. Routing login multi-konteks (2026-10-31, permintaan user)

**Masalah:** `/app/login` bersifat universal dan `/dashboard-redirect` memilih tenant tempat akun jadi PENGURUS pertama. Akun yang pengurus di tenant A dan produsen di tenant B selalu mendarat di dashboard A; portal B hanya terjangkau lewat URL langsung. Pengurus di dua tenant juga dilempar ke tenant yang acak (utang teknis lama `getFirstTenantForUser`).

**Keputusan (bagian 1 + 2 dari usulan; bagian 3 "tautan login spesifik tenant `?tenant=`" ditunda):**
1. **Hormati tenant yang dituju.** Layout dashboard (`(dashboard)/app/[tenant]/layout.tsx`): bila akun bukan pengurus tenant itu → jika dia PRODUSEN di tenant itu → langsung ke `/app/{slug}/portal-produsen` (tanpa lompatan; juga jalan di custom domain karena path `/app/{slug-sendiri}` diizinkan middleware); selain itu → `/dashboard-redirect?tenant={slug}`.
   Akibatnya `forbis.id/admin` (→ login `forbis.id/login?redirect=/admin` → rewrite ke `/app/forbis/dashboard`) mengantar produsen forbis ke portal forbis, dan `jalakarta.com/app/forbis/...` sama.
2. **Pemilih tujuan.** `/dashboard-redirect` (tanpa `?tenant`) memakai `lib/user-contexts.server.ts` `listUserContexts()` (semua baris `tenant.users` akun + status produsen yang lolos `getProducerAccess`): 0 konteks → `/no-tenant-access`; 1 → langsung masuk; ≥2 → halaman `/pilih-tujuan` (di luar `/app/*`, sama alasannya dengan `/no-tenant-access`) berisi pilihan "Dashboard Pengurus — A" / "Portal Produsen — B".
   `?tenant=` yang tidak bisa diakses akun → tidak diam-diam menganggap berhasil: jatuh ke pemilih tujuan dengan pemberitahuan ("tidak punya akses di {slug}").

**Keamanan:** `?tenant` dan `?ditolak` hanya diterima bila berbentuk slug (`^[a-z0-9-]{3,20}$`) dan, untuk `tenant`, lolos `isActiveTenant`; semua tujuan redirect dibangun di server dan sudah terverifikasi lolos guard halaman tujuan (tidak ada loop, tidak ada open redirect); pemilih hanya menampilkan konteks milik akun yang login.
**Verifikasi:** `tsc` + `bun run build` bersih (rute `/pilih-tujuan` dan `/dashboard-redirect` terdaftar). Belum dites browser dengan akun ganda-peran.
**Uji manual:** (1) akun pengurus-A + produsen-B login di `jalakarta.com/app/login` → halaman "Pilih Tujuan" berisi dua pilihan; (2) buka `/app/forbis/dashboard` (produsen forbis) → masuk portal forbis; (3) akun hanya produsen → langsung portal; akun hanya pengurus satu tenant → langsung dashboard (tidak berubah); (4) `/dashboard-redirect?tenant=forbis` untuk akun tanpa akses di forbis → "Pilih Tujuan" dengan pemberitahuan.
**Hotfix custom domain (2026-10-31, ditemukan user saat uji di `forbis.id`):** `/pilih-tujuan?ditolak=forbis` di `forbis.id` memberi 404 karena middleware me-rewrite path non-`/app` di custom domain menjadi `/{slug}/pilih-tujuan`. Perbaikan: `pilih-tujuan` dan `no-tenant-access` dikecualikan dari matcher middleware (seperti `dashboard-redirect` — ketiganya tujuan redirect pasca-login yang harus tampil apa adanya di host mana pun; halamannya memeriksa sesi sendiri);
di custom domain, tautan ke tenant LAIN di halaman pemilih dibuat absolut ke jalakarta.com (sesi login per-host terpisah — mungkin perlu login lagi). Sebelum hotfix, `/no-tenant-access` di custom domain juga 404 (utang lama, kini ikut teratasi).
**Sisa/diketahui:** `app/(auth)/layout.tsx` (pengguna login yang membuka halaman auth) masih memakai `getFirstTenantForUser`; bagian 3 (`/app/login?tenant=`) belum dibuat.

## 17. Produk tunggal bersama (admin + produsen) dan pesanan masuk untuk produsen — RENCANA (2026-10-31, belum ada kode)

**Permintaan user:** produsen yang akan MENGIRIM produknya harus melihat data pembeli di halaman produk tunggal. Tampilan admin dan produsen dibuat SAMA (hemat CSS) — boleh bertab (mis. Ringkasan / Pesanan / Detail) dan mudah dipahami produsen — supaya halaman produk tunggal yang akan dikembangkan total cukup diubah SEKALI. Untuk sementara tetap BACA-SAJA (kirim paket / resi / label = upgrade berikutnya, § 10).

### 17.1 Temuan kode (dibaca 2026-10-31)
- `lib/product-buyers.server.ts` `resolveProductBuyers()` sudah SATU fungsi bersama untuk halaman admin dan export Excel. Barisnya memuat data uang (subtotal, voucher, kode unik, total dibayar, ongkir, **modal `unitCost`**) dan dua alamat: "Alamat Checkout" (snapshot transaksi) dan "Alamat User" (alamat rumah di profil anggota, hanya terisi bila HP invoice terverifikasi).
- Halaman admin `toko/produk/[id]/page.tsx` (215 baris) sudah mengosongkan `unitCost` sebelum mengirim baris ke komponen client `ProductBuyerList` (tabel lebar 1280px, ada kolom uang) — pelajaran "payload client = publik".
- Portal Produsen (P4) punya halaman detail sendiri yang berbeda dari admin → dua tampilan yang akan drift.
- Skema siap untuk tahap kirim paket nanti: `invoice_shipping_lines.tracking_number`, `courier/service`, `delivery_method` (courier/pickup), `payment_method` (cod), dan fulfillment 5-tahap (`docs/arsitektur-fulfillment.md`).

### 17.2 Rancangan
1. **Komponen bersama** `components/toko/product-detail/` (server component, TANPA state client): `ProductDetailTabs` (tab lewat tautan `?tab=ringkasan|pesanan|detail` — tidak ada JS/props client yang bisa bocor), `TabRingkasan`, `TabPesanan`, `TabDetail`. Dipakai SAMA oleh `/app/{slug}/toko/produk/[id]` (admin) dan `/app/{slug}/portal-produsen/produk/[id]` (produsen); parameter `view: "admin" | "producer"` hanya memutuskan bagian mana yang tampil. Tab/kolom baru ditambah SEKALI di komponen bersama.
   Bagian KHUSUS admin (tidak ada di produsen): tombol Edit, tab/seksi "Laporan & Produsen" (kartu keuntungan, kartu produsen, tombol export Excel), kolom uang.
2. **Data tetap satu sumber:** `resolveProductBuyers()` tidak digandakan. Untuk produsen ditambah **proyeksi allow-list** `toProducerBuyerRows(rows)` DI SERVER (memilih eksplisit field yang diizinkan — bukan "buang yang sensitif") sebelum menyentuh komponen/props apa pun.
3. **Field pesanan yang terlihat produsen (usulan):** nomor invoice, tanggal, nama pembeli, nomor HP (+ tautan WhatsApp), nama item + varian + jumlah, metode pengiriman (kurir/layanan atau ambil sendiri; COD), **alamat checkout** (alamat tujuan transaksi ini). **TIDAK:** uang apa pun (harga jual, subtotal, voucher, kode unik, total dibayar, ongkir, modal/laba), "Alamat User" (alamat rumah profil anggota — data pribadi di luar kebutuhan kirim), item produk lain di invoice yang sama, export Excel (menyusul bersama fitur label).
4. **Pesanan yang tampil (usulan):** hanya invoice **Lunas** (`includeAll: false`) — produsen tidak boleh mengirim barang yang belum dibayar. Pesanan belum lunas/sebagian tidak tampil sama sekali.
5. **Tab (nama yang mudah dipahami):** `Ringkasan` (jumlah pesanan lunas, total unit terjual, stok; admin: + statistik status bayar), `Pesanan Masuk` (daftar + cari + tampilan kartu di HP untuk produsen), `Detail Produk` (foto, harga, stok, variasi, deskripsi — isi halaman P4 sekarang dipindah ke komponen bersama). Admin menambah `Laporan & Produsen`.

### 17.3 Keamanan & privasi (data pembeli = data pribadi)
- Akses tetap lewat `getProducerAccess` + `WHERE id AND producer_id = <sesi> AND mitra_id IS NULL`; `resolveProductBuyers` hanya dipanggil SETELAH kepemilikan produk terverifikasi (fungsinya sendiri menerima productId mentah!).
- Allow-list di server; payload RSC/props tidak memuat field terlarang (diverifikasi dengan memeriksa tipe + grep payload di uji).
- Pesan privasi di tab: "Data pembeli hanya untuk keperluan pengiriman pesanan ini."
- Pencatatan akses (audit log lihat-data-pembeli) dipertimbangkan — belum diusulkan masuk fase ini; dicatat sebagai opsi bila diinginkan.
- Produk mitra tidak pernah tampil (sudah di query).

### 17.4 Risiko
- Merombak halaman admin 215 baris menjadi komponen bersama + tab = risiko regresi tampilan admin; mitigasi: logika data tidak diubah, hanya JSX dipindah; admin tetap punya semua yang sekarang ada (daftar pembeli penuh dengan kolom uang, laporan, export).
- Tabel lebar (1280px) tidak cocok di HP produsen → produsen memakai daftar kartu ringkas; admin tetap tabel.
- Kolom/ketentuan data pembeli yang diizinkan perlu disepakati (privasi) — lihat keputusan.

### 17.5 Fase (urut; tiap fase: tsc → security review → commit)
| Fase | Isi |
|---|---|
| T1 | Ekstrak komponen bersama + tab; halaman admin memakainya (tampilan fungsi sama + tab) |
| T2 | `toProducerBuyerRows` + tab `Pesanan Masuk` untuk produsen; portal memakai komponen bersama |
| T3 | Pengerasan: matriks uji + audit `security-auditor` (khusus kebocoran data pembeli/uang) |

### 17.6 Keputusan yang menunggu user
(a) Pesanan yang tampil untuk produsen: hanya **Lunas** (usulan) atau semua status. (b) Data pembeli yang diizinkan: sesuai § 17.2 butir 3 (usulan) — khususnya TANPA uang dan TANPA alamat rumah profil. (c) Halaman produk tunggal ADMIN ikut dirombak menjadi bertab (usulan, sesuai permintaan "tampilan admin dan produsen sama"). (d) Export Excel/label untuk produsen ditunda ke fase kirim paket.

### 17.7 Status eksekusi
- [x] **T1 — SELESAI KODE 2026-10-31** (`tsc` bersih; belum dites browser/deploy): `lib/product-detail.server.ts` (`loadProductDetail`, opsi `ownerProducerId` untuk kepemilikan produsen), komponen bersama `components/toko/product-detail/` (`ProductDetailHeader`, `ProductDetailTabNav` + `productTabs()`/`resolveActiveTab()`, `TabRingkasan`, `TabPesanan` (cabang admin), `TabDetail`, `TabLaporan` (khusus admin)), dan halaman admin `toko/produk/[id]/page.tsx` dirombak memakainya (tab: Ringkasan · Pesanan Masuk · Detail Produk · Laporan & Produsen [hanya `hasFullAccess(toko)`]).
      Yang dijaga: logika data tidak berubah (`resolveProductBuyers` tetap, MODAL `unitCost` tetap dikosongkan sebelum ke komponen client, laporan+kartu produsen hanya dihitung bila tab aktif DAN berhak); `?tab=` divalidasi (tab tak dikenal / tak diizinkan → tab pertama). **Temuan saat review T1 & sudah diperbaiki:** tab Detail Produk yang baru akan memperlihatkan Harga Dasar (modal) kepada pengguna admin baca-saja (sebelumnya disembunyikan) → ditambah prop `showCost` (admin: hanya `hasFullAccess(toko)`; produsen: true).
      Portal Produsen belum memakai komponen bersama (halaman detail P4 lama masih berjalan) — beralih di T2.
- [x] **T2 — SELESAI KODE 2026-10-31** (`tsc` + `bun run build` produksi bersih; belum dites browser/deploy): `lib/producer-buyers.ts` (`toProducerBuyerRows` — proyeksi ALLOW-LIST 9 field: invoice, tanggal, nama, HP, item, varian, jumlah, metode kirim, alamat checkout; hanya Lunas), cabang produsen di `TabPesanan` (kartu ringkas ramah HP: tautan WhatsApp, cari nama/invoice, paginasi 20; server component → data pembeli TIDAK pernah ter-serialize ke client), dan `portal-produsen/produk/[id]/page.tsx` ditulis ulang memakai komponen bersama (tab Ringkasan · Pesanan Masuk · Detail Produk).
      Rantai keamanan di halaman: `getProducerAccess` → UUID → `loadProductDetail({ ownerProducerId: <sesi> })` (produk lain / internal / mitra → 404) → BARU `resolveProductBuyers(includeAll:false)` (hanya setelah kepemilikan terbukti) → `toProducerBuyerRows`. Diuji (skrip sementara): hanya baris Lunas lolos; kunci hasil persis 9 field allow-list; tidak ada `invoiceId`, `memberAddress` (alamat rumah), uang, `unitCost`, `voucherCode`, `sellerType`.
      Catatan: bundel JS halaman portal memuat kode (bukan data) `ProductBuyerList` karena `TabPesanan` mengimpornya untuk cabang admin — tidak ada kebocoran data; bisa dirapikan nanti dengan memecah berkas bila ukuran bundel jadi masalah.
- [x] **T3 — SELESAI 2026-10-31** (audit subagent `security-auditor`, fokus kebocoran data pembeli/uang ke produsen; 7 pertanyaan): **0 Critical, 0 High, 0 Medium, 2 Low, 3 Info.** Lolos dengan bukti file:baris: kepemilikan terbukti SEBELUM `resolveProductBuyers` (hanya 3 pemanggil di seluruh app; semua terjaga) · `toProducerBuyerRows` allow-list sejati (objek baru 9 field, bukan spread) + Lunas ganda (query + proyeksi) · tidak ada `"use client"` di rantai portal dan cabang produsen `TabPesanan` tidak me-render/mengoper rows ke client component · `?tab=laporan` jatuh ke tab pertama untuk produsen; tab laporan & Harga Dasar admin hanya `hasFullAccess(toko)` · tautan `wa.me` hanya digit, teks pembeli di-escape React, portal tanpa Server Action (satu-satunya form = GET pencarian) · query pembeli variasi terbatas id produk+variasinya · route export tidak terjangkau produsen (`getTenantAccess` null).
      `renderBody` (deskripsi) diperiksa manual: teks di-escape (`escapeHtml`), href disaring (`sanitizeLinkHref`) — fungsi lama yang juga dipakai halaman publik.
      **Diperbaiki:** (a) INFO — `resolveProductBuyers` kini punya opsi `skipMemberAddress`; Portal Produsen memakainya sehingga alamat rumah profil anggota tidak pernah dikumpulkan di jalur produsen (defense in depth + hemat N query `composeAddress`).
      **Diterima / dicatat:** (b) LOW — produsen melihat HP & alamat checkout semua pesanan Lunas produknya tanpa batas waktu (sesuai keputusan produk; opsi lanjutan: batasi ke pesanan belum terkirim atau catat akses — belum diminta); (c) LOW — pencarian/paginasi dilakukan di memori atas semua baris pesanan produk itu (tanpa LIMIT di SQL): beban performa hanya untuk produk berpesanan puluhan ribu — optimasi nanti bila perlu; (d) INFO (LAMA) — halaman admin mengirim baris pembeli penuh (kolom uang, `memberAddress`) ke komponen client untuk pengguna `hasReadAccess` toko; hanya modal yang dijaga — perilaku sebelum refactor, tidak diubah.
      Tidak dapat dipastikan dari kode: perbandingan perilaku admin lama via `git log -p` (auditor tanpa shell) — saya memeriksa sendiri saat review T1 dan menutup satu regresi (Harga Dasar di tab Detail untuk admin baca-saja → `showCost`).
      **Uji manual setelah deploy:** (1) produsen A buka `/portal-produsen/produk/<id produk B>` → 404; (2) tab Pesanan Masuk hanya menampilkan pesanan Lunas, tanpa angka rupiah; lihat sumber halaman (view-source) → tidak ada nama voucher/harga pesanan/alamat rumah; (3) `?tab=laporan` di portal → kembali ke Ringkasan; (4) admin dengan akses baca-saja (bukan penuh) buka produk → tab Detail tanpa Harga Dasar & tanpa tab Laporan; (5) admin penuh: semua tab tampil, export & laporan jalan seperti sebelumnya.

### 17.8 REVISI keputusan user (2026-10-31, setelah uji di layar lebar): "tampilkan semuanya, tidak ada rahasia antara admin dan produsen"
Pesanan Masuk versi produsen (kartu + allow-list, T2) DITARIK: terlihat berbeda total dari tabel admin, padahal permintaan awal "tampilan sama, edit sekali". Kini `TabPesanan` hanya SATU tampilan — `ProductBuyerList` (tabel admin) untuk admin DAN produsen, data sama: semua status bayar, kolom uang, voucher, kode unik, ongkir, Alamat Checkout + Alamat User. `TabRingkasan` juga sama (4 kartu). Halaman produsen memanggil `resolveProductBuyers(includeAll: true)`.
**Dua perbedaan teknis yang tak bisa sama:** (1) tombol Export tidak ditampilkan untuk produsen (route export memakai `getTenantAccess` → produsen ditolak, tombolnya akan error; membukanya = perubahan route → menunggu keputusan user); (2) nomor invoice produsen berupa teks biasa (`linkInvoices=false`, halaman invoice admin bukan untuk produsen).
**Tetap dikosongkan:** MODAL per baris (`unitCost`) — sama seperti admin (dikosongkan untuk semua pengguna sebelum ke komponen client). Tab "Laporan & Produsen" (keuntungan/modal) TIDAK dibuka untuk produsen (tidak diminta).
**Konsekuensi yang perlu disadari (keputusan user, bukan celah):** payload halaman produsen kini memuat data uang pesanan, voucher, dan "Alamat User" (alamat rumah profil anggota pembeli) — terlihat lewat view-source oleh produsen; hasil audit T3 (allow-list) tidak lagi berlaku untuk tab Pesanan Masuk. `lib/producer-buyers.ts` (`toProducerBuyerRows`) disimpan tetapi TIDAK dipakai sementara, siap diaktifkan lagi bila kelak data produsen dibatasi. Pembatasan lanjutan (mis. kolom uang) = keputusan user di tahap berikutnya.

## 18. DEFINISI FITUR (dikunci bersama user, 2026-10-31) — baca ini dulu sebelum mengubah apa pun

Bagian ini ada supaya definisi tidak lagi disalahpahami. Bila bertentangan dengan bagian lain dokumen ini, BAGIAN INI yang berlaku.

**1. Apa itu Produsen.** Produsen adalah **GUDANG** tenant: pemilik produk yang menyimpan barang dan **WAJIB mengirimkannya** setiap ada order. Tujuannya agar tenant tidak perlu punya produk/stok sendiri untuk berjualan. Karena itu produsen adalah mitra operasional, BUKAN orang luar yang perlu dibatasi.
**2. Bentuk identitas: STATUS, bukan role** (dipilih user setelah dibahas). Produsen = status pada akun anggota (`public.producer_logins`, satu akun = satu tenant), punya "pintu" sendiri (Portal Produsen) dan terkunci di halaman lain secara bawaan. Alasan: role pengurus meloloskan akun ke ratusan rute admin yang hanya memeriksa "pengurus tenant ini"; sistem role juga tidak mengenal aturan "hanya data milik produsen ini". Tujuan "edit sekali berlaku di admin dan produsen" dicapai lewat KOMPONEN BERSAMA, bukan lewat role. Role baru dipertimbangkan hanya bila produsen harus memakai halaman admin yang sama persis (alamat `/app/{slug}/toko/...` + semua menu).
**3. Apa yang dilihat produsen.** SEMUA data produknya sendiri dan SEMUA data pesanan produknya: pembeli, nomor HP, alamat tujuan, item/varian/jumlah, status bayar, harga/subtotal, ongkir, voucher, kode unik. **Tidak ada rahasia antara admin dan produsen** (keputusan user). Yang masih dikosongkan: modal per baris (sama seperti admin) dan tab "Laporan & Produsen" — BELUM dibuka, belum diminta.
**4. Tampilan SAMA PERSIS.** Halaman produk tunggal admin dan produsen memakai komponen yang sama (`components/toko/product-detail/*`, tabel `ProductBuyerList`). "Samakan / persis" berarti PAKAI komponen yang sama — JANGAN membuat tampilan alternatif walau ada alasan (HP, privasi); keberatan disampaikan sebagai pertanyaan SEBELUM membangun. Perbedaan teknis yang disepakati hanya: tombol Export tidak tampil untuk produsen (route export khusus pengurus) dan nomor invoice berupa teks (halaman invoice admin bukan untuk produsen).
**5. Alamat gudang.** Saat ini "Kota Asal Pengiriman" (picker kota RajaOngkir) ada di form produk dan opsional (kosong = default toko) — itulah alamat pengiriman produsen. Arah: kolom itu kelak DIKOSONGKAN karena alamat gudang diambil dari data PRODUSEN, yang harus lengkap sesuai format RajaOngkir. Belum dikerjakan (alamat produsen sekarang format wilayah biasa, bukan RajaOngkir).
**6. Arah pengembangan** (urut belum ditentukan): perombakan TOTAL tabel Pesanan Masuk agar sederhana (nanti, jangan dikerjakan sebelum diminta) · alamat gudang produsen format RajaOngkir · kirim paket (resi), cetak label · integrasi ke status Mitra (`docs/arsitektur-mitra.md`).
**7. Belum diputuskan (jangan ditebak):** definisi "untung saya" bagi produsen — uang yang DITERIMA produsen per pesanan (mis. Harga Dasar × jumlah?) atau selisih seperti laporan admin; contoh angka sudah diajukan tetapi belum dijawab user · apakah produsen perlu export · apakah pesanan belum dibayar tetap tampil (sekarang: tampil semua).
**8. Dikerjakan 2026-10-31 (permintaan user):** semua kolom tabel admin ada di produsen (sudah) · kolom **HP** pembeli ditambahkan di tabel bersama (admin ikut punya) · **paginasi** tabel bersama · desain tabel tetap SATU komponen.

**Status § 18 butir 8 (2026-10-31):** SELESAI KODE — `components/toko/product-buyer-list.tsx` (SATU komponen untuk admin & produsen): kolom **HP** pembeli (format `displayPhone`, teks biasa — bukan tautan WhatsApp, tidak ada yang ditambahkan di luar permintaan) dan **paginasi** 20 baris/halaman (sisi klien; reset ke halaman 1 saat mencari; kontrol Sebelumnya/Berikutnya + "Halaman x dari y · N pesanan" hanya bila > 20 baris). `tsc` + `bun run build` bersih. Tidak menyentuh data/akses (tidak ada risiko keamanan baru; baris yang sama yang sudah dikirim). Belum dites browser/deploy.

## 19. Perombakan portal: sidebar + Pesanan + Pengiriman (batch) — RENCANA (2026-11-01, belum ada kode)

**Permintaan user (2026-11-01, setelah uji browser P1–P6 + tabel bersama lolos):** portal dirombak total menjadi bergaya dashboard admin (sidebar), dikembangkan bertahap.

### 19.1 Menu
1. **Dashboard** — halaman kosong dulu (dikembangkan nanti).
2. **Produk** — seperti sekarang (daftar + detail bertab bersama admin).
3. **Pesanan** — semua pesanan dari semua produk milik produsen, HANYA invoice `paid`. Kolom: tgl pesan · invoice · pemesan (nama + HP) · pesanan (produk, atau variannya bila produk bervariasi) · jml · kurir · status · aksi (ikon saja: mata = lihat, printer = cetak — mesin cetak dibuat user secara terpisah, tombol nonaktif dulu).
   Keputusan user: **satu baris = satu invoice** (status pengiriman memang per invoice; satu invoice boleh memuat banyak varian dalam satu sel). Ini menjawab keputusan terbuka § 18 butir 7 ("pesanan belum dibayar tampil?") → TIDAK, hanya paid.
4. **Pengiriman** — batch pengiriman.

### 19.2 Batch pengiriman
- **Nama batch** otomatis `DDMMYYYY` + nomor urut 4 digit, mis. `011120260001` (1 Nov 2026, urutan ke-1). Dugaan: urutan direset per hari per produsen — dikonfirmasi saat implementasi.
- **Form:** nama batch (otomatis) · tanggal pengiriman · daftar pemesan/invoice yang dikirim saat itu (pilih dari pesanan paid yang belum masuk batch).
- **Alur status (keputusan user)** — memakai 5-tahap fulfillment yang SUDAH ADA (`invoice_shipping_lines.status`, `docs/arsitektur-fulfillment.md`):
  1. buat batch → invoice di dalamnya `pending → processing` (Diproses)
  2. cetak/kemas (mesin printing, dibuat terpisah) → `packed` (Dikemas)
  3. produsen mengisi **nomor resi + unggah foto resi** → `shipped` (Dikirim; `trackingNumber` + `shippedAt`). Pelanggan dan admin melihat status yang sama (satu sumber).
- **Aturan batch:** batch TIDAK bisa dihapus/dibatalkan — harus berjalan sampai selesai (agar tahapan pengiriman rapi). Yang boleh diubah: daftar pemesan di dalam batch.
- Batch dianggap selesai bila semua invoice di dalamnya `shipped`.

### 19.3 Temuan kode yang menentukan rancangan
- Status pengiriman satu-satunya ada di `invoice_shipping_lines` (per invoice per seller; semua produk berpenjual `tenant` — termasuk produk produsen — berbagi SATU baris). Aturan transisi sudah ada: hanya maju satu langkah, `shipped` wajib resi, hanya invoice paid.
- `updateFulfillmentStatusAction` ada di `finance/billing/actions.ts` dan dijaga `getTenantAccess` (pengurus) → produsen TIDAK bisa memakainya; perlu aksi khusus produsen yang menumpang aturan transisi yang sama (jangan menyalin logika).
- Tabel baru di schema tenant (batch + isi batch) → pola ADR-0003 + `create-tenant-schema` + migration SQL tenant lama.
- Unggah foto resi: produsen bukan `tenant.users`, jadi tidak bisa memakai Media Library tenant; butuh jalur unggah sendiri sesuai aturan keamanan (validasi ukuran + proses ulang Sharp + nama `randomUUID()`).

### 19.4 Risiko
1. **Portal berubah dari baca-saja menjadi punya Server Action** (aksi tulis pertama produsen). Wajib: `getProducerAccess` + bukti kepemilikan (invoice memuat item produsen ini) + paid + transisi valid + tidak masuk batch lain; lalu security review.
2. **Invoice campuran** (item dari beberapa produsen / produk milik tenant sendiri) berbagi satu status + satu resi → bila dua pihak bertindak, saling menimpa. Perlu aturan (lihat 19.6).
3. Migration di VPS untuk tenant lama.
4. Unggah file dari akun non-pengurus = permukaan serangan baru.

### 19.5 Fase (tiap fase: tsc → security review → commit; push hanya bila diminta)
| Fase | Isi |
|---|---|
| S1 | Shell sidebar (desktop + drawer HP) + menu Dashboard (kosong) / Produk / Pesanan / Pengiriman |
| S2 | Menu Pesanan (baca-saja, paid, per invoice) |
| S3 | Tabel batch + form buat batch (invoice → Diproses) + edit isi batch |
| S4 | Input resi + unggah foto resi → Dikirim; batch selesai |

### 19.6 Keputusan user (2026-11-01) — menggantikan pertanyaan terbuka
(a) **Invoice campuran** (item produsen lain / produk tenant sendiri): tetap tampil di Pesanan dengan penanda, tetapi TIDAK bisa masuk batch (hanya invoice murni milik produsen ini). Admin yang menangani.
(b) **Diproses → Dikemas**: tombol manual sementara "Tandai Dikemas" (per invoice/batch); kelak digantikan mesin printing.
(c) **Mengeluarkan invoice dari batch**: boleh selama BELUM ada resi (status Diproses atau Dikemas); status kembali ke Menunggu (pengecualian atas aturan "maju satu langkah" — ini aksi koreksi khusus). Setelah resi diisi (Dikirim) terkunci. Menambah invoice ke batch boleh sampai batch selesai. Batch sendiri tidak bisa dihapus.

### 19.7 Status eksekusi
- [x] **S1 — SELESAI KODE 2026-11-01** (`tsc` bersih; belum dites browser): `components/producer/producer-sidebar.tsx` (sidebar desktop + drawer HP, 4 menu tetap, tampilan sama sidebar admin), `layout.tsx` ditulis ulang (sidebar + header + menu pengguna), root portal → `/dashboard`, halaman placeholder `dashboard` / `pesanan` / `pengiriman` (Produk tetap). Security review: semua page (6) memanggil `getProducerAccess` sendiri; tidak ada `"use server"`; props ke komponen client hanya `slug`, nama tenant, nama produsen sendiri. Tidak ada query/aksi baru.
- [x] **S2 — SELESAI KODE 2026-11-01** (`tsc` bersih; belum dites browser/deploy; tanpa migration): `lib/producer-orders.server.ts` (`listProducerOrders`, `getProducerOrder`), `pesanan/page.tsx` (tabel: Tgl Pesan · Invoice · Pemesan [nama+HP] · Pesanan [produk + varian] · Jml · Kurir · Status · Aksi [mata = detail, printer = nonaktif]; cari nomor invoice/nama; paginasi 20), `pesanan/[invoiceId]/page.tsx` (detail baca-saja), `components/producer/order-status-badge.tsx`.
      Satu baris = satu invoice LUNAS (`invoices.status = 'paid'`) yang memuat ≥1 item produk milik produsen (cocok `invoice_items.itemId` ke id produk ATAU id variasi produsen, `mitra_id IS NULL`). Hanya item produsen ini yang tampil; invoice yang juga memuat item lain diberi penanda **Campuran** (tidak bisa masuk batch — S3). Status = `invoice_shipping_lines.status` baris tenant (Menunggu/Diproses/Dikemas/Dikirim/Diterima). Tanpa data uang (tidak diminta).
      Security review (mandiri, checklist): `producerId` dari sesi (`getProducerAccess`), bukan URL · slug dari `access.tenant.slug` · `q` lewat `escapeLike` + `ilike` parameterized · `invoiceId` divalidasi UUID (`isValidUuid`) → 404 bersih · kepemilikan dibuktikan di loader (lunas + memuat item produsen; selain itu 404) · tanpa `"use server"`/state klien · tidak ada uang/modal/alamat rumah profil. Diterima: invoice campuran tetap memperlihatkan data pembeli kepada produsen yang barangnya ada di sana (konsisten keputusan "tidak ada rahasia admin–produsen").
      Uji manual setelah deploy: (1) menu Pesanan hanya memuat invoice lunas; (2) pesanan produsen lain tidak muncul; (3) `/pesanan/<id invoice produsen lain>` → 404; (4) produk bervariasi menampilkan varian; (5) invoice campuran bertanda "Campuran".

### 19.8 S3 — rancangan teknis batch pengiriman (2026-11-01, ditulis SEBELUM kode)
**Tabel baru (schema tenant, migration `0077_producer_shipment_batches.sql` + `create-tenant-schema.ts`):**
- `producer_shipment_batches` (`id`, `producer_id` FK→producers **RESTRICT**, `name`, `shipping_date` DATE, `created_at`, `updated_at`; `UNIQUE(producer_id, name)`). FK RESTRICT = batch tidak bisa terhapus lewat produsen; **tidak ada aksi hapus batch** sama sekali.
- `producer_shipment_invoices` (`id`, `batch_id` FK→batches **RESTRICT**, `invoice_id` FK→invoices **UNIQUE** (satu invoice paling banyak di satu batch — dijaga DB, bukan hanya aplikasi), `created_at`).
- Status pengiriman TIDAK diduplikasi: tetap `invoice_shipping_lines.status` (satu sumber, admin + pelanggan melihat yang sama). Batch hanya mengelompokkan; status batch DITURUNKAN dari status invoice di dalamnya.

**Nama batch:** `DDMMYYYY` (tanggal pembuatan, WIB) + urutan 4 digit per produsen per hari (`011120260001`). Form menyodorkan nama bawaan (bisa diubah); server memvalidasi 1–40 karakter dan unik per produsen.

**Aksi (Server Action pertama portal; tiap aksi: `getProducerAccess` → validasi input → kepemilikan lewat loader → transaksi + compare-and-set):**
1. `createBatchAction` — syarat tiap invoice: lunas · memuat item produsen ini · BUKAN campuran · status `pending` · belum di batch mana pun · bukan "ambil sendiri" (tidak dikirim kurir; keputusan saya, mudah dibalik). Transaksi: insert batch + tautan, lalu `pending → processing` dengan `UPDATE … WHERE status='pending'` (jumlah baris terubah harus sama, kalau tidak seluruh transaksi dibatalkan).
2. `addInvoicesToBatchAction` — syarat sama; batch yang semua invoicenya sudah `shipped` (selesai) tidak menerima tambahan.
3. `removeInvoiceFromBatchAction` — hanya bila status `processing`/`packed` (belum resi); status kembali `pending`; hapus tautan.
4. `markPackedAction` — tombol manual sementara: `processing → packed` (per invoice atau seluruh batch) sampai mesin printing ada.
Notifikasi pelanggan "Diproses" dikirim sama seperti jalur admin (`order_processing`, mengikuti pengaturan notifikasi tenant). Resi/Dikirim = S4.

**Halaman:** `/pengiriman` (daftar batch: nama, tgl kirim, jumlah invoice, ringkasan status) · `/pengiriman/baru` (form) · `/pengiriman/[batchId]` (isi batch + tambah/keluarkan + Tandai Dikemas).

### 19.9 Status S3 (2026-11-01)
- [x] **S3 — SELESAI KODE** (`tsc` bersih; belum dites browser/deploy). **WAJIB di VPS SEBELUM kode:** migration `0077_producer_shipment_batches.sql` (2 tabel + kolom `invoice_shipping_lines.processing_notified_at`; idempotent). File: `pengiriman/actions.ts` (4 aksi), `pengiriman/{page,baru/page,[batchId]/page}.tsx`, `components/producer/{order-picker,batch-create-form,batch-detail-actions}.tsx`, fungsi batch di `lib/producer-orders.server.ts`, skema `producer-shipments.ts`.
- **Audit `security-auditor` (0 Critical, 0 High, 2 Medium, 4 Low, 4 Info)** — tidak ada IDOR; transisi status tidak bisa lompat/mundur dari shipped; UNIQUE + tanpa aksi hapus batch terbukti. Diperbaiki: (M-1) notifikasi "Diproses" hanya sekali per invoice (kolom `processing_notified_at`, siklus Keluarkan→Masukkan tidak spam); (M-2) syarat invoice `paid` dicek ULANG di dalam UPDATE compare-and-set (tutup TOCTOU); (L-1) mengeluarkan invoice dari batch tidak lagi mensyaratkan `paid` (invoice yang kemudian batal tidak tersangkut); (L-2) daftar pilih dibatasi 100 = `MAX_INVOICES`; (L-3) tanggal divalidasi round-trip + rentang −30 hari s/d +1 tahun. Diterima: (L-4) cek "batch selesai" di luar transaksi — hanya konsistensi, bukan kebocoran.
- Belum diverifikasi dari kode: apakah admin bisa mengubah status pengiriman invoice yang sudah ada di batch (jalur admin tidak diaudit); Server Action tanpa rate limit sendiri.
- Uji manual setelah deploy: (1) buat batch → pesanan jadi Diproses di portal DAN di halaman admin `/toko/pesanan/invoice/<id>` DAN di `/akun/transaksi` pelanggan; (2) Tandai Dikemas; (3) Keluarkan → kembali Menunggu, dimasukkan lagi → pelanggan TIDAK dapat pesan kedua; (4) invoice campuran / ambil sendiri tidak muncul di daftar pilih; (5) dua tab membuat batch dengan pesanan yang sama → salah satu ditolak; (6) batch produsen lain → 404.

### 19.10 S4 — rancangan resi + foto resi → Dikirim (2026-11-01, ditulis SEBELUM kode)
- **Alur:** invoice berstatus `packed` di sebuah batch → produsen mengisi **nomor resi + unggah foto resi** (keduanya wajib, keputusan user) → `packed → shipped` (`trackingNumber`, `shippedAt`, `trackingProofPath`). Setelah itu pelanggan & admin melihat Dikirim + resi (sumber sama). Notifikasi `order_shipped` ke pelanggan seperti jalur admin.
- **Bukan Server Action tetapi route handler** `POST /api/produsen/resi` (multipart): Server Action dibatasi body 1 MB (belum ada `bodySizeLimit`), foto resi bisa lebih. Route handler membawa jaminan sama: `getProducerAccess(slug)` dulu, cek `Origin` = host (CSRF; cookie sesi sudah `SameSite`), UUID, kepemilikan lewat loader (batch milik produsen + tautan + invoice lunas + status `packed`), lalu compare-and-set `packed → shipped` termasuk cek `paid` di UPDATE yang sama.
- **Unggah (aturan keamanan project):** batas 8 MB di server · format dibaca dari ISI file lewat Sharp (`metadata().format` ∈ jpeg/png/webp/heif), BUKAN `file.type` klien · diproses ulang ke WebP maks 1600 px (membuang EXIF/GPS) · `limitInputPixels` · nama `randomUUID()` · kunci `produsen/resi/YYYY/MM/uuid.webp` di bucket `tenant-{slug}` · bila CAS DB gagal, file yang sudah terunggah DIHAPUS. Kompresi klien (`compressImage`) hanya penghemat bandwidth, bukan batas keamanan.
- **Skema:** kolom baru `invoice_shipping_lines.tracking_proof_path TEXT` (migration `0078_tracking_proof_path.sql`, idempotent). Tampil di portal (detail pesanan + isi batch) dan di kartu fulfillment admin (tautan "Lihat foto resi").
- **Tidak termasuk:** koreksi resi/foto setelah Dikirim oleh produsen (admin tetap bisa lewat `updateAdminShippingTrackingAction`); "Diterima" tetap dari konfirmasi pelanggan.

### 19.11 Status S4 (2026-11-01)
- [x] **S4 — SELESAI KODE** (`tsc` bersih; belum dites browser/deploy). **Di VPS SEBELUM kode:** `0077` lalu `0078_tracking_proof_path.sql`. File: `app/api/produsen/resi/route.ts`, `ResiForm` + `BatchRowActions` di `components/producer/batch-detail-actions.tsx`; tautan foto resi di portal (isi batch, detail pesanan) dan kartu fulfillment admin.
- **Audit `security-auditor` (0 Critical, 0 High, 2 Medium, 3 Low, 4 Info)** — tak ada IDOR; format dibaca dari isi file (lebih ketat dari `akun/media/upload`); CAS `packed→shipped` + cek `paid` di UPDATE yang sama; notifikasi Dikirim paling banyak sekali. Diperbaiki: (M-1) sesi diperiksa SEBELUM body dibaca (slug lewat `?tenant=`), `Content-Length` wajib & ≤ 9 MB; (M-2) rate limit 20 permintaan/10 menit per akun, `limitInputPixels` 25 MP; (L-1) flag `committed` — file tak dihapus bila error terjadi setelah DB tersimpan, `revalidatePath` dibungkus try sendiri; (L-2) kegagalan hapus file yatim di-log; (L-3) tolak invoice campuran/ambil-sendiri di route (lapis kedua); CSRF: Origin ATAU Referer wajib.
- **Perlu dicek manual di server:** (a) Nginx — tambah `client_max_body_size 10m;` pada `location /api/produsen/` (sekarang 50M) dan pastikan `proxy_set_header Host $host` (cek Origin memakai header Host); (b) cookie sesi Better Auth `SameSite=Lax` (DevTools → Application → Cookies); (c) HEIC iPhone bisa ditolak bila libvips VPS tanpa dukungan HEVC (pesan "Foto tidak bisa diproses"); (d) bucket policy publik tanpa `ListBucket`.
- **Diterima / catatan:** foto resi di URL publik acak (UUID 122-bit) seperti bukti transfer & media lain — foto label bisa memuat nama/alamat penerima; opsi lanjutan = route proxy ber-sesi atau presigned URL. Admin yang mengedit resi tidak menyentuh `trackingProofPath` (foto lama bisa tertinggal). Jalur admin mengubah status invoice yang sudah di batch belum diaudit.
- Uji manual setelah deploy: (1) Tandai Dikemas → Input Resi → isi resi + foto → status Dikirim di portal, kartu admin (`/toko/pesanan/invoice/<id>`, ada tautan foto) dan `/akun/transaksi`; (2) pelanggan menerima notifikasi Dikirim sekali; (3) tanpa foto / resi < 3 karakter / file bukan gambar / > 8 MB → ditolak; (4) Keluarkan tak tersedia setelah Dikirim; (5) dua tab mengisi resi invoice yang sama → satu 409 dan tidak ada file tersisa; (6) batch semua Dikirim → "Selesai" di daftar.

### 19.12 S4b — foto resi masuk Media Library anggota + edit + hapus otomatis 30 hari (2026-11-01, ditulis SEBELUM kode)
**Permintaan user:** produsen berotoritas penuh atas produknya → boleh EDIT nomor resi & foto resi; foto resi harus terintegrasi dengan Media Library (Media Library ANGGOTA `public.member_media` — produsen adalah anggota aktif tenant, jadi bisa memakainya; koreksi atas jawaban saya sebelumnya yang hanya menyebut Media Library tenant); WAJIB WebP, file asli tidak disimpan; satu tempat penyimpanan per produsen; bukti pengiriman dihapus otomatis setelah 1 bulan.
- **Penyimpanan:** foto resi = baris `public.member_media` milik anggota-pemilik produsen (`producer.memberId`, sudah dibuktikan lewat `getProducerAccess`), file fisik `akun/{memberId}/YYYY/MM/{uuid}_resi.webp` di bucket tenant — SATU folder per produsen, sama dengan foto anggota lain. Tetap hanya WebP (≤ 1600 px, q80); file asli tidak pernah disimpan. Tampil di `/akun/media` ("Foto Saya") dengan label **Bukti pengiriman**.
- **Penanda `purpose`:** kolom baru `public.member_media.purpose` (null = umum, `'resi'` = bukti pengiriman; migration `0079`). Alasan: foto resi memuat nama/alamat pembeli — TIDAK boleh muncul di picker cover (foto profil/usaha/pesantren publik). `GET /api/akun/media` default MENGECUALIKAN `purpose` non-null; halaman `/akun/media` meminta `?include=all`.
- **Tautan ke pengiriman:** `invoice_shipping_lines.tracking_proof_media_id` (tambah ke migration `0078`, belum deploy) di samping `tracking_proof_path`.
- **Edit (route yang sama):** pesanan `packed` → buat; `shipped` → ubah (resi dan/atau foto, minimal salah satu; tanpa notifikasi ulang); `delivered` → terkunci. Ganti foto = upload baru → CAS (menjaga media lama masih yang dirujuk) → baru hapus foto & baris lama. Ganti foto hanya dalam 30 hari sejak tanggal kirim.
- **Hapus manual dari /akun/media** tetap boleh (otoritas produsen); untuk `purpose='resi'` rujukan di pengiriman ikut dikosongkan supaya tidak ada tautan rusak.
- **Hapus otomatis:** `app/api/cron/cleanup-resi` (harian, header `x-cron-secret`, pola `cleanup-images`): per tenant aktif, pengiriman dengan foto resi & `shipped_at` > 30 hari → hapus file + baris `member_media` + kosongkan rujukan. NOMOR RESI tetap tersimpan; hanya foto yang dihapus. Perlu dipasang di crontab VPS.

### 19.13 Status S4b (2026-11-01)
- [x] **S4b — SELESAI KODE** (`tsc` bersih; belum dites browser/deploy). File: `app/api/produsen/resi/route.ts` (buat+ubah), `app/api/cron/cleanup-resi/route.ts`, `purpose` di `GET/DELETE /api/akun/media`, label di `/akun/media`, `ResiForm` mode ubah, migration `0079_member_media_purpose.sql`, kolom `tracking_proof_media_id` (di `0078`).
- **⚠ URUTAN DEPLOY (temuan audit Medium):** jalankan `0078` LALU `0079` di VPS **SEBELUM** kode. Drizzle memasukkan semua kolom schema ke `select()`/`returning()` → tanpa kolom `purpose`, **upload & picker foto anggota mati di seluruh platform** (bukan hanya fitur resi), dan halaman fulfillment admin bisa error tanpa `tracking_proof_path`. Migration dulu, kode belakangan = aman (kolom nullable). **Jalankan ulang `0078` apa pun kondisinya** (isinya diperluas setelah commit S4; idempotent) lalu cek `\d tenant_<slug>.invoice_shipping_lines` memuat `tracking_proof_path`, `tracking_proof_media_id`, `processing_notified_at`.
- **Audit `security-auditor` (0 Critical, 0 High, 2 Medium, 3 Low):** kepemilikan/penghapusan foto lama aman (filter `memberId`, path dari baris pengiriman milik produsen); CAS dua edit bersamaan benar; `purpose` tak bisa diubah anggota; foto resi tidak bocor ke picker; cron tahan gagal per tenant/baris. Diperbaiki: (L) `shipped_at` NULL → cron & batas ganti-foto memakai cadangan `updated_at`. Diterima: file yatim bila server mati di tengah proses (pemilik bisa menghapus di /akun/media), gagal-kosongkan-rujukan saat hapus manual hanya di-log, pelanggan tidak diberi tahu bila resi diubah.
- **Cron VPS (baru):** `cleanup-resi` harian dengan header `x-cron-secret` (pola `cleanup-images`/`pj-digest`), contoh: `15 3 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://jalakarta.com/api/cron/cleanup-resi >> /var/log/jalajogja-cron.log 2>&1`.
- Uji manual: (1) Input Resi → foto muncul di `/akun/media` berlabel "Bukti pengiriman" dan TIDAK muncul di picker foto profil/usaha; (2) Ubah Resi (hanya nomor / hanya foto / keduanya) → pelanggan tidak dapat notifikasi baru; foto lama hilang dari /akun/media; (3) pesanan Diterima → tombol Ubah Resi tidak ada, route menolak; (4) hapus foto dari /akun/media → pengiriman menampilkan "Foto resi sudah dihapus"; (5) panggil cron manual dengan secret → `{"deleted":0,"failed":0}`; ubah `shipped_at` satu baris ke > 30 hari lalu → foto + baris media terhapus, nomor resi tetap.

### 19.14 Tab "Pesanan Masuk" dirombak = tabel menu Pesanan (2026-11-01, permintaan user)
- **Permintaan:** "rombak total tabel Pesanan Masuk di halaman produk tunggal, isinya sama persis dengan halaman pesanan." Menggantikan tabel lama `ProductBuyerList` (kolom uang/voucher/kode unik/alamat, semua status bayar) — **§ 17.8 digantikan untuk tab ini**.
- **Satu komponen:** `components/orders/orders-table.tsx` (`OrdersTable`, server component) dipakai menu Pesanan portal DAN tab Pesanan Masuk produk tunggal (admin + produsen). Edit sekali berlaku ke semuanya. `ProductBuyerList` dihapus (tak ada pemakai lain).
- **Data:** `listProductOrders(tenantClient, productId, opts)` di `lib/producer-orders.server.ts` (berbagi inti `listByOwned` dengan `listProducerOrders`): invoice LUNAS yang memuat produk itu (+ variasinya); item yang tampil hanya milik produk itu; pencarian nomor invoice/nama; paginasi 20. Fungsi ini TIDAK memeriksa kepemilikan sendiri — pemanggil wajib sudah membuktikannya (admin: `getTenantAccess` + `loadProductDetail`; produsen: `loadProductDetail({ ownerProducerId })`). Dua pemanggil itu saja.
- **Aksi mata:** admin → `/toko/pesanan/invoice/{id}`; produsen → `/portal-produsen/pesanan/{id}`. Printer nonaktif. Penanda "Campuran" disembunyikan di tab produk (artinya "ada barang lain di invoice" membingungkan di konteks satu produk).
- **Yang berubah bagi admin (disengaja oleh permintaan):** tab ini tidak lagi menampilkan kolom uang/voucher/kode unik/alamat dan baris yang belum lunas. Data itu tetap ada di tab **Laporan & Produsen**, tombol **Export Pembeli / Export Semua** (admin) tetap ada di atas tabel. Tab **Ringkasan** tidak diubah.
- **Yang berubah bagi produsen:** payload halaman produk tidak lagi memuat data uang pesanan ke browser (tabel server-side, tanpa uang) — lebih sempit dari keputusan § 17.8.
- Status: `tsc` bersih; belum dites browser/deploy; tanpa migration.

## 20. Profil produsen + Gudang Pengiriman (format RajaOngkir) — RENCANA (2026-11-01, ditulis SEBELUM kode)

**Permintaan user:** kota asal pengiriman diambil dari data PRODUSEN, bukan diisi per produk (§ 18 butir 5). Di portal ada halaman profil lengkap produsen, lalu mulai dengan menambah SATU alamat sesuai format RajaOngkir.
**Keputusan user (2026-11-01):** (1) prioritas kota asal = **gudang produsen → kota per produk → kota default toko**; (2) Profil = **ringkasan baca-saja + gudang yang bisa diedit** (data usaha/pesantren/profesional & kontak milik anggota → ubah di Akun, bukan di portal).

### 20.1 Rancangan
- **Tabel baru** `producer_warehouses` (tenant, migration `0080`): `id`, `producer_id` (FK→producers RESTRICT), `label` (nama gudang), `address_detail` (jalan/RT/RW), `rajaongkir_city_id` (id lokasi dari picker; kecamatan/kelurahan-level seperti `mitras.rajaongkir_city_id`), `rajaongkir_city_label` (label lengkap hasil picker), `postal_code`, `is_default`, `created_at`, `updated_at`; unique index parsial `(producer_id) WHERE is_default`. Siap multi-alamat; **UI sekarang hanya satu alamat** (alamat utama).
- **Portal:** menu **Profil** (sidebar) → ringkasan baca-saja (nama, jenis sumber usaha/pesantren/profesional, kontak, alamat anggota; tautan ke Akun untuk mengubah) + kartu **Gudang Pengiriman** (form: nama gudang, alamat detail, `RajaOngkirCityPicker`). Aksi tulis `saveWarehouseAction` (`getProducerAccess` → validasi → upsert alamat utama milik produsen dari SESI).
- **Resolusi kota asal** (produk tenant, `mitraId IS NULL`): `gudang utama produsen (bila produk punya producer_id, produsen aktif, gudang ada)` → `product.originCityId` → default toko. Produk mitra TIDAK berubah. Diterapkan di DUA tempat yang sudah duplikat (§ addon-ongkir "Resolusi origin saat checkout"): `(public)/[tenant]/checkout/page.tsx` dan `toko/pesanan/new/page.tsx`. `groupKey` sudah memuat `originCityId` → dua produk satu produsen = satu paket = satu resi (cocok dengan alur batch/resi S4: satu baris pengiriman tenant per invoice).
- **Form produk:** bila produsen terpilih punya gudang, kolom "Kota Asal" per produk disembunyikan + keterangan "mengikuti gudang produsen" (nilai lama di DB tidak dihapus; hanya tidak dipakai).

### 20.2 Risiko & mitigasi
- Kota asal salah = tarif ongkir salah ke pelanggan → gudang kosong = perilaku lama persis (tidak ada perubahan untuk data yang ada); pesanan lama menyimpan salinan kota asal di `invoice_shipping_lines`, tidak terpengaruh.
- Aksi tulis baru dari akun produsen → `getProducerAccess` + kepemilikan dari sesi; selalu update baris milik `producer.id` sesi; `rajaongkir_city_id` dari klien dibatasi bilangan bulat positif dan label dipotong (produsen hanya bisa memengaruhi produknya sendiri); audit `security-auditor` sebelum commit akhir.
- Produsen nonaktif → gudangnya diabaikan (produk memang tak bisa dipesan, P6).
- Di luar cakupan (tidak diminta): "Lokasi Ambil Sendiri" per produk tidak mengikuti gudang; label/alamat pengirim cetak; multi-gudang UI.

### 20.3 Status (2026-11-01)
- [x] **SELESAI KODE** (`tsc` bersih; belum dites browser/deploy). **Di VPS SEBELUM kode:** migration `0080_producer_warehouses.sql`. File: `producer_warehouses` (skema + DDL + migration), `lib/producer-warehouse.server.ts` (`loadDefaultWarehouses`, `listProducerIdsWithWarehouse`, `publicCityLabel`), portal `profil/{page,actions}.tsx` + `components/producer/warehouse-form.tsx` + menu **Profil**, kota asal di `checkout/page.tsx` dan `toko/pesanan/new/page.tsx`, kolom "Kota Asal" per produk disembunyikan bila produsen punya gudang (`product-form.tsx`, halaman produk baru/edit).
- **Audit `security-auditor` (0 Critical, 0 High, 2 Medium, 3 Low):** penulisan gudang hanya milik produsen sesi (semua query difilter), produsen nonaktif/keluar keanggotaan ditolak, unique index parsial menjaga satu alamat utama, produk mitra tak tersentuh, alamat detail tidak sampai ke klien checkout. Diperbaiki: (M-1) `loadDefaultWarehouses`/`listProducerIdsWithWarehouse` kini menangkap error dan fallback ke kota asal lama — tanpa ini, bila tabel belum ada checkout publik diam-diam KEHILANGAN seluruh opsi pengiriman (pemanggil berada dalam try yang mengosongkan `sellerGroups`); (M-2) label yang tampil ke pembeli dipotong ke "KOTA, PROVINSI" (`publicCityLabel`) — kelurahan + kode pos gudang tidak lagi terlihat publik; teks bantuan di form menjelaskannya.
- **Diterima / tindak lanjut:** (L) `cityId`/`cityLabel` dipercaya dari klien — produsen hanya bisa memengaruhi ongkir produknya sendiri; verifikasi ke API RajaOngkir saat simpan ditunda (butuh uji dengan kunci API asli, dan salah implementasi akan memblokir produsen sah); tanpa rate limit di `saveWarehouseAction`; snapshot kota asal di item invoice dikirim klien (pra-eksisting, bukan regresi); tautan `/{slug}/akun` di Profil belum disesuaikan untuk custom domain.
- Uji manual setelah deploy: (1) produsen buka Profil → ringkasan tampil, isi Gudang (pilih lokasi dari pencarian) → tersimpan, muat ulang masih ada; (2) produk milik produsen itu di admin: kolom Kota Asal berganti keterangan "mengikuti Gudang Pengiriman"; (3) checkout publik dengan produk itu: "Paket dari …" menampilkan HANYA kota + provinsi, ongkir terhitung dari lokasi gudang; (4) produsen tanpa gudang / produk internal / produk mitra: ongkir seperti semula; (5) dua produk satu produsen → satu paket; (6) pesanan manual admin memakai kota gudang yang sama.

## 21. Cetak Label Pengiriman (PDF) — RENCANA (2026-11-01, ditulis SEBELUM kode)

**Permintaan user:** komponen cetak label (ikon printer di tabel Pesanan sudah ada, nonaktif). Cetak satuan dan masal (checkbox) oleh produsen DAN admin tenant (tenant = produsen internal). Popup pilih format (contoh Mengantar, UI kita dibuat lebih baik); output langsung PDF. Isi label: "Member of {tenant}" + logo tenant, logo kurir bila tersedia, nomor invoice sebagai barcode (menggantikan nomor resi), pengirim, penerima, COD/NON-COD, isi paket, instruksi. Contoh referensi (di luar repo): tiga PDF Mengantar — A4 landscape 4-per-halaman, thermal 10×15 cm, A4 portrait 1-per-halaman.

### 21.1 Riset API RajaOngkir/Komerce (2026-11-01)
Ada endpoint cetak label (`POST …/order/api/v1/orders/print-label`, header `x-api-key`; `page_1` A4 1/hal, `page_2` A4 2/hal, `page_4` A4 4/hal, `page_5` thermal 10×10, `page_6` thermal 10×15; `order_no` bisa banyak dipisah koma). **Tidak dipakai**, karena: (1) hanya untuk pesanan yang dibuat lewat **Delivery Order API Komerce** (store-order + jadwal pickup Komerce; label memuat AWB yang diterbitkan Komerce) — alur kita produsen mengirim sendiri dengan kurir pilihan dan mengisi resi manual; (2) tidak ada kustomisasi (logo tenant, "Member of …", barcode invoice); (3) format tetap, sama sekali tidak mencakup 6-per-halaman / 8×6 cm; (4) dokumen tidak menyebut logo kurir. Sumber: rajaongkir.com/docs/delivery-order-api/label_order. → **Label dibuat sendiri.**

### 21.2 Keputusan user (2026-11-01)
1. **Semua 7 format** sejak rilis pertama: kertas biasa 1 / 2 / 4 / 6 label per halaman (A4; 1 & 2 juga cocok A5) dan thermal 10×10, 10×15, 8×6 cm.
2. **Dikemas otomatis:** produsen DAN admin boleh; mencetak label = tahap mengemas → pesanan berstatus **Diproses** otomatis menjadi **Dikemas** saat PDF berhasil dibuat (satu langkah saja, mengikuti aturan fulfillment; cetak ulang aman). **Tombol manual "Tandai Dikemas" TETAP ada** sebagai jalur alternatif (user: "atau dia mengubah manual, klik dikemas").
3. **Barcode bawah = nama batch** (mis. 011120260001) untuk memindai tumpukan paket per batch; label di luar batch menampilkan "Dibuat pada" saja.
4. **Logo kurir:** API tidak menyediakan → **diunggah admin di Pengaturan Toko** per kurir (16 kode di `lib/rajaongkir-couriers.ts`; daftar mengikuti kurir yang diaktifkan tenant di add-on RajaOngkir). Tersimpan di settings tenant (kunci `courier_logos`, `{ kode: url gambar }`; gambar lewat Media Library admin). Tanpa logo = badge teks tebal. (Menggantikan rencana awal "folder `public/couriers`".)

### 21.3 Rancangan
- **Mesin:** HTML+CSS → PDF dengan Playwright (pola sama sertifikat event/surat). Satu template label berparameter (ukuran label + grid per halaman + kepadatan font); format kecil (8×6) memakai tata letak ringkas. Barcode Code128 lewat `bwip-js` (dependency baru; `qrcode` yang ada hanya QR).
- **Route:** `POST /api/labels?tenant=` (body: daftar invoiceId + format). Pintu akses ganda: `getTenantAccess` (admin) ATAU `getProducerAccess` (produsen) → hak per-invoice: produsen hanya invoice lunas yang memuat produknya & BUKAN campuran; admin invoice lunas tenant ber-seller tenant. Batas jumlah per cetak (100), rate limit per akun. PDF dikirim sebagai respons (dibuka di tab baru), TIDAK disimpan.
- **Data label:** pengirim = gudang produsen (alamat § 20) / kontak tenant untuk produk internal; penerima = invoice (nama, HP, alamat checkout); kurir+layanan+berat dari `invoice_shipping_lines`; COD/NON-COD dari `payment_method`; isi paket = item (produsen: hanya miliknya) + varian + jumlah; instruksi = `invoices.notes`; "Dibuat pada" = waktu cetak (zona waktu tenant).
- **Efek status:** setelah PDF berhasil dibuat → compare-and-set `processing → packed` untuk invoice yang dicetak (cek paid di UPDATE yang sama), per aturan 21.2(2).
- **UI:** popup format dua kolom (Kertas Biasa | Thermal) dengan pratinjau kecil; ikon printer per baris + checkbox cetak masal di `OrdersTable` (dipakai portal & tab produk admin) + tombol "Cetak Label Batch"; titik masuk admin di daftar pesanan toko dan halaman fulfillment invoice.

### 21.4 Fase (tiap fase: tsc → security review → commit; push hanya bila diminta)
| Fase | Isi |
|---|---|
| L1 | Prototipe desain label (7 format) dengan data contoh → PDF untuk ditinjau user, SEBELUM disambung ke data/route |
| L2 | Route `/api/labels` + data nyata + barcode + izin akses + efek Dikemas |
| L3 | Popup format + ikon printer/checkbox di `OrdersTable`, batch, titik masuk admin |
| L3b | Pengaturan Toko → bagian **Logo Kurir** (unggah per kurir, simpan `courier_logos`); label memakai logo ini (disematkan base64 ke PDF agar tak bergantung jaringan) |

### 21.5 Status L1 — prototipe desain (2026-11-01)
- [x] **L1 SELESAI** (`tsc` bersih; belum tersambung ke data/route): `lib/shipping-label/{types,formats,render}.ts` (mesin render murni: `renderLabelsHtml(LabelData[], format)`, Code128 via `bwip-js` — dependency baru) + alat pratinjau `apps/web/scripts/preview-labels.ts` (`bun run scripts/preview-labels.ts <folder> [format…]`, data contoh, tanpa DB) → 7 PDF.
- Desain: monokrom (aman thermal), 4 varian tata letak (`wide` untuk A4 1/2/4 per halaman, `tall` 10×15, `compact` 10×10 & A4 6/halaman, `mini` 8×6); kotak penerima/pengirim mengisi ruang sisa; COD tampil inversi hitam + nominal tagih; "Member of {tenant}" + logo tenant + logo kurir (atau badge teks); barcode invoice (kanan atas) + barcode batch (bawah, hanya bila di batch); alamat panjang dipotong rapi (line-clamp).
- **Font (keputusan user 2026-11-01): Inter KHUSUS label, bukan font tenant** — keterbacaan di 5–9 pt, metrik tetap untuk pemotongan baris, PDF dibuat di server (font tenant butuh jaringan & bisa dekoratif). Inter (latin 400/700/800, SIL OFL) disematkan base64 di `lib/shipping-label/fonts-data.ts` (tak bergantung path/node_modules saat runtime); lisensi di `lib/shipping-label/fonts/`. Terverifikasi tertanam di PDF.
- Belum: sumber logo tenant/kurir dari data nyata, route, popup, efek Dikemas (L2–L3b).

### 21.6 Status L2 — route cetak + data nyata + efek Dikemas (2026-11-01)
- [x] **L2 SELESAI KODE** (`tsc` bersih; diuji dengan DB dev lokal + data nyata, belum dites di browser/VPS; **tanpa migration baru**). File: `app/api/labels/route.ts` (`POST /api/labels?tenant=`; JSON atau form), `lib/shipping-label/{build.server,images.server,pdf.server}.ts`, alat dev `scripts/{smoke-labels,stub-server-only}.ts`.
- Akses: admin (`getTenantAccess` + baca modul toko; ubah status Dikemas hanya akses PENUH toko) ATAU produsen (`getProducerAccess`; hanya pesanannya, tidak campuran, bukan ambil-sendiri); tiap invoice diperiksa ulang di `buildLabelData` (gagal total bila ada yang tak layak, tidak diam-diam melewatkan). Batas: 100 pesanan, 15 cetak/5 mnt/akun, 2 render Chromium bersamaan. PDF tidak disimpan (`no-store, private`).
- **Audit `security-auditor` (0 Critical, 0 High, 2 Medium, 5 Low)** — tak ada IDOR/XSS/SSRF; semua nilai template ter-escape; SSRF logo dikunci ke `MINIO_PUBLIC_URL`; CAS `processing→packed` + cek lunas. Diperbaiki: Chromium dikeraskan (JS mati, offline, hanya `data:`/`about:` boleh dimuat, CSP meta); counter render selalu berkurang walau `close()` gagal; cek jumlah id sebelum `map`; pesan error disatukan (tak jadi oracle keberadaan invoice); logo > 1,5 MB tak dibaca. Diterima: rate limit & batas render per proses (cek PM2 fork vs cluster); `logo_url` boleh menunjuk bucket tenant lain bila publik (sudah publik).
- **⚠ KEPUTUSAN TERBUKA — pesanan COD:** invoice COD baru `paid` setelah `confirmCodPaymentAction` (uang tunai diterima), padahal label/pengiriman terjadi SEBELUM itu → pesanan COD murni TIDAK muncul di Pesanan/batch/resi/label (semuanya "hanya lunas", keputusan user S2) dan kotak COD di label hampir tak pernah tercapai. Memperbaikinya = mengizinkan invoice `pending`/`partial` bila baris tenant COD & belum `codConfirmedAt` di: `producer-orders` (`requirePaid`), `buildLabelData`, `markPackedAfterPrint`, aksi batch (`toProcessing`), route resi, dan aturan "Diproses hanya bila lunas" di fulfillment admin. **Belum diubah — menunggu keputusan user.**
- Uji manual: (1) cetak dari baris pesanan produsen di tiap format → PDF terbuka; barcode terbaca pemindai; (2) pesanan Diproses di batch → otomatis Dikemas setelah cetak, cetak ulang tak mengubah apa pun; (3) pesanan campuran / ambil-sendiri / produsen lain → ditolak; (4) admin akses toko "read" → bisa cetak tapi status tak berubah; (5) logo tenant tampil; (6) PM2: Chromium non-root `--no-sandbox` jalan di VPS (sertifikat event sudah memakai yang sama).

### 21.7 Status L3 — popup format + ikon printer + cetak masal (2026-11-01)
- [x] **L3 SELESAI KODE** (`tsc` + `bun run build` produksi bersih; belum dites di browser/VPS; tanpa migration). File: `components/orders/print-label-dialog.tsx` (popup "Print Format" dua kolom Kertas Biasa | Thermal, 7 kartu berpictogram; `PrintLabelsButton` mandiri), `components/orders/print-selection.tsx` (Provider + checkbox + bar "Cetak Label (N)"), `OrdersTable` (prop `print`), pemasangan di: menu Pesanan portal (blockMixed), tab "Pesanan Masuk" produk (admin + produsen), halaman batch ("Cetak Label Batch"), halaman fulfillment admin ("Cetak Label"), daftar pesanan toko admin (ikon per baris, aktif hanya untuk pesanan lunas).
- Alur klik: tab kosong dibuka SINKRON (anti pop-up blocker) → `fetch POST /api/labels` → tab diarahkan ke PDF (blob). Kegagalan (campuran/ambil-sendiri/sibuk/rate limit) tampil di popup, bukan JSON mentah. Setelah sukses `router.refresh()` (status Diproses → Dikemas sudah diubah server sebelum respons). Tombol manual "Tandai Dikemas" TETAP ada.
- Kelayakan baris di `OrdersTable`: ikon/checkbox nonaktif untuk "ambil sendiri" dan (menu Pesanan produsen saja) invoice campuran; di tab produk kelayakan campuran diputuskan server karena "campuran" di sana relatif terhadap satu produk.
- Belum: L3b (Pengaturan Toko → Logo Kurir; sampai itu ada, kurir tampil sebagai badge teks), cetak masal dengan checkbox di daftar pesanan toko admin (baru ikon per baris), keputusan COD (§ 21.6).
- Uji manual: (1) klik ikon printer di Pesanan produsen → popup 7 format → pilih → PDF terbuka di tab baru; (2) centang beberapa baris → "Cetak Label (N)"; (3) pesanan campuran/ambil-sendiri: ikon nonaktif + alasan di tooltip; (4) pesanan Diproses di batch jadi Dikemas setelah cetak; (5) halaman batch "Cetak Label Batch"; (6) admin: ikon di daftar pesanan + tombol di halaman fulfillment; (7) bila pop-up diblokir, PDF tetap dibuka lewat window.open kedua.

### 21.8 Status L3b — Logo Kurir di Pengaturan Toko (2026-11-01)
- [x] **L3b SELESAI KODE** (`tsc` bersih; belum dites browser; tanpa migration). `/app/{slug}/toko/pengaturan` → bagian **Logo Kurir** (`courier-logos-form.tsx` + `saveCourierLogosAction`): daftar kurir = yang diaktifkan tenant di add-on RajaOngkir (bila terpasang; selain itu semua 16 kurir), tiap kurir "Pilih logo" lewat **MediaPicker** (Media Library admin) / Ganti / Hapus; tersimpan di settings group `toko`, key `courier_logos` `{ kode: url }`. Dibaca `buildLabelData` → disematkan base64 ke PDF label. Kurir tanpa logo = badge teks tebal.
- Keamanan (tinjau mandiri; aksi kecil): `getTenantAccess` + `hasFullAccess(toko)`; kunci dibatasi daftar kurir resmi; URL wajib berawalan `MINIO_PUBLIC_URL/` (selaras batas SSRF `imageToDataUri`), maks 500 karakter; entri kosong dibuang.
- **Keputusan COD (user 2026-11-01): sistem tidak memakai COD** → temuan COD § 21.6 tidak perlu ditindaklanjuti; kotak label selalu "NON-COD" dalam praktik. "Ambil di tempat" tetap prabayar lewat tenant (invoice lunas, tampil di Pesanan) tetapi tidak dikirim kurir → tak ikut batch/resi/label. Kode COD dibiarkan dorman.

## 22. Tindakan masal "Buat Batch" + filter status pesanan — RENCANA (2026-11-01, ditulis SEBELUM kode)

**Permintaan user:** (1) tindakan masal **Buat Batch pengiriman** dari tabel pesanan: tab "Pesanan Masuk" di halaman produk tunggal dan menu Pesanan portal produsen; (2) **filter berdasarkan status** di tabel itu. **Keputusan user (2026-11-01):** Buat Batch masal juga tersedia di **dashboard admin** (tab produk admin), bukan hanya portal.

### 22.1 Rancangan
- **Satu inti pembuatan batch** `lib/producer-batch.server.ts` → `createBatchCore(tenantDb, producerId, input)` (dipindahkan dari `createBatchAction`: validasi nama/tanggal/id, kelayakan lewat `getProducerOrdersByIds` + `isBatchable`, transaksi insert batch + tautan + `pending → processing` compare-and-set, notifikasi "Diproses" sekali per invoice). Dua pintu akses MEMANGGIL inti yang sama setelah otorisasi masing-masing:
  - produsen: `createBatchAction` (sudah ada; `producerId` dari sesi) — dirapikan memanggil inti.
  - admin: `createBatchAsAdminAction(slug, producerId, input)` — `getTenantAccess` + `hasFullAccess(toko)`; `producerId` wajib baris `producers` milik tenant & AKTIF; semua invoice harus milik produsen itu (pemeriksaan kepemilikan yang sama). Batch tercatat atas nama produsen tsb dan terlihat di portalnya. Admin tidak punya halaman batch; kelanjutan (Dikemas/resi) lewat alur fulfillment admin yang sudah ada atau portal produsen — keduanya mengubah status pengiriman yang sama.
- **UI:** `BulkPrintBar` menjadi bar tindakan masal: "Cetak Label (N)" + "Buat Batch (N)" (hanya bila `batch` aktif; N = terpilih ∩ layak batch: berstatus Menunggu, kurir, bukan ambil-sendiri; yang tidak layak dilewati dengan keterangan). Klik "Buat Batch" → popup: nama batch bawaan (`DDMMYYYY####`), tanggal kirim, ringkasan jumlah → simpan. Produsen: setelah sukses menuju halaman batch; admin: pesan sukses + tabel disegarkan (status → Diproses).
- **Admin hanya untuk produk berprodusen:** tab produk admin menampilkan "Buat Batch" hanya bila produk punya `producer_id` (produk internal tak punya produsen → tak ada batch; tombol tersembunyi dengan keterangan).
- **Filter status:** `?status=pending|processing|packed|shipped|delivered` (status pengiriman, `invoice_shipping_lines.status` baris tenant) di menu Pesanan portal dan tab Pesanan Masuk produk (admin + produsen). Chip: **Semua · Menunggu · Diproses · Dikemas · Dikirim · Diterima** dengan jumlah per status (satu query ber-`GROUP BY` pada himpunan pesanan lunas yang sama; jumlah mengabaikan pencarian agar stabil). Paginasi/pencarian mempertahankan filter. Status tak dikenal diabaikan (= Semua).
- **Loader:** `listByOwned` menerima `status`, mengembalikan `statusCounts`; dipakai `listProducerOrders` dan `listProductOrders`.

### 22.2 Risiko & mitigasi
- Aksi tulis admin baru atas nama produsen → otorisasi `hasFullAccess(toko)`; `producerId` dari input DIVERIFIKASI ke tabel produsen tenant (bukan dipercaya) dan kepemilikan tiap invoice dibuktikan lagi terhadap produsen itu; invoice produsen lain/campuran/ambil-sendiri/belum lunas ditolak seluruhnya.
- Refactor `createBatchAction` ke inti bersama → perilaku produsen TIDAK boleh berubah (pesan error, notifikasi sekali, rollback); diuji ulang + audit.
- Cakupan daftar dibatasi 100 invoice per batch (seperti sekarang); seleksi masal tidak lintas halaman (per halaman 20).
- Tidak ada migration (tabel batch sudah ada).

### 22.3 Fase (tiap fase: tsc → security review → commit; push hanya bila diminta)
| Fase | Isi |
|---|---|
| B1 | Filter status: loader + chip + paginasi (portal Pesanan, tab produk admin & produsen) |
| B2 | `createBatchCore` + `createBatchAsAdminAction` + refactor `createBatchAction` |
| B3 | Bar tindakan masal + popup Buat Batch di `OrdersTable`; pemasangan di tiga tempat |
