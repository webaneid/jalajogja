# Arsitektur Backbone IKPM Gontor — Ekosistem Multi-Organisasi

## Visi

jalakarta bukan hanya platform untuk satu organisasi cabang. Ini adalah **infrastruktur backbone
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

Setiap organisasi dalam ekosistem IKPM adalah satu **tenant** di jalakarta, dibedakan via
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
Ketua Marhalah 2005 daftar di jalakarta, buat tenant "marhalah-2005":

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

## Alur Pendaftaran Forum v1 (SUPERSEDED — lihat "v2" di bawah)

> **Status: DIGANTIKAN oleh § "Alur Pendaftaran Forum v2" di bawah** (didiskusikan + direncanakan
> 2026-07-23, belum dieksekusi). Yang diganti SECARA SPESIFIK: narasi alur (3 mode
> registration_mode, halaman `/{forum}/daftar` dengan "data pre-filled" sebagai form
> pendaftaran tersendiri) dan § 4 di bawah (`source_type: 'forum_registration'` baru — v2 TIDAK
> butuh ini, pembayaran forum cukup lewat `source_type: 'cart'` yang sudah ada).
>
> **TIDAK superseded — masih berlaku dan SUDAH diimplementasikan** (verifikasi kode 2026-07-23):
> § 1–3 di bawah (kolom `tenant_type`/`marhalah_year`/`parent_tenant_id` di `tenants`,
> `primary_cabang_ref_id` di `members`, `membership_type`/`forum_status`/`forum_invoice_id`/
> `approved_at`/`expires_at` di `tenant_memberships`) — ini schema BACKBONE UMUM (bukan spesifik
> alur registrasi forum), sudah live sejak migration `0018_backbone_tenant_types.sql`. v2 di
> bawah justru MEMANFAATKAN kolom `forum_status` dkk yang sudah ada ini, bukan menggantikannya.

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

> **Status: DIRENCANAKAN 2026-07-23, BELUM DIEKSEKUSI.** Didiskusikan penuh di percakapan
> (bukan Plan Mode formal) sebelum menulis dokumen ini — lihat riwayat keputusan di § "Keputusan
> yang Dikunci" di bawah. **Jangan mulai implementasi tanpa sinyal eksplisit user**, dan mulai
> dari § "Urutan Eksekusi" di bagian paling bawah kalau/ketika diberi izin jalan.

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

Karena data IKPM Cabang resmi sudah tersedia di IKPM Pusat, jalakarta menyediakan
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

### Phase 4 — Forum + Forum Registration Flow

> **Checklist di bawah ini BASI — dari desain v1 yang sudah di-supersede.** Rencana yang
> berlaku sekarang: § "Alur Pendaftaran Forum v2" di atas + checklist "Urutan Eksekusi
> (Fase A–E)" di situ. Baris-baris di bawah dipertahankan sebagai catatan sejarah saja.

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
