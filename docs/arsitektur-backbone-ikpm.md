# Arsitektur Backbone IKPM Gontor — Ekosistem Multi-Organisasi

## Visi

jalajogja bukan hanya platform untuk satu organisasi cabang. Ini adalah **infrastruktur backbone
ekosistem IKPM Gontor** — satu identitas anggota berlaku di seluruh jenis organisasi IKPM:
cabang, marhalah (angkatan), maupun forum-forum resmi di bawah IKPM Pusat.

**Prinsip utama yang tidak boleh dilanggar:**

> Satu anggota, satu identitas. Data diisi sekali, berlaku di mana-mana.
> Tidak ada form yang sama diketik ulang di organisasi berbeda.

---

## Peta Organisasi IKPM Gontor

```
IKPM Pusat
│
├── IKPM Cabang (per kota/wilayah) — "Tenant Cabang"
│   ├── PC IKPM Yogyakarta
│   ├── PC IKPM Jakarta
│   ├── PC IKPM Surabaya
│   └── dst... (data resmi tersedia dari IKPM Pusat)
│
├── Forum Resmi (lintas cabang, di bawah Pusat) — "Tenant Forum"
│   ├── Forum Bisnis IKPM Gontor (Forbis)
│   ├── Forum Olahraga IKPM
│   ├── Forum Seni & Budaya
│   └── dst... (dibuat oleh pengurus forum resmi)
│
└── Marhalah / Angkatan (per tahun lulus) — "Tenant Marhalah"
    ├── Marhalah 2005
    ├── Marhalah 1999 Awal
    ├── Marhalah 1999 Akhir
    └── dst... (dibuat oleh alumni angkatan, auto-populated dari data cabang)
```

---

## Tiga Tipe Tenant

Setiap organisasi dalam ekosistem IKPM adalah satu **tenant** di jalajogja, dibedakan via
kolom `tenant_type` di tabel `public.tenants`.

| Tipe | Slug Contoh | Siapa yang Buat | Keanggotaan | Modul Default |
|------|------------|-----------------|-------------|---------------|
| `cabang` | `pc-ikpm-yogyakarta` | Admin IKPM Pusat / Pengurus Cabang | Manual + upload data | Semua modul |
| `forum` | `forbis-ikpm` | Pengurus Forum resmi | Opt-in (daftar mandiri) | Website, Event, Toko |
| `marhalah` | `marhalah-2005` | Alumni angkatan (self-service) | **Auto-populated** dari data cabang | Website, Event, Chat |

### Aturan Kunci per Tipe

**Cabang (`cabang`):**
- Sumber data primer — semua anggota IKPM wajib terdaftar di minimal satu cabang
- Admin bisa upload data anggota via CSV/spreadsheet (import massal dari data IKPM Pusat)
- `primary_cabang_id` di `public.members` selalu menunjuk ke cabang utama anggota

**Marhalah (`marhalah`):**
- Tidak perlu ada admin aktif — bisa berupa halaman informasi alumni angkatan
- Anggota **otomatis terdaftar** saat marhalah tenant dibuat, berdasarkan `graduation_year`
- Jika ada dua periode (1999 Awal / 1999 Akhir), ada dua tenant marhalah terpisah

**Forum (`forum`):**
- Anggota opt-in: mendaftar sendiri, tapi verifikasi identitas sudah ada (dari data cabang)
- Data profil, usaha, pesantren dari cabang langsung tersedia tanpa input ulang
- Forum bisa punya struktur kepengurusan sendiri via modul Pengurus

---

## Arsitektur Data: Single Source of Truth

### Schema yang Sudah Ada (Backbone Ready)

```
public.members          ← IDENTITAS GLOBAL — satu record per orang di seluruh IKPM
  id (UUID)
  member_number          ← nomor IKPM global, atomic sequence
  stambuk_number         ← nomor santri Gontor
  nik
  name, gender, birth_date, birth_place
  graduation_year        ← kunci untuk auto-populate marhalah
  graduation_period      ← 'awal' | 'akhir' (khusus 1999)
  contact_id → public.contacts  (phone, whatsapp, email, visibilitas)
  better_auth_user_id → public.user  (link ke login)
  primary_cabang_id → public.tenants  ← BARU — cabang utama anggota

public.tenant_memberships   ← RELASI — siapa terdaftar di organisasi mana
  tenant_id → public.tenants
  member_id → public.members
  status: active | inactive | alumni
  joined_at
  registered_via: 'admin' | 'self' | 'import' | 'auto_marhalah' | 'invite'
  membership_type: 'cabang' | 'marhalah' | 'forum'  ← BARU

public.tenants
  id, slug, name, is_active
  tenant_type: 'cabang' | 'forum' | 'marhalah' | 'pusat'  ← BARU
  marhalah_year INTEGER    ← BARU — untuk tipe marhalah (misal: 2005)
  marhalah_period TEXT     ← BARU — 'awal' | 'akhir' | null
  parent_tenant_id → public.tenants  ← BARU — forum/marhalah di bawah cabang atau pusat mana
```

### Data yang Tersimpan Sekali, Dipakai Banyak Tempat

```
public.members              → identitas dasar (nama, tgl lahir, stambuk, NIK)
public.contacts             → kontak (HP, WA, email) + visibilitas
public.addresses            → alamat domisili
public.member_owned_pesantren → data pesantren yang dikelola anggota
public.member_businesses    → data usaha anggota
```

Semua data di atas diisi **satu kali** di PC IKPM Cabang manapun, lalu tersedia di:
- Direktori anggota marhalah → menampilkan data usaha & pesantren anggota angkatan
- Forum Bisnis → menampilkan data usaha anggota yang mendaftar ke forum
- PC IKPM lain → bisa lihat profil anggota (lintas cabang, sesuai hak akses)

---

## Alur Skenario — Simulasi Kehidupan Nyata

### Skenario 1: Anggota Mendaftar di PC IKPM Yogyakarta

```
Pak Ahmad (stambuk 2005) mendaftar di PC IKPM Yogyakarta:

1. Admin input data atau Ahmad self-register via /{slug}/register
   → INSERT public.members { graduation_year: 2005, primary_cabang_id: pc-ikpm-yogyakarta }
   → INSERT public.tenant_memberships { tenant_id: pc-ikpm-jogjakarta, registered_via: 'admin' }

2. Ahmad mengisi data lengkap:
   → UPDATE contacts (HP, WA, email)
   → INSERT member_businesses (toko batik, dll)
   → INSERT member_owned_pesantren (jika ada)

SELESAI — data Ahmad tersimpan di public schema, berlaku global.
```

### Skenario 2: Marhalah 2005 Buat Website / Tenant

```
Ketua Marhalah 2005 daftar di jalajogja, buat tenant "marhalah-2005":

1. Buat tenant:
   → INSERT public.tenants { slug: 'marhalah-2005', tenant_type: 'marhalah',
                              marhalah_year: 2005, marhalah_period: null }

2. Sistem AUTO-POPULATE keanggotaan marhalah:
   → SELECT * FROM public.members
     WHERE graduation_year = 2005
       AND graduation_period IS NULL OR graduation_period != 'akhir'
       AND id IN (SELECT member_id FROM tenant_memberships
                  WHERE status IN ('active', 'alumni'))

   → BULK INSERT public.tenant_memberships:
     { tenant_id: marhalah-2005, member_id: ..., registered_via: 'auto_marhalah',
       membership_type: 'marhalah' }

3. Ahmad (angkatan 2005) OTOMATIS terdaftar di marhalah-2005
   → Bisa login ke /{marhalah-2005}/akun langsung
   → Profil, usaha, pesantren langsung tampil di direktori marhalah
   → Tidak perlu ketik apapun lagi
```

### Skenario 3: Ahmad Mendaftar ke Forum Bisnis IKPM

```
Ahmad buka website Forum Bisnis IKPM (forbis-ikpm.jalakarta.com):

1. Ahmad klik "Daftar ke Forum Bisnis"
   → Cek: apakah Ahmad punya better_auth_user_id? (sudah, dari step 1)
   → Login langsung dengan akun yang sama

2. Isi formulir keanggotaan forum (minimal, hanya data spesifik forum):
   → Bidang usaha yang relevan dengan forum (pilih dari data usaha yang sudah ada)
   → Persetujuan aturan forum
   → (Tidak perlu isi nama, kontak, alamat, usaha — sudah ada semua)

3. INSERT public.tenant_memberships { tenant_id: forbis-ikpm,
                                       member_id: ahmad.id,
                                       registered_via: 'self',
                                       membership_type: 'forum' }

4. Ahmad langsung bisa akses:
   → Direktori anggota Forum Bisnis (tampilkan usaha sesama anggota)
   → Event dan webinar Forum Bisnis
   → Group diskusi / konten forum
```

### Skenario 4: Upload Data Massal dari IKPM Pusat

```
PC IKPM Surabaya baru buat tenant, punya data 3000 anggota dalam Excel:

1. Admin upload CSV via /{slug}/members/import
   → Parse: nama, stambuk, NIK, HP, email, graduation_year, status

2. Untuk setiap baris:
   a. Cek public.members WHERE stambuk = row.stambuk
      → Sudah ada (pernah terdaftar di cabang lain): SKIP insert, langsung ke step c
      → Belum ada: INSERT public.members + INSERT contacts

   b. Jika better_auth_user_id sudah ada → kirim notif WA "Data Anda ditemukan di Surabaya"
      Jika belum ada → data disimpan, anggota bisa klaim saat register

   c. INSERT public.tenant_memberships { registered_via: 'import', membership_type: 'cabang' }

3. Setelah import:
   → Anggota yang sudah punya akun langsung bisa akses /{surabaya}/akun
   → Anggota baru dapat link undangan lewat WA untuk aktivasi akun
```

---

## Arsitektur Login: Satu Akun, Banyak Organisasi

```
Ahmad → buka forbis-ikpm.jalakarta.com/login
      → masuk dengan email/WA yang sama seperti di PC IKPM Yogya
      → sistem cek: better_auth_user_id → public.members → tenant_memberships
      → Ahmad punya membership di forbis-ikpm? Ya → masuk ke /akun forum
      → Belum? → tampilkan halaman "Daftar ke Forum Bisnis" dengan data pre-filled
```

### Routing Pasca Login (Multi-Organisasi)

```
/{slug}/login → getAkunIdentity()
  ↓ identity.memberId ada
  ├─ ada di tenant_memberships untuk {slug} → /akun (tampil info keanggotaan)
  └─ tidak ada → /akun (tampil "Anda belum terdaftar di {orgName}")
                          → tombol "Daftar ke {orgName}" (untuk forum: langsung)
                                                          (untuk marhalah: auto-add)
```

---

## Schema Changes yang Diperlukan

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
  ADD COLUMN membership_type TEXT NOT NULL DEFAULT 'cabang'
    CHECK (membership_type IN ('cabang', 'forum', 'marhalah'));
```

### 4. Migration nomor

File: `packages/db/migrations/0018_backbone_tenant_types.sql`

---

## Auto-Populate Marhalah — Mekanisme

### Saat Tenant Marhalah Dibuat

```typescript
// Server action: createMarhalahTenantAction(slug, year, period?)
async function autoPopulateMarhalah(tenantId: string, year: number, period?: string) {
  // Ambil semua anggota yang punya graduation_year yang cocok
  // DAN sudah terdaftar di minimal satu cabang
  const eligibleMembers = await db
    .select({ memberId: members.id })
    .from(members)
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      inArray(tenantMemberships.membershipType, ['cabang']),
    ))
    .where(and(
      eq(members.graduationYear, year),
      period
        ? eq(members.graduationPeriod, period)
        : isNull(members.graduationPeriod),
    ));

  // Bulk insert ke tenant_memberships
  if (eligibleMembers.length > 0) {
    await db.insert(tenantMemberships).values(
      eligibleMembers.map(({ memberId }) => ({
        tenantId,
        memberId,
        status:         "active",
        registeredVia:  "auto_marhalah",
        membershipType: "marhalah",
      }))
    ).onConflictDoNothing(); // idempotent
  }
}
```

### Saat Anggota Baru Terdaftar di Cabang

Jika sudah ada marhalah tenant untuk `graduation_year` yang cocok → auto-add juga ke marhalah:

```typescript
// Di createMemberAction atau register action
async function autoAddToMarhalah(memberId: string, year: number, period?: string) {
  const marhalahTenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(
      eq(tenants.tenantType, "marhalah"),
      eq(tenants.marhalahYear, year),
      period ? eq(tenants.marhalahPeriod, period) : isNull(tenants.marhalahPeriod),
    ))
    .limit(1);

  if (marhalahTenant.length > 0) {
    await db.insert(tenantMemberships).values({
      tenantId:       marhalahTenant[0].id,
      memberId,
      status:         "active",
      registeredVia:  "auto_marhalah",
      membershipType: "marhalah",
    }).onConflictDoNothing();
  }
}
```

---

## Data yang Terlihat di Masing-Masing Tenant

### Direktori Anggota — Per Tipe Tenant

| Data | Cabang | Marhalah | Forum |
|------|--------|----------|-------|
| Nama | ✓ | ✓ | ✓ |
| Foto | ✓ | ✓ | ✓ |
| Stambuk | ✓ | ✓ | ✓ |
| Cabang (home) | ✓ | ✓ | ✓ |
| Angkatan | ✓ | ✓ | ✓ |
| Kontak (jika publik) | ✓ | ✓ | ✓ |
| Domisili (provinsi/kota) | ✓ | ✓ | ✓ |
| Data Usaha | ✓ | ✓ (singkat) | ✓ (fokus bisnis) |
| Data Pesantren | ✓ | ✓ (singkat) | sesuai relevance |
| Status keanggotaan cabang | ✓ | — | — |

### Modul yang Tersedia per Tipe Tenant

| Modul | Cabang | Forum | Marhalah |
|-------|--------|-------|----------|
| Website (CMS) | ✓ | ✓ | ✓ (terbatas) |
| Anggota | ✓ full | ✓ (opt-in) | ✓ (auto-read-only) |
| Surat | ✓ | ✓ | — |
| Keuangan | ✓ | ✓ | terbatas |
| Toko | ✓ | ✓ | — |
| Donasi/Infaq | ✓ | ✓ | ✓ |
| Event | ✓ | ✓ | ✓ |
| Dokumen | ✓ | ✓ | — |
| Pengurus | ✓ | ✓ | ✓ |

---

## Fitur Import Data Anggota (Cabang)

Karena data IKPM Cabang resmi sudah tersedia di IKPM Pusat, jalajogja menyediakan
mekanisme import massal:

### Format CSV yang Diterima

```
nama_lengkap | stambuk | nik | tanggal_lahir | tempat_lahir | jenis_kelamin |
tahun_lulus | periode (awal/akhir/kosong) | no_hp | email | status (active/alumni)
```

### Alur Import

```
Upload CSV
  ↓
Parse + validasi format
  ↓
Untuk setiap baris:
  ├─ Cek by stambuk di public.members
  │   ├─ Ketemu → update data yang kosong, skip yang sudah ada, add ke cabang ini
  │   └─ Tidak ketemu → INSERT members + contacts, SET primary_cabang_id
  ↓
Bulk INSERT tenant_memberships (registered_via: 'import')
  ↓
Auto-add ke marhalah yang sudah ada (jika ada)
  ↓
Opsional: kirim WA blast undangan aktivasi akun
```

### Deduplikasi

Urutan cek untuk identifikasi anggota yang sudah ada:
1. Stambuk (paling kuat — unik per santri)
2. NIK (unik, tapi tidak semua punya)
3. Kombinasi nama + tgl lahir (fuzzy, butuh konfirmasi manual)

---

## Antarmuka Admin — Fitur Baru per Tipe Tenant

### Cabang

- `/{slug}/members/import` — upload CSV data anggota
- `/{slug}/members` — tampil `membership_type: 'cabang'` saja (bukan marhalah/forum)

### Marhalah

- `/app/create-tenant?type=marhalah` — form khusus: tahun + periode
- Auto-populate dijalankan langsung setelah tenant dibuat
- Dashboard: "N anggota angkatan ini terdaftar", "M sudah aktivasi akun"
- Tidak punya modul Surat/Keuangan/Toko (sesuai paket marhalah)

### Forum

- `/app/create-tenant?type=forum` — form: nama forum, bidang/kategori
- Halaman publik pendaftaran anggota: `/{forum-slug}/daftar`
  - Jika sudah punya akun IKPM: konfirmasi identitas + isi data forum-spesifik
  - Jika belum: arahkan ke register via cabang dulu, baru kembali daftar forum

---

## Cross-Tenant Data Access — Aturan

| Situasi | Apa yang Bisa Dilihat |
|---------|----------------------|
| Anggota buka `/akun` di marhalah | Profil pribadi, data usaha, transaksi di marhalah ini |
| Anggota buka `/akun` di forum | Profil pribadi, data usaha yang di-share ke forum, transaksi di forum |
| Admin marhalah lihat anggota | Profil publik (tanpa NIK, detail alamat, tanggal+bulan lahir) |
| Admin forum lihat anggota | Profil publik + data usaha yang di-share ke forum |
| Admin cabang | Data penuh anggota cabangnya sendiri |

**Aturan privasi yang tidak boleh dilanggar:**
- NIK tidak pernah tampil lintas organisasi
- Detail alamat (kecamatan/desa/jalan) tidak tampil di luar cabang sendiri
- Kontak (HP/WA/email) hanya tampil jika `contacts.is_*_public = true`

---

## Roadmap Implementasi

### Phase 1 — Schema + Tipe Tenant (Fondasi)
- [ ] Migration `0018_backbone_tenant_types.sql`
- [ ] Update Drizzle schema: `tenants`, `tenant_memberships`, `members`
- [ ] Update `createTenantDb` cache key agar tidak konflik nama schema

### Phase 2 — Import Massal (Cabang)
- [ ] Route `/{slug}/members/import` (upload CSV)
- [ ] Parser + validator CSV
- [ ] Deduplikasi logic (stambuk → NIK → nama+lahir)
- [ ] Laporan hasil import (berhasil / duplikat / gagal)

### Phase 3 — Marhalah
- [ ] Halaman buat tenant marhalah (`/app/create-tenant?type=marhalah`)
- [ ] `autoPopulateMarhalah()` server action
- [ ] Hook di `createMemberAction`: auto-add ke marhalah aktif
- [ ] Dashboard marhalah sederhana (statistik + website sederhana)

### Phase 4 — Forum
- [ ] Halaman buat tenant forum
- [ ] Halaman publik pendaftaran anggota forum (`/{forum}/daftar`)
- [ ] Verifikasi identitas (sudah punya akun IKPM?) saat daftar forum
- [ ] Data sharing: anggota pilih data usaha mana yang di-share ke forum

### Phase 5 — Platform Dashboard (Pusat)
- [ ] Admin IKPM Pusat bisa lihat semua tenant + statistik lintas cabang
- [ ] Kelola katalog forum resmi
- [ ] Statistik alumni global (berapa anggota, sebaran wilayah, angkatan)

---

## Hubungan dengan Dokumen Arsitektur Lain

| Dokumen | Relevansi |
|---------|-----------|
| `arsitektur-keanggotaan.md` | Arsitektur dasar `public.members` + `tenant_memberships` |
| `arsitektur-akun.md` | Login universal yang sudah cross-tenant |
| `arsitektur-login-universal.md` | Alur register + auto-link member |
| `arsitektur-direktori-publik.md` | Direktori anggota yang akan dipakai di marhalah & forum |
| `arsitektur-billing.md` | Transaksi lintas tenant via cart universal |

---

## Catatan Implementasi

**Yang sudah ada dan siap digunakan:**
- `public.members` sebagai identitas global ✅
- `public.tenant_memberships` bisa dipakai untuk semua tipe ✅
- Login universal berlaku di semua subdomain ✅
- Data usaha/pesantren sudah di public schema ✅
- `graduation_year` + `graduation_period` sudah ada di members ✅

**Yang perlu ditambah:**
- Kolom `tenant_type`, `marhalah_year`, `marhalah_period`, `parent_tenant_id` di tenants
- Kolom `primary_cabang_id` di members
- Kolom `membership_type` + update `registered_via` enum di tenant_memberships
- UI import CSV untuk cabang
- Auto-populate logic untuk marhalah
- Halaman daftar forum yang data-aware
