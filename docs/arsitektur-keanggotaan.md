# Arsitektur Keanggotaan — jalajogja / Ekosistem IKPM Gontor

## Visi

jalajogja bukan hanya platform per-cabang. Ini adalah **ekosistem IKPM Gontor** — satu
identitas anggota berlaku di seluruh cabang. Seorang alumni Gontor yang terdaftar di
IKPM Jogja bisa berbelanja produk IKPM Jakarta, berdonasi ke IKPM Surabaya, atau
mendaftar event IKPM Bandung — **tanpa membuat akun baru**.

---

## Dua Lapisan Identitas

```
LAPISAN 1 — Identitas Global (siapa orangnya)
─────────────────────────────────────────────
public.members
  id, member_number, stambuk_number, nik
  name, gender, birth_place, birth_date
  contact_id → public.contacts (phone, email)
  photo_url

public.member_number_seq   → SEQUENCE global, atomic, tidak duplikat antar cabang

LAPISAN 2 — Relasi Keanggotaan (anggota ini di cabang mana)
─────────────────────────────────────────────────────────────
public.tenant_memberships
  tenant_id, member_id
  status: active | inactive | alumni
  joined_at, registered_via
```

Satu orang bisa punya **satu record di `public.members`** (identitas universal) dan
**banyak record di `tenant_memberships`** (terdaftar di lebih dari satu cabang).

---

## Home Tenant vs Guest Tenant

| Konsep | Definisi |
|--------|----------|
| **Home Tenant** | Cabang tempat anggota terdaftar di `tenant_memberships` |
| **Guest Tenant** | Cabang tempat anggota bertransaksi tapi bukan anggota resmi |

Satu anggota bisa punya **banyak Home Tenant** jika memang terdaftar di beberapa cabang.
Guest Tenant tidak menambah keanggotaan — hanya meninggalkan rekam jejak transaksi.

---

## Hak Akses per Konteks

### Di Home Tenant (terdaftar sebagai anggota)

| Aksi | Bisa? |
|------|-------|
| Login ke dashboard tenant | ✓ (jika punya `tenant.users` record) |
| Lihat + edit profil sendiri | ✓ |
| Tambah/edit data usaha | ✓ |
| Tambah/edit data pendidikan | ✓ |
| Transaksi (beli, donasi, event) | ✓ |
| Lihat riwayat transaksi di cabang ini | ✓ |

### Di Guest Tenant (bukan anggota resmi di sana)

| Aksi | Bisa? |
|------|-------|
| Login ke dashboard tenant | ✗ (tidak punya akun di tenant ini) |
| Lihat + edit profil | ✗ |
| Transaksi (beli, donasi, event) | ✓ — via checkout HP/email atau login universal |
| Riwayat transaksi tersimpan atas nama member_id | ✓ |

### Super Admin jalajogja

| Aksi | Bisa? |
|------|-------|
| Query `public.members` tanpa filter tenant | ✓ |
| Lihat semua member dari semua cabang | ✓ |
| Edit data member manapun | ✓ |

---

## Cara Member Bertransaksi di Tenant Lain (Cross-Tenant)

### Jalur 1 — Guest Checkout (tanpa login)

**Prinsip UX:** Semua transaksi wajib tercatat. Tapi login tidak boleh jadi penghalang.
Sistem selalu menawarkan login dulu — jika tidak mau, cukup HP + email. Cepat, tanpa akun.

**UX Flow di halaman publik (event, donasi, toko):**
```
User buka halaman event / donasi / produk
→ Klik "Daftar / Donasi / Beli"
→ Sistem tampilkan prompt: "Masuk untuk proses lebih cepat" (dengan tombol Login + opsi "Lanjut tanpa login")
→ [Jika pilih Login] → masuk via Jalur 2 (Login Universal)
→ [Jika pilih Lanjut tanpa login] → form checkout muncul: isi nama, HP, email
→ Checkout diproses:
    System lookup: SELECT dari public.members JOIN public.contacts
      WHERE contacts.phone = '{hp}' OR contacts.email = '{email}'
    → Ketemu  → invoice.member_id = member.id (transaksi ter-link ke identitas)
    → Tidak ketemu → invoice.member_id = null (guest murni: nama/hp/email disimpan di invoice)
```

**Aturan penting:**
- HP + email di form checkout bukan opsional — keduanya wajib diisi (untuk lookup + konfirmasi pembayaran)
- Sistem tidak otomatis membuat akun baru hanya dari transaksi — guest tetap guest
- Jika nomor HP/email cocok dengan anggota → transaksi ter-link ke identitasnya, meski mereka tidak login
- Ini berlaku lintas modul: Toko, Donasi, Event — flow checkout selalu sama

### Jalur 2 — Login Universal (via front-end)

```
Member login di front-end jalajogja (session Better Auth universal)
→ Bisa browse semua tenant
→ Checkout otomatis ter-link ke member_id (tidak perlu isi HP/email lagi)
→ Invoice/donasi/registrasi event tercatat atas nama member tersebut
```

### Jalur 3 — WhatsApp / Email OTP (rencana)

```
Member tidak punya akun login tapi ada di database
→ Masuk via OTP ke HP/email
→ Session sementara: bisa checkout, lihat riwayat transaksi sendiri
→ Tidak bisa edit profil (perlu verifikasi lebih lanjut di home tenant)
```

---

## Aturan Akses Data (Application-Level)

PostgreSQL tidak memakai RLS. Access control sepenuhnya di aplikasi:

```typescript
// Tenant query — SELALU join ke tenant_memberships
const members = await db
  .select()
  .from(publicMembers)
  .innerJoin(tenantMemberships,
    and(
      eq(tenantMemberships.memberId, publicMembers.id),
      eq(tenantMemberships.tenantId, currentTenantId)
    )
  );

// Super admin — query langsung tanpa filter
const allMembers = await db.select().from(publicMembers);
```

**Aturan kritis:**
- Tenant A **tidak boleh** melihat member Tenant B, meskipun datanya ada di tabel yang sama
- Tenant A **boleh** melihat transaksi dari member manapun yang bertransaksi di tenant A
  (karena invoice/order di tenant schema milik tenant A)
- Edit profil (`public.members`) hanya boleh oleh home tenant atau super admin

---

## Tracking Transaksi Lintas Cabang

Setiap transaksi menyimpan `member_id` di tabel masing-masing modul:

```
tenant_ikpm_jogja.invoices.member_id   → public.members.id
tenant_ikpm_jogja.orders.customer_id   → public.members.id (nullable)
tenant_ikpm_jogja.donations.member_id  → public.members.id (nullable)
tenant_ikpm_jogja.event_registrations.member_id → public.members.id (nullable)
```

Ini memungkinkan:
- **Di home tenant**: lihat semua transaksi anggota di cabang ini
- **Di platform admin**: aggregasi semua transaksi member di seluruh cabang (future)
- **Di profil member** (future): "Riwayat Kontribusi ke Ekosistem IKPM" lintas cabang

---

## Format Nomor Anggota (Global)

```
{tahun_daftar} + {DDMMYYYY_lahir} + {urutan_global_5_digit}

Contoh:
  Lahir 26-10-1981, daftar 2025, urutan ke-1 → 20252610198100001
```

Generator: `generateMemberNumber(db, birthDate, year?)` di
`packages/db/src/helpers/member-number.ts` — menggunakan PostgreSQL SEQUENCE
`public.member_number_seq` yang atomic (tidak duplikat meski concurrent insert).

---

## Deteksi Duplikasi Anggota

Karena `public.members` adalah satu sumber kebenaran, duplikasi NIK bisa dideteksi
secara global:

```sql
-- Constraint di DB:
ALTER TABLE public.members ADD CONSTRAINT members_nik_not_null_unique
  UNIQUE (nik) WHERE nik IS NOT NULL;
```

Jika admin cabang A input anggota dengan NIK yang sama dengan anggota cabang B:
- Sistem menolak dengan error `members_nik_not_null_unique`
- Solusi: cek apakah anggota sudah ada, jika ya → tambahkan ke `tenant_memberships` saja
  (tanpa create member baru)

---

## Struktur Schema Database

```
packages/db/src/schema/public/
├── members.ts              → public.members (identitas global)
├── tenant-memberships.ts   → public.tenant_memberships (relasi cabang)
└── auth.ts                 → public.user, public.session, public.account

packages/db/src/helpers/
└── member-number.ts        → generateMemberNumber() via SEQUENCE global
```

**Tenant schema TIDAK punya tabel members.** Referensi ke member via UUID:
- `tenant_{slug}.users.member_id` → `public.members.id`
- `tenant_{slug}.orders.customer_id` → `public.members.id` (nullable)
- `tenant_{slug}.invoices.member_id` → `public.members.id` (nullable)
- `tenant_{slug}.donations.member_id` → `public.members.id` (nullable)

---

## Skenario Lifecycle Anggota

### Skenario 1 — Anggota baru daftar di IKPM Jogja
```
1. Admin IKPM Jogja input via wizard anggota
2. Record baru di public.members (identitas)
3. Record baru di public.tenant_memberships (status: active, tenant: ikpm-jogja)
4. Nomor anggota global di-generate via SEQUENCE
```

### Skenario 2 — Anggota IKPM Jogja beli produk IKPM Jakarta
```
1. Buka front-end IKPM Jakarta → tambah ke keranjang
2. Checkout → isi nomor HP
3. System lookup: HP ditemukan di public.contacts → member_id = {id anggota tsb}
4. Invoice IKPM Jakarta.member_id = {id anggota IKPM Jogja}
5. Anggota TIDAK masuk di tenant_memberships IKPM Jakarta
6. Admin IKPM Jakarta bisa lihat: "ada transaksi dari member X"
   tapi TIDAK bisa lihat profil lengkap member X (bukan anggota mereka)
```

### Skenario 3 — Anggota terdaftar di dua cabang
```
1. Alumni daftar di IKPM Jogja tahun 2020 → member_id: {X}
2. Pindah ke Jakarta, daftar juga di IKPM Jakarta → cek NIK dulu
3. NIK sudah ada → JANGAN buat member baru
4. Tambahkan: tenant_memberships (tenant: ikpm-jakarta, member_id: {X})
5. Sekarang anggota X bisa login di KEDUA dashboard
```

### Skenario 4 — Guest tanpa data di sistem
```
1. Orang luar (bukan alumni Gontor) donasi ke IKPM Jogja
2. Checkout → isi nama + HP + email
3. System lookup: tidak ditemukan di public.members
4. Donasi tersimpan: donations.member_id = null, donor_name/phone/email diisi langsung
5. Data tidak masuk public.members (bukan anggota ekosistem)
```

---

## Roadmap Fitur Keanggotaan

| Fitur | Status | Keterangan |
|-------|--------|------------|
| Identitas universal `public.members` | ✅ Selesai | Schema + CRUD + wizard 4-step |
| Akses terisolasi per tenant | ✅ Selesai | JOIN tenant_memberships di semua query |
| Guest checkout via HP/email (lookup member) | ✅ Selesai | Di billing Phase 2 |
| Member terdaftar di >1 cabang | ✅ Schema siap | UI belum (perlu "claim membership") |
| Login universal front-end | 🔲 Belum | Setelah front-end dibangun |
| OTP WhatsApp/Email untuk akses | 🔲 Belum | Butuh WhatsApp add-on aktif |
| Profil member lintas cabang | 🔲 Belum | Bagian dari Front-end Phase |
| Riwayat transaksi aggregasi | 🔲 Belum | Platform admin (Phase 3) |
| "Claim membership" — anggota cabang lain | 🔲 Belum | UI untuk skenario 3 |

---

## Implementasi — Route & Komponen

```
app/(dashboard)/[tenant]/members/
├── actions.ts          → Server Actions: createMemberAction, updateMemberAction, removeMemberFromTenantAction
├── page.tsx            → /{slug}/members — list + search + filter + pagination
├── new/page.tsx        → /{slug}/members/new — form tambah anggota (MemberForm step 1)
└── [id]/
    ├── page.tsx        → /{slug}/members/{id} — detail anggota
    ├── delete-button.tsx → CLIENT component, inline confirm
    └── edit/page.tsx   → /{slug}/members/{id}/edit — form edit anggota
```

**MemberForm** — shared antara new + edit:
- `defaultValues` prop untuk pre-fill di mode edit
- `memberId` prop untuk menentukan teks tombol ("Tambah" vs "Simpan")
- `joinedAt` default = `today()` client-side — tidak dari server (hindari hydration mismatch)

**Server Actions — pola wajib:**
- Semua action validasi `getTenantAccess()` terlebih dahulu — tidak ada aksi tanpa auth tenant
- Update: dua query atomik berurutan — `UPDATE public.members` + `UPDATE public.tenant_memberships`
- Delete: hanya hapus dari `tenant_memberships` — data identitas global di `public.members` TIDAK dihapus

---

## Implementasi — Member Wizard 4-Step

Wizard untuk tambah anggota baru. Step 1 wajib (buat record), Step 2–4 opsional (bisa skip/diisi nanti).

| Step | Isi | Wajib? |
|------|-----|--------|
| 1 — Identitas | Nama, NIK, gender, tanggal lahir, nomor stambuk | ✅ Wajib submit |
| 2 — Kontak & Alamat | Phone, email, alamat rumah (WilayahSelect) | Opsional |
| 3 — Pendidikan | Riwayat pendidikan (dynamic list) | Opsional |
| 4 — Usaha | Data usaha + alamat usaha | Opsional |

**Detail implementasi:**
- Cabang domisili otomatis dari context tenant (bukan pilihan user) — field read-only di UI
- Dynamic list education & business: **replace-all strategy** — hapus semua lama → insert batch baru
- Alamat Indonesia/Luar Negeri: toggle pill button, mutual exclusive
  - LN: simpan `country` text, wilayah-null-kan
  - Indonesia: simpan wilayah, country-null-kan
  - Berlaku untuk alamat rumah (Step 2) DAN alamat usaha (Step 4)
- `addresses` table shared helper: kolom `country` berlaku ke semua jenis alamat di DB — tapi UI dan action harus diupdate manual per form

---

## Lessons Learned — Keanggotaan

### Keputusan Besar: Sentralisasi Data Anggota

**Konteks**: Visi jalajogja sebagai ekosistem big data alumni Gontor lintas cabang IKPM.

**Keputusan**: Member data di `public` schema, akses dikontrol application-level. Tenant hanya query member via JOIN `tenant_memberships`. Member bisa bertransaksi di tenant lain tanpa daftar ulang — guest checkout lookup via HP/email.

**Implikasi ke kode**:
- `tenant_{slug}.members` **tidak ada** — semua referensi ke `public.members.id`
- `generateMemberNumber()` pakai PostgreSQL SEQUENCE `public.member_number_seq` (atomic)
- Semua query tenant wajib JOIN `tenant_memberships WHERE tenant_id = {current}`

**Pelajaran**: Shared entity lintas tenant → `public` schema + application-level access control. Bukan tenant schema terisolasi.

### NIK Duplicate Error Detection

NIK memakai partial unique index (bukan `.unique()` Drizzle — tidak support partial index):
```sql
ALTER TABLE public.members ADD CONSTRAINT members_nik_not_null_unique
  UNIQUE (nik) WHERE nik IS NOT NULL;
```
Di server action, deteksi via constraint name di catch block:
```typescript
if (err.constraint === "members_nik_not_null_unique") {
  return { error: "NIK sudah terdaftar di sistem." };
}
```

### SEQUENCE member_number_seq — Bug & Fix

`public.member_number_seq` **harus dibuat manual via raw SQL** — tidak bisa di Drizzle schema:
```sql
CREATE SEQUENCE IF NOT EXISTS public.member_number_seq START 1;
```

**Bug**: `nextval('member_number_seq')` tanpa schema prefix gagal jika `search_path` tidak di-set.
**Fix**: Selalu pakai `nextval('public.member_number_seq')` dengan prefix eksplisit.

### WilayahSelect — Lazy Fetch Per Level

83k desa di `ref_villages` → plain `<select>` tidak feasible.
- **Provinsi**: di-fetch saat mount
- **Kabupaten**: di-fetch on-select provinsi
- **Kecamatan**: di-fetch on-select kabupaten
- **Desa**: di-fetch on-select kecamatan

Pattern ini juga berlaku untuk semua form lain yang butuh wilayah (termasuk modul Akun Publik).
