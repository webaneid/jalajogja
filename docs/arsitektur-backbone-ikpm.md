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
| `cabang` | `pc-ikpm-yogyakarta` | **Otomatis** (match `primaryCabangRefId`) | Register dari mana saja | Semua modul |
| `marhalah` | `marhalah-2005` | **Otomatis** (match `graduationYear`) | Register dari mana saja | Website, Event, Direktori |
| `forum` | `forbis-ikpm` | **Aktif (opt-in)** | Klik "Daftar ke Forum" | Website, Event, Toko, Direktori |
| `pusat` 📋 | `ikpm-pusat` | **Otomatis, TANPA syarat** | Register dari mana saja — TIDAK ADA yang bisa dikecualikan | Semua modul (sama seperti cabang) |

> 📋 `pusat` masih RENCANA — belum dibangun. Lihat § "Tenant Khusus: IKPM Pusat" di bawah untuk
> desain lengkap.

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

**IKPM Pusat (`pusat`) 📋 RENCANA:**
- Tenant seperti tenant lain — punya schema sendiri, modul operasional (Surat, Toko, Website,
  Keuangan, Event) berfungsi identik, TIDAK ADA kode khusus di modul-modul itu.
- **Satu-satunya perbedaan: himpunan keanggotaannya.** Cabang dibatasi `primaryCabangRefId`,
  marhalah dibatasi `graduationYear`, forum dibatasi opt-in eksplisit — **Pusat TIDAK dibatasi
  kriteria apa pun**. Setiap anggota yang punya baris di `public.members` otomatis jadi
  anggota Pusat, titik.
- **"The one and only"** — hanya boleh ada SATU tenant `tenant_type='pusat'` di seluruh
  sistem, dipaksa lewat constraint (lihat desain di bawah).
- **BUKAN lapisan akses lintas-tenant.** Dashboard Pusat TIDAK BISA membaca surat/keuangan/
  produk/event tenant lain — isolasi schema-per-tenant TETAP berlaku sama seperti tenant
  manapun. "Muara semua data" di sini artinya muara KEANGGOTAAN (semua orang otomatis jadi
  anggotanya), BUKAN muara data operasional lintas tenant. Kalau suatu saat memang dibutuhkan
  visibility lintas-tenant untuk data operasional (bukan cuma keanggotaan), itu topik terpisah
  yang harus lewat Platform Admin (`/platform/*`) — jangan dicampur ke tenant ini.

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

> **Catatan (2026-08-06)**: bagian cabang+marhalah di skenario ini (register otomatis masuk
> cabang & marhalah dari domain manapun) TETAP akurat, prinsip umum backbone. Bagian FORUM-nya
> (registrasi forum terjadi LANGSUNG BERSAMAAN dalam satu form) adalah asumsi v1-era yang sudah
> diganti — di alur `/gabung` v2 yang sungguhan berjalan sekarang, bergabung forum SELALU jadi
> langkah terpisah setelah identitas IKPM ada (lihat `docs/arsitektur-gabung-forum.md`), tidak
> pernah tergabung dalam satu form register.

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

### Skenario 3: Ahmad Bergabung ke Forum Bisnis IKPM

> **Dipindahkan ke `docs/arsitektur-gabung-forum.md`** § "Skenario Historis" (2026-08-06) —
> skenario ini murni ilustratif dari niat awal (v1-era), sudah tidak persis sama dengan alur
> `/gabung` v2 yang benar-benar berjalan sekarang. Lihat dokumen itu untuk alur end-to-end yang
> akurat (§ "4. Alur End-to-End" di bagian "Alur Pendaftaran Forum v2").

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

## Alur Pendaftaran / Bergabung Forum

> **Dipindahkan ke dokumen terpisah: `docs/arsitektur-gabung-forum.md`** (2026-08-06) — mencakup
> v1 (superseded, riwayat keputusan) dan v2 (arsitektur + implementasi saat ini: halaman
> `/gabung`, overlay `/akun`, settings `/app/{slug}/settings/keanggotaan`, integrasi pembayaran
> opsional lewat produk/campaign existing, nomor keanggotaan lokal forum, pemisahan donasi vs
> registrasi forum, dan audit sinkronisasi kode terbaru). Dokumen ini
> (`arsitektur-backbone-ikpm.md`) tetap jadi rujukan untuk arsitektur backbone UMUM (tiga tipe
> tenant, auto-populate cabang/marhalah, cross-tenant data access, roadmap Phase 1–5) — bagian
> yang SPESIFIK ke "seseorang bergabung/mendaftar jadi anggota FORUM" sekarang seluruhnya ada di
> dokumen terpisah itu, termasuk Skenario 3 (di atas, § "Alur Skenario") dan checklist Phase 4
> lama (di bawah, § "Roadmap Implementasi") yang juga sudah dipindahkan ke sana.

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

## Tenant Khusus: IKPM Pusat — Keanggotaan Tanpa Batas ✅ FASE A–D SELESAI

> **Status: DIEKSEKUSI (2026-08-06, commit `a6f877b` + `679f2f9`).** Dikunci lewat diskusi
> 2026-08-06 (user: *"betul sekali, dia the one and only"* + *"ikpm pusat adalah muara semua
> data"*), lalu dieksekusi penuh di sesi yang sama setelah instruksi *"masuk mode hemat dan
> auto, kemudian eksekusi.."*. Migration `0060_tenant_type_pusat.sql` sudah dijalankan+
> diverifikasi di LOKAL dan di VPS (user konfirmasi output `ALTER TABLE`×4 + `CREATE INDEX` +
> hasil verifikasi CHECK constraint/index sukses). `tsc`+build genuine bersih di lokal — status
> build+restart PM2 di VPS BELUM dikonfirmasi selesai di percakapan ini. **Belum diverifikasi
> visual di browser** (buat tenant Pusat sungguhan, cek backfill, cek penolakan tenant kedua)
> — di luar kapasitas environment kerja ini, perlu dicoba user. Lihat juga section BARU di
> bawah: "Menu Admin Khusus IKPM Pusat: Ringkasan Tenant" — fitur lanjutan yang memakai tenant
> tipe ini.

### Konsep

IKPM Pusat adalah tenant seperti tenant lain — schema sendiri, modul operasional (Surat, Toko,
Website, Keuangan, Event) berfungsi identik, TIDAK ADA kode khusus di modul-modul itu. Satu-
satunya yang berbeda adalah **himpunan keanggotaannya**: kalau cabang dibatasi
`primaryCabangRefId` dan marhalah dibatasi `graduationYear`, IKPM Pusat **tidak dibatasi
kriteria apa pun** — setiap anggota yang punya baris di `public.members` otomatis jadi
anggotanya. "Muara semua data" berarti muara KEANGGOTAAN — bukan visibility lintas-tenant
untuk data operasional (surat/keuangan/produk tenant lain tetap terisolasi, tidak terlihat
dari sini, sama seperti tenant manapun terhadap tenant lain).

### 1. Tipe tenant baru: `pusat`

`TENANT_TYPES` (`packages/db/src/schema/public/tenants.ts`) dan `MEMBERSHIP_TYPES`
(`packages/db/src/schema/public/tenant-memberships.ts`) perlu nilai ke-4: `"pusat"`. Kolom
`tenants.tenant_type` dan `tenant_memberships.membership_type` punya CHECK constraint DB
NYATA (`CHECK (tenant_type IN ('cabang','marhalah','forum'))`, migration `0018`) — bukan
cuma TypeScript enum — jadi menambah nilai ini butuh migration `ALTER TABLE ... DROP
CONSTRAINT ... ADD CONSTRAINT ... CHECK (... IN (..., 'pusat'))` untuk KEDUA kolom.
`REGISTERED_VIA` (`["admin","self","import","invite","auto_marhalah","auto_cabang"]`) juga
perlu nilai baru `"auto_pusat"` untuk audit-trail yang jelas (jangan reuse `"auto_cabang"` —
semantiknya beda).

### 2. Keunikan — "The One and Only"

Cuma boleh ada SATU tenant `tenant_type='pusat'` di seluruh sistem — dampaknya menyentuh
SEMUA anggota, jadi ini harus dipaksa, bukan sekadar disiplin admin. Dua lapis (defense in
depth, bukan pilih salah satu):
- **DB-level**: partial unique index Postgres —
  `CREATE UNIQUE INDEX tenants_pusat_singleton ON tenants ((1)) WHERE tenant_type='pusat'`
  (trik standar Postgres untuk "maksimal satu baris yang memenuhi kondisi").
- **Application-level**: `createTenantAction`/`linkTenantToCabangAction`-setara — cek
  `SELECT COUNT(*) FROM tenants WHERE tenant_type='pusat'` sebelum insert, tolak dengan pesan
  jelas kalau sudah ada ("IKPM Pusat sudah dibuat sebelumnya — hanya boleh ada satu.") supaya
  admin dapat pesan yang jelas, bukan error constraint mentah dari DB.

### 3. Auto-populate — cabang ketiga di `syncAutoTenantMemberships()`

`packages/db/src/helpers/member-sync.ts` sekarang punya 2 cabang (cabang match
`primaryCabangRefId`, marhalah match `graduationYear`) — perlu cabang ke-3 yang **TANPA
kondisi WHERE apa pun**, dijalankan UNCONDITIONAL setiap kali fungsi ini dipanggil (bukan
digate oleh parameter apa pun, beda dari 2 cabang lain yang butuh
`primaryCabangRefId`/`graduationYear` terisi dulu):

```typescript
// 3. IKPM Pusat Auto-Join — TANPA syarat, berjalan untuk SETIAP pemanggilan fungsi ini
const [pusatTenant] = await runner
  .select({ id: tenants.id })
  .from(tenants)
  .where(and(eq(tenants.tenantType, "pusat"), eq(tenants.isActive, true)))
  .limit(1);

if (pusatTenant) {
  await runner
    .insert(tenantMemberships)
    .values({
      tenantId: pusatTenant.id,
      memberId,
      status: "active",
      registeredVia: "auto_pusat",
      membershipType: "pusat",
    })
    .onConflictDoNothing();
}
```

Fungsi ini sudah dipanggil dari 4 titik yang tepat (`createMemberAction`, `updateMemberAction`,
`commitImportAction`, `PATCH /api/akun/member-data`) — cabang baru ini otomatis ikut berjalan
di keempatnya tanpa perlu sentuh titik pemanggilan mana pun. Kalau tenant `pusat` belum
dibuat sama sekali (`pusatTenant` kosong), cabang ini no-op — aman dipasang lebih dulu sebelum
tenant-nya benar-benar ada.

### 4. Backfill retroaktif

Begitu tenant `pusat` dibuat, SEMUA anggota yang SUDAH ADA (bukan cuma anggota baru ke depan)
perlu langsung dapat `tenant_memberships` — analog persis dengan bulk-insert yang sudah ada
untuk cabang/marhalah di `createTenantAction`/`linkTenantToCabangAction`
(`apps/web/app/(platform)/platform/(protected)/actions.ts`), cuma TANPA filter `WHERE` sama
sekali. Beda penting dari pola existing: cabang/marhalah backfill mengambil SUBSET anggota ke
JS (`SELECT ... WHERE primaryCabangRefId=X` → `.map()` → bulk insert array) — untuk Pusat,
subsetnya adalah SELURUH `public.members` (berpotensi jauh lebih besar, bisa ribuan+). Untuk
skala itu, JANGAN tarik semua baris ke memori Node dulu — pakai raw SQL `INSERT ... SELECT`
satu statement (Postgres proses server-side):

```sql
INSERT INTO public.tenant_memberships (tenant_id, member_id, status, registered_via, membership_type)
SELECT $1, id, 'active', 'auto_pusat', 'pusat'
FROM public.members
ON CONFLICT DO NOTHING;
```

### 5. Interaksi dengan fitur eligibility/overlay/branding yang sudah ada — sebagian besar GRATIS

Ditelusuri terhadap kode yang sudah dibaca sesi ini — beberapa mekanisme sudah generalisasi ke
"non-forum" secara biner (bukan per-tipe spesifik), jadi otomatis mencakup `pusat` tanpa
sentuh kode:
- `akun/page.tsx`'s cabang `if (overlayIsForum) {...} else {...}` — SEMUA tipe non-forum
  (cabang, marhalah, dan `pusat` nanti) jatuh ke cabang `else` yang sama, yang menghitung
  `overlayIsJoined` dari keberadaan baris `tenant_memberships` dan tetap menjalankan
  `checkMemberEligibility()` untuk menentukan overlay "Lengkapi Data". Nol kode tambahan.
- `resolveAkunBranding()` (`lib/resolve-akun-branding.ts`) — resolusi "genuine member tenant
  yang dibrowsing" berbasis keberadaan baris `tenant_memberships`, bukan tipe tenant spesifik.
  Begitu baris Pusat ter-insert (via § 3/§ 4), browsing `/akun` di tenant Pusat otomatis
  resolve branding tenant itu tanpa kode tambahan.
- `checkMemberEligibility()` (`lib/member-eligibility.ts`) — tidak pernah branch berdasarkan
  tipe tenant sama sekali (parameternya `memberId` + daftar modul ekosistem aktif tenant yang
  dibrowsing) — otomatis berfungsi sama untuk Pusat.

**Yang PERLU diverifikasi ulang saat eksekusi** (bukan diasumsikan pasti aman dari analisis
statis ini): field label organisasi (`resolveOrgLabels()`, dipakai halaman register) saat ini
punya 3 cabang (cabang/marhalah/forum) — perlu cabang ke-4 eksplisit untuk `pusat` (mis. label
copy "Anggota IKPM Pusat" atau serupa), karena kalau tidak ditangani akan jatuh ke fallback
default yang belum tentu tepat.

### 6. Yang TIDAK diubah

- `checkMemberEligibility()`, `MembershipEligibilityOverlay`, alur `/gabung` (khusus
  `tenant_type==='forum'`, tidak relevan untuk Pusat karena keanggotaannya otomatis, bukan
  opt-in) — nol perubahan.
- Modul Surat/Toko/Website/Keuangan/Event — nol perubahan, tenant Pusat memakainya persis
  seperti tenant cabang biasa.
- Isolasi schema-per-tenant — TETAP berlaku penuh. Dashboard Pusat tidak bisa dan tidak akan
  bisa membaca `tenant_{slug}.*` tenant lain.

### File yang akan disentuh (kalau/saat dieksekusi)

| File | Perubahan |
|------|-----------|
| `packages/db/src/schema/public/tenants.ts` | `TENANT_TYPES` +`"pusat"` |
| `packages/db/src/schema/public/tenant-memberships.ts` | `MEMBERSHIP_TYPES`/`REGISTERED_VIA` +`"pusat"`/`"auto_pusat"` |
| `packages/db/migrations/00XX_tenant_type_pusat.sql` (baru) | CHECK constraint 2 kolom + partial unique index |
| `packages/db/src/helpers/member-sync.ts` | Cabang ke-3 unconditional (§ 3) |
| `apps/web/app/(platform)/platform/(protected)/actions.ts` | `createTenantAction` — cek keunikan + backfill raw SQL (§ 2, § 4) |
| `lib/tenant-org-label.ts` (`resolveOrgLabels()`) | Cabang ke-4 untuk label registrasi (§ 5) |

---

## Menu Admin Khusus IKPM Pusat: "Ringkasan Tenant" 📋 RENCANA

> **Status: RENCANA — belum dieksekusi.** Diminta user 2026-08-06, langsung setelah eksekusi
> Fase A–D IKPM Pusat di atas selesai: *"bikin perencanaan yang merangkum semua aktifitas
> keanggotaan masing2 tenant.. isinya rangkuman anggota masing2 dan statistik masing2 tenant..
> hanya ada di IKPM pusat dan hanya bisa diakses ikpm pusat.. dia menu tersendiri di admin..
> jadi ada tenant apa saja, anggota berapa, dll gitu lah.. pokoknya rangkuman semua tenant.."*

### Konsep

Menu dashboard BARU — satu-satunya menu di seluruh sistem yang menampilkan data AGREGAT
lintas SELURUH tenant — tapi HANYA muncul dan HANYA bisa diakses dari dalam dashboard admin
tenant `tenant_type='pusat'` itu sendiri (bukan Platform Admin `/platform/*`, yang merupakan
sistem auth terpisah/JWT; bukan tenant lain manapun).

**Prinsip yang mengatur seluruh desain ini**: modul ini HANYA membaca dari 3 tabel `public`
schema yang memang didesain sebagai backbone lintas-tenant SEJAK AWAL project (`public.
tenants`, `public.tenant_memberships`, `public.members`) — TIDAK PERNAH membaca `tenant_
{slug}.*` (surat, keuangan, produk, event, dst) milik tenant LAIN. Ini BUKAN pengecualian
terhadap isolasi schema-per-tenant yang sudah dikunci sejak awal project (§ "Cross-Tenant Data
Access — Aturan" di bawah) — murni memanfaatkan layer yang memang sudah global by design.
Kalau nanti ada permintaan menampilkan data OPERASIONAL tenant lain (mis. "total transaksi
semua tenant", "berapa post yang diterbitkan semua tenant") — itu keputusan arsitektur
TERPISAH yang harus didiskusikan ulang dari nol, bukan otomatis termasuk perluasan fitur ini.

### Keamanan — dua lapis wajib (non-negotiable)

Fitur ini secara struktural rawan jadi celah kebocoran data lintas-tenant kalau cuma
disembunyikan dari sidebar (UX-level hiding) tanpa guard server-side — ini kelas bug yang
sudah berkali-kali terjadi & difix di project ini (isolasi custom domain, dst, lihat CLAUDE.md
"[2026-07-08] Bug kritis: custom domain bisa akses admin dashboard tenant manapun" dan
turunannya). WAJIB dua lapis, bukan salah satu:

1. **Sidebar (murni UX, BUKAN pertahanan)** — item menu "Ringkasan Tenant" hanya dirender
   kalau `tenant.tenantType === "pusat"`.
2. **Server-side guard (pertahanan SESUNGGUHNYA)** — halaman itu sendiri WAJIB cek ulang di
   baris pertama Server Component: `if (access.tenant.tenantType !== "pusat")
   redirect(\`/app/${slug}/dashboard\`)` — pola PERSIS sama dengan guard 10-modul permission
   (`canAccess(...)`) yang sudah ada di 10 modul lain, cuma kondisinya TIPE TENANT bukan
   role-permission. Tanpa guard #2, admin tenant CABANG manapun yang tahu/menebak URL bisa
   melihat rangkuman keanggotaan SELURUH tenant lain — sidebar hiding TIDAK mencegah akses
   URL langsung.

### Route + Menu

- Route baru: `/app/{slug}/ringkasan-tenant` — folder
  `app/(dashboard)/app/[tenant]/ringkasan-tenant/page.tsx`.
- Sidebar label: **"Ringkasan Tenant"**, icon `Network` (lucide-react — diverifikasi ada di
  `.d.ts` `lucide-react@1.8.0` yang terinstall sebelum dipakai).
- BUKAN bagian sistem 10-modul (`Module` di `lib/permissions.ts`, `website|surat|keuangan|
  toko|donasi|event|dokumen|anggota|media|pengurus`) — itu axis PERMISSION per role DALAM satu
  tenant (full/read/own/none). Menu ini axis berbeda: TIPE TENANT (visible hanya untuk satu
  tenant spesifik, terlepas role user di dalamnya — owner maupun sekretaris tenant Pusat
  sama-sama boleh lihat, tidak digate lebih lanjut per role). JANGAN dicampur jadi modul ke-11
  di `Module` union — dua konsep yang berbeda, akan mengaburkan makna axis permission yang
  sudah mapan.

### Wiring sidebar (4 file, prop-threading sederhana)

`(dashboard)/app/[tenant]/layout.tsx` SUDAH punya `tenant` (full row hasil `getTenantAccess()`,
termasuk `tenantType`) — cukup hitung `isPusatTenant = tenant.tenantType === "pusat"` dan
teruskan sebagai prop baru melalui rantai yang sudah ada:

```
layout.tsx  →  Sidebar (desktop) + MobileSidebar (mobile, cuma wrap <Sidebar>)  →  SidebarNav
```

- `components/dashboard/sidebar-nav.tsx` — `NavItem` type tambah field opsional
  `pusatOnly?: boolean` (sejajar `module`). `NAV_ITEMS` tambah entry baru:
  `{ label: "Ringkasan Tenant", icon: Network, path: "ringkasan-tenant", module: null,
  pusatOnly: true }`. Filter logic diperluas: `if (item.pusatOnly) return isPusatTenant;`
  dicek SEBELUM cek `module` (item ini `module: null` supaya tidak ikut lolos permission
  check `canAccess`, murni digate tipe tenant).
- `components/dashboard/sidebar.tsx` + `mobile-sidebar.tsx` — tambah prop `isPusatTenant:
  boolean`, teruskan ke `<SidebarNav>`. `MobileSidebar` sekadar forward props ke `<Sidebar>`
  (sudah merender `SidebarNav` di dalamnya) — cukup 1 baris tambahan di masing-masing.

### Data yang ditampilkan (Fase 1 — cukup untuk permintaan awal user)

**A. KPI ringkas** — 4× `<StatCard>` (reuse `components/dashboard/stat-card.tsx` apa adanya,
komponennya sudah generik, nol perubahan diperlukan):
- Total tenant aktif — `COUNT(*) FROM tenants WHERE isActive=true`
- Total anggota IKPM (unique) — `COUNT(*) FROM members`
- Total baris keanggotaan tercatat — `COUNT(*) FROM tenant_memberships` (BISA lebih besar dari
  jumlah anggota unique karena satu anggota bisa jadi member di banyak tenant sekaligus — beri
  sublabel yang jujur soal ini di `<StatCard sublabel=...>`, jangan biarkan terlihat seperti
  duplikasi data)
- Anggota baru bulan ini — `COUNT(*) FROM members WHERE createdAt >= awal_bulan_ini` — WAJIB
  pakai anchor kalender WIB (`anchorTodayUtc()`/pola timezone yang sudah dikunci berkali-kali
  di project ini), BUKAN `new Date()` mentah yang bisa geser 1 hari di jam-jam awal WIB (lihat
  lesson lama "Bug Kritis Import Anggota" / rangkaian bug WIB-vs-UTC lain di CLAUDE.md).

**B. Breakdown jumlah tenant per tipe** — bar list kecil (cabang/marhalah/forum/pusat),
`GROUP BY tenant_type`, urutan tetap sesuai `TENANT_TYPES` (bukan hasil `COUNT` descending,
supaya urutannya konsisten setiap render).

**C. Tabel utama: daftar tenant + jumlah anggota** (INTI permintaan user — "ada tenant apa
saja, anggota berapa, dll"):

```sql
SELECT
  t.id, t.slug, t.name, t.tenant_type, t.is_active, t.created_at,
  COUNT(tm.id) AS total_members,
  COUNT(tm.id) FILTER (WHERE tm.status = 'active')   AS active_members,
  COUNT(tm.id) FILTER (WHERE tm.status = 'alumni')   AS alumni_members,
  COUNT(tm.id) FILTER (WHERE tm.status = 'inactive') AS inactive_members
FROM public.tenants t
LEFT JOIN public.tenant_memberships tm ON tm.tenant_id = t.id
GROUP BY t.id
ORDER BY total_members DESC;
```

Kolom tabel: Nama tenant (+ badge tipe — REUSE style `TYPE_LABEL` dari `/platform/tenants/
page.tsx`, drive-by gap ditemukan saat riset: entry `"pusat"` BELUM ada di `TYPE_LABEL` situ,
fallback diam-diam ke `TYPE_LABEL.cabang` → badge tenant Pusat sendiri di `/platform/tenants`
salah tampil "Cabang" — WAJIB ditambahkan sekalian saat eksekusi, item terpisah di tabel file
di bawah), Slug, Total Anggota, breakdown Aktif/Alumni/Non-aktif (kolom terpisah atau expand,
diputuskan saat implementasi), Status tenant (Aktif/Non-aktif). **TIDAK ada link keluar** ke
`/platform/tenants/{slug}` — itu sistem auth TERPISAH (JWT `platform_users`, bukan Better Auth
`tenant.users`), admin dashboard tenant Pusat kemungkinan besar TIDAK punya akses ke situ;
murni tampilan informasi read-only, tidak actionable.

**D. Data quality insight** (opsional tapi murah untuk ditambahkan sekalian): jumlah anggota
yang BELUM tersambung ke PC IKPM resmi manapun — `COUNT(*) FROM members WHERE
primary_cabang_ref_id IS NULL`. Berguna operasional buat admin Pusat memantau kelengkapan data
backbone.

### Di luar scope Fase 1 (ide lanjutan, TIDAK diminta eksplisit — jangan dieksekusi tanpa konfirmasi)

- Grafik tren pendaftaran anggota (harian/mingguan/bulanan) — bisa reuse pola
  `components/dashboard/income-expense-chart.tsx` (recharts, dipakai dashboard tenant biasa
  untuk grafik pemasukan/pengeluaran) sebagai referensi bikin komponen `MemberGrowthChart`
  serupa.
- Breakdown demografis lintas-tenant (kabupaten/provinsi/angkatan agregat) — pola query-nya
  SUDAH ADA di `/{slug}/statistik` (halaman publik per-tenant, § lesson CLAUDE.md "Statistik —
  Pola Angkatan dengan Sub-periode"), tinggal dilepas filter `tenant_memberships.tenantId`
  untuk versi lintas-tenant.
- Filter/search di tabel tenant (mirip `/platform/tenants` yang sudah punya query param
  `q`+`status`).

### File yang akan disentuh (saat dieksekusi)

| File | Perubahan |
|------|-----------|
| `components/dashboard/sidebar-nav.tsx` | `NavItem.pusatOnly` + entry baru + filter logic |
| `components/dashboard/sidebar.tsx` | prop `isPusatTenant` → diteruskan ke `SidebarNav` |
| `components/dashboard/mobile-sidebar.tsx` | prop `isPusatTenant` → diteruskan ke `Sidebar` |
| `(dashboard)/app/[tenant]/layout.tsx` | hitung `isPusatTenant`, teruskan ke `Sidebar`+`MobileSidebar` |
| `(dashboard)/app/[tenant]/ringkasan-tenant/page.tsx` (baru) | Server Component: guard tipe tenant + 4 query (A–D) + render StatCard+tabel |
| `(platform)/platform/(protected)/tenants/page.tsx` | drive-by fix: tambah entry `TYPE_LABEL.pusat` (gap ditemukan saat riset fitur ini, badge platform admin salah tampil "Cabang" untuk tenant Pusat) |

**Nol migrasi DB diperlukan** — seluruh data sumber (`tenants`, `tenant_memberships`,
`members`) sudah ada sejak lama, fitur ini murni query+render baru.

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

- Buat tenant forum: `/platform/tenants/new` (platform admin) — bukan self-service.
- Halaman pendaftaran anggota (v2, live): **`/gabung`** (bukan `/{forum-slug}/daftar` seperti
  rencana v1 lama) — cek kelayakan data (bukan form baru), opsional syarat iuran via
  produk/campaign existing. Detail lengkap: **`docs/arsitektur-gabung-forum.md`**.
- Settings admin forum: `/app/{slug}/settings/keanggotaan`.

---

## Cross-Tenant Data Access — Aturan

| Situasi | Apa yang Bisa Dilihat |
|---------|----------------------|
| Anggota buka `/akun` di marhalah | Profil pribadi, data usaha, transaksi di marhalah ini |
| Anggota buka `/akun` di forum | Profil pribadi, data usaha yang di-share ke forum, transaksi di forum |
| Admin marhalah lihat anggota | Profil publik (tanpa NIK, detail alamat, tanggal+bulan lahir) |
| Admin forum lihat anggota | Profil publik + data usaha yang di-share ke forum |
| Admin cabang | Data penuh anggota cabangnya sendiri |
| Admin IKPM Pusat (menu "Ringkasan Tenant" 📋) | HANYA rangkuman agregat lintas-tenant dari `tenants`+`tenant_memberships`+`members` (nama tenant, jumlah anggota per tenant, breakdown status) — TIDAK PERNAH data operasional tenant lain (surat/keuangan/produk/dst, tetap terisolasi penuh) |

**Aturan privasi yang tidak boleh dilanggar:**
- NIK tidak pernah tampil lintas organisasi
- Detail alamat (kecamatan/desa/jalan) tidak tampil di luar cabang sendiri
- Kontak (HP/WA/email) hanya tampil jika `contacts.is_*_public = true`
- Rangkuman agregat lintas-tenant ("Ringkasan Tenant") HANYA reachable dari dashboard admin
  tenant `tenant_type='pusat'` itu sendiri — WAJIB guard server-side di halaman itu sendiri,
  bukan cuma disembunyikan dari sidebar (lihat § "Menu Admin Khusus IKPM Pusat" di atas)

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

> **Dipindahkan ke `docs/arsitektur-gabung-forum.md`** § "Roadmap Historis — Phase 4 Checklist
> Lama" (2026-08-06). Rencana yang berlaku sekarang (dan sudah diimplementasikan): § "Alur
> Pendaftaran Forum v2" di dokumen itu, termasuk checklist "Urutan Eksekusi (Fase A–E)".

### Phase 5 — IKPM Pusat + Platform Dashboard

> **Baris pertama di bawah ini SEBELUMNYA salah kerangka** — ditulis seolah "IKPM Pusat"
> berarti Platform Admin diberi kemampuan membaca data operasional (surat/keuangan/dst)
> lintas tenant. Setelah didiskusikan ulang 2026-08-06, yang dimaksud "IKPM Pusat" adalah
> **tenant tersendiri dengan keanggotaan tanpa batas** (semua anggota otomatis jadi
> anggotanya) — BUKAN kemampuan baca lintas-schema. Lihat § "Tenant Khusus: IKPM Pusat —
> Keanggotaan Tanpa Batas" di atas untuk desain lengkap yang menggantikan baris pertama ini.

- [x] Tenant `pusat` — § "Tenant Khusus: IKPM Pusat" di atas (tipe tenant baru, auto-populate
      unconditional, backfill retroaktif, constraint "the one and only") — DIEKSEKUSI
      2026-08-06, commit `a6f877b`+`679f2f9`, migration jalan di lokal+VPS
- [ ] Kelola katalog forum resmi
- [ ] Statistik alumni global (berapa anggota, sebaran wilayah, angkatan) — § "Menu Admin
      Khusus IKPM Pusat: 'Ringkasan Tenant'" di atas (RENCANA, belum dieksekusi) — dibangun
      sebagai menu dashboard tenant Pusat sendiri (bukan Platform Admin), fase pertama cukup
      daftar tenant+jumlah anggota, breakdown wilayah/angkatan lintas-tenant masuk fase lanjutan

---

## Hubungan dengan Dokumen Arsitektur Lain

| Dokumen | Relevansi |
|---------|-----------|
| `arsitektur-gabung-forum.md` | Alur pendaftaran/bergabung anggota ke tenant tipe forum (v1 historis + v2 implementasi + audit sinkronisasi kode) — dipindahkan keluar dari dokumen ini 2026-08-06 |
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
