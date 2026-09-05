# Arsitektur Modul Surat — Indeks + Audit Menyeluruh (2026-07-24)

> **Dokumen ini adalah PETA + HASIL AUDIT**, bukan pengganti 3 dokumen detail yang sudah ada.
> Ditulis setelah verifikasi LANGSUNG ke kode aktual (bukan cuma baca dokumen lama) — beberapa
> klaim di 3 dokumen di bawah ternyata BASI (status salah, fitur yang diklaim belum ada
> ternyata sudah, atau sebaliknya). Detail koreksi ada di § 3.

## 1. Peta Dokumen Modul Surat

| Dokumen | Cakupan | Status setelah audit ini |
|---|---|---|
| `docs/arsitektur-surat.md` | Identitas surat (3 layout), tujuan surat, format tanggal (Masehi/Hijriah), lampiran | **Header status dikoreksi** — tertulis "PROPOSAL belum dieksekusi", ternyata 100% sudah diimplementasikan sejak lama. 1 detail penyimpanan setting juga dikoreksi (§ 3a). |
| `docs/arsitektur-surat-detail.md` | Render body (Tiptap JSON→HTML tanpa `@tiptap/core`), merge fields `{{...}}`, halaman detail | Akurat, tidak ada koreksi. |
| `docs/arsitektur-tandatangan.md` | Layout TTD (7 varian), alur signing via URL, 4-layer component architecture | Akurat untuk 95% isi — **1 kontradiksi internal dikoreksi** (§ 3b), lalu fiturnya BENAR-BENAR dibangun (§ 4 Bug #2), sekarang § 5/§ 11 sudah "✅ SELESAI" lagi. |
| `docs/arsitektur-whatsapp.md` § 6.6 | Notifikasi WA seluruh modul (bukan cuma surat) | Bagian "Surat" diupdate — helper `notifyOfficerSignRequest`, dua titik trigger, trade-off batching (lihat § 7a di bawah). |

**Kalau butuh detail teknis satu bagian spesifik, baca dokumen yang bersangkutan — dokumen ini
cuma indeks + catatan audit, bukan duplikasi isi.**

---

## 1a. Fondasi: Tabel Schema, Route, Server Actions

### Tabel Schema
```
letter_types      → jenis surat (SK, Undangan, dll) — CRUD inline di /letters/template
letter_contacts   → kontak luar + opsional link ke public.members
letter_templates  → template KONTEN surat (perihal + isi) — type: outgoing|internal,
                    subject, body, is_active. (Kop surat/styling/paper-size/margin TIDAK
                    lagi di sini — pindah ke settings.letter_config, lihat di bawah)
letters           → surat utama — type: outgoing | incoming | internal
letter_number_sequences → counter nomor surat per year+type+category (atomic)
letter_signatures → slot tanda tangan digital per officer (multi-signer, lihat
                    docs/arsitektur-tandatangan.md untuk skema lengkap slot_order/
                    slot_section/signing_token)
```

### Route Structure
```
app/(dashboard)/[tenant]/letters/
├── layout.tsx            → shell: LettersNav (sub-nav kiri) + slot konten kanan
├── page.tsx              → redirect ke /letters/keluar
├── keluar/
│   ├── page.tsx          → list surat keluar (type=outgoing)
│   ├── new/page.tsx      → pre-create draft → redirect ke edit
│   ├── [id]/edit/page.tsx → LetterForm (subject, body, nomor, jenis, template, paper size)
│   └── [id]/bulk/page.tsx → BulkRecipientPicker (mail merge)
├── masuk/
│   ├── page.tsx          → list surat masuk (type=incoming)
│   └── new/page.tsx      → IncomingLetterForm (direct save, no pre-create)
├── nota/
│   ├── page.tsx          → list nota dinas (type=internal)
│   ├── new/page.tsx      → pre-create draft → redirect ke edit
│   └── [id]/edit/page.tsx → LetterForm (sama seperti keluar)
├── kontak/
│   └── page.tsx          → CRUD letter_contacts (kontak luar untuk surat)
├── pengaturan/
│   └── page.tsx          → LetterConfigClient (kop surat, paper size, format nomor, dst — settings.letter_config)
└── template/
    ├── page.tsx          → LetterTypeManageClient + LetterTemplateList
    ├── new/page.tsx      → LetterTemplateForm
    └── [id]/edit/page.tsx → LetterTemplateForm
```

### Server Actions (letters/actions.ts)
```
createLetterDraftAction(slug, type)           → pre-create draft → return letterId
createIncomingLetterAction(slug, data)        → direct create surat masuk
updateLetterAction(slug, letterId, data)      → update semua field
updateLetterStatusAction(slug, letterId, s)   → quick status change (lihat § 2a alur status)
deleteLetterAction(slug, letterId)            → delete sigs dulu, baru letter
getNextLetterNumberAction(slug, type, cat?)   → atomic SELECT FOR UPDATE

createBulkLettersAction(slug, parentId, recipients[]) → insert N child letters (mail merge)
markAllChildrenSentAction(slug, parentId)     → bulk update status anak draft → sent

CRUD letter_types:    createLetterTypeAction, updateLetterTypeAction, deleteLetterTypeAction
CRUD letter_templates: createLetterTemplateAction, updateLetterTemplateAction, deleteLetterTemplateAction
CRUD letter_contacts: createLetterContactAction, updateLetterContactAction, deleteLetterContactAction
```

Untuk actions terkait tanda tangan (`signByTokenAction`, `syncSignatureSlotsAction`,
`generateSigningTokenAction`, dst) lihat `docs/arsitektur-tandatangan.md`.

### Format Nomor Surat — Dinamis
Format string dikonfigurasi per-tenant di `/letters/pengaturan` (`settings.letter_config.number_format`),
di-resolve oleh `lib/letter-number.ts`:
```
resolveLetterNumberFormat()  — parse token dari letter_config.number_format
resolveSequenceCategory()    — tentukan kategori counter: kalau format pakai {issuer_code} →
                                category = divisionCode.upper(); selain itu → "UMUM"
```
Token yang didukung: `{number}`, `{number:N}` (zero-padded N digit), `{type_code}`,
`{org_code}`, `{issuer_code}` (dari `letters.issuer_officer_id` → kode divisi officer),
`{month_roman}`, `{month}`, `{year}`, `{year:2}`.
Counter atomic tetap via `SELECT FOR UPDATE` di `letter_number_sequences`, dipartisi per
year+type+category.

### Ukuran Kertas — Presisi Piksel (@ 96 DPI)
| Ukuran | Lebar | Tinggi |
|--------|-------|--------|
| A4 | 794px | 1123px |
| F4 / Folio | 813px | 1247px |
| Letter | 816px | 1056px |

Tinggi hanya referensi (konten menentukan panjang aktual). Dipakai di dropdown pengaturan
(`letter-config-client.tsx`) untuk hint dinamis sesuai pilihan ukuran kertas.

### Mail Merge Bulk — Arsitektur
```
createBulkLettersAction(slug, parentId, recipients[])
  ├─ BulkRecipient type: { type: "member"|"contact", id, name, phone?, email?, address?, number?, nik? }
  ├─ Nomor anak: parent.letterNumber + "/1", "/2", dst — null jika parent belum punya nomor
  ├─ Sequential insert (BUKAN Promise.all) — supaya suffix nomor konsisten
  └─ Guard: max 500 recipients, admin/owner only; set isBulk=true di parent setelah selesai

GET /api/ref/tenant-members — paginated (PAGE_SIZE=30), filter status/search/page
  └─ JOIN: members INNER JOIN tenantMemberships LEFT JOIN contacts (phone/email via FK)

components/letters/bulk-recipient-picker.tsx — dua tab:
  ├─ "Dari Anggota": debounced search (300ms), pagination, filter status, "Pilih semua halaman ini"
  └─ "Dari Kontak": pre-loaded dari server

components/letters/bulk-children-section.tsx:
  ├─ "Generate Semua PDF" — Promise.allSettled, paralel per anak
  └─ "Tandai Semua Terkirim" — optimistic update via markAllChildrenSentAction
```
Merge fields tambahan untuk bulk: `{{recipient.name}}`, `{{recipient.phone}}`, dll —
resolved per-anak saat generate PDF (lihat `docs/arsitektur-surat-detail.md` § Merge Fields
untuk daftar lengkap variabel `{{recipient.*}}`).

### Manajemen Kontak Surat
`letter_contacts` dikelola di `/letters/kontak` (`letter-contact-manage-client.tsx`) — inline
CRUD (name, title, org, phone, email, address). Dipakai sebagai sumber alternatif penerima
surat selain `public.members` (lihat fallback chain di `docs/arsitektur-surat-detail.md`
§ Merge Fields, tabel "Sumber data per tipe penerima").

---

## 2. Status Aktual Fitur (diverifikasi langsung ke kode, bukan disalin dari dokumen lama)

| Fitur | Status | Bukti verifikasi |
|---|---|---|
| CRUD surat keluar/masuk/nota | ✅ Selesai | Semua route ada: `keluar/{page,new,[id],[id]/edit,[id]/bulk}`, `masuk/{page,new,[id]}` (read-only, sengaja tanpa edit), `nota/{page,new,[id],[id]/edit}` |
| Jenis surat + 3 layout identitas + format tanggal per-jenis | ✅ Selesai | `letter-type-manage-client.tsx` render penuh: radio layout, radio date_format, checkbox lampiran — 3 kolom di DB (`identitas_layout`, `show_lampiran`, `date_format`) semua terpakai |
| Tujuan Surat (blok "Kepada Yth.") | ✅ Selesai | `renderTujuanSurat()` di `lib/letter-html.ts`, termasuk dedup nama organisasi = nama penerima |
| Kalender Hijriah + offset | ✅ Selesai | `letter-config-client.tsx` render input `hijri_offset` + `letter_city`, `buildTodayVars()` pakai `Intl.DateTimeFormat` islamic-umalqura |
| Lampiran teks (`attachment_label`) | ✅ Selesai | Diwire penuh: form → actions → PDF render |
| PDF generate — Layout 3 nama jenis surat | ✅ Selesai | `generate-pdf/route.ts` SUDAH fetch `letterTypes.name` (dokumen lama bilang ini belum ada — basi) |
| TTD — 7 layout, alur via URL, 4-layer architecture | ✅ Selesai | Semua file di § 9 `arsitektur-tandatangan.md` dikonfirmasi ada dan terisi |
| Notifikasi WA saat butuh TTD (`letter_sign_request`) | ✅ Ada, **tapi cuma 1 dari 2 jalur** | Lihat § 4 Bug #1 |
| Preview isi surat di halaman publik `/sign/[token]` | ❌ **TIDAK ADA** | Lihat § 4 Bug #2 |
| Attachment lampiran file (MediaPicker) | ❌ Belum ada | `attachmentUrls` cuma plumbing kosong (schema+type+passthrough), nol UI upload, nol tempat ditampilkan — konsisten dengan status lama di CLAUDE.md, bukan temuan baru |
| Inter-tenant (kirim surat ke cabang IKPM lain) | ❌ Belum ada | `interTenantTo`/`interTenantStatus` cuma kolom + field opsional di action, nol picker tenant tujuan, nol logic kirim/terima lintas tenant — konsisten dengan status lama, bukan temuan baru |

---

## 2a. Alur Status Surat — Draft / Terkirim / Diarsipkan (Cara Kerja)

> Ditulis 2026-09-04 setelah user bingung: surat sudah dikirim secara nyata (WA/print/kurir)
> tapi status di arsip tetap "Draft". Gap dokumentasi murni — mekanismenya sudah benar sejak
> awal, cuma belum pernah dijelaskan di mana pun.

**Satu kolom, satu sumber kebenaran**: `letters.status` (`packages/db/src/schema/tenant/
letters.ts`, `LETTER_STATUSES = ["draft", "sent", "received", "archived"]`). Untuk surat keluar
dan nota dinas (yang relevan: `draft` / `sent` / `archived` — `received` khusus surat masuk).
Badge status di halaman arsip (`letter-list-client.tsx`) dan di halaman edit (`letter-form.tsx`)
sama-sama membaca kolom yang SAMA — tidak ada logika terpisah, tidak ada kolom lain yang ikut
menentukan.

**PENTING — status TIDAK PERNAH berubah otomatis.** Sistem tidak mendeteksi apakah surat
benar-benar sudah dikirim secara nyata (dicetak, dikirim WA, diantar kurir, dsb). Satu-satunya
cara mengubah status adalah admin klik tombol di halaman edit surat (`letter-form.tsx`):

| Status sekarang | Tombol tersedia | Hasil |
|---|---|---|
| **Draft** | "Simpan Draft" | Tetap Draft |
| | **"Kirim Surat"** | → **Terkirim** |
| **Terkirim** | "Simpan Perubahan" | Tetap Terkirim (edit isi tanpa ganti status) |
| | "Jadikan Draft" | → balik ke Draft |
| **Draft / Terkirim** | "Arsipkan" | → **Diarsipkan** |
| **Diarsipkan** | "Simpan Perubahan" | Tetap Diarsipkan |
| | "Aktifkan Kembali" | → balik ke **Terkirim** |

**Kalau surat "sudah dikirim" tapi statusnya masih Draft**: bukan bug — berarti setelah generate
PDF/kirim manual, admin belum kembali ke halaman edit surat itu dan klik "Kirim Surat". Fix-nya
selalu manual (buka surat → klik tombol), tidak ada cara massal/otomatis saat ini.

---

## 3. Koreksi Dokumen Basi

### 3a. `arsitektur-surat.md` — status header salah + detail penyimpanan setting salah

- **Header**: diubah dari "PROPOSAL — belum dieksekusi" jadi "SELESAI — diimplementasikan
  penuh, lihat § 2 `arsitektur-modul-surat.md` untuk verifikasi silang ke kode".
- **§ 5 "Pengaturan Global di `/letters/pengaturan`"**: dokumen bilang tersimpan sebagai DUA
  key terpisah (`letter_date_format`, `letter_hijri_offset`). **Implementasi aktual**: SATU
  object `letter_config` (key="letter_config", group="general") yang menampung SEMUA
  pengaturan surat sekaligus (`date_format`, `hijri_offset`, `letter_city`, plus
  paper_size/margin/number_format/dst) — konsisten dengan yang sudah benar didokumentasikan di
  `arsitektur-tandatangan.md` § "Referensi". Bukan bug kode, cuma dokumen lama yang
  mendeskripsikan skema penyimpanan yang berbeda dari yang akhirnya dipakai.

### 3b. `arsitektur-tandatangan.md` — kontradiksi internal § 5 vs § 11

- § 5 "Halaman Publik `/sign/[token]`" menulis: *"Accordion 'Lihat Preview Surat' — render body
  surat via `renderBody()`"* — seolah sudah ada.
- § 11 "Pertanyaan Terbuka" menulis: *"saat ini tidak ada preview isi surat. Tambahkan jika
  diperlukan."* — mengaku belum ada.
- **Diverifikasi ke kode**: § 11 yang BENAR. `sign/[token]/page.tsx` tidak pernah fetch
  `letters.body`, `signing-page-client.tsx` tidak punya accordion/preview apa pun. Baris di § 5
  dikoreksi jadi "❌ BELUM ADA — lihat § 4 Bug #2 di `arsitektur-modul-surat.md`".

---

## 4. Bug/Gap Ditemukan + Rencana Perbaikan

> **Update 2026-07-24 (lanjutan sesi yang sama)**: Bug #1 dan Bug #2 di bawah **SUDAH
> DIEKSEKUSI** — user minta lanjut fix setelah rencana ini dibaca. Detail implementasi
> ditambahkan di akhir masing-masing sub-bagian. Gap #3 dan #4 TETAP belum dikerjakan (masih
> butuh keputusan desain).

### Bug #1 — `generateSigningTokenAction` tidak kirim notifikasi WA (inkonsisten dengan `syncSignatureSlotsAction`) — ✅ FIXED

**Lokasi**: `apps/web/app/(dashboard)/app/[tenant]/letters/actions.ts`

**Gejala**: Ada 2 jalur yang sama-sama bisa menerbitkan token TTD baru untuk seorang officer:
1. `syncSignatureSlotsAction` (saat admin simpan surat, assign officer baru/ganti officer) →
   **otomatis kirim WA** `letter_sign_request` ke officer (lihat baris ~1053-1071).
2. `generateSigningTokenAction` (tombol "Buat Link TTD" di halaman detail, untuk slot lama yang
   tokennya `null` — misal token sempat di-null dari bug lama, atau edge case lain) → **TIDAK
   pernah kirim WA sama sekali**, cuma generate token dan tampilkan di UI, admin harus salin +
   kirim manual sendiri.

Ini bukan by-design (dokumen mana pun tidak menyebutkan perbedaan ini disengaja) — kemungkinan
besar `generateSigningTokenAction` dibuat SEBELUM fitur notifikasi WA (Fase 6, 2026-07-19) dan
tidak pernah di-retrofit saat notifikasi itu ditambahkan ke jalur sync.

**Dampak**: Officer yang link TTD-nya di-generate ulang lewat tombol "Buat Link TTD" tidak
pernah tahu ada link baru untuk mereka, kecuali admin ingat menyalin+kirim manual — gampang
terlewat, terutama untuk slot lama yang sudah lama menggantung.

**Rencana perbaikan** (belum dieksekusi, menunggu konfirmasi):
1. Ekstrak logic notifikasi (resolve officer→member→contact→phone, build `signUrl`, panggil
   `notifyWa`) dari dalam loop `syncSignatureSlotsAction` jadi helper privat kecil, mis.
   `notifyOfficerSignRequest(tenantClient, slug, letterId, officerId, token)`.
2. Panggil helper itu dari KEDUA tempat — akhir `syncSignatureSlotsAction` (untuk setiap entry
   di `toNotify`) DAN akhir `generateSigningTokenAction` (sekali, untuk token yang baru
   digenerate — SKIP kalau `sig.signedAt` sudah ada, karena token untuk slot yang sudah TTD
   tidak perlu notifikasi "diminta tanda tangan").
3. Risiko rendah — murni penambahan pemanggilan notifikasi, tidak mengubah logic token/lock
   yang sudah ada. Tidak perlu migrasi DB.

**Implementasi aktual**: helper baru `notifyOfficerSignRequest(tenantClient, slug, letterId,
officerId, token)` di `letters/actions.ts` — melakukan sendiri lookup officer→member→contact→
phone + fetch subject/nomor surat + `waAppUrl()` + `notifyWa()`, generik untuk 1 officer.
Dipanggil dari KEDUA tempat: `syncSignatureSlotsAction` (loop `toNotify`, MENGGANTIKAN ~40 baris
resolusi batch yang sebelumnya inline — sekarang tinggal 1 baris per slot) dan
`generateSigningTokenAction` (sekali, digate `if (!sig.signedAt)` — token untuk slot yang sudah
TTD tidak perlu notifikasi "diminta tanda tangan"). Trade-off yang diterima: `syncSignatureSlotsAction`
kehilangan optimisasi batch-query (dulu 1 query untuk semua officer/member/contact sekaligus,
sekarang N query terpisah per slot) — diterima karena jumlah slot baru per simpan surat biasanya
1-2, bukan puluhan, dan ini fire-and-forget (tidak block response ke admin).

### Bug #2 — Officer menandatangani "buta": halaman publik `/sign/[token]` tidak pernah menampilkan isi surat — ✅ FIXED

**Lokasi**: `apps/web/app/(public)/[tenant]/sign/[token]/page.tsx` +
`apps/web/components/letters/signing-page-client.tsx`

**Gejala**: `SELECT` surat di `page.tsx` hanya mengambil `id, subject, letterNumber, letterDate,
recipient` — **kolom `body` TIDAK PERNAH di-fetch**. Officer yang buka link TTD cuma melihat
metadata (perihal, nomor, tanggal, siapa yang diminta TTD) — TIDAK PERNAH melihat isi surat
sebenarnya sebelum klik "Tanda Tangani Sekarang".

**Dampak**: Ini bukan cuma gap UX — ini masalah kepercayaan/legal. Menandatangani dokumen tanpa
bisa membaca isinya dulu bertentangan dengan tujuan dasar tanda tangan digital (persetujuan
atas ISI dokumen, bukan cuma metadata-nya). `arsitektur-tandatangan.md` § 5 sendiri sudah
mengasumsikan fitur ini ada sejak awal ditulis — berarti ini gap yang terlewat sejak awal
implementasi, bukan regresi baru.

**Rencana perbaikan** (belum dieksekusi, menunggu konfirmasi):
1. `page.tsx` — tambah `schema.letters.body` ke SELECT surat yang sudah ada (tidak perlu query
   tambahan, cukup tambah 1 kolom ke select yang sudah jalan).
2. Resolve merge fields + render body via `resolveMergeFields()` + `renderBody()` (pola yang
   SAMA PERSIS dipakai `keluar/[id]/page.tsx` — reuse, bukan bikin baru) — bangun `MergeContext`
   minimal (org data + signer pertama, tidak perlu recipient penuh untuk kebutuhan preview ini).
3. `signing-page-client.tsx` — tambah prop `bodyHtml: string`, render sebagai `<details>` /
   accordion collapsed-by-default (pola sama seperti dokumen sudah rencanakan) — dengan
   `dangerouslySetInnerHTML`, className `prose prose-sm` (pola yang sudah dipakai di banyak
   tempat lain untuk render `renderBody()` output).
4. Risiko rendah — murni penambahan tampilan read-only, tidak menyentuh logic signing/token
   sama sekali. Tidak perlu migrasi DB (kolom `body` sudah ada).

**Implementasi aktual**: `sign/[token]/page.tsx` — SELECT surat ditambah `body`+`sender`, fetch
`getSettings` general+contact (pola sama `keluar/[id]/page.tsx`), `buildMergeContext()` dengan
`signers: []` (context minimal — tidak perlu resolusi signer penuh untuk kebutuhan preview
read-only ini) → `resolveMergeFields()` → `renderBody()` → `bodyHtml`. Dibungkus try/catch —
kalau render gagal (edge case), `bodyHtml = null` dan accordion preview otomatis tidak
dirender, TIDAK menggagalkan seluruh halaman TTD (fail-safe, konsisten prinsip "notifikasi/
tampilan tambahan tidak boleh menggagalkan alur utama"). `signing-page-client.tsx` — prop baru
`bodyHtml: string | null`, accordion native `<details>`/`<summary>` (collapsed by default,
tanpa JS state tambahan) ditaruh antara blok "Detail Surat" dan "Penandatangan". Efek samping
bagus: copy existing "Dengan menandatangani, Anda menyetujui isi surat di atas." — SEBELUMNYA
teks ini MENIPU (tidak ada isi surat di atas sama sekali) — sekarang jadi BENAR karena
accordion isi surat memang ada di atas tombol tersebut, tidak perlu ubah teks itu sendiri.

### Gap #3 (sudah lama diketahui, dikonfirmasi masih berlaku) — Attachment lampiran file

`attachment_urls JSONB` di tabel `letters` sudah ada sejak lama, dan field-nya ikut di-passthrough
di beberapa tempat (`actions.ts`, halaman new/edit sebagai default `[]`) — tapi **nol UI**:
tidak ada `MediaPicker` di `letter-form.tsx`, tidak ada tempat menampilkan/mengunduh lampiran di
halaman detail. Konsisten dengan status "belum diimplementasikan" yang sudah lama tercatat di
CLAUDE.md — bukan regresi, cuma dikonfirmasi ulang di sesi ini bahwa gap ini genuinely masih ada.
**Tidak direncanakan diperbaiki sesi ini** — dicatat sebagai backlog terpisah, butuh keputusan
desain sendiri (berapa file maks, tipe file apa saja, dst) sebelum dieksekusi.

### Gap #4 (sudah lama diketahui, dikonfirmasi masih berlaku) — Inter-tenant

`inter_tenant_to`/`inter_tenant_status` sudah ada sebagai kolom + field opsional di
`updateLetterAction`, tapi tidak ada satu pun UI untuk memilih tenant tujuan, dan tidak ada
logic kirim/terima lintas tenant sama sekali. Konsisten dengan status lama di CLAUDE.md.
**Tidak direncanakan diperbaiki sesi ini** — fitur besar, butuh desain alur kirim/terima antar
tenant dulu (siapa yang approve di sisi penerima, bagaimana notifikasinya, dst).

### Bug #5 — Link internal modul Surat kehilangan prefix `/app/`, 404 di custom domain — ✅ FIXED (2026-09-04)

**Dilaporkan user**: `visikita.com/letters/keluar/{id}` → 404, sementara `jalakarta.com/app/
visikita/letters/keluar/{id}` (link yang sama, dari `<Link>` di halaman arsip) aman.

**Root cause #1 (bukan bug — cuma URL yang salah)**: dashboard admin HANYA bisa diakses lewat
`jalakarta.com/app/{slug}/...` atau `{custom-domain}/admin/...` (lihat `docs/arsitektur-domain.md`
§ 7.2). URL bare tanpa kedua prefix itu (seperti yang dilaporkan) jatuh ke jalur konten PUBLIK
di middleware — tidak ada halaman publik untuk detail surat, jadi 404 lewat catch-all. Solusi:
buka `{custom-domain}/admin/letters/keluar/{id}`, bukan path bare.

**Root cause #2 (bug NYATA, ditemukan saat investigasi #1)**: `components/letters/letter-form.tsx`
(redirect setelah buat surat baru) dan `components/letters/letter-list-client.tsx` (tombol
"Surat Baru"/"Nota Dinas Baru" + link tiap baris tabel — dipakai di `keluar`, `nota`, `masuk`)
membangun URL sebagai `` `/${slug}/letters/...` `` — **kurang prefix `/app/`**. Di `jalakarta.com`
ini tertutupi diam-diam oleh redirect 301 legacy (`ADMIN_MODULES` di `next.config.ts`, sisa
migrasi URL Fase 1-4) — tapi redirect itu SENGAJA `has: [{host: "jalakarta.com"}]`, tidak berlaku
di custom domain (lihat `docs/arsitektur-domain.md` § 3.1). Jadi di `visikita.com` (atau tenant
custom-domain manapun), tombol "Surat Baru" dan setiap link baris di arsip surat **404 nyata**,
tidak ketolong redirect apa pun.

**Audit lanjutan menemukan 5 file LAIN dengan bug kelas identik** (bukan cuma modul Surat) —
sama-sama diproteksi legacy redirect di `jalakarta.com` tapi 404 di custom domain: filter status
+ form pencarian di `finance/pengeluaran`, `finance/jurnal`, `finance/pemasukan`; filter + form
pencarian + link detail di `donasi/transaksi`; filter status di `website/posts`.

**Fix**: tambah prefix `/app/` di ke-7 titik itu — perubahan string literal murni, tidak ada
perubahan logika. `tsc --noEmit` 0 error + `bun run build --filter=@jalajogja/web` genuine
sukses. Commit `306c5e7`.

**Aturan yang ditegaskan**: setiap kali menemukan link `` `/${slug}/{module}` `` tanpa prefix
`/app/` di komponen dashboard admin manapun, itu KEMUNGKINAN BESAR masih berfungsi di
`jalakarta.com` (tertolong redirect legacy `ADMIN_MODULES`) tapi **selalu 404 di custom domain**
— dua kondisi ini tidak boleh dianggap "sama-sama aman" hanya karena diuji di `jalakarta.com`
saja. Grep periodik `` `/\$\{slug\}/(members|pengurus|divisi|accounts|media|website|letters|
finance|donasi|toko|settings|event)` `` di `apps/web/components` + `apps/web/app/(dashboard)`
adalah cara murah mendeteksi sisa kasus serupa.

---

## 5. Yang TIDAK Bermasalah (dicek, dikonfirmasi aman)

- Toggle gating notifikasi WA (`config.notifications?.[event]`) berlaku generik untuk
  `letter_sign_request` juga — tidak ada celah bypass toggle admin.
- Template WA `letter_sign_request` — variabel (`name`, `letterSubject`, `letterNumber`,
  `signUrl`) match persis dengan yang dikirim dari `syncSignatureSlotsAction`, tidak ada drift.
- `syncSignatureSlotsAction` idempotent — dicek ulang: token cuma di-generate ulang kalau
  officer berubah atau token null, TIDAK pernah re-notify officer yang sama tanpa perubahan
  (aman dari spam WA saat admin simpan surat berkali-kali tanpa mengubah signature slot).
- Render body surat (`renderBody()`, custom pure-string renderer) — tidak ada regresi, semua
  node/mark type yang didokumentasikan `arsitektur-surat-detail.md` masih konsisten dengan kode.
- Merge fields `{{...}}` — sumber data & fallback chain (kontak vs anggota vs manual) konsisten
  dengan dokumen.
- `masuk` (surat masuk) read-only — dikonfirmasi disengaja, bukan halaman yang lupa dibuatkan
  edit page.

---

## 6. Ringkasan untuk Keputusan

Dua bug (WA notif tidak konsisten, preview surat tidak ada di halaman TTD publik) **✅ SUDAH
DIPERBAIKI** (2026-07-24, sesi yang sama) — `tsc --noEmit` bersih di `apps/web` DAN
`packages/db`, `bun run build --filter=@jalajogja/web` sukses, dev server direstart. **Belum
di-commit/push, belum dijalankan/diverifikasi di VPS, belum diverifikasi visual di browser
sungguhan** — user perlu coba alur TTD end-to-end (assign officer → cek WA masuk → buka link
`/sign/{token}` → expand "Lihat Isi Surat" → tanda tangan) sebelum dianggap final.

Dua gap lama (attachment file, inter-tenant) **butuh keputusan desain dulu** sebelum bisa
direncanakan lebih detail — bukan quick-fix, tidak disentuh sesi ini.

---

## 7. Arsitektur Final Setelah Perbaikan — Referensi untuk Pengembangan Lanjutan

Bagian ini deskripsi CARA KERJA SEKARANG (bukan riwayat perbaikan) — baca ini kalau mau
menambah fitur baru di area TTD/notifikasi, jangan mulai dari nol tanpa cek pola yang sudah ada.

### 7a. Pola notifikasi WA untuk TTD — satu helper, dua titik pemanggil

```
notifyOfficerSignRequest(tenantClient, slug, letterId, officerId, token)
  ├─ lookup: officers.memberId → public.members → public.contacts.(whatsapp||phone)
  ├─ fetch: letters.subject + letters.letterNumber
  ├─ build: signUrl via waAppUrl(slug, `/sign/${token}`)
  └─ void notifyWa({ event: "letter_sign_request", phone, vars: {...} })

Dipanggil dari:
  1. syncSignatureSlotsAction  — loop toNotify[], setiap slot yang DAPAT token baru
  2. generateSigningTokenAction — sekali, HANYA kalau !sig.signedAt
```

**Kalau mau tambah event notifikasi WA baru terkait surat** (mis. "surat sudah lengkap
ditandatangani semua pihak" → notif ke pembuat surat) — JANGAN taruh logic resolusi
officer→member→contact secara terpisah lagi. Tulis helper sendiri dengan pola yang SAMA
(function kecil, terima ID minimal, resolve sendiri di dalamnya, `void notifyWa(...)`
fire-and-forget) — konsisten dengan helper serupa di modul lain (`docs/arsitektur-whatsapp.md`
§ 6 punya banyak contoh pola ini per modul).

**Kalau performa jadi masalah** (banyak slot baru sekaligus dalam satu surat, jarang terjadi
tapi mungkin untuk organisasi besar) — pertimbangkan kembalikan batching (1 query untuk semua
officer/member/contact ids sekaligus, seperti implementasi LAMA sebelum 2026-07-24) HANYA di
dalam `syncSignatureSlotsAction` — `generateSigningTokenAction` tetap single-officer, tidak
perlu batching sama sekali (dipanggil untuk 1 slot per klik tombol).

### 7b. Pola preview isi surat sebelum aksi — reuse `renderBody()` + `buildMergeContext()`

```
1. SELECT letters kolom body (+ field lain yang dibutuhkan buildMergeContext)
2. getSettings(tenantClient, "general") + getSettings(tenantClient, "contact") → org data
3. buildMergeContext({ orgName, orgAddress, orgPhone, orgEmail, letterNumber, letterDate,
                       subject, sender, recipient, signers: [] })
   — signers boleh [] untuk preview read-only yang tidak butuh info penandatangan lengkap
4. resolveMergeFields(letter.body ?? "", mergeCtx) → resolvedBody
5. renderBody(resolvedBody) → bodyHtml
6. Render bodyHtml via <details>/<summary> collapsed-by-default (native, tanpa JS state) atau
   dangerouslySetInnerHTML biasa kalau memang harus selalu terbuka
```

Pola ini SEKARANG dipakai di 2 tempat: `keluar/[id]/page.tsx` (detail admin, full context) dan
`sign/[token]/page.tsx` (preview publik, minimal context). **Kalau mau tambah preview isi
surat di tempat LAIN** (mis. halaman `/verify/[hash]` — saat ini cuma tampilkan info TTD tanpa
isi surat, belum diaudit apakah perlu) — ikuti pola yang sama, JANGAN bikin renderer baru.
Selalu bungkus dengan try/catch → `bodyHtml = null` kalau gagal (fail-safe, jangan sampai
kegagalan render preview menggagalkan halaman utamanya).

---

## 8. Backlog / Rencana Perbaikan ke Depan (belum dikerjakan, urutan bukan prioritas)

1. **Attachment lampiran file (MediaPicker)** — `attachment_urls` masih plumbing kosong (lihat
   § 2). Perlu keputusan: berapa file maksimal, batas ukuran, tipe file apa saja (PDF only?
   gambar juga?), dan di mana ditampilkan (halaman detail + PDF, atau cuma halaman detail).
2. **Inter-tenant (kirim surat ke cabang IKPM lain)** — `inter_tenant_to`/`inter_tenant_status`
   masih kolom kosong. Perlu keputusan: siapa yang approve di sisi penerima, bagaimana surat
   "muncul" di tenant lain (draft otomatis? butuh konfirmasi dulu?), notifikasi apa yang perlu
   dikirim ke admin tenant tujuan.
3. **Notifikasi "surat selesai ditandatangani semua pihak"** — saat ini cuma ada notifikasi
   "diminta TTD" (§ 7a), belum ada notifikasi balik ke pembuat surat/admin begitu SEMUA slot
   (main, bukan witness) sudah TTD. Bisa jadi WA event baru `letter_fully_signed` — cek dulu
   apakah benar-benar dibutuhkan sebelum dibangun (belum diminta user).
4. **Preview isi surat di halaman verifikasi publik** (`/verify/[hash]`) — belum diaudit apakah
   halaman ini juga perlu accordion isi surat seperti `/sign/[token]` sekarang, atau memang
   cukup info TTD saja (tujuannya beda: verifikasi keabsahan, bukan meminta persetujuan).
5. **Restore batching notifikasi** — lihat § 7a, cuma relevan kalau ada laporan nyata banyak
   slot baru sekaligus dalam satu surat menyebabkan lambat.

Item 1 dan 2 sudah lama tercatat sebagai "belum diimplementasikan" (lihat status di CLAUDE.md).
Item 3-5 baru muncul sebagai ide dari audit sesi ini — belum tentu perlu dikerjakan, tulis di
sini supaya tidak hilang, bukan berarti harus segera dieksekusi.
