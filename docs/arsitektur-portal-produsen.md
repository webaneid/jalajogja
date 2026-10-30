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
      **Temuan LAMA (bukan dari fitur ini; TIDAK diperbaiki di sini, menunggu keputusan user):** [HIGH] `settings/addons/rajaongkir/actions.ts` `saveRajaOngkirConfigAction` — Server Action TANPA autentikasi/otorisasi, mengubah `tenant_addon_installations.config` berdasarkan `installationId` dari klien (diverifikasi manual: memang tanpa guard);
      [MEDIUM] open redirect `?redirect=` di login publik tenant (`(public)/[tenant]/login/login-form.tsx`, `page.tsx`); [MEDIUM] `api/mitra/products` + `api/mitra/status` memakai `slug` mentah ke `createTenantDb` tanpa `isActiveTenant` (500 + noise log); [LOW] redirect login admin menerima `/\evil.com` (perlu dicek manual di browser).
      **Perlu keputusan/cek manual:** apakah portal harus ikut gating modul per paket tenant (Starter/Standar/Pro) — saat ini hanya cek tenant aktif; `/no-tenant-access` di custom domain ikut di-rewrite middleware (UX, bukan keamanan); migration 0075 mengunci `products`/`producers` sebentar → jalankan di luar jam ramai; keputusan D5 (produk produsen nonaktif tak bisa dipesan) = P6, belum diaudit.
- [ ] P6 produsen nonaktif → produk tak bisa dipesan.
