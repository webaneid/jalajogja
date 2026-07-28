# Arsitektur Penulis & Editor Post (Byline System)

> **Status: ✅ SELESAI DIEKSEKUSI (2026-07-26)** — `tsc --noEmit` bersih di `apps/web` +
> `packages/db`, build produksi sukses (`/api/ref/post-authors` terkonfirmasi muncul di build
> output). Migration `0049_post_authors.sql` sudah dijalankan+diverifikasi di lokal — **belum
> dijalankan di VPS**. **Belum diverifikasi visual di browser** (pilih penulis dari Anggota,
> buat penulis tamu baru, edit bio/foto, isi Editor, cek byline+bio+"Disunting oleh X" di
> halaman publik) — perlu dicoba user sebelum deploy. Rencana di dokumen ini terealisasi
> hampir 1:1 — satu penyesuaian kecil dicatat di § 12.

## 12. Penyesuaian Saat Eksekusi (vs Rencana Awal)

- **Server actions ditaruh di file BARU** `website/post-authors-actions.ts` (bukan ditambahkan
  ke `website/actions.ts` yang sudah 1000+ baris) — konsisten dengan pola project ini
  memisahkan actions besar per-fitur (mis. billing actions terpisah dari finance actions).
- **`AuthorPicker` tidak butuh prop `role`** — cukup `label`+`emptyHint` berbeda per pemanggilan
  (Penulis vs Editor), komponennya sendiri generik tanpa percabangan `role`.
- **Hint default "Penulis" berbeda isi antara create-mode dan edit-mode** — create-mode:
  nama yang SEDANG login (`access.userId → public.user.name`, query di `posts/new/page.tsx`).
  Edit-mode: nama PEMBUAT DRAFT ASLI dari `post.authorId` (bisa beda orang dari yang sedang
  mengedit) — resolusi 2 langkah yang SAMA PERSIS dipakai halaman publik
  (`schema.users → public.user`), supaya hint selalu akurat mencerminkan fallback SESUNGGUHNYA
  yang akan dipakai kalau field Penulis dibiarkan kosong (§ 3).
- **Bio menggantikan "Tim Redaksi" di halaman publik, bukan baris tambahan** —
  `{authorBio ?? "Tim Redaksi"}` di kedua blok render (mobile+desktop). Untuk byline lama
  (fallback `authorId`, `authorBio` selalu null) perilaku 100% tidak berubah; untuk byline baru
  yang bio-nya diisi, teks itu menggantikan placeholder generik "Tim Redaksi" — lebih informatif
  tanpa menambah baris visual baru.
- **Avatar upload pakai `<MediaPicker>` admin (module="website"), BUKAN `CoverImageField`
  self-service member** — `CoverImageField`/`MemberMediaPicker` terikat ke sesi member yang
  login sendiri (`/api/akun/media/*`), tidak cocok untuk admin yang upload foto ATAS NAMA
  profil penulis tamu. `MediaPicker` admin (dipakai juga untuk Featured Image post) yang benar.

## 13. Integrasi SEO — Direncanakan di `docs/arsitektur-seo.md` § 6b (Belum Diimplementasikan)

Byline (Penulis+Editor) yang dibangun di dokumen ini SAAT INI murni tampilan HTML visual di
`post/[slug]/page.tsx` — belum masuk sebagai data terstruktur (JSON-LD) yang dibaca Google.
Rencana penutupan gap ini (perluasan `ArticleJsonLdParams`, wiring `generateArticleJsonLd()`
yang sampai sekarang nol pemanggil di seluruh app, reuse fallback chain byline yang SAMA
dengan render visual, dan keputusan eksplisit "Editor tidak masuk JSON-LD karena Schema.org
`Article` tidak punya properti `editor` resmi") sudah ditulis lengkap sebagai **Fase 7B** di
`docs/arsitektur-seo.md` § 6b — **rencana saja, belum dieksekusi**, menyusul instruksi user.

## 1. Masalah yang Dipecahkan

Diverifikasi ke kode aktual (bukan asumsi) sebelum menulis dokumen ini:

- `posts.authorId` **ADA** di skema (`packages/db/src/schema/tenant/website.ts`), FK ke
  `tenant.users.id` (DDL: `REFERENCES "${s}".users(id) ON DELETE SET NULL`) — tapi **TIDAK
  PERNAH muncul sebagai field di `post-form.tsx`** (grep 0 hasil). Diisi otomatis ke
  `access.tenantUser.id` (pengurus yang sedang login) HANYA saat baris pertama kali dibuat
  (`createPostDraftAction`), dan **tidak pernah disentuh lagi oleh `updatePostAction`** — jadi
  sifatnya "siapa yang membuat draft ini", permanen, tidak bisa diganti dari UI mana pun.
- Diverifikasi: `authorId` **TIDAK dipakai untuk permission/scope apa pun** — modul `website` di
  `lib/permissions.ts` cuma punya level `full`/`read`/`none` (tidak ada `"own"` seperti modul
  `surat`). Ini penting: berarti aman menambah cara BARU untuk menentukan byline tanpa
  menyentuh `authorId` sama sekali — tidak ada access-control yang bergantung padanya.
- Tidak ada cara mengatribusikan tulisan ke: (a) pengurus LAIN (bukan yang sedang login,
  misal admin upload-kan tulisan orang lain), (b) anggota IKPM yang BUKAN pengurus, (c)
  penulis eksternal yang bukan anggota sama sekali (kolumnis tamu, wartawan, dll).
- Tidak ada bio/deskripsi penulis (WordPress punya ini bawaan di profil user — "Wartawan
  senior di X, menulis kolom opini sejak Y").
- Tidak ada konsep "Editor" (penyunting) sama sekali.

## 2. Keputusan yang Sudah Dikonfirmasi User (2026-07-26)

1. **Default**: siapa pun yang login dan membuat/mengedit post, dialah penulis secara default
   — TANPA perlu memilih apa pun. Baru kalau admin ingin menulis ATAS NAMA orang lain (member
   ATAU tamu), field Penulis boleh diganti manual.
2. **Scope: Post saja** — TIDAK diperluas ke Pages (Halaman Statis) di fase ini, meski
   `pages.authorId` punya kolom yang persis sama (bisa disusulkan nanti kalau diminta).
3. **Manajemen penulis: inline saja** — TIDAK ada halaman admin terpisah (`/website/penulis`)
   di fase ini. Cari/buat/edit bio penulis semuanya dari sidebar form post langsung.
4. **Editor: field kedua, terpisah dari Penulis, SELALU opsional** (boleh kosong selamanya).
   Tampil ke publik sebagai baris "Disunting oleh {nama}" di byline, HANYA kalau diisi.

## 3. Prinsip Arsitektur Kunci

**`authorId` (kolom existing) TIDAK DIUBAH SAMA SEKALI** — tetap FK ke `tenant.users`, tetap
auto-terisi saat draft dibuat, tetap immutable setelahnya. Ini sengaja dipertahankan sebagai
"siapa pemilik sistem dari draft ini" (audit trail internal) — terpisah total dari konsep BARU
"byline" (siapa yang ditampilkan ke pembaca sebagai penulis/editor).

Byline diimplementasikan sebagai **dua kolom baru yang nullable** di `posts`:
`display_author_id` dan `editor_id`, keduanya menunjuk ke SATU entitas baru `post_authors`.

**Kenapa satu entitas untuk dua peran (Penulis dan Editor), bukan dua tabel terpisah**: baik
Penulis maupun Editor sama-sama butuh hal yang identik — nama, foto, bio opsional, bisa
tertaut ke member ATAU berdiri sendiri sebagai profil tamu. Membuat dua tabel akan
menduplikasi logic pencarian/pembuatan tanpa manfaat nyata — satu orang yang sama juga bisa
jadi Penulis di satu post dan Editor di post lain.

**Kenapa default "penulis = yang login" otomatis terpenuhi tanpa logic tambahan**:
`display_author_id` defaultnya `NULL`. Titik resolusi byline di halaman publik dirancang:
kalau `display_author_id` ADA → resolve dari `post_authors`; kalau `NULL` → **fallback ke
resolusi `authorId` yang SUDAH ADA sekarang** (tidak diubah). Jadi post yang field Penulis-nya
tidak pernah disentuh admin otomatis tetap menampilkan "yang login saat membuat" — persis
seperti sekarang, TANPA butuh insert row `post_authors` untuk kasus default ini. Efek samping
bagus: **nol migrasi data untuk post lama** — semuanya otomatis tetap benar.

## 4. Entitas Baru: `tenant.post_authors`

```typescript
export function createPostAuthorsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("post_authors", {
    id:        uuid("id").primaryKey().defaultRandom(),
    // FK ke public.members — TANPA constraint DB (pola sama tenant.users.member_id, circular
    // ref di factory pattern tenant schema — lihat CLAUDE.md "FK Constraints di Tenant Tables").
    // NULL = profil tamu murni (bukan anggota IKPM sama sekali).
    memberId:  uuid("member_id"),
    name:      text("name").notNull(),
    bio:       text("bio"),            // "Wartawan senior di Kompas.com..." — opsional
    // URL langsung (bukan media_id FK) — pola sama member_businesses.cover_url /
    // member_owned_pesantren.cover_url (lesson "Member Media Library"), bukan pola
    // posts.cover_id (FK ke media). Profil penulis lebih dekat konsepnya ke "foto profil
    // entitas mandiri" daripada "aset konten utama post".
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}
```

**Kolom `posts` baru** (nullable, `ON DELETE SET NULL` — kehilangan penulis/editor tidak
boleh menghapus post):
```sql
ALTER TABLE posts ADD COLUMN display_author_id UUID REFERENCES post_authors(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN editor_id          UUID REFERENCES post_authors(id) ON DELETE SET NULL;
```

## 5. Alur UI — Sidebar Form Post

Section baru "Penulis" di sidebar kanan `post-form.tsx` (pola sama section lain di situ —
`<SidebarLabel>` + konten, sejajar dengan Kategori/Tag/Featured Image), berisi DUA field:

### 5.1. Field "Penulis"
- Placeholder/teks bantuan kalau kosong: `"Default: {nama pengurus yang sedang login}"` — supaya
  admin paham defaultnya tanpa perlu isi apa pun.
- Komponen baru `AuthorPicker` — search gabungan DUA sumber sekaligus (dropdown satu, hasil
  digabung+dikelompokkan, mirip pola `PublicLinkPicker` grouped-by-source):
  1. **Anggota** — reuse `/api/ref/tenant-members` (endpoint yang SUDAH ADA, dipakai
     `MemberNameAutocomplete` di modul Keuangan sesi sebelumnya).
  2. **Penulis Tersimpan** — endpoint BARU `GET /api/ref/post-authors?slug=&q=` — cari
     `post_authors` yang `member_id IS NULL` (profil tamu yang sudah pernah dibuat, "recall").
- **Pilih dari Anggota** → find-or-create idempotent: cek dulu apakah `post_authors` untuk
  `member_id` itu sudah ada di tenant ini (pola sama `computeMemberMergeCandidate`/
  `syncAutoTenantMemberships` — cek dulu sebelum insert, jangan pernah duplikat); kalau belum,
  buat baru dengan `name` snapshot dari member, `avatarUrl` kosong (fallback ke foto member
  saat render, lihat § 7).
- **Pilih dari Penulis Tersimpan** → langsung reuse `id`-nya, tidak ada insert baru.
- **Ketik nama yang TIDAK match apa pun** → opsi "+ Buat penulis baru: '{nama}'" muncul di
  dropdown → klik → mini-form inline (nama sudah terisi dari ketikan, tambah **Bio** opsional
  + **Foto** opsional via `<MediaPicker>`) → simpan sebagai `post_authors` baru (`memberId`
  null).
- **Setelah penulis terpilih** (dari sumber mana pun): tampil card ringkas (foto+nama+bio
  1 baris terpotong) + tombol "Edit Bio/Foto" (expand inline, edit `post_authors` row yang
  sedang dipakai — HATI-HATI: ini row SHARED, dipakai bisa banyak post, jadi editnya
  memengaruhi SEMUA post oleh penulis itu — ini prinsip "recall" yang memang diminta user,
  bukan bug) + tombol "Ganti Penulis" (reset ke kosong/default).

### 5.2. Field "Editor" (opsional, SELALU boleh kosong)
- Komponen SAMA (`AuthorPicker`, props berbeda: `role="editor"`, tidak ada default-text
  "yang login" karena memang tidak ada default sama sekali untuk field ini).
- Placeholder kalau kosong: `"(Opsional — kosongkan kalau tidak ada penyunting)"`.

## 6. Server Actions & API Baru

```
GET  /api/ref/post-authors?slug=&q=        → search post_authors WHERE member_id IS NULL
findOrCreatePostAuthorFromMemberAction(slug, memberId)  → idempotent, dipakai saat pilih dari Anggota
createGuestPostAuthorAction(slug, {name, bio?, avatarUrl?})  → buat profil tamu baru
updatePostAuthorAction(slug, authorId, {name?, bio?, avatarUrl?})  → edit bio/foto (shared row)
```

`updatePostAction` (existing, `website/actions.ts`) diperluas — `displayAuthorId` dan
`editorId` ditambahkan ke `.set({...})` (sebelumnya TIDAK ADA field ini sama sekali di sana).
`PostFormData` type juga diperluas dua field baru (opsional).

## 7. Resolusi & Render Publik (`post/[slug]/page.tsx`)

Query diperluas — LEFT JOIN `post_authors` (untuk `displayAuthorId`) dan LEFT JOIN lagi untuk
`editorId` (dua alias join berbeda, satu tabel).

**Byline penulis**:
```
displayAuthorId ada → nama = post_authors.name, foto = post_authors.avatarUrl
                       ?? (kalau post_authors.memberId ada) members.photoUrl
                       ?? Gravatar (fallback TERAKHIR, sama seperti sekarang)
displayAuthorId NULL → fallback ke resolusi authorId LAMA (tidak berubah — kode existing
                        `post.authorId → tenant.users → public.user + public.members` tetap
                        dipakai apa adanya untuk kasus ini)
```

**Bio penulis** — tampil di HALAMAN DETAIL POST SAJA (bukan di card list/archive, terlalu
ramai untuk tampilan list) — teks kecil muted di bawah nama+foto penulis, mirip kotak "Tentang
Penulis" ala WordPress. Kalau `post_authors.bio` kosong, baris ini tidak dirender sama sekali
(bukan tampilkan string kosong).

**Byline editor** — kalau `editorId` ada, baris TAMBAHAN "Disunting oleh {nama editor}" di
byline (styling menyesuaikan blok author existing, ukuran lebih kecil/sekunder). Kalau
`editorId` NULL (kasus paling umum, karena opsional) → baris ini TIDAK dirender sama sekali.

## 8. Precedent yang Direuse (Bukan Reinvent)

- `MemberNameAutocomplete` (`components/keuangan/member-name-autocomplete.tsx`, dibuat sesi
  sebelumnya untuk form Catat Pemasukan) — pola dasar "search dari `/api/ref/tenant-members`,
  fallback ketik manual" — `AuthorPicker` MEMPERLUAS pola ini (dua sumber, bukan satu; hasil
  pilih bukan cuma nama tapi butuh insert/reuse row `post_authors`).
- Pola "find or create" idempotent — SAMA PERSIS `computeMemberMergeCandidate()`/
  `syncAutoTenantMemberships()` dari fitur Import Anggota (sesi sebelumnya): cek dulu apakah
  row untuk identitas ini sudah ada sebelum insert, jangan pernah bikin duplikat diam-diam.
- `<MediaPicker>` untuk upload foto penulis — infrastruktur upload yang sudah ada, tidak perlu
  pipeline baru.
- Pola `cover_url TEXT` langsung (bukan `media_id` FK) untuk `avatar_url` — sama seperti
  `member_businesses.cover_url`/`member_owned_pesantren.cover_url`.
- `SeoPanel` sebagai referensi pola "section embeddable di sidebar/bawah form" — meski
  `AuthorPicker` sendiri lebih ringkas (bukan accordion 3-tab seperti SeoPanel).

## 9. Yang Sengaja TIDAK Dikerjakan di Fase Ini

- **Halaman Direktori Penulis** (`/website/penulis`, list semua + jumlah tulisan per penulis)
  — dikonfirmasi user, cukup inline dari form post dulu. Bisa disusulkan kalau nanti ada
  kebutuhan nyata (mis. penulis mulai banyak, admin perlu lihat/kelola semua sekaligus).
- **Halaman arsip publik per penulis** (`/{slug}/penulis/{nama}`, ala WordPress author
  archive) — tidak diminta, di luar scope sekarang. **Dependency terbuka**: kalau dibangun
  nanti, halaman ini jadi sumber `author.url` di JSON-LD Article (lihat
  `docs/arsitektur-seo.md` § 6b.3) — sampai saat itu, `author.url` sengaja dikosongkan di
  structured data.
- **Pages (Halaman Statis)** — `pages.authorId` dibiarkan seperti sekarang, tidak ikut
  diperluas byline-nya. Bisa disusulkan terpisah kalau diminta nanti.
- **Sinkronisasi otomatis nama/foto** kalau data member yang ditautkan berubah di kemudian
  hari — `post_authors.name`/`avatarUrl` untuk kasus member-linked adalah SNAPSHOT saat
  dipilih pertama kali, bukan live-join setiap render (lebih sederhana, konsisten dengan
  pola project ini untuk kolom snapshot lain). Admin bisa edit manual via "Edit Bio/Foto" kalau
  perlu update.

## 10. Urutan Eksekusi (Rencana)

```
Fase A — Schema: createPostAuthorsTable + kolom baru posts + DDL create-tenant-schema.ts
         + migration SQL (loop semua tenant aktif, pola sama migration lain)
Fase B — Server Actions: find-or-create dari member, create guest, update bio/foto
         + API search /api/ref/post-authors
Fase C — Komponen AuthorPicker (baru) + integrasi ke sidebar post-form.tsx (2 field:
         Penulis + Editor) + updatePostAction diperluas
Fase D — Resolusi render publik: post/[slug]/page.tsx query + tampilan byline+bio+editor
Fase E — Verifikasi tsc --noEmit + build produksi, dokumentasi hasil akhir
```

**Migration wajib dijalankan di VPS sebelum deploy kode** (pola standar project ini — migrate
dulu, baru restart PM2).
