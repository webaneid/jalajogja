# Arsitektur Akun — jalajogja

> Status: **SELESAI** — arsitektur sudah diimplementasikan. Dokumen ini adalah referensi utama.

---

## Prinsip Utama (Dikunci)

> Ini bukan sekadar keputusan teknis — ini adalah identitas sistem.

jalajogja adalah super-app komunitas IKPM. Semua yang punya akses ke sistem — baik di
front-end maupun dashboard — adalah bagian dari ekosistem IKPM, dengan hierarki yang jelas:

**Pengurus adalah anggota IKPM yang sedang bertugas.**
Bukan entitas terpisah. Bukan karyawan. Bukan user biasa.
Mereka adalah alumni Gontor yang dipercaya mengelola organisasi untuk satu periode jabatan.

**Konsekuensi prinsip ini:**
- Tidak ada pengurus yang bukan anggota IKPM — `tenant.users.member_id` TIDAK BOLEH null
- Saat masa jabatan berakhir, mereka kembali menjadi anggota biasa — akun tidak dihapus
- Satu akun Better Auth berlaku di dua tempat: dashboard (saat menjabat) + front-end (selamanya)
- Aktivasi akun pengurus = otomatis dapat akses front-end sebagai anggota IKPM

---

## Empat Jenis Entitas di Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│  SUPER ADMIN JALAJOGJA (platform level)                         │
│  ✓ Akses semua tenant    ✓ Kelola modul, billing, paket         │
│  Data: platform terpisah — bukan bagian dari tenant schema      │
│  Tidak dibahas di dokumen ini                                   │
├─────────────────────────────────────────────────────────────────┤
│  LEVEL 1 — PENGURUS (subset Anggota IKPM, per tenant)           │
│  ✓ Login dashboard tenant    ✓ Login front-end (sebagai anggota)│
│  Data: public.members + public.user + tenant_{slug}.users       │
│  Diangkat oleh owner/super admin, masa jabatan terbatas         │
│  Saat jabatan berakhir → turun ke Level 2, akun tetap ada       │
├─────────────────────────────────────────────────────────────────┤
│  LEVEL 2 — ANGGOTA IKPM (alumni Gontor)                         │
│  ✗ Login dashboard tenant    ✓ Login front-end semua tenant     │
│  Data: public.members + public.user                             │
│  Kecuali diangkat jadi pengurus → naik ke Level 1               │
├─────────────────────────────────────────────────────────────────┤
│  LEVEL 3 — AKUN PUBLIK (orang umum)                             │
│  ✗ Login dashboard tenant    ✓ Login front-end semua tenant     │
│  Data: public.profiles + public.user                            │
│  Tidak bisa diangkat jadi pengurus                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Visi

jalajogja adalah super-app untuk ekosistem IKPM (alumni Pondok Modern Gontor). Ada dua
kategori pengguna yang bisa berinteraksi dengan front-end publik tenant:

1. **Anggota IKPM** — alumni Gontor, identitas dikelola admin, bisa diangkat jadi pengurus
2. **Akun Publik** — orang umum yang ingin belanja, donasi, atau ikut event

Keduanya berbeda entitas, berbeda tabel, berbeda lifecycle.

---

## Tiga Level Akses

```
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 1 — PENGURUS (subset Anggota IKPM)                   │
│  ✓ Login dashboard tenant    ✓ Login front-end              │
│  Data: public.members + public.user + tenant.users          │
│  Diangkat oleh owner/super admin, masa jabatan terbatas     │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 2 — ANGGOTA IKPM (alumni Gontor)                     │
│  ✗ Login dashboard tenant    ✓ Login front-end semua tenant │
│  Data: public.members + public.user                         │
│  Kecuali diangkat jadi pengurus → naik ke Level 1           │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 3 — AKUN PUBLIK (orang umum)                         │
│  ✗ Login dashboard tenant    ✓ Login front-end semua tenant │
│  Data: public.profiles + public.user                        │
│  Tidak bisa diangkat jadi pengurus                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Relasi Tabel

```
public.user (Better Auth — satu tabel untuk SEMUA yang bisa login)
    │
    ├─── via tenant_{slug}.users ──────────────────→ PENGURUS
    │         role: owner|ketua|sekretaris|bendahara|custom
    │         member_id ──────────────────────────→ public.members
    │         masa jabatan via /pengurus module
    │
    ├─── via public.members.better_auth_user_id ──→ ANGGOTA IKPM
    │         (front-end login lintas semua tenant)
    │         stambuk, member_number, NIK, dll
    │
    └─── via public.profiles.better_auth_user_id ─→ AKUN PUBLIK
              (front-end login lintas semua tenant)
              nama, email, phone — no IKPM data
```

---

## Tabel `public.members` — Anggota IKPM

Tabel sakral. Hanya diisi oleh admin via dashboard (`/members/new`).
Tidak bisa self-register.

```sql
public.members
  id, member_number, stambuk_number, nik
  name, gender, birth_date, birth_place
  contact_id → public.contacts (phone, email, whatsapp)
  better_auth_user_id → public.user  ← kolom untuk front-end login
```

**Kolom `better_auth_user_id` di `public.members`:**
- `null` = anggota belum punya login (data ada tapi belum aktivasi akun)
- diisi = anggota sudah bisa login di front-end
- diisi VIA proses aktivasi mandiri (`/aktivasi`) atau admin aktifkan dari dashboard

---

## Tabel `public.profiles` — Akun Publik

Self-service. Siapapun bisa daftar via `/register`.
Tidak ada data keanggotaan IKPM di sini.

```sql
public.profiles
  id, name, email (unique), phone (unique)
  whatsapp, address_detail, province_id, regency_id, district_id, village_id
  better_auth_user_id → public.user
  registered_at_tenant → public.tenants
  created_at, updated_at, deleted_at (soft delete)
```

**Tidak ada kolom `member_id` atau `account_type`** — ini khusus untuk publik saja.

---

## Alur Register

### Jalur Anggota IKPM Gontor

Tujuan utama aplikasi adalah **pendataan anggota IKPM**. Siapapun yang mengaku alumni Gontor
bisa mendaftar — baik yang datanya sudah ada di DB maupun yang belum.

```
User buka /{slug}/register → pilih "Anggota IKPM Gontor"
→ Isi form: stambuk (opsional), nama, email, HP, password

→ Live lookup (onBlur stambuk/email/HP):
    Cari di public.members via stambuk → atau via contacts.email/phone
    → Ketemu  → banner "Data ditemukan atas nama {nama}"
                mode KLAIM: nama di-prefill (read-only)
    → Tidak   → mode DAFTAR BARU: nama input bebas

→ Submit:

    [Mode KLAIM — data sudah ada di public.members]
    → Cek members.better_auth_user_id:
        → Sudah terisi → "Akun sudah ada. Gunakan lupa password."
        → Belum ada    → Buat public.user (Better Auth)
                          UPDATE public.members SET better_auth_user_id = user.id
                          Login otomatis → redirect /{slug}/akun/lengkapi

    [Mode DAFTAR BARU — belum ada di public.members]
    → Cek duplikat email/HP di contacts → ada → "Email/HP sudah terdaftar"
    → Buat public.user (Better Auth)
    → INSERT public.contacts { email, phone }
    → INSERT public.members { name, stambuk?, contact_id, better_auth_user_id }
    → Login otomatis → redirect /{slug}/akun/lengkapi
```

> Redirect ke `/akun/lengkapi` (wizard pelengkap data) — data baru pasti belum lengkap.

### Jalur Akun Publik (Bukan Anggota)

```
User buka /{slug}/register → pilih "Bukan Anggota IKPM"
→ Isi form: nama, email, HP, password
→ Cek: email/HP sudah ada di public.profiles? → "Sudah terdaftar, silakan masuk"
→ Buat public.user (Better Auth)
→ INSERT public.profiles { name, email, phone, better_auth_user_id, registered_at_tenant }
→ Login otomatis → redirect /{slug}/akun
```

---

## Alur Login & Routing Pasca Login

### Login Front-end (`/{slug}/login`)

```
Buka /{slug}/login:
→ Server component cek session dulu (auth.api.getSession)
    → Session ada → jangan tampilkan form, redirect ke tujuan:
        → getAkunIdentity() ada → /{slug}/akun
        → getAkunIdentity() null (pengurus-only) → /{slug}/dashboard
    → Session tidak ada → tampilkan LoginForm

Submit form (email + password):
→ Better Auth signIn → dapat public.user.id
→ Redirect ke /{slug}/akun

Di /{slug}/akun:
→ getAkunIdentity(userId):
    → Cek public.members WHERE better_auth_user_id = userId → ANGGOTA IKPM
    → Cek public.profiles WHERE better_auth_user_id = userId → AKUN PUBLIK
    → Tidak ketemu → user adalah pengurus tanpa front-end profile → redirect /dashboard
```

### Login Dashboard (`/{slug}/dashboard`)

Dashboard dilindungi middleware. Session tidak ada → redirect ke `/login` (atau `/login?redirect=...`).
Session ada tapi tidak di `tenant.users` → 403 / redirect halaman tidak punya akses.
Session ada dan di `tenant.users` → akses sesuai role.

### Satu Akun, Dua Konteks

```
Ahmad (anggota IKPM + pengurus aktif) login dengan email + password:

Via /{slug}/login (front-end):
→ Redirect ke /{slug}/akun → tampil sebagai ANGGOTA IKPM
→ Bisa belanja, donasi, ikut event, lihat riwayat transaksi

Via dashboard (/{slug}/dashboard):
→ Tampil sebagai PENGURUS → kelola surat, anggota, keuangan, dll

Dua konteks, satu akun. Tidak perlu logout untuk pindah — 
dashboard dan front-end membaca tabel berbeda untuk menentukan hak akses.
```

---

## Alur Pengangkatan Pengurus

```
Admin buka /{slug}/settings/users → "Tambah Pengurus"
→ Pilih dari public.members (combobox anggota aktif)
→ Pilih role (ketua/sekretaris/bendahara/custom)
→ Pilih masa jabatan (dari modul /pengurus)
→ Aktifkan: kirim link undangan ATAU admin set password
→ Insert tenant_{slug}.users:
    better_auth_user_id = public.user.id (sudah ada atau baru dibuat)
    member_id = public.members.id
    role = {pilihan}

Jika anggota belum punya better_auth_user_id:
→ Buat public.user baru (via auth.api.signUpEmail)
→ UPDATE public.members SET better_auth_user_id = userId  ← WAJIB, jangan lupa!
→ Insert tenant.users
```

> Pengurus adalah anggota IKPM — `tenant.users.member_id` TIDAK BOLEH null.
> Tidak ada pengurus yang bukan alumni Gontor.

### ⚠️ Aturan Kritis: `better_auth_user_id` Wajib Diset Saat Aktivasi

Ketika akun pengurus diaktifkan (`createOfficerWithAccountAction`), **wajib** melakukan
dua operasi sekaligus — bukan hanya satu:

```typescript
// ✅ BENAR — dua operasi
await db.update(members)
  .set({ betterAuthUserId: userId })
  .where(eq(members.id, memberId));   // ← SET ini juga

await tenantDb.insert(schema.users).values({
  betterAuthUserId: userId,
  memberId,
  role: ...,
});
```

```typescript
// ❌ SALAH — hanya insert tenant.users tanpa update members
await tenantDb.insert(schema.users).values({ betterAuthUserId: userId, memberId });
// Pengurus tidak bisa login di front-end → redirect loop saat akses /login
```

**Mengapa wajib:** `getAkunIdentity()` mencari `members.better_auth_user_id` untuk menentukan
apakah user adalah anggota IKPM di front-end. Jika null, user dianggap "dashboard-only" dan
diarahkan ke `/dashboard` saat membuka `/akun`. Ini benar untuk kasus darurat, tapi jika dibiarkan
permanen, pengurus tidak bisa menikmati hak front-end sebagai anggota IKPM (belanja, donasi, dll).

---

## Alur Masa Jabatan Berakhir

```
Masa jabatan berakhir (dari modul /pengurus)
→ DELETE atau DEACTIVATE tenant.users record
→ public.members.better_auth_user_id TETAP ada (tidak dihapus)
→ Pengurus turun kembali ke Level 2 (Anggota IKPM)
→ Masih bisa login di front-end, tidak bisa lagi masuk dashboard
```

---

## Hak Akses per Level

| Aksi | Pengurus | Anggota IKPM | Akun Publik |
|------|----------|--------------|-------------|
| Login dashboard tenant | ✓ | ✗ | ✗ |
| Login front-end semua tenant | ✓ | ✓ | ✓ |
| Belanja / donasi / ikut event | ✓ | ✓ | ✓ |
| Lihat riwayat transaksi sendiri | ✓ | ✓ | ✓ |
| Lengkapi data keanggotaan | ✓ | ✓ | ✗ |
| Diangkat jadi pengurus | ✓ (sudah) | ✓ (bisa) | ✗ (tidak bisa) |
| Akses data anggota lain | ✓ (sesuai role) | ✗ | ✗ |

---

## Route Publik

```
app/(public)/[tenant]/
├── login/page.tsx          → email + password (untuk semua level)
├── register/page.tsx       → 2 jalur: klaim anggota IKPM vs daftar publik
├── forgot-password/        → reset via email
├── reset-password/         → konfirmasi password baru
└── akun/
    ├── page.tsx            → dashboard front-end (anggota + publik)
    ├── profil/page.tsx     → edit profil
    ├── transaksi/page.tsx  → riwayat transaksi
    ├── lengkapi/page.tsx   → wizard data keanggotaan (anggota IKPM saja)
    ├── pesantren/page.tsx  → data pesantren multi-entry (anggota saja)
    └── usaha/page.tsx      → data usaha multi-entry (anggota saja)
```

---

## Data Usaha Anggota (`/akun/usaha`)

### Arsitektur Penyimpanan

Setiap usaha disimpan sebagai **satu row `public.member_businesses`** dengan tiga FK opsional ke tabel helper:

```
public.member_businesses
  id, member_id (FK → members)
  name, brand, description, category, sector
  legality, position, employees, branches, revenue
  contact_id   → public.contacts   (phone, whatsapp, email, isPhonePublic, isWhatsappPublic)
  address_id   → public.addresses  (country, provinceId, regencyId, districtId, villageId, detail, postalCode)
  social_media_id → public.social_medias (instagram, facebook, linkedin, twitter, youtube, tiktok, website)
```

FK ke tabel helper **dibuat kondisional** — hanya jika datanya ada:
- Tidak ada kontak → `contact_id = null` (tidak insert row kosong)
- Tidak ada alamat → `address_id = null`
- Tidak ada sosmed → `social_media_id = null`

### API Route: `GET /api/akun/member-business`

Auth: `members.betterAuthUserId = session.user.id` — tanpa tenant access.

Query pakai LEFT JOIN ke semua tabel helper **plus ref tables** agar nama wilayah ikut ter-resolve:

```typescript
.from(memberBusinesses)
.leftJoin(contacts,    eq(contacts.id,    memberBusinesses.contactId))
.leftJoin(addresses,   eq(addresses.id,   memberBusinesses.addressId))
.leftJoin(socialMedias, eq(socialMedias.id, memberBusinesses.socialMediaId))
// ← WAJIB: resolve ID ke nama wilayah, bukan hanya kirim angka ID
.leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
.leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
.leftJoin(refDistricts, eq(refDistricts.id, addresses.districtId))
.leftJoin(refVillages,  eq(refVillages.id,  addresses.villageId))
```

Response menyertakan kedua versi:
```
addressProvinceId, addressRegencyId, addressDistrictId, addressVillageId  ← untuk form edit
addressProvinceName, addressRegencyName, addressDistrictName, addressVillageName  ← untuk display
```

### API Route: `POST /api/akun/member-business`

**Replace-all pattern** — hapus semua usaha lama, insert ulang semua yang valid:

```
DELETE FROM member_businesses WHERE member_id = {memberId}
for each entry:
  → INSERT contacts (kondisional)
  → INSERT addresses (kondisional)
  → INSERT social_medias (kondisional)
  → INSERT member_businesses (dengan FK ke tiga row di atas)
```

Filter valid: `e.name?.trim() && e.category && e.sector` — hanya tiga field ini wajib (nama, kategori, sektor).

### UX: Three-View Pattern

Halaman `/akun/usaha` menggunakan **three-view pattern** berbasis state (bukan router navigation):

```
LIST VIEW (default)
  Table: nama usaha | kategori | sektor | aksi [Detail] [Edit] [Hapus]
  → klik [Detail] → DETAIL VIEW (dialog popup)
  → klik [Edit]   → EDIT VIEW (form penuh, menggantikan halaman)
  → klik [Hapus]  → konfirmasi + POST ke API

DETAIL VIEW (dialog popup, di atas LIST VIEW)
  Tampil SEMUA informasi: deskripsi, klasifikasi, alamat lengkap, kontak, sosmed
  → Alamat Indonesia: urutan detail → desa → kecamatan → kabupaten → provinsi → kode pos
  → Alamat LN: nama negara → detail → kode pos
  Tombol "Edit" → transisi ke EDIT VIEW

EDIT VIEW (full-page replace)
  Form lengkap: identitas, klasifikasi, skala, alamat (wilayah atau LN), kontak, sosmed
  Breadcrumb: "← Data Usaha / Nama Usaha"
  Tombol "Batal" → kembali ke LIST VIEW (tanpa save)
  Tombol "Simpan" → POST API → kembali ke LIST VIEW + success banner
```

**State management:**
- `editingEntry: Entry | null` — null = list view; ada = edit view
- `isNew: boolean` — true = entry baru (dihapus dari list jika batal)
- `detailKey: string | null` — key entry yang sedang dibuka di dialog

### Komponen

**`usaha-client.tsx`** — satu file, tiga sub-komponen:
- `DetailDialog` — modal popup, ESC untuk tutup, klik overlay untuk tutup
- `EntryEditForm` — form lengkap per entry
- `UsahaClient` — root: state management + list view

**`Entry` type** — menyimpan dua representasi wilayah:
```typescript
// Untuk form edit (dikirim ke API):
addressProvinceId: number | null
addressRegencyId:  number | null
// ...

// Untuk display di detail popup (dari API response, tidak dikirim balik):
addressProvinceName: string
addressRegencyName:  string
// ...
```

### Komponen Universal yang Dipakai

- **`PhoneInput`** dari `components/ui/phone-input.tsx` — untuk Telepon dan WhatsApp (WAJIB, sesuai standar)
- **`WilayahSelect`** dari `components/ui/wilayah-select.tsx` — untuk pilih wilayah Indonesia
- **`SocialMediaInput`** dari `components/ui/social-media-input.tsx` — universal, 7 platform
- **`Combobox`** dari `components/ui/combobox.tsx` — untuk semua dropdown (kategori, sektor, dll)

### Aturan yang Tidak Boleh Dilanggar

1. **Jangan simpan hanya ID wilayah** — API GET wajib LEFT JOIN ke `refProvinces/Regencies/Districts/Villages` dan kembalikan nama. Front-end tidak pernah tahu cara lookup nama dari ID.
2. **Input phone/WA wajib `<PhoneInput>`** — tidak boleh `<input type="tel">` biasa, berlaku untuk admin form (`step4-business.tsx`) dan front-end form (`usaha-client.tsx`).
3. **Display wilayah: urutan detail → desa → kec → kab/kota → prov → kodepos** — dari spesifik ke umum, konsisten dengan `/anggota/[id]`.
4. **Tiga field wajib saat save**: `name`, `category`, `sector` — field lain opsional.
5. **Jangan tampilkan emoji** di semua display kontak atau informasi apapun.

---

## Tabel Transaksi — Dua Referensi

Transaksi (orders, donations, event_registrations, invoices) punya dua kolom identitas:

```sql
member_id   UUID REFERENCES public.members(id)   -- jika pelaku adalah anggota IKPM
profile_id  UUID REFERENCES public.profiles(id)  -- jika pelaku adalah akun publik
```

Keduanya nullable. Lookup saat checkout:

```
1. Ada session login?
   a. Cek public.members.better_auth_user_id → anggota IKPM → isi member_id
   b. Cek public.profiles.better_auth_user_id → akun publik → isi profile_id

2. Guest checkout (tanpa login) — isi email/HP manual:
   a. Cek public.members via contacts (email/phone) → isi member_id
   b. Cek public.profiles via email/phone → isi profile_id
   c. Tidak ketemu → guest (keduanya null, nama/email disimpan langsung di transaksi)
```

---

## Status Implementasi

### Schema ✅ Selesai
- [x] Kolom `better_auth_user_id TEXT UNIQUE REFERENCES public.user(id)` di `public.members`
- [x] `public.profiles` murni untuk akun publik (tidak ada `member_id`, `account_type`)

### Kode ✅ Selesai
- [x] Register 2 jalur (IKPM + publik) di `/{slug}/register`
- [x] Jalur IKPM: lookup → klaim existing atau buat baru → `UPDATE members SET better_auth_user_id`
- [x] Jalur publik: `INSERT public.profiles`
- [x] `getAkunIdentity(userId)` di `lib/akun-identity.ts`
- [x] `/login` redirect ke `/akun` jika sudah login
- [x] `/register` redirect ke `/akun` jika sudah login
- [x] `/akun` redirect ke `/dashboard` jika identity null (pengurus-only)

### ✅ Bug Diperbaiki
- [x] **`createOfficerWithAccountAction`** — sekarang set `members.better_auth_user_id`
      `UPDATE public.members SET better_auth_user_id = userId WHERE id = memberId AND better_auth_user_id IS NULL`
- [x] **`activateUserDirectAction`** — sama, sudah set `better_auth_user_id`
- [x] **`acceptInviteAction` + `registerAndAcceptAction`** — sudah set `better_auth_user_id` jika `invite.memberId` tidak null

### Tidak Akan Diimplementasi
- Auto-create member dari front-end jika tidak ketemu di `public.members` → DILARANG.
  Anggota baru wajib didaftarkan oleh admin via `/{slug}/members/new`.
  Register jalur IKPM hanya untuk klaim data yang sudah ada.
