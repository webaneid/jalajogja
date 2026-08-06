# Arsitektur Bergabung Forum — Pendaftaran Anggota ke Tenant Tipe Forum

> **Dokumen ini dipindahkan dari `docs/arsitektur-backbone-ikpm.md` pada 2026-08-06** — sebelumnya
> seluruh alur pendaftaran/bergabung forum (v1 + v2, riwayat keputusan, implementasi, dan bug fix)
> tersebar sebagai satu bagian besar di dalam dokumen backbone umum. Sekarang dipisah ke sini
> supaya lebih mudah dirujuk khusus untuk fitur ini, tanpa harus menelusuri dokumen backbone yang
> jauh lebih luas cakupannya.
>
> **Untuk arsitektur backbone UMUM** (tiga tipe tenant — cabang/marhalah/forum, auto-populate
> cabang/marhalah, cross-tenant data access, roadmap Phase 1–5, schema
> `tenant_type`/`marhalah_year`/`parent_tenant_id`/`primary_cabang_id`) — tetap merujuk ke
> **`docs/arsitektur-backbone-ikpm.md`**. Dokumen INI hanya membahas satu hal spesifik:
> **seseorang mendaftar/bergabung menjadi anggota tenant bertipe `forum`.**

---

## Status Ringkas (per audit sinkronisasi 2026-08-06)

- **v1** (3 mode pendaftaran: gratis/berbayar/infaq, halaman `/{forum}/daftar`, form baru) —
  **SUPERSEDED total**, tidak pernah diimplementasikan satu baris kode pun. Dipertahankan di
  bawah murni sebagai catatan sejarah (kenapa diganti, apa yang tetap relevan dari situ).
- **v2** (prinsip single-ID, tanpa form baru, halaman `/gabung`, reuse produk/campaign existing
  sebagai syarat iuran opsional) — **SUDAH DIIMPLEMENTASIKAN PENUH dan DIVERIFIKASI SINKRON
  DENGAN KODE AKTUAL** pada audit 2026-08-06 (lihat § "Audit Sinkronisasi Arsitektur ↔ Kode
  Aktual" di bagian paling bawah dokumen ini untuk rincian per-file). Fase A–D selesai secara
  kode; Fase E (verifikasi manual end-to-end oleh siapa pun di browser sungguhan, lalu deploy)
  **BELUM** dilakukan sampai catatan terakhir.
- **Drift nyata yang ditemukan** saat audit 2026-08-06: syarat kelayakan (§ "1. Syarat
  Kelayakan" di bawah, bagian v2) jauh lebih detail di kode sekarang dibanding yang tertulis di
  rencana aslinya — field `homeAddressId` baru, pengecekan "directory" sekarang mensyaratkan
  KELENGKAPAN penuh (bukan cuma "punya baris"), dan ada integrasi toggle modul ekosistem
  (Usaha/Pesantren/Profesional per-tenant) yang belum ada saat teks v2 pertama ditulis. Detail
  lengkap ada di § audit, bukan dikoreksi diam-diam di teks historis di bawah.
- Penamaan: rencana asli (v2, sebelum digeneralisasi) memakai nama `checkForumEligibility()` /
  `lib/forum-eligibility.ts` dan `ForumJoinOverlay` / `components/akun/forum-join-overlay.tsx`.
  Nama SEBENARNYA di kode sekarang (setelah digeneralisasi ke semua tipe tenant, bukan cuma
  forum) adalah `checkMemberEligibility()` / `lib/member-eligibility.ts` dan
  `MembershipEligibilityOverlay` / `components/akun/membership-eligibility-overlay.tsx`. Teks
  historis di bawah SENGAJA tidak di-rename ulang (murni catatan sejarah rencana) — kalau butuh
  nama yang benar-benar dipakai sekarang, rujuk § audit atau kode langsung.

---

## Alur Pendaftaran Forum v1 (SUPERSEDED — lihat "v2" di bawah)

> **Status: DIGANTIKAN oleh § "Alur Pendaftaran Forum v2" di bawah** (didiskusikan + direncanakan
> 2026-07-23, lalu diimplementasikan penuh). Yang diganti SECARA SPESIFIK: narasi alur (3 mode
> registration_mode, halaman `/{forum}/daftar` dengan "data pre-filled" sebagai form
> pendaftaran tersendiri) dan § 4 di bawah (`source_type: 'forum_registration'` baru — v2 TIDAK
> butuh ini, pembayaran forum cukup lewat `source_type: 'cart'` yang sudah ada).
>
> **TIDAK superseded — masih berlaku dan SUDAH diimplementasikan** (verifikasi kode 2026-07-23):
> § 1–3 di bawah (kolom `tenant_type`/`marhalah_year`/`parent_tenant_id` di `tenants`,
> `primary_cabang_ref_id` di `members`, `membership_type`/`forum_status`/`forum_invoice_id`/
> `approved_at`/`expires_at` di `tenant_memberships`) — ini schema BACKBONE UMUM (bukan spesifik
> alur registrasi forum), sudah live sejak migration `0018_backbone_tenant_types.sql`, dan juga
> didokumentasikan di `docs/arsitektur-backbone-ikpm.md` § "Arsitektur Data: Single Source of
> Truth". v2 di bawah justru MEMANFAATKAN kolom `forum_status` dkk yang sudah ada ini, bukan
> menggantikannya.

> **Klarifikasi penting:** Yang dimaksud pendaftaran di sini adalah **alumni IKPM yang
> mendaftar menjadi anggota forum** (bukan forum yang membayar sesuatu). Forum adalah tenant
> penyelenggara; alumni adalah pihak yang mendaftar dan (jika diperlukan) membayar iuran
> keanggotaan ke forum tersebut.

Forum bisa punya alur pendaftaran yang berbeda-beda. Admin forum mengatur sendiri
via **Settings Forum** (`/app/{slug}/settings/membership`). Tidak ada alur yang
di-hardcode — semuanya mengikuti konfigurasi yang dipilih admin forum.

---

### Tiga Mode Pendaftaran Anggota Forum

```
MODE 1 — GRATIS
───────────────
Alumni klik "Daftar ke Forum" → konfirmasi data → langsung active.
Tidak ada biaya apapun.
Cocok untuk: forum diskusi terbuka, komunitas hobi.

MODE 2 — BERBAYAR (Iuran/Biaya Pendaftaran)
────────────────────────────────────────────
Alumni klik "Daftar ke Forum"
  → data pre-filled ditampilkan (dari cabang/marhalah)
  → alumni konfirmasi + pilih metode bayar
  → invoice dibuat → alumni bayar → admin forum konfirmasi → status: active

Biaya masuk ke kas forum (bukan ke jalakarta).
Cocok untuk: forum profesional dengan program eksklusif.

MODE 3 — INFAQ (Sukarela)
──────────────────────────
Alumni klik "Daftar ke Forum"
  → data pre-filled ditampilkan
  → alumni isi nominal infaq sendiri (admin bisa set minimal)
  → invoice dibuat → alumni bayar → status: active

Cocok untuk: forum sosial, kepedulian alumni, komunitas berbasis sedekah.
```

---

### Yang Perlu Dikonfigurasi Admin Forum

Disimpan di `tenant_{slug}.settings` — key `membership_config`, group `forum`:

```json
{
  "registration_mode": "free | paid | infaq",

  "paid": {
    "amount": 150000,
    "label": "Iuran Pendaftaran Forum Bisnis",
    "period": "once | annual | lifetime"
  },

  "infaq": {
    "min_amount": 50000,
    "suggest_amounts": [50000, 100000, 250000]
  },

  "access_before_payment": false,
  "require_approval": false
}
```

| Field | Keterangan |
|-------|------------|
| `registration_mode` | Tipe alur — free / paid / infaq |
| `paid.period` | `once` = sekali, `annual` = iuran tahunan, `lifetime` = bayar sekali selamanya |
| `access_before_payment` | `true` = langsung bisa akses forum meski belum bayar (cocok infaq). `false` = tunggu lunas dulu |
| `require_approval` | Admin forum harus approve dulu sebelum status active |

---

### Status Keanggotaan Forum

```
[Alumni klik Daftar]
        │
    ┌───▼────┐
    │ pending│
    └───┬────┘
        │
   ┌────┴────────────┐
   │                 │
 free           paid / infaq
   │                 │
langsung      buat invoice
active     alumni bayar → admin konfirmasi
   │                 │
   └────────┬────────┘
        ┌───▼────┐
        │ active │  ← bisa akses penuh konten forum
        └───┬────┘
            │ (jika iuran annual telat diperpanjang)
        ┌───▼──────┐
        │ suspended│
        └──────────┘
```

`forum_status` hanya ada untuk `membership_type = 'forum'`.
Cabang dan marhalah tetap pakai kolom `status` yang sudah ada.

---

### UX dari Sisi Alumni

```
Alumni buka /{forum-slug}/daftar
  ↓
Halaman menampilkan data pre-filled (dari data cabang/marhalah):
  Nama, Stambuk, Cabang, Angkatan, Data Usaha yang relevan
  → [Ubah data] mengarah ke /akun (bukan form baru di sini)
  ↓
Tergantung mode forum:
  [free]  → tombol "Daftar Sekarang" → selesai
  [paid]  → tampil nominal + pilih metode bayar → "Lanjut Bayar"
  [infaq] → tampil chips nominal + input bebas → "Lanjut Bayar"
  ↓
Selesai → redirect ke /akun dengan info status keanggotaan forum
```

---

### Integrasi Billing

Pembayaran keanggotaan forum menggunakan **invoice yang sudah ada** — tidak perlu
sistem baru. `source_type: 'forum_registration'` ditambahkan ke enum invoice.
Konfirmasi bayar oleh admin forum otomatis mengubah `forum_status → active`.

> Detail implementasi teknis (`joinForumAction`, `syncInvoicePayment` hook, iuran tahunan,
> WA reminder) akan didokumentasikan saat Phase 4 siap dieksekusi.

---

### Halaman Admin Forum

```
/app/{slug}/settings/membership  → konfigurasi mode + nominal + approval
/app/{slug}/members              → list anggota forum (filter: pending/active/suspended)
                                   aksi: Approve | Tolak | Suspend | Perpanjang
```

---

### 1. Tambah kolom di `public.tenants`

```sql
ALTER TABLE public.tenants
  ADD COLUMN tenant_type        TEXT NOT NULL DEFAULT 'cabang'
    CHECK (tenant_type IN ('cabang', 'forum', 'marhalah', 'pusat')),
  ADD COLUMN marhalah_year      INTEGER,
  ADD COLUMN marhalah_period    TEXT CHECK (marhalah_period IN ('awal', 'akhir')),
  ADD COLUMN parent_tenant_id   UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Tenant yang sudah ada = cabang (default sudah benar)
```

### 2. Tambah kolom di `public.members`

```sql
ALTER TABLE public.members
  ADD COLUMN primary_cabang_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Backfill: ambil dari tenant_memberships (cabang pertama yang ditemukan)
UPDATE public.members m
SET primary_cabang_id = (
  SELECT tm.tenant_id FROM public.tenant_memberships tm
  INNER JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.member_id = m.id AND t.tenant_type = 'cabang'
  ORDER BY tm.joined_at ASC
  LIMIT 1
)
WHERE m.primary_cabang_id IS NULL;
```

### 3. Tambah kolom di `public.tenant_memberships`

```sql
ALTER TABLE public.tenant_memberships
  ADD COLUMN membership_type  TEXT NOT NULL DEFAULT 'cabang'
    CHECK (membership_type IN ('cabang', 'forum', 'marhalah')),
  -- Kolom khusus forum (null untuk cabang & marhalah):
  ADD COLUMN forum_status     TEXT CHECK (forum_status IN
    ('pending', 'active', 'suspended', 'rejected')),
  ADD COLUMN forum_invoice_id UUID,       -- referensi ke invoice pembayaran
  ADD COLUMN approved_at      TIMESTAMPTZ,
  ADD COLUMN expires_at       TIMESTAMPTZ; -- untuk iuran tahunan
```

### 4. Tambah `source_type` baru di tenant invoices

```sql
-- Di create-tenant-schema.ts, update CHECK constraint invoices.source_type:
-- Tambahkan 'forum_registration' ke list yang sudah ada
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_source_type_check,
  ADD CONSTRAINT invoices_source_type_check
    CHECK (source_type IN (
      'order', 'donation', 'event_registration', 'manual', 'forum_registration'
    ));
```

### 5. Settings forum di `tenant_{slug}.settings`

Tidak perlu tabel baru — gunakan tabel `settings` yang sudah ada:
```
key="membership_config"  group="forum"  value={...ForumMembershipConfig JSON...}
```

### 6. Migration nomor

File: `packages/db/migrations/0018_backbone_tenant_types.sql`

---

## Alur Pendaftaran Forum v2 — Prinsip Single-ID, Tanpa Form Baru

> **Status: SUDAH DIIMPLEMENTASIKAN PENUH (verifikasi sinkron kode 2026-08-06).** Didiskusikan
> penuh di percakapan (bukan Plan Mode formal) sebelum menulis dokumen ini — lihat riwayat
> keputusan di § "Keputusan yang Dikunci" di bawah.

### Kenapa v1 Diganti

Desain v1 (di atas) berasumsi forum butuh **form pendaftaran sendiri** ("data pre-filled dari
cabang/marhalah, alumni konfirmasi") + **invoice source_type baru** (`forum_registration`).
Setelah didiskusikan ulang, user eksplisit menegaskan: project ini sudah menganut **prinsip
single-ID** (satu `public.members` per orang, dipakai ulang di semua tempat) — maka mendaftar
jadi anggota forum **tidak boleh** jadi form baru yang mengumpulkan data lagi. Yang dibutuhkan
hanyalah: (1) VERIFIKASI bahwa data anggota ini sudah cukup lengkap/matang untuk dianggap layak
gabung forum, dan (2) KALAU forum itu berbayar, arahkan ke infrastruktur billing yang **sudah
ada** (Toko/Donasi), bukan bikin sistem invoice baru.

### Prinsip Kunci yang Dikunci Selama Diskusi

1. **Tidak ada form pendaftaran forum baru.** "Daftar jadi anggota forum" = cek kelayakan +
   (opsional) selesaikan pembayaran via produk/campaign yang sudah ada + satu klik konfirmasi.
2. **Syarat kelayakan SAMA untuk semua forum** — bukan sesuatu yang bisa diatur beda-beda per
   forum oleh admin forum masing-masing. Ini standar IKPM-wide.
3. **Pembayaran forum (opsional, per forum) memakai Toko/Donasi yang SUDAH ADA** — admin forum
   cukup MENUNJUK produk dan/atau campaign yang sudah ada di tenant forum itu sebagai "syarat
   iuran", bukan bikin sistem invoice/mode pembayaran terpisah seperti rencana v1.
4. **UX di `/akun`**: saat membuka domain sebuah forum dan belum jadi anggotanya, kartu
   keanggotaan yang biasanya tampil (hasil `resolveAkunBranding()` yang sudah ada) tetap
   dirender di belakang, TAPI ditutupi overlay glass-effect (frosted, `bg-background/80
   backdrop-blur-lg`, konsisten dengan pola yang sudah dipakai `single-mobile-topbar.tsx`)
   berisi ajakan gabung atau pesan kekurangan syarat — memaksa anggota menuntaskan status
   forum ini dulu sebelum bisa "melihat" kartunya secara normal.
5. **Ada halaman terpisah** (bukan cuma tombol di overlay) tempat proses pendaftaran/pembayaran
   sungguhan terjadi — overlay di `/akun` hanya pintu masuk.

### 1. Syarat Kelayakan (Eligibility Gate)

> ⚠️ **Bagian ini menampilkan rencana ASLI 2026-07-23. Field list sebenarnya di kode SUDAH
> BERBEDA (lebih ketat) — lihat § "Audit Sinkronisasi Arsitektur ↔ Kode Aktual" di bagian
> paling bawah dokumen ini untuk daftar field yang BENAR-BENAR dipakai sekarang.** Teks di
> bawah dipertahankan sebagai catatan sejarah keputusan awal, bukan rujukan operasional.

Berlaku SAMA untuk semua forum, dicek ULANG setiap kali (bukan dari flag tersimpan — supaya
data yang diedit balik jadi tidak lengkap otomatis kehilangan kelayakan):

**a. Profil pribadi lengkap** — field yang SUDAH jadi wajib di wizard `/akun/lengkapi`
Step 1 (Data Identitas) + Step 2 (Kontak & Alamat), dicek ulang langsung ke kolom DB (bukan
percaya wizard "pernah" diselesaikan):
Seluruh nama kolom di bawah **sudah diverifikasi langsung ke schema aktual**
(`packages/db/src/schema/public/members.ts` + `contacts.ts`, dicek 2026-07-23) — bukan dari
ingatan:
```
members.gender             IS NOT NULL   -- enum ["male","female"]
members.birthDate          IS NOT NULL   -- kolom date
members.graduationYear     IS NOT NULL   -- smallint
members.graduationPeriod   IS NOT NULL   -- hanya wajib kalau graduationYear = 1999, enum ["awal","akhir"]
members.professionId       IS NOT NULL   -- smallint, FK ke ref_professions
members.waliSantri         IS NOT NULL
members.primaryCabangRefId IS NOT NULL   -- uuid, FK ke ref_ikpm_cabang
members.domicileStatus     IS NOT NULL   -- CONFIRMED: kolom LANGSUNG di members (bukan di
                                         -- addresses/contacts), enum ["permanent","temporary"]
contacts.phone             IS NOT NULL   -- via members.contactId
contacts.whatsapp          IS NOT NULL
contacts.email             IS NOT NULL
```
Step 3 (Riwayat Pendidikan) **dikecualikan** — tidak masuk syarat, sesuai instruksi eksplisit.

**b. Minimal 1 dari 3 direktori self-report** — bukan field `professionId` umum di atas
(yang otomatis terisi begitu Step 1 selesai, jadi tidak masuk akal jadi syarat tambahan):
```
EXISTS (SELECT 1 FROM member_businesses      WHERE member_id = X)
   OR
EXISTS (SELECT 1 FROM member_owned_pesantren WHERE member_id = X)
   OR
EXISTS (SELECT 1 FROM member_professionals   WHERE member_id = X)
```

**Helper yang perlu dibuat**: satu fungsi `checkForumEligibility(memberId): { eligible: boolean,
missing: string[] }` — dipakai BERSAMA oleh (1) overlay `/akun` dan (2) halaman pendaftaran
forum, supaya logic-nya tidak dua kali ditulis dan berisiko drift (pola "satu helper, satu
tempat" yang sudah berkali-kali ditegaskan di project ini).

### 2. Konfigurasi Pembayaran per Forum (Opsional)

**Dikunci 2026-07-23**: pembayaran (produk/campaign) SELALU murni opsional secara bertingkat.
Ada DUA sumbu independen, bukan satu:

1. **Apakah ada produk/campaign yang ditunjuk sama sekali** — admin boleh kosongkan
   keduanya (`requiredProductId`/`requiredCampaignId` = `null`) → forum 100% gratis, tidak ada
   ajakan bayar apa pun.
2. **Kalau admin MENUNJUK produk/campaign, apakah menyelesaikannya WAJIB atau OPSIONAL untuk
   menjadi anggota** — toggle terpisah `paymentRequired: boolean` (checkbox di halaman
   settings). Ini yang membedakan dua skenario:
   - `paymentRequired = false` (default) → produk/campaign yang ditunjuk cuma jadi **ajakan
     dukungan sukarela** — anggota tetap bisa klik "Ya, Saya Ingin Bergabung" dan langsung
     aktif TANPA menyelesaikan pembayaran apa pun; opsi beli/donasi ditampilkan terpisah
     (mis. sebagai CTA sekunder di halaman pendaftaran atau setelah bergabung), bukan gate.
   - `paymentRequired = true` → produk/campaign yang ditunjuk jadi SYARAT WAJIB — anggota baru
     aktif setelah invoice terkait lunas, persis alur di §4 di bawah.

Kalau `paymentRequired = true` DAN kedua produk+campaign sekaligus ditunjuk, dipakai
`requireMode: "either" | "both"` sebagai sumbu ketiga (default `"either"` kalau admin tidak
mengubah — belum ada instruksi eksplisit untuk lebih spesifik dari ini, dipilih `"either"`
sebagai default karena implementasinya lebih sederhana: cukup cek item pada SATU invoice yang
baru lunas, bukan agregasi lintas invoice seperti mode `"both"`).

Disimpan di `tenant_{slug}.settings` — key BARU `membership_config`, group BARU `forum`:
```json
{
  "requiredProductId":  "uuid-produk-atau-null",
  "requiredCampaignId": "uuid-campaign-atau-null",
  "paymentRequired":     false,
  "requireMode":         "either"
}
```
`requireMode` hanya relevan/dipakai kalau `paymentRequired = true` DAN kedua ID di atas
sekaligus terisi.

**Halaman admin baru** — rute dikunci: **`/app/{slug}/settings/keanggotaan`** (dicek, tidak
collision dengan rute lain yang ada). Hanya render kalau `tenants.tenantType === 'forum'`.
Isi: picker produk (dari `products` tenant ini) + picker campaign (dari `campaigns` tenant
ini) via `<Combobox>`, keduanya opsional; checkbox "Wajibkan pembayaran ini untuk anggota
baru" (`paymentRequired`) yang HANYA aktif/relevan kalau minimal satu picker terisi; toggle
`requireMode` yang HANYA muncul kalau `paymentRequired=true` DAN kedua picker terisi.

### 3. Perubahan Skema — Ringkasan Apa yang Baru vs Sudah Ada

| Yang dibutuhkan | Status |
|---|---|
| `tenant_memberships.forumStatus`/`forumInvoiceId`/`approvedAt`/`expiresAt` | **SUDAH ADA** (kolom nganggur sejak migration 0018) — v2 pakai ini, tidak perlu migrasi baru |
| `invoices.source_type` baru (`forum_registration`) | **TIDAK DIBUTUHKAN** — pembayaran forum lewat cart checkout biasa, `source_type` tetap `"cart"` |
| `settings.group` baru (`"forum"`) | **BARU** — migrasi kecil, pola sama persis `0031_settings_group_event.sql` (update TS union `SETTING_GROUPS` + DDL CHECK constraint di `create-tenant-schema.ts` + migration SQL per-tenant) |
| Tabel baru | **TIDAK ADA** — semuanya numpang ke tabel yang sudah ada |

### 4. Alur End-to-End (User Journey)

```
Anggota buka {slug-forum}.jalakarta.com/akun
  │
  ├─ Belum login → alur login/register YANG SUDAH ADA (tidak ada logic baru di sini —
  │                setelah login sukses, konvensi yang sudah ada memang redirect ke /akun)
  │
  └─ Sudah login →
       │
       ├─ Sudah tenant_memberships utk tenant forum ini (status aktif)?
       │    YA  → kartu tampil normal, TIDAK ada overlay (perilaku hari ini, tidak berubah)
       │    TIDAK → lanjut ke bawah
       │
       ├─ checkForumEligibility(memberId) →
       │    TIDAK eligible → overlay glass-effect + pesan spesifik field/direktori yang
       │                     kurang + tautan langsung ke /akun/lengkapi atau
       │                     /akun/usaha|pesantren|profesional (tombol daftar TIDAK muncul)
       │    ELIGIBLE       → overlay glass-effect + tombol "Daftar Menjadi Anggota {NamaForum}"
       │
       └─ Klik tombol → halaman pendaftaran khusus (terpisah, bukan proses inline di overlay)
            │
            ├─ paymentRequired=false (default — termasuk kasus forum 100% gratis tanpa
            │  produk/campaign ditunjuk sama sekali)
            │    → tombol "Ya, Saya Ingin Bergabung" satu klik langsung aktif
            │    → INSERT/UPDATE tenant_memberships (membershipType='forum', status='active',
            │       forumStatus='active', approvedAt=now(), registeredVia='self')
            │    → kalau ADA produk/campaign ditunjuk (meski tidak wajib) → tampilkan CTA
            │      sekunder "Ingin mendukung {Nama Forum}?" mengarah ke produk/campaign itu,
            │      TAPI tidak memblokir apa pun — bisa diabaikan
            │    → redirect balik /akun, overlay hilang
            │
            └─ paymentRequired=true → arahkan ke checkout produk/campaign yang dikonfigurasi
                 (reuse alur cart/checkout publik yang SUDAH ADA sepenuhnya — tidak ada
                 halaman checkout baru)
                 → invoice lunas (sourceType tetap "cart", TIDAK ada source_type baru)
                 → HOOK di confirmInvoicePaymentAction/verifySubmittedPaymentAction
                   (finance/billing/actions.ts — fungsi yang SAMA yang sudah disentuh sesi
                   audit phone/WA sebelumnya): setelah invoice paid, cek apakah item invoice
                   ini cocok dengan requiredProductId/requiredCampaignId TENANT INI (invoice
                   sudah otomatis ter-scope ke tenant ybs karena billing per-tenant-schema,
                   TIDAK perlu cari lintas tenant) → kalau cocok (dan requireMode terpenuhi
                   kalau kedua ID ditunjuk) → aktivasi tenant_memberships forum untuk memberId
                   pembeli
```

### 5. Komponen UI Baru

- **Overlay kartu `/akun`** — komponen baru (nama disarankan `ForumJoinOverlay`), dirender
  bersyarat di `akun/layout.tsx` atau `akun/page.tsx` (titik yang sama dengan
  `resolveAkunBranding()` sudah dipanggil — reuse context "tenant apa yang sedang dibuka" yang
  sudah di-resolve di situ, jangan query ulang). Style: `bg-background/80 backdrop-blur-lg
  border border-border rounded-2xl shadow-lg` menimpa `<MemberCard>` yang tetap dirender di
  belakangnya (bukan disembunyikan — sengaja tetap ada di DOM, cuma ketutup visual, sesuai
  yang didiskusikan).
- **Halaman pendaftaran forum** — route baru di `(public)/[tenant]/`, nama **dikunci: `/gabung`**
  (dicek 2026-07-23, tidak ada collision dengan route lain yang sudah ada).
- **Settings admin forum** — `/app/{slug}/settings/keanggotaan` (dikunci, tidak collision;
  hanya untuk tenant forum).

### 6. File yang Kemungkinan Disentuh (perkiraan, akan diverifikasi ulang saat implementasi)

```
packages/db/migrations/00XX_settings_group_forum.sql     → BARU (migrasi kecil)
packages/db/src/schema/tenant/settings.ts                → tambah "forum" ke SETTING_GROUPS
packages/db/src/helpers/create-tenant-schema.ts          → update DDL CHECK constraint

apps/web/lib/forum-eligibility.ts                        → BARU: checkForumEligibility()
apps/web/app/(dashboard)/app/[tenant]/settings/keanggotaan/  → BARU: halaman admin (hanya forum)
apps/web/app/(public)/[tenant]/gabung/                    → BARU: halaman pendaftaran forum
apps/web/app/(public)/[tenant]/akun/layout.tsx (atau page.tsx) → tambah overlay bersyarat
apps/web/components/akun/forum-join-overlay.tsx           → BARU: komponen overlay
apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts → tambah hook aktivasi forum
                                                              di confirmInvoicePaymentAction +
                                                              verifySubmittedPaymentAction
```

### 7. Keputusan — Status Akhir (2026-07-23)

Semua item di bawah ini **SUDAH RESOLVED** sebelum eksekusi boleh dimulai:

1. ~~`requireMode: "either" | "both"`~~ — **RESOLVED**: dibuat configurable (§2), TAPI hanya
   relevan kalau `paymentRequired=true` DAN kedua produk+campaign ditunjuk. Default `"either"`
   kalau admin tidak eksplisit ubah (alasan: implementasi lebih sederhana, tidak perlu agregasi
   lintas invoice).
2. ~~Nama rute~~ — **RESOLVED & dicek collision**: halaman pendaftaran = `/gabung`, settings
   admin = `/app/{slug}/settings/keanggotaan`. Keduanya dikonfirmasi tidak bentrok dengan route
   lain yang ada (grep 2026-07-23).
3. ~~Field `domicileStatus`~~ — **RESOLVED, diverifikasi langsung ke schema**: `members.
   domicileStatus`, kolom langsung di tabel `members` (bukan di `addresses`/`contacts`), enum
   `["permanent","temporary"]`. Semua 10 field syarat kelengkapan di §1a sudah diverifikasi
   satu-per-satu ke `packages/db/src/schema/public/members.ts` + `contacts.ts` — bukan dari
   ingatan wizard.
4. **MASIH TERBUKA, sengaja dibiarkan di luar scope MVP pertama**: cron/reminder untuk forum
   yang `expiresAt` mendekati (iuran tahunan, konsep dari v1 lama) — v2 belum membahas ini
   sama sekali. Tidak menghalangi mulai eksekusi Fase A–E di bawah; bisa jadi Fase F terpisah
   nanti kalau memang dibutuhkan.

**Kesimpulan: tidak ada lagi keputusan blocking yang menggantung — rencana ini sudah siap
dieksekusi dari Fase A, menunggu sinyal eksplisit user untuk mulai.**

### Urutan Eksekusi (kalau/ketika diberi izin jalan)

Ikuti pola yang sudah established di project ini — tulis rencana (dokumen ini) → jawab §7 di
atas → eksekusi bertahap dengan verifikasi `tsc`/build di tiap checkpoint, BUKAN sekaligus:

```
Fase A — Skema: migration settings group "forum" + jalankan lokal + verifikasi        ✅ SELESAI
Fase B+C — checkForumEligibility() + overlay glass-effect di /akun + halaman /gabung  ✅ SELESAI
           (forum GRATIS bisa didaftar end-to-end — lihat catatan penggabungan di bawah)
Fase D — Integrasi pembayaran: picker produk/campaign di settings + hook aktivasi di
         confirmInvoicePaymentAction/verifySubmittedPaymentAction                     ✅ SELESAI
Fase E — Verifikasi end-to-end (forum gratis + forum berbayar), dokumentasi final,
         commit+push, deploy                                                          ⬜ BELUM
```

**Fase D — detail (2026-07-24):**

Sebelum eksekusi, user mengklarifikasi satu pertanyaan kunci yang tidak eksplisit dijawab di
§2 sebelumnya: **kalau seseorang yang BELUM eligible kebetulan membayar/donasi ke campaign
yang ditunjuk (lewat jalur APA PUN, bukan cuma via `/gabung` — mis. donasi biasa lewat
`/campaign`), apakah keanggotaan forumnya tetap aktif otomatis?** Jawaban dikunci:
**TIDAK** — payment SAJA tidak cukup, `checkForumEligibility()` tetap WAJIB dicek ulang di
titik konfirmasi pembayaran sebelum aktivasi terjadi. Ini penting karena hook aktivasi
memang sengaja bereaksi terhadap SEMBARANG invoice yang lunas dan itemnya cocok dengan
konfigurasi (bukan cuma invoice yang berasal dari alur `/gabung`) — reuse penuh billing
universal, tanpa perlu "menandai" invoice sebagai "untuk pendaftaran forum" secara eksplisit.

**File yang ditambah/diubah (Fase D):**
```
apps/web/app/(dashboard)/app/[tenant]/settings/actions.ts       → MembershipConfigData type +
                                                                    saveMembershipConfigAction()
apps/web/app/(dashboard)/app/[tenant]/settings/keanggotaan/
  page.tsx                                                      → BARU: halaman admin, guard
                                                                    tenantType==="forum", fetch
                                                                    produk+campaign aktif
apps/web/components/settings/membership-config-form.tsx         → BARU: form client — 2 Combobox
                                                                    (produk/campaign) + checkbox
                                                                    paymentRequired + toggle
                                                                    requireMode (kondisional)
apps/web/components/settings/settings-nav.tsx                    → item "Keanggotaan" kondisional
                                                                    (prop isForum)
apps/web/app/(dashboard)/app/[tenant]/settings/layout.tsx        → teruskan
                                                                    isForum={tenant.tenantType
                                                                    === "forum"} ke SettingsNav
apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts → activateForumMembershipIfApplicable()
                                                                    (helper privat baru) + dipanggil
                                                                    dari confirmInvoicePaymentAction
                                                                    DAN verifySubmittedPaymentAction,
                                                                    HANYA saat newStatus==="paid"
                                                                    (bukan partial)
apps/web/app/(public)/[tenant]/gabung/actions.ts                 → joinForumAction ditambah guard:
                                                                    tolak kalau paymentRequired=true
                                                                    (pertahanan server-side kedua,
                                                                    UI sudah tidak tampilkan tombol
                                                                    ini tapi jangan percaya itu saja)
apps/web/app/(public)/[tenant]/gabung/page.tsx                   → branch UI: paymentRequired=false
                                                                    → tombol join (+ CTA dukungan
                                                                    opsional kalau ada yang
                                                                    dikonfigurasi); paymentRequired
                                                                    =true → link ke produk/campaign
                                                                    (either/both sesuai requireMode),
                                                                    TANPA tombol join — aktivasi
                                                                    murni dari hook pembayaran
```

**Keputusan implementasi kunci:**
- `activateForumMembershipIfApplicable()` dipanggil SETELAH `db.transaction()` (tenant-schema)
  commit — BUKAN di dalamnya — karena `tenant_memberships` ada di PUBLIC schema, koneksi
  terpisah dari `tx` tenant-schema. Dibungkus try/catch TERPISAH dari catch utama fungsi
  (pembayaran yang sudah sah TIDAK BOLEH gagal tercatat hanya karena aktivasi forum error).
- Gating "hanya saat lunas" pakai object holder `paymentStatusInfo: {newStatus: string}` (pola
  yang sama dengan `installmentInfo` di kedua fungsi) — bukan `let newStatus` polos, konsisten
  dengan lesson lama soal TypeScript narrowing `never` pada `let` yang di-reassign di dalam
  closure `db.transaction()`.
- `MembershipConfigData` didefinisikan SATU KALI di `settings/actions.ts` (pemilik penulisan
  config), diimpor SEBAGAI TYPE oleh `finance/billing/actions.ts` DAN `gabung/actions.ts` DAN
  `gabung/page.tsx` — mencegah drift 3 salinan independen dari shape yang sama.
- Matching invoice item ke config: `itemType='product' AND itemId=requiredProductId` (produk),
  `itemType='donation' AND itemId=requiredCampaignId` (donasi/campaign REGULAR). **Limitasi
  yang diterima**: campaign tipe QURBAN tidak akan pernah match kalau ditunjuk sebagai
  `requiredCampaignId` — item qurban di cart tersimpan dengan `itemId = qurban_animals.id`
  (bukan `campaigns.id` langsung, lihat § arsitektur-donasi.md), jadi admin sebaiknya
  menunjuk campaign donasi REGULAR, bukan qurban, sebagai syarat iuran forum.
- Guru "cari produk/campaign untuk picker" di halaman settings pakai query LANGSUNG di server
  page (pola `display/page.tsx`, bukan lewat action terpisah) — filter `status='active'`.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan) — route `/settings/keanggotaan` DAN
`/gabung` terkonfirmasi muncul di build output. Nol migrasi DB tambahan (memakai key JSONB baru
`membership_config` di group `"forum"` yang skemanya sudah dibuat Fase A). **Belum
diverifikasi visual di browser, belum ada tenant forum + konfigurasi pembayaran nyata yang
dicoba end-to-end** — Fase E (verifikasi + deploy) masih menunggu.

**Susulan Fase D — Informasi Pendaftaran + Persetujuan Legal (2026-07-24):**

Setelah mencoba tenant forum lokal (Forcreator), user minta halaman `/gabung` bisa menampilkan
teks penjelasan organisasi yang bersifat custom per forum — contoh yang diberikan: *"FORCREATOR
IKPM Gontor adalah organisasi resmi di bawah Pengurus Pusat IKPM Gontor. Keanggotaan FORCREATOR
bersifat EKSKLUSIF — hanya anggota IKPM Gontor (alumni, minimal 1 tahun mondok) yang bisa
mendaftar. Keanggotaan FORCREATOR hanya memiliki satu jenis: anggota FORCREATOR IKPM Gontor,
tidak ada cabang/nama lain."* — plus checkbox persetujuan Syarat & Ketentuan + Kebijakan Privasi
sebelum tombol join, mengikuti pola yang sudah ada di `/register`.

**Field baru `registrationInfo: string | null`** ditambahkan ke `MembershipConfigData`
(satu field lagi di JSONB `membership_config`, group "forum" — TIDAK butuh migrasi DB baru,
sama seperti field lain di key ini). Textarea admin di `MembershipConfigForm`, ditampilkan
sebagai teks bebas multi-paragraf (baris baru dipertahankan via `whitespace-pre-line`) di
`/gabung`, TERLEPAS status eligibility pengunjung — dipindah ke atas halaman, sebelum blok
eligible/belum-eligible, karena relevan untuk SEMUA calon anggota, bukan cuma yang sudah
memenuhi syarat. `getSetting("membership_config", "forum")` sekarang dibaca SELALU (bukan
cuma saat `eligibility.eligible`, seperti pertama kali ditulis) — hanya bagian syarat iuran
(product/campaign lookup) yang tetap digating eligibility.

**`LegalModal` diekstrak jadi komponen shared** (`components/akun/legal-modal.tsx`) dari yang
sebelumnya private/inline di `register/register-form.tsx` — dipakai ulang oleh
`gabung/join-forum-button.tsx` (checkbox "Dengan ini saya menyatakan menyetujui Syarat dan
Ketentuan serta Kebijakan Privasi" ditambahkan tepat di atas tombol "Ya, Saya Ingin Bergabung",
tombol di-disable sampai dicentang — pola identik `agreed` state di form register). Konten
modal tetap dari API yang sama (`GET /api/akun/legal?slug=&template=terms|privacy`, halaman
legal singleton tenant) — tidak ada endpoint baru.

**UI header `/gabung` diperkaya (permintaan user "biar cakep")**: logo tenant (dari
`getSettings(tenantDb, "general").logo_url`, fetch paralel dengan `membership_config` via
`Promise.all`) ditampilkan sebagai avatar bulat (`h-20 w-20 rounded-full`) dengan ring aksen
primary + border putih + shadow — fallback ke inisial huruf pertama nama tenant dalam badge
`bg-primary` bulat kalau logo belum diupload. Kartu info registrasi diberi header kecil "Tentang
{tenant}" (ikon `Info`, teks uppercase `text-primary`) + gradient tipis `from-primary/[0.04]`,
menggantikan box abu-abu polos sebelumnya.

**Verifikasi**: `tsc --noEmit` bersih (kedua kali, sebelum dan sesudah redesign header) +
`bun run build --filter=@jalajogja/web` sukses. Nol migrasi DB. Belum diverifikasi visual.

### Nomor Keanggotaan Lokal Forum (2026-07-24)

User sadar setelah mencoba `/gabung`: forum butuh nomor identitas anggota SENDIRI, terpisah
dari `public.members.member_number` (global lintas IKPM, sudah ada sejak lama). Contoh yang
diminta: `2017.00001` — tahun bergabung + urutan 5-digit, dipisah titik untuk keterbacaan.

**Keputusan yang dikunci** (dikonfirmasi via `AskUserQuestion`):
- **Khusus tenant forum** — TIDAK digeneralisasi ke cabang/marhalah (cabang/marhalah sudah
  punya `member_number` global sebagai identitas utama, tidak butuh nomor lokal tambahan).
- **Counter TIDAK reset per tahun** — jalan terus selama umur tenant (anggota ke-1 sampai
  ke-N sepanjang sejarah forum, bukan "urutan dalam tahun itu").
- **Preset dropdown, bukan token-format bebas ketik** — 3 pilihan konkret, bukan mesin token
  seperti nomor surat (`{number:N}`, `{year:2}`, dst) yang jauh lebih berat untuk kebutuhan
  sekecil ini:
  1. **Tahun + Urutan** (default): `2017.00001`
  2. **Tahun + Tgl Lahir + Urutan** — SAMA PERSIS recipe `member_number` global
     (`lib/member-number.ts` di `packages/db`, DDMMYYYY), sekadar di-scope ulang per tenant:
     `20172610199700001`
  3. **Bulan-Tahun + Urutan**: `082017.00001`
- **Simpan STRING HASIL JADI**, bukan rekonstruksi dari bagian mentah di titik baca — sekali
  digenerate saat join, tersimpan apa adanya di `tenant_memberships.membership_number`. Kalau
  admin ganti format setting nanti, nomor yang SUDAH terbit tidak berubah retroaktif (sama
  seperti perilaku format nomor surat). Prinsip ini eksplisit untuk menghindari kelas bug
  "format ulang dari data mentah di titik baca" yang sudah berkali-kali terjadi di project ini
  (Rupiah ICU/CLDR, `displayPhone()` dipakai ulang untuk link wa.me, dll).

**Schema baru** (migration `0045_forum_membership_number.sql`):
```
public.tenant_memberships.membership_number  TEXT (nullable)
public.forum_membership_sequences            (id, tenant_id UNIQUE, last_number, updated_at)
```
Tabel counter di PUBLIC schema (bukan tenant schema) karena `tenant_memberships` sendiri ada
di public schema — pola locking SAMA PERSIS `letter_number_sequences` (`SELECT ... FOR UPDATE`
di dalam `db.transaction()`), cuma dipindah lokasi. Satu baris per tenant, TANPA kolom
`year`/`period` (beda dari `letter_number_sequences` yang unique per year+type+category) —
konsekuensi langsung dari keputusan "tidak reset per tahun".

**Bug client/server boundary ditemukan+difix SEGERA saat build** (bukan setelah deploy) —
`lib/forum-membership-number.ts` awalnya satu file (`import "server-only"` + konstanta +
fungsi generate yang butuh `db`), diimpor oleh `membership-config-form.tsx` (client
component, untuk dapat daftar preset+label) → `next build` gagal eksplisit: *"You're importing
a component that needs 'server-only'... not supported in the pages/ directory"* — PERSIS
lesson lama `nav-menu.ts`/`tenant-timezone.ts` (`tsc --noEmit` tidak menangkap ini sama sekali,
cuma `next build` yang tahu soal client/server bundle boundary). Fix: split jadi 2 file —
`lib/forum-membership-number.ts` (client-safe: `FORUM_MEMBERSHIP_NUMBER_FORMATS`,
`FORUM_MEMBERSHIP_NUMBER_FORMAT_LABELS`, `formatForumMembershipNumber()` pure function, ZERO
import `@jalajogja/db`) + `lib/forum-membership-number.server.ts` (`import "server-only"`,
`generateForumMembershipNumber()` yang butuh DB, re-export konstanta dari file client-safe).
`settings/actions.ts` (validasi format saat save) impor dari file PLAIN; `gabung/actions.ts`
dan `finance/billing/actions.ts` (generate nomor sungguhan) impor dari `.server`.

**Generation — dua titik aktivasi keanggotaan forum, sama-sama guard "generate sekali saja"**:
`joinForumAction` (jalur gratis) dan `activateForumMembershipIfApplicable` (jalur pembayaran,
`finance/billing/actions.ts`) — keduanya cek `existing?.membershipNumber` dulu, HANYA generate
kalau kosong (member yang sempat `suspended` lalu aktif lagi TIDAK dapat nomor baru,
mempertahankan yang lama).

**Display**: baris baru "No. Anggota Forum" di panel "Info keanggotaan" desktop `/akun`
(`membershipInfo.forumMembershipNumber`, hanya render kalau ada nilai — otomatis cuma
muncul untuk forum yang sudah dikonfigurasi). **Admin dashboard (`/app/{slug}/members/[id]`)
belum menampilkan ini** — di luar scope MVP, bisa ditambah kalau diminta.

**Susulan — MemberCard mobile (2026-07-24, permintaan langsung sesudah fitur ini live)**:
user minta nomor forum juga tampil di kartu MOBILE, tapi bukan sebagai baris tambahan seperti
di desktop — **menggantikan** `memberNumber` (No. Anggota IKPM global) yang biasa tampil besar
di tengah kartu, plus caption kecil di bawahnya "No. ID {nama forum}" (mis. "No. ID
Forcreator") supaya jelas nomor apa yang sedang dilihat. `MemberCard` (`components/akun/mobile/
member-card.tsx`) dapat prop baru opsional `forumMembershipNumber?: string | null` — cabang
render 3-tingkat: `forumMembershipNumber` ada → tampilkan itu + caption (bukan `memberNumber`
sama sekali); tidak ada → fallback `memberNumber` seperti semula; kosong dua-duanya → fallback
`stambuk`. **Reuse `siteName` yang sudah ada** untuk caption "No. ID {siteName}" — TIDAK
butuh prop nama-tenant terpisah, karena `forumMembershipNumber` HANYA pernah terisi untuk
member yang genuinely aktif di forum yang sedang dibrowsing, dan pada kondisi itu
`resolveAkunBranding()` SUDAH me-resolve `siteName` ke tenant forum itu sendiri (Step 1:
genuine member dari tenant yang dibrowsing) — bukan kebetulan, konsekuensi langsung arsitektur
resolusi branding yang sudah dikunci sebelumnya (§ "Resolusi Branding Kartu Anggota",
`docs/arsitektur-akun.md`). Tidak berlaku untuk cabang/marhalah — otomatis, karena kolom
`membership_number` memang tidak pernah diisi untuk kedua tipe itu (data-driven guard, bukan
pengecekan `tenantType` eksplisit tambahan).

**Preset ke-4 — "Tahun Daftar + Angkatan + Urutan" (2026-07-28)**: user minta format baru
`<2 digit tahun daftar><2 digit tahun angkatan>.<seq 5-digit>`, contoh `2690.00001` = daftar
2026, angkatan (Tahun Lulus KMI) 1990, urutan 1. Ditambahkan sebagai opsi ke-4 di
`FORUM_MEMBERSHIP_NUMBER_FORMATS` (key: `joinyear_gradyear_seq`) — murni ADDITIF, 3 preset lama
tidak berubah sama sekali (diverifikasi via disposable test regresi).

Layak dibangun tanpa risiko data kosong karena `graduationYear` (Tahun Lulus KMI) SUDAH jadi
field WAJIB di `checkMemberEligibility()` (§ "Alur Pendaftaran Forum v2") — dan KEDUA titik
generate nomor (`joinForumAction` jalur gratis, `activateForumMembershipIfApplicable` jalur
bayar) SUDAH memanggil `checkMemberEligibility()` dan menolak proses kalau belum lolos, SEBELUM
sampai ke `generateForumMembershipNumber()`. Jadi `graduationYear` dijamin terisi di titik ini —
fallback `"00"` di kode murni defensif (sama pola `birthPart` fallback `"00000000"` yang sudah
ada), tidak pernah genuinely terpakai lewat jalur normal.

**Batasan yang diterima, tidak diselesaikan (di luar scope diminta)**: angkatan 1999 punya dua
sub-kelompok (`graduationPeriod`: Awal/Akhir, lihat § "Statistik — Pola Angkatan dengan
Sub-periode" di CLAUDE.md) — format ini TIDAK membedakan keduanya, dua digit "99" akan sama
untuk 1999-Awal maupun 1999-Akhir. Ini TIDAK menyebabkan bug data (bagian sequence 5-digit tetap
unik per anggota, tidak pernah bentrok) — cuma berarti prefiks manusia-terbaca ini kebetulan
tidak disambiguasi untuk kasus 1999 spesifik. Tidak ditangani karena tidak diminta dan akan
memaksa format jadi lebih panjang (butuh 1 karakter tambahan untuk Awal/Akhir) demi kasus yang
cuma menyentuh SATU angkatan dari puluhan yang mungkin ada di sebuah forum.

Diverifikasi empiris (disposable test, dihapus setelah): output PERSIS `"2690.00001"` untuk
input persis contoh user, plus 2 edge case (graduationYear null → fallback "00", seq >5 digit
→ tidak dipotong, `padStart` cuma jamin MINIMAL 5 digit) dan 1 regression check (`year_seq`
masih identik). `tsc --noEmit` (dari `apps/web`, bukan root — root `tsconfig.json` tidak
punya alias `@/*`, gampang keliru) + `bun run build` genuine, keduanya 0 error.

**Limitasi yang diterima (edge case, tidak dibangun)**: TIDAK ada backfill untuk anggota forum
yang SUDAH aktif SEBELUM admin mengaktifkan fitur ini — mereka akan selamanya `membership_
number = NULL` kecuali dibackfill manual. Anggota BARU setelah fitur diaktifkan mulai dari
urutan `00001` — bukan reproduksi urutan historis sebenarnya kalau ada member lama tanpa
nomor. Diterima karena tenant forum yang jadi konteks fitur ini (Forcreator) masih baru,
risiko rendah — dicatat di sini kalau perlu backfill di kemudian hari untuk forum yang sudah
lama berjalan.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (setelah fix client/server split — percobaan pertama gagal
build, dikonfirmasi via log build, bukan asumsi). Migration `0045` dijalankan+diverifikasi di
lokal (`\d public.tenant_memberships` + `\d public.forum_membership_sequences`). **Belum
dijalankan di VPS. Belum diverifikasi visual** — user perlu aktifkan format di
`/app/{slug}/settings/keanggotaan` (tenant `forcreator`), coba join via `/gabung`, lihat hasil
di `/akun`.

**Catatan penggabungan Fase B+C (2026-07-23/24)**: rencana awal memisahkan Fase B ("halaman
settings admin keanggotaan, gratis dulu") dari Fase C (overlay + `/gabung`). Saat eksekusi,
disadari admin settings page untuk forum HANYA berguna kalau ADA sesuatu untuk dikonfigurasi
(picker produk/campaign) — dan itu baru dibutuhkan di Fase D. Selama belum ada baris
`membership_config` tersimpan sama sekali, perilaku default (tidak ada tabel `settings` key
`membership_config`) sudah SAMA PERSIS dengan "forum gratis, tanpa payment" — jadi halaman
settingsnya sendiri ditunda ke Fase D, dan Fase B+C digabung jadi satu milestone: eligibility
helper + overlay + halaman `/gabung` + aksi join (jalur gratis saja untuk sekarang).

**File yang dibuat (Fase B+C):**
```
apps/web/lib/forum-eligibility.ts                          → checkForumEligibility() + label ID
apps/web/app/(public)/[tenant]/gabung/page.tsx              → halaman pendaftaran (3 state:
                                                                bukan-member/sudah-anggota/
                                                                belum-eligible/eligible)
apps/web/app/(public)/[tenant]/gabung/actions.ts            → joinForumAction() — jalur GRATIS
                                                                saja (Fase D nambah cabang bayar)
apps/web/app/(public)/[tenant]/gabung/join-forum-button.tsx → client component tombol join
apps/web/components/akun/forum-join-overlay.tsx             → overlay glass-effect (server,
                                                                murni presentasional)
apps/web/app/(public)/[tenant]/akun/page.tsx                → wiring overlay ke 2 titik: kartu
                                                                desktop ("Info keanggotaan") dan
                                                                MemberCard mobile, keduanya
                                                                dibungkus wrapper `relative`
```

**Keputusan implementasi kecil yang diambil saat eksekusi (konsisten dengan §1-§7 di atas,
bukan penyimpangan):**
- Query "apakah tenant ini forum + apakah member sudah aktif di situ" di `akun/page.tsx`
  SENGAJA terpisah dari query `membershipInfo` yang sudah ada (yang pakai INNER JOIN
  `tenant_memberships ⋈ tenants`) — INNER JOIN itu mensyaratkan baris `tenant_memberships`
  sudah ADA, padahal justru "belum ada baris sama sekali" adalah kasus utama yang harus
  terdeteksi oleh overlay.
- `joinForumAction` melakukan UPSERT manual (SELECT dulu → UPDATE jika baris sudah ada
  dengan status apa pun, INSERT jika belum ada sama sekali) — bukan `INSERT ... ON CONFLICT`
  — supaya baris lama yang sempat `forumStatus='rejected'`/`'suspended'` bisa diaktifkan
  ulang tanpa menabrak unique constraint `(tenantId, memberId)`.
- Eligibility DICEK ULANG di server di dalam `joinForumAction` (bukan cuma dipercaya dari
  render halaman `/gabung`) — konsisten dengan pola "server actions publik tidak boleh
  percaya state client" yang sudah berkali-kali ditegaskan di project ini.
- Overlay TIDAK memproses join secara inline — cuma `<a href="/gabung">`, sesuai keputusan
  §4 ("halaman pendaftaran khusus, terpisah, bukan proses inline di overlay").
- Redirect setelah join sukses pakai `window.location.href` (bukan `router.push`) ke
  `${baseUrl}/akun` — mengikuti lesson lama "PC IKPM Cabang — Cache RSC basi di /akun".

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan), route `/gabung` terkonfirmasi muncul
di build output. Nol migrasi DB tambahan di fase ini (semua kolom yang dipakai sudah ada sejak
migration 0018). **Belum diverifikasi visual di browser** dan **belum ada tenant forum + member
uji coba nyata** untuk mencoba alur end-to-end — perlu dicoba manual sebelum dianggap final.

**Refinement `ForumJoinOverlay` (2026-07-24, susulan)**: user menemukan tombolnya "rancu" saat
testing manual — kondisi belum eligible tetap mengarah ke `/gabung` (double-hop membingungkan,
karena `/gabung` cuma menampilkan ulang info yang sama). Diganti jadi **3 kondisi eksplisit**
berdasar isi `missing: ForumEligibilityField[]` (bukan cuma `eligible: boolean`):
1. **Profil pribadi belum lengkap** (ada field selain `"directory"` di `missing`) → tombol
   "Lengkapi Data Pribadi" → langsung `/akun/lengkapi` (bukan `/gabung`).
2. **Profil pribadi lengkap, tinggal direktori** (`missing` cuma berisi `"directory"`) → tombol
   "Lengkapi Data →" membuka **popup** (`DirectoryChoicePopover`, komponen client baru,
   `Popover`/`PopoverTrigger`/`PopoverContent` dari Radix — sama seperti dipakai `Combobox`) —
   3 pilihan: "Saya seorang profesional" → `/akun/profesional`, "Saya memiliki usaha" →
   `/akun/usaha`, "Saya memiliki lembaga pendidikan/kursus" → `/akun/pesantren`.
3. **Eligible** → teks "Data Anda lengkap. Jika ingin mendaftar menjadi anggota X, klik tombol
   di bawah ini:" + tombol **"Gabung {tenantName}"** → `/gabung` (satu-satunya kasus yang benar-
   benar masuk `/gabung`, karena di situ tombol join sungguhan aktif).

`ForumJoinOverlay` sendiri TETAP server component (tidak butuh state) — hanya
`DirectoryChoicePopover` yang jadi client component terpisah, dikomposisi dari server component
seperti biasa (pola composition standar Next.js App Router). `akun/page.tsx` diubah dari
menyimpan `forumEligible: boolean` jadi `forumMissing: ForumEligibilityField[]` (reuse langsung
`eligibility.missing` dari `checkForumEligibility()` yang sudah dipanggil, tidak ada query
tambahan) dan props overlay berubah dari `eligible`/`gabungHref` jadi `missing`/`baseUrl` (overlay
sendiri yang membangun semua href turunan: `/gabung`, `/akun/lengkapi`, `/akun/{usaha,profesional,
pesantren}`).

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev
server dimatikan dulu, `.next` dibersihkan, direstart setelah build). Nol migrasi DB. Belum
diverifikasi visual di browser oleh Claude — user perlu coba ketiga kondisi langsung.

### Pemisahan Donasi vs Registrasi Forum (2026-07-24)

**Masalah yang ditemukan** (user minta cek langsung: "apakah ketika orang berdonasi SAJA, itu
otomatis dianggap ikut event/gabung forum? seharusnya tidak"):

- **Event + donasi** — DICEK, TIDAK ADA BUG. `EventRegisterForm` selalu mewajibkan pilih tiket
  untuk mendaftar (donasi ke campaign terhubung cuma tawaran tambahan opsional, tidak pernah
  memaksa/otomatis). Auto-create `event_registrations` (di `finance/billing/actions.ts`) secara
  eksplisit HANYA memproses `invoice_items` bertipe `"ticket"` — donasi (`itemType="donation"`)
  tidak pernah disentuh loop itu sama sekali. Jadi donasi ke campaign yang kebetulan terhubung
  ke event, lewat `/campaign/{slug}` biasa, TIDAK PERNAH membuat baris pendaftaran event.

- **Forum + donasi wajib (`paymentRequired=true`)** — DITEMUKAN CELAH NYATA.
  `activateForumMembershipIfApplicable()` (dibangun di Fase D, lihat bagian di atas) sebelumnya
  menganggap SIAPA PUN yang bayar/donasi ke produk/campaign yang jadi syarat iuran forum — dari
  jalur MANA PUN, bukan cuma dari `/gabung` — sebagai niat gabung forum. Ini disengaja saat Fase
  D dibangun ("reuse billing universal, tanpa perlu menandai invoice"), tapi konsekuensinya:
  orang yang menemukan campaign itu sendiri lewat `/campaign/{slug}` (nol niat gabung forum)
  bisa tiba-tiba jadi anggota forum kalau kebetulan data pribadinya sudah lengkap (eligible).
  User mengonfirmasi via `AskUserQuestion`: **donasi dan registrasi forum harus dipisah total** —
  hanya pembayaran yang genuinely berasal dari `/gabung` yang boleh mengaktifkan keanggotaan.

**Fix — penanda eksplisit `for_gabung_registration`, dipropagasi dari klik link sampai ke
invoice item:**

```
/gabung (paymentRequired=true)
  └─ link ke /produk/{slug}?forGabung=1 atau /campaign/{slug}?forGabung=1
       └─ page.tsx baca searchParams.forGabung === "1" → prop forGabungRegistration
            └─ ProductDetailClient / CampaignDetailClient
                 └─ addToCartAction(..., { forGabung: true })
                      └─ cart_items.for_gabung_registration = true
                           └─ checkoutAction → invoice_items.for_gabung_registration = true
                                └─ activateForumMembershipIfApplicable() WAJIB
                                   forGabungRegistration=true, bukan cuma itemId cocok
```

**Migration**: `0046_for_gabung_registration.sql` — kolom BOOLEAN DEFAULT false di
`cart_items` DAN `invoice_items` (per-tenant, pola `DO $$ LOOP` sama seperti migration
`0042`/`0045`). Default `false` berarti SEMUA donasi/pembelian existing (dan yang baru, kecuali
eksplisit ditandai) otomatis aman — tidak ada regresi untuk data lama.

**Keputusan scope**: penanda ini HANYA ditambahkan ke 2 link di blok `paymentRequired=true`
(syarat wajib). Link "dukungan sukarela" (`paymentRequired=false`, blok `hasSupportOption`)
SENGAJA TIDAK ditandai — fungsi `activateForumMembershipIfApplicable` sudah `return` di awal
kalau `!config.paymentRequired`, jadi menandai link itu tidak ada gunanya sama sekali (donasi
sukarela sudah 100% aman by design sejak Fase D, bukan bagian dari celah ini).

**Retroaktif untuk item existing di cart**: kalau user sudah pernah menambahkan item YANG SAMA
ke cart lewat jalur biasa (tanpa flag) SEBELUM klik link `/gabung`, `addToCartAction`'s cabang
"item sudah ada → update qty" ikut MENANDAI baris lama jadi `true` kalau `forGabung=true` di
panggilan berikutnya — TIDAK PERNAH sebaliknya (meng-UN-tandai baris yang sudah `true` hanya
karena satu panggilan lain kebetulan `forGabung=false`), supaya niat gabung yang sudah tercatat
tidak pernah hilang begitu saja karena urutan klik.

**File yang diubah**: schema (`packages/db/src/schema/tenant/billing.ts` — kolom di
`createCartItemsTable`+`createInvoiceItemsTable`) + DDL (`create-tenant-schema.ts`) + migration
`0046` + `gabung/page.tsx` (2 link) + `produk/[productSlug]/page.tsx` +
`campaign/[slug]/page.tsx` (baca `searchParams.forGabung`) + `product-detail-client.tsx` +
`campaign-detail-client.tsx` (terima prop, kirim ke `addToCartAction`) + `cart/actions.ts`
(`CartItemInput.forGabung`, `addToCartAction`, `checkoutAction`) + `finance/billing/actions.ts`
(`activateForumMembershipIfApplicable` — filter tambahan `forGabungRegistration===true`).

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+dibersihkan+direstart). Migration `0046`
dijalankan+diverifikasi di lokal (`\d` konfirmasi kolom ada di kedua tabel, tenant `forcreator`).
**Belum dijalankan di VPS. Belum diverifikasi visual/end-to-end** — user perlu coba: (1) donasi
biasa ke campaign forum lewat `/campaign/{slug}` langsung (TANPA lewat `/gabung`) → pastikan
TIDAK jadi anggota forum meski eligible; (2) klik link dari `/gabung` → bayar → pastikan
keanggotaan AKTIF setelah invoice lunas seperti sebelumnya.

> **Catatan penamaan (2026-08-06)**: beberapa bagian di atas (§1 "Helper yang perlu dibuat",
> §5 "Komponen UI Baru", §6 "File yang Kemungkinan Disentuh", § "File yang dibuat (Fase B+C)")
> masih menyebut nama RENCANA AWAL — `checkForumEligibility()`/`lib/forum-eligibility.ts` dan
> `ForumJoinOverlay`/`components/akun/forum-join-overlay.tsx`. Nama SEBENARNYA di kode setelah
> eksekusi (di-generalisasi ke semua tipe tenant, bukan cuma forum) adalah
> `checkMemberEligibility()`/`lib/member-eligibility.ts` dan
> `MembershipEligibilityOverlay`/`components/akun/membership-eligibility-overlay.tsx` — lihat
> lesson CLAUDE.md `[2026-07-24] Eligibility Overlay Digeneralisasi ke Semua Tipe Tenant + Rename
> Total`. Bagian di atas SENGAJA tidak di-rename ulang di sini (murni catatan sejarah rencana,
> bukan referensi operasional) — kalau butuh nama fungsi/file yang benar-benar dipakai sekarang,
> rujuk ke lesson itu, § "Audit Sinkronisasi Arsitektur ↔ Kode Aktual" di bagian bawah dokumen
> ini, atau ke kode langsung — bukan ke teks §1/§5/§6 di atas.

### UI `/gabung` — Fixed Footer Tombol Gabung + Revert Percobaan "Tanpa Navigasi" (2026-08-06)

**Permintaan awal user, dua poin**: (1) "tidak pernah meninggalkan laman ini, tetap di satu
halaman gabung" — dibaca sebagai instruksi untuk membuat SELURUH alur (termasuk kartu
produk/donasi syarat wajib) tidak pernah navigasi keluar `/gabung`; (2) checkbox persetujuan +
tombol "Ya, Saya Ingin Bergabung" (`JoinForumButton`) di mobile harus jadi **fixed bottom bar**
yang meng-override fixed footer lain kalau ada, dengan z-index yang benar, dan **tidak pernah
hilang**.

**Percobaan pertama (kemudian di-REVERT sebagian)**: dibangun `RequiredProductItem`/
`RequiredCampaignItem` (`gabung-required-item.tsx`, baru) — kartu produk/donasi syarat wajib
diubah dari `<a href>` navigasi jadi widget inline yang memanggil `addToCartAction` langsung
(pola persis `donation-banner-cart.tsx`: nominal chip+custom input untuk donasi, quick-add
untuk produk simple; produk BERVARIASI tetap harus ke halaman detail — satu-satunya
pengecualian, belum ada picker atribut inline di mana pun di codebase). `JoinForumButton`
diubah: tidak lagi `window.location.href` redirect otomatis setelah join sukses (tampil status
sukses inline + tombol "Ke Akun Saya →" eksplisit), dan checkbox+tombol dirender DUA KALI
(desktop `hidden md:block` normal, mobile `md:hidden fixed bottom-0 z-[72]` — satu tingkat di
atas `MobileActionSheet` yang z-[71], bar tertinggi yang sudah ada di codebase, supaya menang
atas fixed footer lain kalau ada) dengan id unik per instance (`gabung-agreed-desktop`/
`gabung-agreed-mobile`, cegah duplikat `id`/`htmlFor` di DOM) dan spacer yang diukur via
`ResizeObserver` (bukan angka tetap — teks persetujuan bisa wrap 2-3 baris tergantung lebar
layar).

**User menegur scope-creep**: "mana tombol gabungnya gk muncul.. saya bilang jangan lakukan
lainnya selain mengubah tombol gabung berada di footer fixed seperti ketika transaksi
ditempat lain." Investigasi menemukan **root cause bukan bug** — tenant `forcreator` sedang
`paymentRequired=true` di config `membership_config`, dan pada kondisi itu `JoinForumButton`
**MEMANG TIDAK PERNAH dirender sama sekali** — ini perilaku YANG SUDAH ADA sejak Fase D (lihat
§4 di atas), bukan regresi sesi ini: kalau pembayaran wajib, keanggotaan aktif OTOMATIS lewat
hook `activateForumMembershipIfApplicable` saat invoice lunas, bukan lewat klik tombol manual.
User kemungkinan sedang menguji state itu dan mengira tombolnya hilang karena bug.

**Fix — revert sebagian, bukan tambal**: kartu produk/donasi syarat wajib DIKEMBALIKAN ke
`<a href>` navigasi sederhana (foto + judul + CTA yang link ke `/produk/{slug}?forGabung=1` /
`/campaign/{slug}?forGabung=1`) — PERSIS bentuk sebelum percobaan "tanpa navigasi". File
`gabung-required-item.tsx` DIHAPUS TOTAL (bukan disimpan/dikomentari — sudah tidak dipakai).
Field tambahan yang cuma dibutuhkan widget inline itu (`productType`/`price` di query produk,
fetch `donation_config.recommended_amounts`) juga dilepas dari `page.tsx`. **Yang DIPERTAHANKAN**
(karena memang bagian dari permintaan "tombol gabung di footer fixed"): seluruh perubahan
`JoinForumButton` — fixed mobile bar, no-redirect success state, id unik per instance,
ResizeObserver spacer. Sebagai langkah unblock TESTING (bukan keputusan produk permanen), config
`forcreator.membership_config.paymentRequired` DISET SEMENTARA ke `false` supaya user bisa
langsung melihat/menguji tombol yang dimaksud — bisa di-toggle balik lewat
`/app/forcreator/settings/keanggotaan` kapan saja.

**Diverifikasi**: `tsc --noEmit` bersih (2×, sebelum+sesudah revert) + `bun run build
--filter=@jalajogja/web` genuine sukses (2×). Curl dengan session cookie asli (signed HMAC,
`token.base64(HMAC-SHA256(BETTER_AUTH_SECRET, token))`, url-encoded — bukan raw token, Better
Auth menolak raw token tanpa signature) mengonfirmasi struktur HTML: `z-[72]` fixed bar hadir,
2 checkbox id unik, tombol "Ya, Saya Ingin Bergabung" muncul 2× (desktop+mobile), teks "Beli
Sekarang"/widget inline TIDAK ADA lagi (revert berhasil), dan hanya SATU elemen
`fixed bottom-0` di seluruh halaman (tidak ada BottomNav situs bentrok — `/gabung` sudah masuk
`isSingleMobileRoute()` sejak awal, `FooterBottomNav` otomatis tidak dirender di sana). Nol
migrasi DB. **Belum diverifikasi visual sungguhan di browser oleh siapa pun** (klaim "tombol
tidak muncul" dari user sebelumnya BELUM dikonfirmasi ulang setelah fix — perlu dicoba lagi
setelah `paymentRequired` di-set `false`).

**Aturan yang ditegaskan**: instruksi "tidak pernah meninggalkan halaman ini" yang terdengar
ABSOLUT ternyata, setelah diklarifikasi user, HANYA berlaku untuk perilaku tombol "Gabung" itu
sendiri (tidak auto-redirect setelah sukses) — BUKAN untuk seluruh flow pembayaran/pemilihan
produk-donasi (yang tetap boleh navigasi ke halaman detail, sesuai desain lama). Kalau instruksi
serupa terdengar luas/arsitektural di sesi mendatang, JANGAN langsung membangun solusi paling
literal/luas — pertimbangkan interpretasi SEMPIT yang sudah cocok dengan pola established
(`donation-banner-cart.tsx` toh SUDAH punya presedan "produk simple inline, produk variasi tetap
navigasi") sebelum membangun sistem baru, dan kalau ragu skala dampaknya besar, PERKECIL dulu
scope draft pertama sebelum eksekusi penuh.

---

## Skenario Historis: Ahmad Bergabung ke Forum Bisnis IKPM (v1-era, superseded)

> Bagian di bawah adalah bagian dari narasi "Alur Skenario — Simulasi Kehidupan Nyata" di
> `docs/arsitektur-backbone-ikpm.md` (skenario umum lintas cabang/marhalah/forum) — hanya
> Skenario 3 (spesifik forum) yang dipindah ke sini. Skenario ini ditulis SEBELUM v2 ada dan
> menggambarkan asumsi lama ("data usaha muncul otomatis begitu login ke domain forum") yang
> TIDAK PERSIS sama dengan alur v2 sungguhan (yang sekarang mengecek kelayakan dulu, baru
> menampilkan tombol join eksplisit di halaman terpisah `/gabung` — lihat § "4. Alur End-to-End"
> di atas untuk alur yang benar-benar berjalan sekarang). Dipertahankan sebagai ilustrasi
> historis niat awal, bukan rujukan operasional.

```
Ahmad (sudah terdaftar di PC IKPM Yogyakarta + Marhalah 2005) buka
forbis-ikpm.jalakarta.com:

HALAMAN UTAMA FORUM — menampilkan:
  "Anda sudah terdaftar sebagai Alumni IKPM Gontor."
  "Login sebagai Pak Ahmad?"  [Ya, Login]

Setelah login:
  "Bergabunglah dengan Forum Bisnis IKPM"
  Tampil: data usaha Ahmad yang sudah ada (Toko Batik, PT. XYZ, dll)
  "Data ini akan terlihat oleh sesama anggota forum."
  [Konfirmasi & Daftar ke Forum Bisnis]

Klik konfirmasi:
  → INSERT tenant_memberships { tenant_id: forbis-ikpm,
                                  member_id: ahmad.id,
                                  registered_via: 'self',
                                  membership_type: 'forum' }

Ahmad langsung bisa akses:
  → Direktori anggota Forum Bisnis (tampilkan usaha sesama anggota)
  → Event dan webinar Forum Bisnis
  → Konten forum

TIDAK ADA SATU PUN DATA YANG PERLU DIKETIK ULANG.
Seluruh identitas + usaha + pesantren sudah tersedia dari data cabang/marhalah.
```

---

## Roadmap Historis — Phase 4 Checklist Lama (v1-era, basi)

> Checklist di bawah ini BASI — dari desain v1 yang sudah di-supersede oleh § "Alur Pendaftaran
> Forum v2" di atas. Dipertahankan sebagai catatan sejarah saja (semula ada di
> `docs/arsitektur-backbone-ikpm.md` § "Roadmap Implementasi" > "Phase 4").

- [ ] ~~Halaman buat tenant forum (`/app/create-tenant?type=forum`)~~ (di luar scope v2 — buat
      tenant forum sudah bisa lewat `/platform/tenants/new`, ini soal PENDAFTARAN ANGGOTA-nya)
- [ ] ~~`settings/membership` — form konfigurasi mode pendaftaran (free/paid/infaq)~~ → diganti
      `/app/{slug}/settings/keanggotaan` di v2 (produk/campaign + toggle wajib, bukan 3 mode)
- [ ] ~~Halaman publik pendaftaran `/{forum}/daftar` — data pre-filled, pilih nominal~~ → diganti
      `/gabung` di v2 (tanpa form baru, murni gate kelayakan + reuse cart checkout)
- [ ] ~~`joinForumAction` — buat membership + invoice (integrasi billing)~~ → diganti hook di
      `confirmInvoicePaymentAction`/`verifySubmittedPaymentAction` yang sudah ada (v2 §4)
- [ ] ~~`onForumInvoicePaid` hook di `syncInvoicePayment()`~~ → sama seperti di atas
- [ ] Admin `/{slug}/members?type=forum` — list + filter pending/active/suspended (BELUM
      dibahas ulang di v2, kemungkinan tetap relevan tapi belum direncanakan detail)
- [ ] Iuran tahunan: cron reminder H-7 + suspend H+30 via `lib/whatsapp.ts` (v2 § 7 poin 4 —
      sengaja di luar scope MVP pertama)
- [ ] `require_approval` flow: admin approve sebelum invoice dikirim (TIDAK ada di v2 — v2
      tidak punya konsep approval admin, aktivasi otomatis begitu syarat+pembayaran terpenuhi)
- [ ] WA template: `forum_welcome`, `forum_renewal_reminder`, `forum_suspended` (belum dibahas
      di v2, kemungkinan besar relevan ditambahkan saat Fase D/E v2 dieksekusi)

---

## Audit Sinkronisasi Arsitektur ↔ Kode Aktual (2026-08-06)

Dilakukan saat memindahkan dokumen ini keluar dari `arsitektur-backbone-ikpm.md` — setiap file
inti dibaca langsung (bukan diasumsikan dari teks historis di atas) untuk memverifikasi
implementasi v2 masih benar-benar berjalan seperti yang direncanakan. Hasilnya: **implementasi
SUDAH SINKRON dengan arsitektur v2 di hampir semua bagian**, dengan **satu drift signifikan**
pada syarat kelayakan (eligibility) — kode sudah berkembang lebih jauh dari yang tertulis di
rencana aslinya, bukan menyimpang darinya.

### Drift nyata: syarat kelayakan sudah lebih ketat & lebih general dari yang didokumentasikan

Rencana § "1. Syarat Kelayakan" (ditulis 2026-07-23) menyebut 11 field
(`gender`/`birthDate`/`graduationYear`/`graduationPeriod`/`professionId`/`waliSantri`/
`primaryCabangRefId`/`domicileStatus`/`phone`/`whatsapp`/`email`) plus satu cek direktori
("punya minimal 1 baris" di `member_businesses`/`member_owned_pesantren`/`member_professionals`).

**Kode aktual di `apps/web/lib/member-eligibility.ts` (dibaca penuh 2026-08-06) berbeda dalam 5
hal, semuanya PENAMBAHAN/PENGETATAN, bukan pengurangan:**

1. **Field baru `homeAddressId`** — tidak ada di rencana asli sama sekali. Dicek terpisah dari
   `domicileStatus` (kategori Tetap/Sementara BUKAN alamat sesungguhnya) — supaya anggota hasil
   import massal (yang `domicileStatus` dan alamat di-parse independen per kolom Excel) tidak
   lolos "eligible" tanpa alamat tersimpan sungguhan.
2. **Cek "directory" sekarang mensyaratkan KELENGKAPAN penuh, bukan cuma "punya baris"** — tiga
   fungsi privat baru (`checkUsahaComplete`/`checkPesantrenComplete`/`checkProfesionalComplete`)
   masing-masing memvalidasi SET FIELD WAJIB PERSIS SAMA dengan validasi client-side self-service
   form (`usaha-client.tsx`/`pesantren-client.tsx`/`profesional-client.tsx`). Member yang punya 1
   baris usaha tapi belum isi semua field wajibnya (mis. hasil import massal, atau baru mulai
   isi) TETAP dianggap belum lengkap — beda dari rencana asli yang cuma cek `EXISTS`.
3. **Parameter baru `enabledDirectoryModules`** — integrasi dengan sistem toggle per-tenant
   modul Usaha/Pesantren/Profesional (`lib/ekosistem-modules.ts`, `docs/arsitektur-ekosistem.md`
   — fitur yang belum ada saat rencana v2 pertama ditulis). Syarat "directory" jadi OR HANYA
   terhadap modul yang aktif untuk tenant yang sedang diproses; kalau tenant matikan semua 3
   modul, syarat ini di-skip total.
4. **Return field baru `directoryIncompleteModule`** — kalau member sudah MULAI isi satu modul
   tapi belum lengkap, field ini menunjuk modul itu supaya UI bisa arahkan langsung ke situ
   ("Lengkapi Data Usaha Anda") alih-alih menyuruh pilih ulang dari 3 opsi.
5. **File ini SEKARANG jadi rumah untuk helper yang TIDAK ADA HUBUNGANNYA dengan forum sama
   sekali** — `checkGeneralRegistrationEligibility()`/`checkProfileComplete()`, dipakai
   khusus Toggle B "Wajib Terdaftar (Umum)" di modul Event (gate tiket, bukan gate forum).
   `checkMemberEligibility()` sendiri sekarang jadi helper GENERIK lintas-fitur (forum join +
   event ticket gate + eligibility overlay `/akun` untuk cabang/marhalah), bukan helper
   khusus-forum seperti nama rencananya (`checkForumEligibility`) menyiratkan.

**Kesimpulan**: bagian §1 rencana v2 di atas TIDAK PERLU dikoreksi teksnya (dipertahankan sebagai
catatan sejarah keputusan awal, sudah diberi peringatan blockquote di tempatnya) — field list
yang BENAR untuk dipakai sekarang adalah SELURUH poin 1–5 di atas, bukan daftar 11 field di §1a.

### Titik lain yang diverifikasi SINKRON PENUH (tidak ada drift)

- **`apps/web/app/(public)/[tenant]/gabung/page.tsx`** — struktur 4-state (bukan-member →
  sudah-anggota → belum-eligible → eligible×{paymentRequired?}) sesuai dokumen. Kartu produk/
  campaign syarat wajib sudah kembali ke `<a href>` navigasi sederhana pasca-revert 2026-08-06
  (bukan widget inline). `JoinForumButton` dirender sebagai elemen PALING TERAKHIR di branch
  `!paymentRequired`, dengan komentar eksplisit menjelaskan kenapa (spacer self-contained bar
  fixed). Query eligibility memakai `enabledModulesArr` dari `getEnabledEkosistemModules()` —
  konsisten dengan drift #3 di atas.
- **`apps/web/app/(public)/[tenant]/gabung/actions.ts`** (`joinForumAction`) — urutan guard
  persis sesuai dokumen: session → identity member → tenant forum → eligibility (re-cek
  server-side, dengan `enabledModulesArr`) → `paymentRequired` guard (tolak kalau true) →
  UPSERT manual (SELECT dulu, baru UPDATE/INSERT) → generate nomor keanggotaan forum (guard
  "generate sekali saja"). Tidak ada `window.location.href` redirect di sini (sesuai fix
  2026-08-06 — redirect dipindah ke client, opsional lewat tombol "Ke Akun Saya →").
- **`apps/web/app/(public)/[tenant]/gabung/join-forum-button.tsx`** — sesuai § "UI /gabung —
  Fixed Footer..." di atas: `z-[72]` fixed bar mobile, `id` unik per instance
  (`gabung-agreed-desktop`/`gabung-agreed-mobile`), `ResizeObserver` untuk tinggi spacer, status
  sukses inline tanpa auto-redirect.
- **`apps/web/components/akun/membership-eligibility-overlay.tsx`** (`MembershipEligibilityOverlay`,
  rename dari `ForumJoinOverlay`) — sudah menjalankan generalisasi PENUH: prop `isForum`
  (cabang/marhalah vs forum framing berbeda), `isJoined` (fix bug "sebelum dapat mendaftar" untuk
  anggota yang sudah aktif — CLAUDE.md lesson `[2026-08-01]`), `directoryIncompleteModule` +
  `enabledModules` (integrasi ekosistem toggle). 4 kondisi tombol sesuai § "Refinement
  ForumJoinOverlay" di atas, DITAMBAH pembedaan framing pesan `isJoined` yang belum ada saat
  refinement itu ditulis.
- **`apps/web/app/(dashboard)/app/[tenant]/settings/actions.ts`** — `MembershipConfigData` type
  berisi PERSIS 6 field: `requiredProductId`, `requiredCampaignId`, `paymentRequired`,
  `requireMode`, `registrationInfo`, `membershipNumberFormat`. `saveMembershipConfigAction`
  guard `tenantType==="forum"`, `revalidatePath` ke settings DAN `/gabung`. Sesuai dokumen.
- **`apps/web/app/(dashboard)/app/[tenant]/settings/keanggotaan/page.tsx`** +
  **`components/settings/membership-config-form.tsx`** — guard redirect non-forum, fetch
  config+produk+campaign aktif paralel, form lengkap (textarea info, 2 Combobox, checkbox
  paymentRequired kondisional `anyConfigured`, toggle requireMode kondisional `bothConfigured`,
  toggle+picker nomor keanggotaan dengan SEMUA 4 preset — termasuk `joinyear_gradyear_seq` yang
  ditambahkan 2026-07-28). Sesuai dokumen.
- **`apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts`**
  (`activateForumMembershipIfApplicable`) — dipanggil dari KEDUA `confirmInvoicePaymentAction`
  DAN `verifySubmittedPaymentAction`, keduanya dibungkus try/catch non-fatal terpisah (dikonfirmasi
  via grep — pesan log `"aktivasi forum gagal (non-fatal)"` di kedua titik). Guard urutan sesuai
  dokumen: tenant forum → `paymentRequired` → ada produk/campaign dikonfigurasi → item invoice
  match itemType+itemId+**`forGabungRegistration===true`** (fix "Pemisahan Donasi vs Registrasi
  Forum" terbukti live di kode) → `requireMode` either/both → **`checkMemberEligibility()`
  dipanggil ULANG** (keputusan "payment saja tidak cukup" terbukti live) → UPSERT +
  generate nomor keanggotaan (reuse generator yang sama, guard sekali-saja yang sama).
  `MembershipConfig` type di file ini adalah ALIAS import (`as MembershipConfig`) dari
  `MembershipConfigData` di `settings/actions.ts` — bukan salinan independen, sesuai dokumen
  ("didefinisikan SATU KALI... diimpor SEBAGAI TYPE").
- **`apps/web/lib/forum-membership-number.ts`** + **`.server.ts`** — split client-safe/server-only
  sesuai dokumen, 4 preset (`year_seq`/`year_birthdate_seq`/`month_year_seq`/
  `joinyear_gradyear_seq`) semuanya ada, `formatForumMembershipNumber()` pure function persis
  sesuai spec masing-masing format, `generateForumMembershipNumber()` pakai `SELECT ... FOR
  UPDATE` atomic pada `forumMembershipSequences`, fetch `birthDate`+`graduationYear` sekaligus
  tanpa kondisi (sesuai catatan refactor "hindari nambah cabang if setiap preset baru").
- **`apps/web/app/(public)/[tenant]/akun/page.tsx`** — wiring `checkMemberEligibility` +
  `getEnabledEkosistemModules` + `MembershipEligibilityOverlay` (dengan `isJoined`,
  `isForum`, `enabledModules` props) terkonfirmasi ada dan konsisten dengan seluruh drift #3-#5
  di atas plus fix bug `[2026-08-01]`.
- **Schema & migrasi**: `public.tenant_memberships` punya kolom `membershipType`, `forumStatus`,
  `forumInvoiceId`, `approvedAt`, `expiresAt`, `membershipNumber` — semua ada
  (`packages/db/src/schema/public/tenant-memberships.ts`). `cart_items` DAN `invoice_items`
  punya kolom `forGabungRegistration` (`packages/db/src/schema/tenant/billing.ts`). `"forum"`
  ada di `SETTING_GROUPS` (`packages/db/src/schema/tenant/settings.ts`) DAN di DDL CHECK
  constraint (`packages/db/src/helpers/create-tenant-schema.ts`). Ketiga file migration yang
  didokumentasikan (`0042_settings_group_forum.sql`, `0045_forum_membership_number.sql`,
  `0046_for_gabung_registration.sql`) ada di `packages/db/migrations/`.

### Yang BELUM bisa diverifikasi dari sesi audit ini

- **Status deploy ke VPS** — tidak ada akses SSH dari environment audit ini. Beberapa bagian
  historis di atas menyatakan "belum dijalankan di VPS" untuk migration `0045`/`0046` — status
  ini TIDAK diverifikasi ulang di audit 2026-08-06, murni dibawa apa adanya dari catatan
  terakhir. Cek `git log`/`psql` di VPS langsung kalau butuh kepastian.
- **Verifikasi visual/end-to-end di browser sungguhan** — Fase E (§ "Urutan Eksekusi") masih
  `⬜ BELUM` sampai audit ini ditulis. Semua klaim "sesuai dokumen" di atas murni verifikasi
  STRUKTURAL (baca kode + `tsc`/build + curl dengan session cookie tersimulasi) — belum ada
  satu pun konfirmasi dari user bahwa alur ini benar-benar terlihat/berfungsi benar di browser
  nyata mereka.
- **Cron/reminder iuran tahunan** (`expiresAt`) — dikonfirmasi TIDAK ADA implementasinya sama
  sekali (sesuai § 7 poin 4, "sengaja di luar scope MVP pertama") — tidak digali lebih jauh
  karena memang belum pernah diklaim sudah dibangun.

---

## Redesain /gabung — Widget Inline (Donasi/Produk) + Syarat Per-Item Eksplisit (2026-08-06)

> **Status: ✅ FASE A–D DIEKSEKUSI (2026-08-06, "mode hemat + mode otomatis").** Seluruh kode di
> § 5–13 sudah ditulis persis sesuai rencana ini (1 deviasi kecil non-arsitektural: popup produk
> menghitung harga member-tier langsung inline alih-alih membangun objek `ProductCardData` penuh
> untuk memanggil `resolvePrice()` — hasil akhir identik, cuma implementasi lebih ringkas).
> `tsc --noEmit` 0 error di `apps/web` DAN `packages/db`. `bun run build --filter=@jalajogja/web`
> genuine sukses (dev server dimatikan+`.next` dibersihkan sebelum build, `Cached: 0 cached`,
> rute `/[tenant]/gabung` 6.88 kB terkonfirmasi di output). Grep akhir `paymentRequired|
> requireMode` di seluruh `apps/web` — nol sisa di kode, cuma komentar penjelas yang sudah
> disesuaikan. **Fase E (verifikasi manual di browser) BELUM dilakukan** — butuh tenant forum +
> member eligible + produk (idealnya salah satu variable) + campaign nyata, di luar kapasitas
> environment sesi ini (tidak ada browser). **Belum di-commit/push ke git, belum dijalankan di
> VPS** (nol migrasi DB — deploy cukup `git pull && bun run build --filter=@jalajogja/web && pm2
> restart jalajogja --update-env` begitu di-commit+push).

### 1. Instruksi User (ringkas, verbatim inti dipertahankan)

Lima poin alur baru untuk `/gabung`:
1. Eligibilitas (`checkMemberEligibility`) sudah benar — TIDAK diubah. Begitu eligible, user bisa
   lanjut ke `/gabung`.
2. `/gabung` harus berperilaku seperti laman **cart event** (`/keranjang` +
   `DonationBannerCart`) ketika ada rekomendasi donasi dan/atau produk.
3. Klik "Donasi" **tidak pernah** meninggalkan `/gabung` — nominal ditambahkan ke cart di
   belakang layar (server action), halaman tetap sama.
4. Klik "Produk" membuka **popup** untuk pilih variasi (kalau ada) — halaman tetap `/gabung`,
   tidak pernah navigasi keluar. Ini kapabilitas BARU — sebelumnya produk variasi selalu
   navigasi keluar ke `/produk/{slug}` (lihat `DonationBannerCart`, § "Riset Kunci" di bawah).
5. Centang checkbox persetujuan → tombol "Ya, Saya Ingin Bergabung" menyala/aktif → klik → masuk
   ke laman checkout → lanjut ke laman verifikasi pengiriman invoice. (Skenario ini untuk kondisi
   donasi/produk **diwajibkan**.)

**Masalah inti yang harus diselesaikan**: di `/app/{slug}/settings/keanggotaan`, saat ini TIDAK
JELAS item mana yang benar-benar wajib ketika toggle "Wajibkan pembayaran" dicentang — kalau
KEDUA slot (produk + campaign) terisi, sistem lama menawarkan `requireMode: "either"` (salah
satu cukup) yang secara implisit berarti **anggota baru boleh MEMILIH** mau bayar produk ATAU
donasi. User eksplisit: *"user tidak dikasih pilihan mau donasi atau beli produk, tetapi jika
wajib salah satu maka admin harus menentukan yang mana yang wajib."* — admin yang memutuskan
item spesifik mana yang wajib, BUKAN pengguna yang memilih saat mendaftar.

Tiga meta-instruksi yang mengikat proses (bukan hasil):
- Bangun dulu arsitekturnya untuk mengakomodasi produk dan/atau donasi yang direkomendasikan.
- Cek UI cart event dulu, supaya tampilan donasi/produk di `/gabung` konsisten dengan itu.
- **Jangan eksekusi apa pun sebelum rencana ini lengkap dan ditulis di sini.**

### 2. Riset Kunci (kode yang benar-benar dibaca, bukan asumsi)

- **`apps/web/app/(public)/[tenant]/keranjang/page.tsx`** (Server Component, 375 baris) — pola
  referensi "laman cart": `<CartClient>` (item + Total + tombol checkout, desktop) →
  `<DonationBannerCart>` (rekomendasi inline, kondisional) → `<CartMobileBar>` (elemen PALING
  TERAKHIR, sesuai aturan spacer `docs/arsitektur-mobile-shell.md`). `donationBanners.amounts`
  diambil dari `getSettings(tenantDb,"donasi").donation_config.recommended_amounts`, fallback
  `[10000, 25000, 50000, 100000]` — SATU sumber nominal donasi tenant-wide, bukan per-campaign.
  `productAlreadyInCart` (baris ±287–299) sudah punya pola "variation-aware check": kumpulkan
  `variationIds` milik `productIdFromEvent` dulu, lalu `relevantIds = new
  Set([productIdFromEvent, ...variationIds])`, baru cek cart terhadap set itu — pola INI yang
  dipakai ulang untuk cek "item wajib sudah di cart?" di `/gabung` (§ 8).
- **`apps/web/components/billing/cart-client.tsx`** + **`cart-mobile-bar.tsx`** — tombol
  "Konfirmasi Detail" (bukan "Lanjut ke Checkout" — beda label dari yang saya kira sebelumnya)
  adalah `<a href={`/${slug}/checkout`}>` polos, styling `bg-primary text-primary-foreground
  rounded-md px-4 py-3`. Tidak pakai `baseUrl` (hardcode `/${slug}` — pola lama pra-custom-domain,
  TIDAK diikuti untuk komponen baru, lihat § 3).
- **`apps/web/components/event/public/donation-banner-cart.tsx`** (`DonationBannerCart`, 221
  baris, dibaca penuh) — komponen referensi VISUAL untuk poin 2. Donasi: chip nominal + input
  custom + tombol "Donasi Rp X" → `addToCartAction({itemType:"donation", itemId:campaignId,
  unitPrice:nominal})` **TANPA** `forGabung` (selalu `false` implisit — pemakaian di
  `/keranjang` memang bukan konteks gabung forum). Produk simple: tombol "Tambah ke Keranjang"
  inline. **Produk variable: `<a href="/${tenantSlug}/produk/${slug}">Lihat & Pilih Variasi
  →</a>` — NAVIGASI KELUAR.** Ini persis gap yang harus ditutup untuk `/gabung` (poin 4).
- **`apps/web/app/(public)/[tenant]/checkout/page.tsx`** (309 baris, dibaca penuh) —
  `sellerGroups` HANYA dibangun dari `cartItems.filter(i => i.itemType === "product" && ...)`
  (baris 125–127, 217) — **donasi TIDAK PERNAH masuk seller-group/shipping**. Konsekuensi
  penting: kalau syarat wajib forum HANYA berupa campaign donasi (skenario paling umum, "iuran
  forum"), checkout dari `/gabung` otomatis LEWATI seluruh langkah shipping (kurir/COD/Ambil
  Sendiri) — `needsShipping = sellerGroups.length > 0` (`checkout-form.tsx` baris 95) akan
  `false`. Kalau syarat wajib berupa PRODUK BERBADAN FISIK, shipping tetap muncul seperti biasa
  (infrastruktur COD/Ambil Sendiri yang sudah ada — lihat rencana lama di
  `/Users/webane/.claude/plans/binary-questing-river.md`, sudah ter-implementasi penuh, TIDAK
  perlu disentuh sama sekali oleh redesain ini).
- **`checkoutAction`** (`cart/actions.ts` baris 515–…) — sudah 100% mendukung
  `forGabungRegistration` end-to-end tanpa perubahan apa pun: `resolvedItems[].
  forGabungRegistration` (baris 673, dari `cartItems[].forGabungRegistration`) → disimpan ke
  `invoice_items.forGabungRegistration` (baris 779). **Redesain ini TIDAK PERNAH menyentuh
  `checkoutAction`/`checkout/page.tsx`/`checkout-form.tsx` sama sekali** — cart universal sudah
  cukup, prinsip "billing universal" (`docs/arsitektur-billing.md`) dipatuhi penuh.
- **`checkout-form.tsx`** baris 216: `router.push(`/${slug}/invoice/${res.data.invoiceId}`)` —
  ini yang dimaksud "laman verifikasi pengiriman invoice" di poin 5. Halaman invoice publik
  (`invoice-public-client.tsx`, sudah ada, tidak disentuh) menangani upload bukti bayar +
  (kalau ada shipping) info kurir/resi.
- **`apps/web/app/(public)/[tenant]/gabung/join-forum-button.tsx`** (`JoinForumButton`, 156
  baris, dibaca penuh) — `AgreementFields` (checkbox + link ToS/Privacy) sudah jadi fungsi lokal
  TIDAK di-export, dirender dua kali (`idSuffix="desktop"`/`"mobile"`) untuk blok statis
  desktop vs fixed-bar mobile (`z-[72]`, `ResizeObserver`-measured spacer). Tombol memanggil
  `joinForumAction(slug)` langsung, TIDAK PERNAH auto-redirect (state `joined` tampil inline).
- **`apps/web/components/toko/public/product-detail-client.tsx`** (392 baris, dibaca penuh) —
  SATU-SATUNYA logic picking-variasi yang ada di codebase ini. `findVariation()`/
  `isValueAvailable()` (baris 47–70) adalah pure function murni (tidak butuh DB, mudah
  diduplikasi). `handleAddToCart()` (baris 163–188) **SUDAH** punya prop
  `forGabungRegistration?: boolean` (default `false`) yang diteruskan ke
  `addToCartAction(...,{forGabung: forGabungRegistration})` — infrastruktur `forGabung` di jalur
  produk SUDAH ADA sejak fitur `?forGabung=1` di URL produk dibangun (§ "Alur v2" di atas),
  tinggal dipakai lewat jalur BARU (popup), bukan lewat query-param+navigasi.
- **`apps/web/app/(public)/[tenant]/produk/[productSlug]/page.tsx`** (378 baris, dibaca penuh)
  — bentuk fetch LENGKAP untuk data variasi: baris 145–184 (fetch `product_variations`,
  fallback harga variasi ke harga induk `String(v.price ?? row.price)` — WAJIB direplikasi
  persis, ini titik yang gampang salah kalau ditulis ulang dari nol). `/gabung` TIDAK butuh
  bagian lain di file ini (deskripsi, related products, SEO archive-design) — hanya subset
  variasi+atribut+gambar untuk SATU produk (yang dikonfigurasi admin), bukan N produk.
- **`apps/web/components/akun/legal-modal.tsx`** (`LegalModal`, 68 baris) — pola Dialog publik
  yang SUDAH dipakai `JoinForumButton` (fetch lazy on-open + loading state). Dipertimbangkan
  sebagai pola untuk popup produk, TAPI **tidak dipakai** — lihat § 3 poin "Popup produk:
  eager-fetch, bukan lazy" untuk alasannya.
- **`activateForumMembershipIfApplicable()`** (`finance/billing/actions.ts` baris 674–769,
  dibaca penuh via subagent) — logic `satisfied` saat ini (baris 707–713):
  ```ts
  const hasProduct  = !!config.requiredProductId  && items.some(it =>
    it.itemType === "product"  && it.itemId === config.requiredProductId  && it.forGabungRegistration);
  const hasCampaign = !!config.requiredCampaignId && items.some(it =>
    it.itemType === "donation" && it.itemId === config.requiredCampaignId && it.forGabungRegistration);
  const bothConfigured = !!(config.requiredProductId && config.requiredCampaignId);
  const satisfied = bothConfigured
    ? (config.requireMode === "both" ? (hasProduct && hasCampaign) : (hasProduct || hasCampaign))
    : (hasProduct || hasCampaign);
  ```
  **BUG LATEN ditemukan saat riset ini** — lihat § 4.

### 3. Bug Laten Ditemukan: Produk Variasi Tidak Pernah Match di `activateForumMembershipIfApplicable`

`settings/keanggotaan/page.tsx` (baris 26–29) mengambil daftar produk untuk combobox admin TANPA
filter `productType` — admin BISA memilih produk `variable` sebagai `requiredProductId`. Tapi
`hasProduct` di atas membandingkan `it.itemId === config.requiredProductId` LANGSUNG. Untuk
produk `variable`, `invoice_items.itemId` (dan `cart_items.itemId`) selalu berisi ID **VARIASI**
(`product_variations.id`), BUKAN `products.id` induknya — pola ini dikonfirmasi di TIGA tempat
independen (`product-detail-client.tsx` baris 166: `itemId = isVariable ?
activeVariation?.id : product.id`; `keranjang/page.tsx`'s `resolveCartItemCovers` baris 58–75
komentar eksplisit soal ini; `checkout/page.tsz`'s `variationMap`/`resolvedProductIds` baris
162–178). Akibatnya: kalau admin menunjuk produk BERVARIASI sebagai syarat wajib, `hasProduct`
**TIDAK PERNAH `true`**, keanggotaan forum TIDAK PERNAH teraktivasi otomatis meski invoice
sudah lunas berisi variasi produk itu — silent failure, tidak ada error yang terlihat admin
maupun user.

**Ini bukan bug baru yang diperkenalkan redesain ini** — sudah ada sejak `activateForumMembership
IfApplicable` pertama dibuat (Fase D lama, sebelum sesi ini). Tapi karena tujuan redesain ini
justru MEMPERMUDAH memilih produk bervariasi (popup, bukan navigasi manual), bug ini WAJIB
ditutup bersamaan — kalau tidak, fitur baru akan terasa "berhasil ditambahkan ke cart" tapi
keanggotaan tidak pernah aktif, membingungkan user parah. Fix (§ 8) murni perluasan query, tidak
mengubah bentuk `satisfied`.

### 4. Prinsip Desain yang Dikunci

Keputusan berikut SAYA tetapkan sebagai bagian dari "bikin arsitekturnya" (instruksi eksplisit
user) — bukan pertanyaan blocking yang perlu dijawab user dulu. Semua didokumentasikan dengan
alasan supaya bisa dikoreksi user sebelum eksekusi kalau ada yang keliru.

1. **Hapus total konsep "either" (salah satu boleh dipilih user).** `paymentRequired: boolean`
   (satu flag umbrella) + `requireMode: "either"|"both"` diganti **dua flag independen**:
   `productRequired: boolean` dan `campaignRequired: boolean`, masing-masing HANYA relevan kalau
   slot ID-nya terisi (`requiredProductId`/`requiredCampaignId`). Admin menentukan status wajib
   PER ITEM secara eksplisit — tidak ada lagi mode "salah satu cukup" yang membuka pilihan ke
   user. Kalau admin centang KEDUA `productRequired` dan `campaignRequired`, otomatis berarti
   "wajib keduanya" — tidak perlu selector terpisah untuk itu (satu-satunya kombinasi mungkin
   selain "salah satu wajib" atau "tidak ada yang wajib").
2. **Satu komponen widget untuk donasi/produk, dipakai di mode wajib MAUPUN opsional.** Poin 2
   instruksi user ("laman gabung seperti laman cart event") dibaca sebagai: kapan pun ada
   produk/campaign dikonfigurasi (wajib ATAU sekadar rekomendasi), tampilkan dengan gaya inline
   `DonationBannerCart` — bukan cuma untuk skenario wajib. Ini menyederhanakan `/gabung/page.tsx`
   (satu widget, satu prop `required: boolean` untuk mengubah copy/gating), dan otomatis
   menutup gap navigasi-keluar produk-variasi untuk KEDUA skenario sekaligus (bukan cuma yang
   wajib).
3. **`DonationBannerCart` dan `/keranjang` TIDAK DISENTUH SAMA SEKALI.** Komponen baru untuk
   `/gabung` (§ 6, § 7) dibangun BERDIRI SENDIRI, meniru visual/interaksi `DonationBannerCart`
   (disalin, bukan di-import/diperluas) — konsisten pola "duplikasi demi isolasi" yang sudah
   berkali-kali dipakai project ini untuk kode dengan lifecycle berbeda (lihat
   `generateEventRegNumber`, `formatEventDateWib`, notifikasi WA, dst di `CLAUDE.md`). Alasan
   konkret: mengubah `DonationBannerCart` (dipakai `/keranjang`, konteks cross-sell tiket event —
   TIDAK terkait forum sama sekali) demi kebutuhan forum berisiko regresi di jalur yang sudah
   stabil dan sedang tidak diminta user untuk disentuh. Kalau nanti user MAU popup-variasi juga
   dipakai di `/keranjang`, itu keputusan terpisah, follow-up eksplisit — bukan diam-diam
   dilakukan sebagai efek samping task ini (lihat lesson `feedback_no_scope_creep_in_audits`).
4. **Popup produk: eager-fetch server-side, BUKAN lazy-fetch client-side.** Beda dari
   `LegalModal` (fetch saat dialog dibuka, karena kontennya bisa besar/HTML sembarang dan
   dipakai berulang untuk template berbeda) — `/gabung` HANYA PERNAH punya NOL ATAU SATU produk
   dikonfigurasi (`config.requiredProductId`, satu ID tetap). Data variasi produk itu (jumlah
   variasi biasanya kecil, < 20 baris) di-fetch SEKALI oleh `/gabung/page.tsx` (Server
   Component) bersamaan dengan fetch lain yang sudah ada di situ, diteruskan sebagai props ke
   popup. Ini menghilangkan kebutuhan API route/server action baru untuk fetch data, dan
   menghilangkan loading-spinner state di popup (data sudah ada saat dialog dibuka).
5. **Gating tombol "Ya, Saya Ingin Bergabung" (mode wajib): checkbox DAN item wajib sudah ada di
   cart — bukan checkbox saja.** Instruksi user poin 5 secara harfiah hanya menyebut checkbox
   sebagai pemicu tombol aktif, tapi seluruh urutan poin 2–5 menyiratkan alur SEKUENSIAL: user
   menambahkan item wajib dulu (poin 3–4) BARU centang+klik (poin 5). Kalau tombol hanya
   digerbang checkbox (tanpa cek cart), user bisa skip menambahkan item wajib sama sekali lalu
   langsung ke checkout dengan cart kosong dari item forum — technically checkout tetap berhasil
   (invoice terbit), tapi keanggotaan TIDAK PERNAH aktif (settlement gagal diam-diam, persis
   kelas bug "silent failure" yang barusan ditemukan di § 3). Menggerbang tombol dengan
   `canProceed` (dihitung server-side dari isi cart SEKARANG, § 8) mencegah kebingungan ini
   sejak di UI, bukan baru ketahuan setelah bayar. Kalau user MAU tombol lebih longgar (checkbox
   saja), itu ubah satu boolean di komponen baru — tidak mengubah arsitektur data.
6. **Cek "item wajib sudah di cart?" via `forGabungRegistration=true` SAJA** — pola ini SIMETRIS
   persis dengan predikat settlement pasca-bayar (§ 9), supaya gating UI (sebelum bayar) dan
   settlement (setelah bayar) selalu sepakat mengenai apa yang dihitung "terpenuhi". Kalau user
   sudah punya campaign yang SAMA di cart dari kunjungan lain (misal donasi organik sebelum ke
   `/gabung`) TAPI baris itu `forGabungRegistration=false`, itu TIDAK dihitung sebagai
   "terpenuhi" — user tetap perlu klik "Donasi" lewat widget `/gabung` (yang menambah SATU baris
   baru bertanda `forGabung=true`, terpisah dari baris donasi organik lama, sesuai desain
   `addToCartAction`'s `itemId`-match-merge — baris yang SAMA `itemId` akan digabung quantity,
   TAPI kalau baris lama itu belum bertanda `forGabung=true`, `addToCartAction` (baris 403 di
   `cart/actions.ts`) akan MENANDAINYA `forGabung=true` retroaktif — jadi tetap benar, cuma satu
   baris, bukan dua).
7. **Bug produk-variasi (§ 3) ditutup sebagai bagian redesain ini**, bukan ticket terpisah —
   karena popup baru (§ 7) justru akan membuat skenario "syarat wajib = produk bervariasi" jauh
   lebih mudah dipakai admin, jadi WAJIB benar dari awal.
8. **Tidak ada migrasi DB baru.** `MembershipConfigData` disimpan di `tenant.settings` (key
   `"membership_config"`, group `"forum"`) sebagai JSONB — mengubah bentuk TypeScript-nya adalah
   perubahan KODE APLIKASI murni, bukan skema. Baris JSONB lama (`paymentRequired`/`requireMode`)
   yang sudah tersimpan di tenant manapun otomatis diabaikan field-nya begitu kode baru deploy
   (tidak dibaca lagi) — TIDAK ADA backward-compat/migrasi data yang perlu ditulis, karena field
   lama diganti field baru dengan default aman (`productRequired`/`campaignRequired` default
   `false` kalau tidak ada di JSONB lama, sesuai perilaku default JS untuk properti undefined).

### 5. Skema Baru: `MembershipConfigData`

Di `apps/web/app/(dashboard)/app/[tenant]/settings/actions.ts` (menggantikan definisi baris
1222–1235):

```ts
export type MembershipConfigData = {
  requiredProductId:  string | null;
  productRequired:    boolean; // hanya relevan kalau requiredProductId terisi
  requiredCampaignId: string | null;
  campaignRequired:   boolean; // hanya relevan kalau requiredCampaignId terisi
  registrationInfo: string | null;
  membershipNumberFormat: ForumMembershipNumberFormat | null;
};
```

`requireMode` dan `paymentRequired` **DIHAPUS TOTAL** dari type ini (bukan di-deprecate/
dipertahankan sebagai optional-tapi-tidak-dipakai — dihapus bersih, konsisten prinsip project
"jangan pertahankan backward-compat shim kalau bisa langsung diubah").

`saveMembershipConfigAction` (baris 1237–1264) disesuaikan — normalisasi server-side (jangan
percaya boolean dari client mentah-mentah, pola yang sudah dipakai di seluruh action publik
project ini):
```ts
await upsertSetting(tenantDb, "membership_config", "forum", {
  requiredProductId:  values.requiredProductId  || null,
  productRequired:    !!values.requiredProductId  && !!values.productRequired,
  requiredCampaignId: values.requiredCampaignId || null,
  campaignRequired:   !!values.requiredCampaignId && !!values.campaignRequired,
  registrationInfo:   values.registrationInfo?.trim() || null,
  membershipNumberFormat,
});
```

### 6. Redesain UI Admin — `membership-config-form.tsx`

Ganti blok "Wajibkan pembayaran" tunggal (baris 119–168 saat ini, termasuk seluruh selector
"Salah satu cukup" / "Wajib keduanya") dengan **checkbox terpisah di bawah masing-masing
combobox**, hanya muncul kalau slot ID-nya terisi:

```
Produk sebagai syarat iuran (opsional)
[Combobox produk]
  ☐ Wajibkan produk ini untuk anggota baru   ← muncul HANYA kalau productId terisi

Campaign/Donasi sebagai syarat iuran (opsional)
[Combobox campaign]
  ☐ Wajibkan campaign ini untuk anggota baru  ← muncul HANYA kalau campaignId terisi
  (Kosongkan keduanya kalau forum ini 100% gratis, tanpa ajakan bayar apa pun.)
```

Teks bantu (baru, ganti penjelasan requireMode lama): kalau KEDUA checkbox dicentang sekaligus,
tampilkan catatan kecil non-interaktif "Anggota baru wajib melengkapi KEDUA syarat di atas
sebelum bergabung." — murni informatif, tidak ada pilihan mode untuk diklik. State React lokal:
`productRequired`/`campaignRequired` (ganti `paymentRequired`/`requireMode`), auto-reset ke
`false` kalau combobox terkait dikosongkan (`useEffect` atau langsung di `onValueChange`
combobox — supaya tidak ada state "wajib" nyangkut untuk slot yang sudah dikosongkan).

### 7. Helper Terpusat Baru — `apps/web/lib/membership-config.ts`

Pure functions, client-safe (tidak ada import `@jalajogja/db`, aman diimpor dari Server
Component MAUPUN Client Component MAUPUN Server Action) — dipakai di TIGA titik (§ 8, § 10, § 11)
supaya definisi "wajib"/"terpenuhi" tidak drift antar titik (kelas bug yang sudah berulang kali
jadi masalah nyata di project ini — lihat lesson kode-unik/phone-normalization/dst):

```ts
// apps/web/lib/membership-config.ts
export type MembershipRequirementConfig = Pick<
  MembershipConfigData,
  "requiredProductId" | "productRequired" | "requiredCampaignId" | "campaignRequired"
>;

/** Ada syarat wajib apa pun untuk bergabung? */
export function hasPaymentRequirement(config: MembershipRequirementConfig | null): boolean {
  if (!config) return false;
  return (!!config.requiredProductId && config.productRequired)
      || (!!config.requiredCampaignId && config.campaignRequired);
}

/** Semua syarat yang ditandai wajib sudah terpenuhi? (AND murni per-item, bukan either/both). */
export function isRequirementSatisfied(
  config: MembershipRequirementConfig,
  has: { product: boolean; campaign: boolean },
): boolean {
  const productOk  = !config.requiredProductId  || !config.productRequired  || has.product;
  const campaignOk = !config.requiredCampaignId || !config.campaignRequired || has.campaign;
  return productOk && campaignOk;
}
```

Import type `MembershipConfigData` dari `settings/actions.ts` seperti pola yang sudah ada (lihat
§ "Alur v2" — `gabung/page.tsx`/`gabung/actions.ts` sudah mengimpor type ini lintas route-group).

### 8. Redesain Halaman `/gabung/page.tsx`

**Perubahan pada blok fetch produk/campaign (menggantikan baris 112–146 saat ini):**

- Hitung `anyRequired = hasPaymentRequirement(config)` (§ 7).
- Untuk `requiredProductId` (dipakai baik mode wajib maupun opsional-rekomendasi — § 4 poin 2):
  fetch product row LENGKAP (bukan cuma `name/slug/images` seperti sekarang) — tambah
  `productType, price, publicPrice, memberPrice, attributeGroups, stock`. Kalau `productType ===
  "variable"`, fetch JUGA `product_variations` (kolom persis sama dengan
  `/produk/[productSlug]/page.tsx` baris 150–167, termasuk fallback harga baris 173–183) DAN
  kumpulkan `variationIds` untuk dipakai di cek cart di bawah.
- Untuk `requiredCampaignId`: fetch `title/slug/coverId` (SAMA seperti sekarang) TAMBAH
  `amounts` dari `getSettings(tenantDb,"donasi").donation_config.recommended_amounts` (fallback
  `[10000,25000,50000,100000]` — persis pola `keranjang/page.tsx`).
- **Cek "sudah di cart?"** — query langsung ke `cart_items` milik session cart aktif (JANGAN
  lewat `getCartAction`/`CartItem` type, yang tidak expose `forGabungRegistration` — query
  manual seperti yang sudah dilakukan `keranjang/page.tsz`/`checkout/page.tsz`):
  ```ts
  const cartRows = token ? await tdb.select({
    itemType: schema.cartItems.itemType,
    itemId:   schema.cartItems.itemId,
    forGabungRegistration: schema.cartItems.forGabungRegistration,
  }).from(schema.cartItems)
    .innerJoin(schema.carts, eq(schema.carts.id, schema.cartItems.cartId))
    .where(eq(schema.carts.sessionToken, token)) : [];

  const productRelevantIds = new Set([config?.requiredProductId, ...variationIds].filter(Boolean));
  const productInCart  = cartRows.some(r => r.itemType === "product"  && r.forGabungRegistration && productRelevantIds.has(r.itemId ?? ""));
  const campaignInCart = cartRows.some(r => r.itemType === "donation" && r.forGabungRegistration && r.itemId === config?.requiredCampaignId);

  const canProceed = config ? isRequirementSatisfied(config, { product: productInCart, campaign: campaignInCart }) : true;
  ```
  (`token` = cookie `cart_session`, dibaca via `cookies()` sama seperti `keranjang/page.tsz` —
  `/gabung/page.tsz` belum pernah baca cookie ini sebelumnya, ini penambahan baru.)

**Perubahan render** (menggantikan baris 179–342 saat ini):

```
eligibility.eligible?
├─ ya:
│   anyRequired?
│   ├─ ya (mode wajib):
│   │    <GabungItemWidget product=... campaign=... required={true} />  (§ 9, keduanya kalau
│   │                                                                     dua-duanya wajib)
│   │    <GabungCheckoutButton slug baseUrl canProceed={canProceed} />  (§ 11)
│   │
│   └─ tidak (mode gratis, sama seperti sekarang tapi widget diganti):
│        {(supportProduct || supportCampaign) &&
│          <GabungItemWidget product=... campaign=... required={false} />}  (§ 9, decorative)
│        <JoinForumButton slug baseUrl tenantName />                        (TIDAK DIUBAH)
│
└─ tidak: (TIDAK BERUBAH — checklist "lengkapi data", sudah benar per instruksi user poin 1)
```

Helper lokal `extractCoverUrl()` (baris 20–24 saat ini) TETAP DIPAKAI, tidak berubah.

### 9. Komponen Baru — `GabungItemWidget`

File: `apps/web/app/(public)/[tenant]/gabung/gabung-item-widget.tsx` (client, colocated dengan
`join-forum-button.tsx` — konvensi route-colocated component yang sudah dipakai file itu sendiri).

```ts
type GabungItemWidgetProps = {
  tenantSlug: string;
  baseUrl:    string;
  required:   boolean; // ganti copy header: "Syarat Bergabung" (wajib) vs "Ingin mendukung? (opsional)"
  product?: {
    productId:   string;
    name:        string;
    coverUrl:    string | null;
    productType: "simple" | "variable";
    unitPrice:   number; // harga dasar produk (utk simple, add langsung)
    alreadyInCart: boolean;
    // HANYA terisi kalau productType === "variable" — eager-fetched di gabung/page.tsx (§ 8).
    variationData?: {
      variations: ProductVariationData[]; // reuse type dari product-detail-client.tsx
      attrGroups: AttributeGroup[];
      images:     ViewerImage[];
    };
  } | null;
  campaign?: {
    campaignId: string;
    title:      string;
    coverUrl:   string | null;
    amounts:    number[];
    alreadyInCart: boolean;
  } | null;
};
```

Perilaku (visual/interaksi disalin dari `DonationBannerCart`, TIDAK di-import — lihat § 4 poin
3):
- **Kartu donasi** (kalau `campaign` ada): chip nominal + input custom + tombol "Donasi
  Rp X" → `addToCartAction(tenantSlug, {itemType:"donation", itemId:campaignId, name:title,
  unitPrice:nominal, forGabung:true})`. Sukses → flash lokal "✓ Ditambahkan" (state lokal,
  seperti `DonationBannerCart`'s `donationAdded`) **DAN** `router.refresh()` (supaya
  `alreadyInCart`/`canProceed` di parent Server Component ikut ter-update — lihat § 4 poin 5).
  Kalau `campaign.alreadyInCart === true` (dari props awal), tampilkan badge "✓ Sudah
  ditambahkan" tanpa perlu klik apa pun.
- **Kartu produk simple** (`product.productType === "simple"`): tombol "Tambah ke Keranjang" →
  `addToCartAction(...,{itemType:"product", itemId:productId, unitPrice, forGabung:true})` →
  sama seperti donasi (flash + `router.refresh()`).
- **Kartu produk variable**: tombol "Pilih Variasi" → buka `<ProductVariationPopup>` (§ 10),
  MENGGANTIKAN link navigasi-keluar `DonationBannerCart` yang lama. Popup menerima
  `product.variationData` (sudah di-fetch, tidak lazy) sebagai props.
- Header kartu: `required ? "Syarat Bergabung" : "Ingin mendukung {tenantName}? (opsional)"` —
  sesuai instruksi user poin 5 ("skenario ini untuk kondisi donasi/produk diwajibkan" vs mode
  gratis yang sudah ada copy "opsional"-nya).

### 10. Komponen Baru — `ProductVariationPopup`

File: `apps/web/app/(public)/[tenant]/gabung/product-variation-popup.tsx` (client).

`<Dialog>`/`<DialogContent>` (bukan `<AlertDialog>` — ini form interaktif, bukan konfirmasi
ya/tidak, pola sama `legal-modal.tsx`). Isi popup: nama produk + (opsional) thumbnail kecil +
`priceBlock` + `variationPicker` + `stockInfo` + `qtyAndCta` — **JSX-nya diadaptasi/disalin**
dari `product-detail-client.tsx` baris 205–310 (priceBlock/variationPicker/stockInfo/qtyAndCta),
DIPERKECIL (tanpa `ProductImageViewer` galeri penuh, tanpa `SingleFeatureImage`/
`MobileActionSheet`/`SocialShareCard` — semua itu concern "halaman penuh", tidak relevan di
popup).

`findVariation()`/`isValueAvailable()` (baris 47–70 di `product-detail-client.tsx`) **DIDUPLIKASI
LOKAL** di file baru ini — pure function kecil (~24 baris total), duplikasi jauh lebih murah
dan lebih aman daripada mengekspor+meng-import lintas file untuk logic sekecil ini (konsisten §
4 poin 3, TIDAK menyentuh `product-detail-client.tsx` sama sekali).

`sessionType` selalu `"member"` — TIDAK PERLU dihitung ulang seperti
`resolveSessionType()` di halaman produk, karena `/gabung` sudah memverifikasi
`identity.type === "member"` sebelum titik mana pun di halaman ini bisa dirender (baris 46
`gabung/page.tsz`, TIDAK BERUBAH). `resolvePrice(product, "member")` langsung dipakai.

Handler tambah-ke-keranjang: `addToCartAction(tenantSlug, {itemType:"product",
itemId:activeVariation.id, name:`${productName} — ${...atribut}`, unitPrice, quantity,
forGabung:true})` — sukses → panggil `props.onAdded()` (parent `GabungItemWidget` menutup popup +
`router.refresh()`), TIDAK pakai `AlertDialog` konfirmasi terpisah seperti di halaman produk
penuh (popup ITU SENDIRI sudah bentuk konfirmasi — menutup popup setelah sukses sudah cukup
sebagai sinyal "berhasil", ditambah state cart yang ter-refresh menampilkan badge "✓ Sudah
ditambahkan" di kartu widget).

### 11. Komponen Baru — `GabungCheckoutButton`

File: `apps/web/app/(public)/[tenant]/gabung/gabung-checkout-button.tsx` (client).

Perubahan minimal di `join-forum-button.tsx`: **SATU baris** — `function AgreementFields(...)`
→ `export function AgreementFields(...)` (baris 15 saat ini). Tidak ada perubahan lain ke file
itu — `JoinForumButton` tetap 100% dipakai apa adanya untuk mode gratis.

`GabungCheckoutButton` mengimpor `AgreementFields` dari `./join-forum-button`, mereplikasi
struktur dual-render (desktop blok statis / mobile fixed-bar `z-[72]` + `ResizeObserver` spacer)
PERSIS pola `JoinForumButton` (duplikasi kecil, sengaja — § 4 poin 3, dua komponen ini punya
lifecycle tombol yang beda: satu memanggil server action lalu tampil status sukses inline, satu
murni navigasi tanpa server action apa pun).

```ts
type Props = { slug: string; baseUrl: string; canProceed: boolean };
```

- `disabled = !agreed || !canProceed` (tidak ada `pending`/`useTransition` — tidak ada server
  action yang dipanggil dari tombol ini, murni navigasi).
- `onClick`: `router.push(`${baseUrl}/checkout`)`.
- Label tombol: **"Ya, Saya Ingin Bergabung"** — SAMA PERSIS dengan mode gratis, sesuai instruksi
  user poin 5 (tidak ada perubahan teks tombol antar mode).
- TIDAK ADA state `joined`/sukses inline (setelah klik, halaman langsung berpindah ke
  `/checkout` — tidak ada "tetap di halaman ini" seperti mode gratis).
- Kalau `!canProceed` (item wajib belum lengkap di cart), teks kecil di bawah tombol: "Lengkapi
  syarat di atas dulu sebelum melanjutkan." — feedback non-blocking, tombol tetap terlihat
  (disabled), tidak disembunyikan (konsisten lesson "Bug: Tombol 'Simpan & Lanjutkan' Sering
  Disabled Padahal Semua Field Terisi" — field/kondisi yang menggerbang tombol WAJIB tampak
  jelas ke user, bukan bikin tombol terlihat aktif tapi diam saat diklik).

### 12. Redesain `joinForumAction` (mode gratis) — Minor

`apps/web/app/(public)/[tenant]/gabung/actions.ts` baris 59–65, guard diganti:
```ts
// LAMA
if (config?.paymentRequired) { return { success:false, error: "..." }; }

// BARU
import { hasPaymentRequirement } from "@/lib/membership-config";
if (hasPaymentRequirement(config)) { return { success:false, error: "..." }; }
```
Tidak ada perubahan lain di file ini — sisanya (insert/update `tenant_memberships`, generate
nomor keanggotaan) TIDAK disentuh.

### 13. Redesain `activateForumMembershipIfApplicable` — Settlement Pasca-Bayar

`apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts` baris 689–714, diganti:

```ts
const config = await getSetting<MembershipConfig>(tenantDb, "membership_config", "forum");
if (!hasPaymentRequirement(config)) return;   // ganti baris 690-691

const { db, schema } = tenantDb;

// Produk BERVARIASI: itemId di invoice_items adalah variation id, bukan requiredProductId
// langsung — fix bug § 3, kumpulkan seluruh variationId milik requiredProductId dulu.
let productRelevantIds = new Set<string>();
if (config?.requiredProductId) {
  productRelevantIds.add(config.requiredProductId);
  const variationRows = await db.select({ id: schema.productVariations.id })
    .from(schema.productVariations)
    .where(eq(schema.productVariations.productId, config.requiredProductId));
  for (const v of variationRows) productRelevantIds.add(v.id);
}

const items = await db.select({
  itemType: schema.invoiceItems.itemType,
  itemId:   schema.invoiceItems.itemId,
  forGabungRegistration: schema.invoiceItems.forGabungRegistration,
}).from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, invoiceId));

const hasProduct  = items.some(it => it.itemType === "product"  && it.forGabungRegistration && it.itemId && productRelevantIds.has(it.itemId));
const hasCampaign = items.some(it => it.itemType === "donation" && it.forGabungRegistration && it.itemId === config?.requiredCampaignId);

if (!isRequirementSatisfied(config!, { product: hasProduct, campaign: hasCampaign })) return;   // ganti baris 710-714
```

`import { hasPaymentRequirement, isRequirementSatisfied } from "@/lib/membership-config"`
ditambah di bagian atas file. Sisa fungsi (baris 716–769: cek eligibility ulang, UPSERT
`tenant_memberships`, generate nomor keanggotaan) **TIDAK BERUBAH SAMA SEKALI** — prinsip
"payment saja tidak cukup, tetap cek `checkMemberEligibility()` ulang" tetap dipertahankan
persis seperti sekarang.

`MembershipConfig` (alias type di file ini, baris ~656 area — dikonfirmasi audit sebelumnya
sebagai `import type { MembershipConfigData as MembershipConfig }`) otomatis ikut berubah bentuk
begitu `MembershipConfigData` diubah di § 5 — tidak ada baris tambahan yang perlu disentuh untuk
alias ini sendiri.

### 14. Yang SENGAJA TIDAK Disentuh (batas scope eksplisit)

- `DonationBannerCart` + `/keranjang/page.tsx` — lihat § 4 poin 3. Produk variasi di
  `/keranjang` TETAP navigasi keluar ke `/produk/{slug}` seperti sekarang. Kalau ingin
  diseragamkan, itu task terpisah.
- `checkout/page.tsx` / `checkout-form.tsx` / `checkoutAction` — sudah 100% mendukung
  `forGabungRegistration`, nol perubahan diperlukan (§ 2).
- `product-detail-client.tsx` — TIDAK di-refactor untuk berbagi kode dengan
  `ProductVariationPopup` (§ 10 menjelaskan alasan duplikasi kecil dianggap lebih aman).
- `checkMemberEligibility()`/eligibility gate — instruksi user poin 1 eksplisit: sudah benar,
  tidak diubah.
- Skema DB / migration baru — nol, sesuai § 4 poin 8.
- Sistem COD/Ambil Sendiri (`mitras.codEnabled`/`pickupEnabled`, `invoice_shipping_lines`) —
  sudah terimplementasi penuh di sesi lain (lihat plan file
  `/Users/webane/.claude/plans/binary-questing-river.md`), otomatis berlaku untuk checkout dari
  `/gabung` kalau syarat wajibnya produk berbadan fisik — tidak perlu disentuh/diverifikasi
  ulang oleh redesain ini.

### 15. Manifest File

| File | Jenis Perubahan |
|------|------------------|
| `apps/web/lib/membership-config.ts` | **BARU** — `hasPaymentRequirement()`, `isRequirementSatisfied()` |
| `apps/web/app/(public)/[tenant]/gabung/gabung-item-widget.tsx` | **BARU** — `GabungItemWidget` |
| `apps/web/app/(public)/[tenant]/gabung/product-variation-popup.tsx` | **BARU** — `ProductVariationPopup` |
| `apps/web/app/(public)/[tenant]/gabung/gabung-checkout-button.tsx` | **BARU** — `GabungCheckoutButton` |
| `apps/web/app/(public)/[tenant]/gabung/join-forum-button.tsx` | Diubah — 1 baris (`export function AgreementFields`) |
| `apps/web/app/(public)/[tenant]/gabung/page.tsx` | Diubah — fetch produk/campaign diperluas, cek cart baru, render dirombak (§ 8) |
| `apps/web/app/(public)/[tenant]/gabung/actions.ts` | Diubah — guard `joinForumAction` pakai helper baru (§ 12) |
| `apps/web/app/(dashboard)/app/[tenant]/settings/actions.ts` | Diubah — `MembershipConfigData` (§ 5) + `saveMembershipConfigAction` |
| `apps/web/app/(dashboard)/app/[tenant]/settings/keanggotaan/page.tsx` | Diubah — `defaultValues` ikut skema baru (baris 51–58) |
| `apps/web/components/settings/membership-config-form.tsx` | Diubah — UI checkbox per-item (§ 6) |
| `apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts` | Diubah — `activateForumMembershipIfApplicable` (§ 13) |

Nol file schema/migration. Nol perubahan di `checkout/`, `keranjang/`, `cart/actions.ts`,
`donation-banner-cart.tsx`, `product-detail-client.tsx`.

### 16. Urutan Eksekusi (kalau/setelah disetujui user)

Mengikuti SOP project (`tsc --noEmit` per fase, `bun run build --filter=@jalajogja/web` genuine
di titik-titik kunci, dev server dimatikan+`.next` dibersihkan sebelum build produksi):

- **Fase A — Skema config + helper.** § 5 (`MembershipConfigData`) + § 7
  (`lib/membership-config.ts`) + § 6 (UI admin) + `keanggotaan/page.tsx` defaultValues. `tsc`
  bersih. Bisa dites: admin toggle per-item tersimpan benar (query manual ke `tenant.settings`).
- **Fase B — Settlement pasca-bayar.** § 13 (`activateForumMembershipIfApplicable`) + § 12
  (`joinForumAction` guard). `tsc` bersih. Verifikasi bug § 3 tertutup: disposable test/query
  manual memastikan produk variable ter-match benar via `productRelevantIds`.
  **Fase A+B bisa di-deploy independen** dari Fase C+D — sistem lama (kalau ada config existing
  bertipe `either`) otomatis berhenti pakai field lama, admin tinggal set ulang toggle baru.
- **Fase C — Komponen widget + popup.** § 9 (`GabungItemWidget`) + § 10
  (`ProductVariationPopup`) + 1 baris `export` di `join-forum-button.tsx`. `tsc` bersih. Build
  genuine (rute `/gabung` baru muncul di output, ukurannya wajar).
- **Fase D — Wiring halaman + tombol checkout.** § 8 (`gabung/page.tsx` fetch+render) + § 11
  (`GabungCheckoutButton`). `tsc` bersih. Build genuine akhir.
- **Fase E — Verifikasi manual.** Butuh minimal: 1 tenant forum, 1 member eligible, 1 produk
  (idealnya salah satu VARIABLE untuk uji popup+bug-fix § 3), 1 campaign — coba: mode gratis
  (tanpa syarat), mode wajib produk-simple-saja, mode wajib campaign-saja, mode wajib keduanya,
  cek tombol checkout ter-disable sampai item lengkap di cart, cek checkout→invoice→settlement
  mengaktifkan keanggotaan untuk KEDUA jenis produk (simple & variable).

### 17. Checklist Verifikasi Sebelum Dianggap Selesai

- `tsc --noEmit` 0 error di `apps/web` (dan `packages/db` kalau ada perubahan type yang
  di-import lintas package — tidak diprediksi ada, karena `MembershipConfigData` murni file
  `apps/web`).
- `bun run build --filter=@jalajogja/web` genuine (dev server dimatikan, `.next` dibersihkan,
  bukan cache-hit) — konfirmasi rute `/gabung` + halaman settings tidak error.
- Grep akhir: pastikan `paymentRequired`/`requireMode` tidak tersisa di kode manapun (`grep -rn
  "paymentRequired\|requireMode" apps/web` harus nol hasil di luar komentar historis/dokumen).
- Verifikasi visual browser (Fase E) — TIDAK bisa dilakukan dari environment tanpa browser;
  tanggung jawab user setelah deploy.
- Deploy ke VPS TETAP tanggung jawab user (tidak ada akses SSH dari sesi manapun) — nol migrasi
  DB berarti langkah deploy cukup `git pull && bun run build --filter=@jalajogja/web && pm2
  restart jalajogja --update-env`.

---

## Koreksi: Komitmen Cart Selalu Menahan Aktivasi Sampai Bayar (2026-08-06)

> Menyusul langsung eksekusi "Redesain /gabung" (§ di atas) — user memberi koreksi sebelum
> fitur itu di-deploy/di-commit. Ini BUKAN pembatalan desain sebelumnya, melainkan lapisan
> aturan baru di atasnya.

### Instruksi user (verbatim inti)

> "diwajibkan atau tidak, jika dia memilih membeli produk dan, atau donasi, maka
> keanggotaannya ditahan sampai membayar. karena itu komitmen.. sehingga setelah klik gabung,
> masuk ke invoice terlebih dahulu.. bayar dulu.. termasuk nanti di keanggotaaan itu ada
> notifikasi: Lunasi Pembayaran yang menutupi kartu ketika mobile atau data keanggotaan ketika
> desktop..(notifikasi yang mendeteksi eligibilitas itu). yang jadi pertanyaan, apakah
> memungkinkan logikannya ketika donasi dan produk tersebut benar2 yang diorder dari laman
> gabung, bukan donasi sendiri atau produk sendiri karena itu 2 entitas yang berbeda."

### Pertanyaan langsung user — dijawab eksplisit

**"Apakah memungkinkan logikanya membedakan item yang genuinely dipesan dari `/gabung`
vs donasi/produk berdiri sendiri?"** — **YA, sudah bisa, dan sudah dipakai.** Flag
`invoice_items.forGabungRegistration` (dan `cart_items.forGabungRegistration`, dibangun di
sesi lampau "Pemisahan Donasi vs Registrasi Forum") **HANYA PERNAH** diset `true` oleh
`GabungItemWidget`/`ProductVariationPopup` (§ 9–10 di atas) saat memanggil `addToCartAction`
dengan `forGabung: true` — jalur donasi/beli PRODUK/CAMPAIGN organik di `/campaign/{slug}` dan
`/produk/{slug}` TIDAK PERNAH mengirim flag ini. Seluruh desain di bawah bertumpu pada
kepastian ini — bukan asumsi baru, melainkan penerapan LEBIH KETAT dari mekanisme yang sudah
ada.

### Prinsip baru yang dikunci

**Sebelumnya**: hanya item yang admin tandai "wajib" (`productRequired`/`campaignRequired`)
yang memaksa alur checkout — item yang dikonfigurasi tapi TIDAK wajib ("opsional/rekomendasi")
tetap bisa langsung join gratis via `JoinForumButton`/`joinForumAction`, terlepas apakah user
sudah menambahkan item opsional itu ke cart atau belum.

**Sekarang**: begitu user MENAMBAHKAN item apa pun (wajib ATAU opsional, tidak relevan) lewat
`GabungItemWidget` di `/gabung`, itu jadi **komitmen** — alur join-gratis TIDAK BOLEH lagi
dipakai untuk mereka, terlepas status "wajib" admin. Membership mereka ditahan
(`forumStatus` tetap bukan `"active"`) sampai invoice-nya benar-benar lunas.

Yang TIDAK berubah: field `productRequired`/`campaignRequired` admin TETAP menentukan apakah
KELENGKAPAN pembayaran (semua item wajib sudah dibayar) — bukan lagi penentu APAKAH mereka
harus lewat checkout sama sekali. Dua sumbu berbeda:
- **Sumbu 1 (front-end, "harus checkout atau boleh gratis?")** — sekarang:
  `anyRequired || hasCartCommitment` (diperluas dari `anyRequired` saja).
- **Sumbu 2 (backend, "sudah lengkap, boleh aktif?")** — TIDAK berubah:
  `isRequirementSatisfied(config, {product, campaign})` — tetap menghormati flag
  wajib/opsional per-item admin.

### 1. Fix `activateForumMembershipIfApplicable` — precondition wajib terpisah dari kelengkapan

**Bug yang HAMPIR diperkenalkan lalu dicegah**: percobaan pertama untuk "izinkan item opsional
ikut mengaktifkan membership" adalah menghapus total gate `hasPaymentRequirement(config)` —
TERNYATA ini akan MEMBUKA KEMBALI kelas bug yang sudah dikunci di § "Pemisahan Donasi vs
Registrasi Forum": `isRequirementSatisfied()` mengembalikan `true` secara VACUOUS untuk slot
yang TIDAK wajib (`!config.campaignRequired` sudah cukup membuat `campaignOk=true`, TANPA
peduli apakah `has.campaign` benar-benar `true`) — kalau gate `hasPaymentRequirement` dibuang
begitu saja tanpa pengganti, INVOICE ORGANIK APA PUN (donasi lewat `/campaign/{slug}` biasa,
tidak lewat `/gabung` sama sekali) yang kebetulan tidak punya syarat wajib akan LOLOS dan
mengaktifkan membership — persis yang sudah pernah ditutup sebelumnya.

**Fix yang benar** (`finance/billing/actions.ts`): pisahkan menjadi DUA gate berurutan, bukan
satu:
```typescript
const config = await getSetting<MembershipConfig>(tenantDb, "membership_config", "forum");
if (!config) return;
if (!config.requiredProductId && !config.requiredCampaignId) return;

// ...hitung hasProduct/hasCampaign dari invoice_items (forGabungRegistration=true, cocok
// productRelevantIds/requiredCampaignId — TIDAK BERUBAH dari § 3/§ 13 di atas)...

// Gate #1 (PRECONDITION, baru) — invoice ini harus GENUINELY punya minimal satu item
// forGabung yang cocok konfigurasi. Ini yang mencegah invoice organik lolos.
if (!hasProduct && !hasCampaign) return;

// Gate #2 (KELENGKAPAN, sudah ada sejak awal, tidak berubah) — item yang ADA sudah cukup
// menurut aturan wajib/opsional admin.
if (!isRequirementSatisfied(config, { product: hasProduct, campaign: hasCampaign })) return;
```
Efeknya: forum TANPA syarat wajib sama sekali (admin hanya konfigurasi campaign sebagai
"rekomendasi", tidak dicentang wajib) — user yang MEMBAYAR via `/gabung` (forGabung=true) untuk
campaign itu SEKARANG mengaktifkan membership (sebelumnya TIDAK, karena gate lama
`hasPaymentRequirement` langsung `return` di awal fungsi tanpa pernah sampai mengecek item).
User yang bayar campaign SAMA lewat `/campaign/{slug}` langsung (organik, forGabung=false)
TETAP TIDAK mengaktifkan apa pun — gate #1 menahannya.
**Status: sudah dieksekusi di `finance/billing/actions.ts` sebagai bagian koreksi ini.**

### 2. Redesain branching `/gabung/page.tsx`

`hasCartCommitment = productInCart || campaignInCart` (variabel INI SUDAH ADA di halaman,
dihitung untuk keperluan `alreadyInCart`/`canProceed` — cuma perlu di-reuse untuk gerbang
baru). Kondisi branch diperluas:
```typescript
const useCheckoutFlow = anyRequired || hasCartCommitment;
```
Ketika `useCheckoutFlow` true → render `<GabungItemWidget required={anyRequired} .../>` +
`<GabungCheckoutButton canProceed={canProceed} .../>` (SAMA PERSIS komponen yang sudah dibangun
§ 9/§ 11 — TIDAK PERLU komponen baru). `required` tetap `anyRequired` (bukan
`useCheckoutFlow`) — supaya copy widget ("Syarat Bergabung" vs "opsional") tetap JUJUR: kalau
item itu genuinely tidak diwajibkan admin, jangan bilang "syarat", walau checkout tetap
dipaksa karena user sudah menambahkannya.

`canProceed` **TIDAK PERLU diubah rumusnya** — `isRequirementSatisfied(config, {...})` SUDAH
otomatis `true` kapan pun `anyRequired=false` (vacuous truth per slot yang tidak wajib), jadi
begitu `useCheckoutFlow` true murni karena `hasCartCommitment` (bukan `anyRequired`),
`canProceed` sudah otomatis `true` tanpa gerbang tambahan apa pun — user tinggal centang
persetujuan lalu klik checkout.

Reaktivitas otomatis, tanpa kode client tambahan: `GabungItemWidget`'s `handleAddDonation`/
`handleAddSimpleProduct`/`handleProductAddedFromPopup` SUDAH memanggil `router.refresh()`
setelah `addToCartAction` sukses (§ 9) — Server Component `/gabung/page.tsx` otomatis
menghitung ulang `productInCart`/`campaignInCart` dari DB, `useCheckoutFlow` ikut flip dari
`false`→`true`, dan JSX otomatis berpindah dari cabang `JoinForumButton` ke cabang
`GabungItemWidget`+`GabungCheckoutButton` — TIDAK ADA state client tambahan yang perlu dijaga
manual.

Tambahan copy penjelasan (hanya tampil saat `useCheckoutFlow && !anyRequired`, supaya user
paham KENAPA alur berubah dari yang mereka duga "opsional"):
> "Karena Anda menambahkan dukungan di atas, keanggotaan akan aktif otomatis setelah
> pembayaran selesai."

### 3. Overlay baru "Lunasi Pembayaran" di `/akun` — perluasan `MembershipEligibilityOverlay`

**Keputusan desain — query-based, TANPA baris `tenant_memberships.forumStatus='pending'`
eager-write.** Dua pendekatan dipertimbangkan:
- **(A) Eager-write** — buat/update baris `tenant_memberships` ke `forumStatus:"pending"` PAS
  saat user klik checkout, sebelum navigasi ke `/checkout`. Ditolak: butuh server action baru
  di titik yang saat ini murni client-side navigation (`GabungCheckoutButton`), DAN berisiko
  baris "pending" yatim selamanya kalau user membatalkan sebelum sempat checkout sungguhan.
- **(B) Query-based** (dipilih) — `/akun/page.tsx` cukup query LANGSUNG: "ada invoice
  OUTSTANDING (belum lunas/dibatalkan) milik member ini di tenant ini, yang punya minimal satu
  `invoice_items.forGabungRegistration=true`?" Kalau ada → overlay "Lunasi Pembayaran". Nol
  tulisan baru ke `tenant_memberships` di titik mana pun sebelum pembayaran genuinely lunas —
  `activateForumMembershipIfApplicable` (§ 1 di atas) TETAP satu-satunya titik yang menulis
  baris membership, TIDAK BERUBAH. `forumInvoiceId`/`forumStatus="pending"` di skema (sudah
  ada sejak lama, lihat § 2.4 § catatan schema) TETAP tidak terpakai untuk state "belum bayar"
  — hanya relevan kalau nanti ada kebutuhan MENAMPILKAN daftar "pending applicant" di
  dashboard admin (belum ada UI itu sama sekali saat ini, jadi tidak ada konsumen yang butuh
  baris eager itu).

Query baru di `apps/web/app/(public)/[tenant]/akun/page.tsx`, di dalam blok
`if (overlayIsForum) { ... if (!isJoined) { ... } }` — DIJALANKAN SEBELUM
`checkMemberEligibility()`, karena kalau ada invoice pending, itu prioritas mutlak di atas
"Lengkapi Data"/"Gabung X":
```typescript
const { db: tdb, schema } = tenantDb; // tenantDb = createTenantDb(slug), sudah dihitung sekali di awal file
const [pendingInvoiceRow] = await tdb
  .select({ id: schema.invoices.id })
  .from(schema.invoices)
  .innerJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
  .where(and(
    eq(schema.invoices.memberId, identity.memberId),
    inArray(schema.invoices.status, ["pending", "waiting_verification", "partial", "overdue"]),
    eq(schema.invoiceItems.forGabungRegistration, true),
  ))
  .limit(1);

if (pendingInvoiceRow) {
  showEligibilityOverlay   = true;
  overlayPendingInvoiceId  = pendingInvoiceRow.id;
} else {
  // ...checkMemberEligibility() seperti sebelumnya, tidak berubah...
}
```
`"draft"` dan `"cancelled"` SENGAJA tidak masuk daftar status — draft belum genuinely
checkout, cancelled sudah mati (menampilkan tombol "Lunasi" ke invoice batal = dead end).
`"paid"` juga tidak masuk — kalau sudah lunas, `activateForumMembershipIfApplicable` seharusnya
sudah mengaktifkan `isJoined=true`, jalur ini sudah tidak tereksekusi (dibungkus
`if (!isJoined)`).

`MembershipEligibilityOverlay` (`components/akun/membership-eligibility-overlay.tsx`) dapat
prop baru opsional `pendingInvoiceId?: string | null`, jadi cabang PALING AWAL/prioritas
tertinggi (menang atas `eligible`/`onlyDirectoryMissing`/default — dicek PALING PERTAMA sebelum
percabangan lain):
```tsx
if (pendingInvoiceId) {
  message = <>Anda sudah memilih untuk mendukung <strong>{tenantName}</strong> — selesaikan
    pembayaran untuk melengkapi keanggotaan Anda.</>;
  action = <a href={`${baseUrl}/invoice/${pendingInvoiceId}`} className="btn btn-primary btn-md">
    Lunasi Pembayaran →
  </a>;
}
```
Guard early-return lama (`if (eligible && !isForum) return null;`) diperluas jadi
`if (eligible && !isForum && !pendingInvoiceId) return null;` — defensif, meski
`pendingInvoiceId` secara struktural cuma pernah diisi saat `isForum=true` (dihitung di dalam
blok `if (overlayIsForum)` di caller).

Posisi visual TIDAK berubah — overlay ini SUDAH jadi sibling `MemberCard` (mobile)/panel "Info
keanggotaan" (desktop) di dalam wrapper `<div className="relative">`, `absolute inset-0`
sejak fitur eligibility overlay generik pertama dibangun (`docs/arsitektur-akun.md` §
"Eligibility Overlay Generik") — persis mekanisme yang dimaksud user ("notifikasi yang
mendeteksi eligibilitas itu"), state baru ini murni CABANG TAMBAHAN di komponen yang sama,
bukan komponen/overlay terpisah.

### File yang disentuh (ringkasan)

| File | Perubahan |
|------|-----------|
| `finance/billing/actions.ts` | `activateForumMembershipIfApplicable` — gate dipecah 2 tahap (§ 1) |
| `gabung/page.tsx` | `useCheckoutFlow = anyRequired \|\| hasCartCommitment`, branch diperluas (§ 2) |
| `components/akun/membership-eligibility-overlay.tsx` | Prop `pendingInvoiceId` + cabang baru prioritas tertinggi (§ 3) |
| `akun/page.tsx` | Query invoice outstanding forGabung, `tenantDb` di-hoist ke variabel (§ 3) |

`GabungCheckoutButton`, `JoinForumButton`, `GabungItemWidget`, `ProductVariationPopup`,
`joinForumAction`, `checkoutAction` — **TIDAK ADA yang disentuh sama sekali** untuk koreksi
ini. Nol migrasi DB (semua kolom/flag yang dipakai sudah ada sejak sesi-sesi sebelumnya).

---

## Dokumen Terkait

| Dokumen | Relevansi |
|---------|-----------|
| `docs/arsitektur-backbone-ikpm.md` | Arsitektur backbone UMUM — tiga tipe tenant, auto-populate cabang/marhalah, cross-tenant data access, roadmap Phase 1–5 |
| `docs/arsitektur-akun.md` | Login universal cross-tenant, `resolveAkunBranding()`, "Eligibility Overlay Generik" (asal-usul generalisasi `checkMemberEligibility`/`MembershipEligibilityOverlay`) |
| `docs/arsitektur-ekosistem.md` | Toggle per-tenant modul Usaha/Pesantren/Profesional — dipakai `checkMemberEligibility()` untuk mempersempit syarat "directory" |
| `docs/arsitektur-billing.md` | Cart/checkout/invoice universal — dipakai jalur syarat wajib produk/campaign (§ "Redesain /gabung" di atas) |
| `docs/arsitektur-mobile-shell.md` | Pola spacer/fixed-bar mobile — dipakai `JoinForumButton` + `GabungCheckoutButton` (§ "Redesain /gabung") |
| `docs/arsitektur-donasi.md` | Kenapa campaign qurban tidak bisa dipakai sebagai `requiredCampaignId` (§ "Keputusan implementasi kunci" di atas) |
| `docs/arsitektur-product.md` | Sistem produk variasi (`product_variations`, `attributeGroups`) — dipakai `ProductVariationPopup` (§ "Redesain /gabung") |
