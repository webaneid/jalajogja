# Arsitektur Backbone IKPM Gontor — Ekosistem Multi-Organisasi

## Visi

jalajogja bukan hanya platform untuk satu organisasi cabang. Ini adalah **infrastruktur backbone
ekosistem IKPM Gontor** — satu identitas anggota berlaku di seluruh jenis organisasi IKPM:
cabang, marhalah (angkatan), maupun forum-forum resmi di bawah IKPM Pusat.

**Dua prinsip utama yang tidak boleh dilanggar:**

> **Prinsip 1 — Single Identity:**
> Satu anggota, satu identitas. Data diisi sekali, berlaku di mana-mana.
> Tidak ada form yang sama diketik ulang di organisasi berbeda.

> **Prinsip 2 — Channel-Agnostic Registration:**
> Dari mana pun seorang anggota masuk (via domain cabang, domain angkatan, atau bahkan
> domain forum) — ia **otomatis terdaftar di PC IKPM Cabang dan Marhalah yang sesuai**.
> Channel masuk tidak membatasi scope keanggotaan.
> Satu-satunya yang butuh tindakan aktif adalah keanggotaan Forum.

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

---

### Dua Sifat Keanggotaan

Ini adalah perbedaan paling fundamental dalam ekosistem backbone IKPM:

```
┌─────────────────────────────────────────────────────────────────┐
│  KEANGGOTAAN OTOMATIS (Passive)                                 │
│  ─────────────────────────────                                  │
│  PC IKPM Cabang + Marhalah/Angkatan                             │
│                                                                  │
│  Berlaku dari mana pun anggota mendaftar:                        │
│  • Daftar via domain Cabang     → ✓ Cabang + ✓ Marhalah (auto) │
│  • Daftar via domain Marhalah   → ✓ Cabang + ✓ Marhalah (auto) │
│  • Daftar via domain Forum      → ✓ Cabang + ✓ Marhalah (auto) │
│  • Diimport admin               → ✓ Cabang + ✓ Marhalah (auto) │
│                                                                  │
│  Anggota tidak perlu melakukan apapun — sistem yang menentukan  │
│  cabang dan angkatan dari data: primary_cabang_id + graduation_year │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  KEANGGOTAAN AKTIF (Active Opt-in)                              │
│  ─────────────────────────────────                              │
│  Forum-forum IKPM                                               │
│                                                                  │
│  Anggota HARUS klik "Daftar ke Forum ini" — tidak otomatis.    │
│  TAPI: semua data sudah tersedia, tidak perlu ketik ulang.      │
│                                                                  │
│  Alurnya:                                                        │
│  1. Login dengan akun IKPM yang sudah ada (satu klik)           │
│  2. Klik "Daftar ke Forum Bisnis"                               │
│  3. Konfirmasi: data usaha yang sudah ada muncul otomatis       │
│  4. Selesai — langsung terdaftar sebagai anggota forum           │
│                                                                  │
│  Tidak ada form baru. Tidak ada data baru yang harus diketik.   │
└─────────────────────────────────────────────────────────────────┘
```

---

### Tabel Perbandingan Tipe Tenant

| Tipe | Slug Contoh | Sifat Keanggotaan | Trigger | Modul Default |
|------|------------|-------------------|---------|---------------|
| `cabang` | `pc-ikpm-yogyakarta` | **Otomatis** | Register dari mana saja | Semua modul |
| `marhalah` | `marhalah-2005` | **Otomatis** | Register dari mana saja | Website, Event, Direktori |
| `forum` | `forbis-ikpm` | **Aktif (opt-in)** | Klik "Daftar ke Forum" | Website, Event, Toko, Direktori |

### Aturan Kunci per Tipe

**Cabang (`cabang`):**
- Sumber data primer — semua anggota IKPM wajib terdaftar di minimal satu cabang
- Admin bisa upload data anggota via CSV/spreadsheet (import massal dari data IKPM Pusat)
- `primary_cabang_id` di `public.members` selalu menunjuk ke cabang utama anggota
- **Keanggotaan bersifat otomatis** — siapapun yang mendaftar via jalur IKPM manapun
  otomatis mendapat keanggotaan di cabang yang sesuai dengan domisili/pilihannya

**Marhalah (`marhalah`):**
- Tidak perlu ada admin aktif — bisa berupa halaman informasi alumni angkatan
- Anggota **otomatis terdaftar** berdasarkan `graduation_year` — baik saat marhalah tenant
  dibuat (retroaktif untuk semua anggota yang sudah ada) maupun saat anggota baru masuk
- **Tidak memandang dari domain mana anggota mendaftar** — yang menentukan marhalah adalah
  tahun lulus, bukan channel registrasi
- Jika ada dua periode (1999 Awal / 1999 Akhir), ada dua tenant marhalah terpisah

**Forum (`forum`):**
- **Satu-satunya tipe yang butuh tindakan aktif** dari anggota — klik "Daftar ke Forum"
- Verifikasi identitas otomatis (sudah punya akun IKPM → langsung terverifikasi)
- **Data profil, usaha, pesantren dari cabang/marhalah langsung tersedia** tanpa input ulang
- Anggota hanya perlu konfirmasi: "Ya, saya ingin bergabung di forum ini"
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
  registered_via:
    'admin'          → diinput manual oleh admin cabang/forum
    'self'           → daftar sendiri di domain organisasi tersebut
    'import'         → upload CSV massal
    'invite'         → via link undangan
    'auto_marhalah'  → otomatis dari graduation_year saat marhalah dibuat / anggota baru masuk
    'auto_cabang'    → otomatis saat daftar via domain marhalah/forum (harus pilih cabang)
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

### Skenario 1a: Anggota Mendaftar via Domain PC IKPM Yogyakarta

```
Pak Ahmad (stambuk 2005) membuka pc-ikpm-yogyakarta.jalakarta.com dan mendaftar:

1. Register atau diinput admin:
   → INSERT public.members { graduation_year: 2005, graduation_period: null }
   → SET primary_cabang_id = 'pc-ikpm-yogyakarta'

2. Sistem OTOMATIS mendaftarkan ke cabang:
   → INSERT tenant_memberships { tenant_id: pc-ikpm-yogyakarta,
                                   membership_type: 'cabang',
                                   registered_via: 'self' }

3. Sistem OTOMATIS cek: ada tenant marhalah untuk angkatan 2005?
   → Ada → INSERT tenant_memberships { tenant_id: marhalah-2005,
                                         membership_type: 'marhalah',
                                         registered_via: 'auto_marhalah' }
   → Tidak ada → skip, nanti auto-add saat marhalah-2005 dibuat

4. Ahmad mengisi data lengkap di /akun/lengkapi:
   → contacts (HP, WA, email), member_businesses, member_owned_pesantren

Ahmad sekarang terdaftar di: PC IKPM Yogyakarta ✓ + Marhalah 2005 ✓
```

### Skenario 1b: Anggota Mendaftar PERTAMA KALI via Domain Marhalah 2005

```
Pak Budi (stambuk 2005, belum terdaftar di cabang manapun) buka
marhalah-2005.jalakarta.com dan mendaftar:

1. Register di domain marhalah:
   → INSERT public.members { graduation_year: 2005 }

2. Sistem OTOMATIS tanya: "Anda dari cabang IKPM mana?"
   (combobox cabang — wajib dipilih saat register jalur marhalah)
   → Budi pilih: PC IKPM Surabaya

3. Sistem OTOMATIS daftarkan ke KEDUANYA:
   → INSERT tenant_memberships { tenant_id: marhalah-2005,
                                   membership_type: 'marhalah',
                                   registered_via: 'self' }
   → INSERT tenant_memberships { tenant_id: pc-ikpm-surabaya,
                                   membership_type: 'cabang',
                                   registered_via: 'auto_cabang' }
   → SET members.primary_cabang_id = 'pc-ikpm-surabaya'

Budi sekarang terdaftar di: Marhalah 2005 ✓ + PC IKPM Surabaya ✓
Channel masuk = marhalah, tapi keanggotaan cabang tetap otomatis masuk.
```

### Skenario 1c: Anggota Mendaftar PERTAMA KALI via Domain Forum Bisnis

```
Pak Candra (stambuk 2003) buka forbis-ikpm.jalakarta.com untuk ikut forum bisnis:

1. Halaman forum menampilkan: "Anda perlu terdaftar di PC IKPM terlebih dahulu"
   Form register sekaligus:
   - Data identitas (nama, stambuk, dll)
   - Pilih cabang: PC IKPM Jakarta
   - Cabang + marhalah akan otomatis terisi

2. Setelah submit:
   → INSERT public.members { graduation_year: 2003 }
   → INSERT tenant_memberships { tenant_id: pc-ikpm-jakarta,    membership_type: 'cabang' }    ← OTOMATIS
   → INSERT tenant_memberships { tenant_id: marhalah-2003,      membership_type: 'marhalah' }  ← OTOMATIS (jika ada)
   → INSERT tenant_memberships { tenant_id: forbis-ikpm,        membership_type: 'forum',
                                   registered_via: 'self' }                                     ← AKTIF (forum)

3. Candra langsung terdaftar di TIGA organisasi sekaligus dari satu kali daftar.

Channel masuk = forum, tapi keanggotaan cabang + marhalah tetap otomatis masuk.
```

---

### Skenario 2: Marhalah 2005 Buat Website / Tenant (Retroaktif)

```
Ketua Marhalah 2005 daftar di jalajogja, buat tenant "marhalah-2005":

1. Buat tenant:
   → INSERT public.tenants { slug: 'marhalah-2005', tenant_type: 'marhalah',
                              marhalah_year: 2005, marhalah_period: null }

2. Sistem AUTO-POPULATE — semua anggota angkatan 2005 yang sudah terdaftar
   di cabang manapun langsung dimasukkan:

   SELECT DISTINCT m.id
   FROM public.members m
   INNER JOIN public.tenant_memberships tm ON tm.member_id = m.id
   INNER JOIN public.tenants t ON t.id = tm.tenant_id AND t.tenant_type = 'cabang'
   WHERE m.graduation_year = 2005
     AND (m.graduation_period IS NULL OR m.graduation_period = 'awal')

   → BULK INSERT public.tenant_memberships (N rows):
     { tenant_id: marhalah-2005, member_id: ...,
       registered_via: 'auto_marhalah', membership_type: 'marhalah' }

3. Hasilnya:
   → Pak Ahmad (daftar via cabang)  → OTOMATIS terdaftar di marhalah-2005
   → Pak Budi (daftar via marhalah) → sudah ada, skip (idempotent)
   → Semua alumni 2005 di semua cabang → masuk semua, tanpa satu pun ketik ulang

Direktori marhalah langsung berisi ratusan anggota + data usaha + data pesantren mereka.
```

### Skenario 3: Ahmad Bergabung ke Forum Bisnis IKPM (Aktif, Satu Klik)

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

## Logika Registrasi per Channel — Panduan Implementasi

Ini adalah rules yang harus selalu dijalankan saat `POST /api/akun/register` atau
`createMemberAction` dipanggil, terlepas dari domain mana request datang.

### Pseudo-code alur registrasi universal

```typescript
async function registerMember(input: RegisterInput, sourceTenantSlug: string) {
  const sourceTenant = await getTenant(sourceTenantSlug);

  // Step 1: Buat atau temukan identitas global
  const member = await findOrCreateMember(input); // cek by stambuk/email/HP

  // Step 2: SELALU daftarkan ke cabang — tidak peduli domain mana
  // ─────────────────────────────────────────────────────────────
  let cabangTenantId: string;

  if (sourceTenant.tenantType === 'cabang') {
    // Daftar langsung di cabang → langsung pakai cabang ini
    cabangTenantId = sourceTenant.id;
  } else {
    // Daftar via marhalah atau forum → WAJIB tanya/tentukan cabangnya
    // UI: combobox "Pilih PC IKPM Anda" saat register
    cabangTenantId = input.selectedCabangId; // wajib diisi user
  }

  await db.insert(tenantMemberships).values({
    tenantId:       cabangTenantId,
    memberId:       member.id,
    membershipType: 'cabang',
    registeredVia:  sourceTenant.tenantType === 'cabang' ? 'self' : 'auto_cabang',
  }).onConflictDoNothing();

  await db.update(members)
    .set({ primaryCabangId: cabangTenantId })
    .where(and(eq(members.id, member.id), isNull(members.primaryCabangId)));

  // Step 3: SELALU daftarkan ke marhalah yang sesuai graduation_year
  // ─────────────────────────────────────────────────────────────────
  if (member.graduationYear) {
    const marhalahTenant = await db.select().from(tenants)
      .where(and(
        eq(tenants.tenantType, 'marhalah'),
        eq(tenants.marhalahYear, member.graduationYear),
        member.graduationPeriod
          ? eq(tenants.marhalahPeriod, member.graduationPeriod)
          : isNull(tenants.marhalahPeriod),
      )).limit(1);

    if (marhalahTenant.length > 0) {
      await db.insert(tenantMemberships).values({
        tenantId:       marhalahTenant[0].id,
        memberId:       member.id,
        membershipType: 'marhalah',
        registeredVia:  'auto_marhalah',
      }).onConflictDoNothing();
    }
    // Jika marhalah belum ada → keanggotaan akan di-backfill saat marhalah dibuat
  }

  // Step 4: Jika daftar via domain forum → daftarkan ke forum (aktif)
  // ─────────────────────────────────────────────────────────────────
  if (sourceTenant.tenantType === 'forum') {
    await db.insert(tenantMemberships).values({
      tenantId:       sourceTenant.id,
      memberId:       member.id,
      membershipType: 'forum',
      registeredVia:  'self',
    }).onConflictDoNothing();
  }
  // Catatan: untuk forum, user masih perlu klik konfirmasi di UI,
  // tapi di level ini kita anggap sudah ada intent (mereka sudah klik dari halaman forum)
}
```

### Aturan yang Tidak Boleh Dilanggar

```
1. Keanggotaan cabang SELALU terbentuk saat registrasi, dari channel manapun.
   Tidak ada anggota IKPM tanpa primary_cabang_id.

2. Keanggotaan marhalah SELALU dicek saat registrasi. Jika ada tenant marhalah
   yang cocok → langsung masuk. Jika belum ada → akan diisi saat tenant marhalah dibuat.

3. Forum TIDAK pernah otomatis — selalu butuh konfirmasi eksplisit dari anggota.
   Bedanya: data sudah pre-filled, bukan ditulis ulang.

4. onConflictDoNothing() WAJIB di semua INSERT tenant_memberships.
   Registrasi di banyak tempat tidak boleh menghasilkan duplikat row.
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
