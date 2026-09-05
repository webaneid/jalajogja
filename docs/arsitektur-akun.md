# Arsitektur Akun — jalakarta

> Status: **SELESAI** — arsitektur sudah diimplementasikan. Dokumen ini adalah referensi utama.

---

## Prinsip Utama (Dikunci)

> Ini bukan sekadar keputusan teknis — ini adalah identitas sistem.

jalakarta adalah super-app komunitas IKPM. Semua yang punya akses ke sistem — baik di
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
│  SUPER ADMIN JALAKARTA (platform level)                         │
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

jalakarta adalah super-app untuk ekosistem IKPM (alumni Pondok Modern Gontor). Ada dua
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

**`member_number` vs `stambuk_number` — sering tertukar, BEDA:**
- `member_number` ("No. ID IKPM Gontor") — auto-generated via PostgreSQL SEQUENCE
  (`public.member_number_seq`), format `{tahun_daftar}{DDMMYYYY_lahir}{5-digit-urutan}`. Sekarang
  di-generate baik di `createMemberAction` (admin) MAUPUN di `PATCH /api/akun/member-data`
  (self-service, kalau `member.memberNumber IS NULL` saat PATCH) — sequence yang sama, atomic,
  tidak ada duplikat. Anggota lama yang `member_number IS NULL` di-backfill langsung via SQL
  `nextval('public.member_number_seq')`.
- `stambuk_number` ("No. Stambuk Gontor") — nomor santri PM Gontor, diisi MANUAL, tidak pernah
  auto-generate.
- Label ini konsisten dipakai di `/anggota/[id]` dan `/akun` — jangan tampilkan "Belum diterbitkan"
  untuk `member_number` (selalu ada setelah PATCH pertama, gunakan `Row` component yang otomatis
  hide kalau value null).

## Self-Service Profil Lengkap (`/akun/lengkapi` + Halaman Turunan)

**Self-service ≠ admin wizard — action dan auth berbeda:**
- Admin actions (`updateMemberAction`, `upsertMemberContactAction`) pakai `getTenantAccess(slug)`
  — profile holder publik tidak punya akses ini.
- Self-service pakai API routes terpisah: `/api/akun/member-data`, `/api/akun/member-contact`,
  `/api/akun/member-education` (GET+POST riwayat pendidikan, replace-all pattern),
  `/api/akun/member-pesantren` (GET+POST data pesantren, replace-all) — semua auth via
  `auth.api.getSession() → profiles.betterAuthUserId → profiles.memberId`.
- Halaman: `app/(public)/[tenant]/akun/pesantren/page.tsx`, `.../akun/usaha/page.tsx`,
  `app/(public)/[tenant]/anggota/[id]/page.tsx` (profil lengkap, auth-protected owner only via
  `session.user.id === member.betterAuthUserId`).

**`/akun/lengkapi` = 3 step:** Identitas → Kontak & Alamat → Riwayat Pendidikan (multi-entry,
Gontor checkbox + kampus).

**Batas field yang boleh diedit self-service** (vs admin-only): boleh — nama, NIK, stambuk,
gender, tgl/tempat lahir, tahun lulus, profesi, kontak, alamat, sosmed. Admin-only (tidak boleh
diubah self-service): `status`, `joinedAt`, `memberNumber` — field yang menentukan hak anggota
tetap di tangan admin.

**Completeness check heuristik:** cek `birthDate` dan `contactId` sebagai proxy (bukan cek semua
field satu-satu) — kalau salah satu null, tampilkan banner "lengkapi data" di dashboard.

**Prinsip form ganda (front-end + admin wizard) — WAJIB konsisten:** Form anggota ada di DUA
tempat — front-end `/akun/lengkapi` self-service DAN admin wizard
`step1-identity.tsx`/`step2-contact.tsx`/`step4-business.tsx`. Setiap perubahan field
(wajib/opsional, komponen, validasi) wajib diterapkan ke KEDUANYA sekaligus — dua form ini mudah
drift karena dikembangkan terpisah; audit ini harus jadi langkah rutin tiap kali menambah field
baru ke salah satu form.

Detail field yang harus konsisten di kedua tempat:
- 4 field wajib form anggota IKPM: jenis kelamin, tanggal lahir, tahun lulus KMI, profesi.
- Field wajib Step 2: Nomor HP, Nomor WhatsApp, Email, Status Domisili.
- `RegencyCombobox` (`components/ui/regency-combobox.tsx`) — search kabupaten langsung tanpa
  pilih provinsi dulu, debounce 300ms, min 2 karakter, max 15 hasil, via
  `/api/ref/regencies?search=`. Dipakai untuk tempat lahir di kedua form.
- Phone Number — format E.164 (`+628xxxxxxxx`) via `components/ui/phone-input.tsx` (country flag
  + dial code selector, 57 negara, default Indonesia +62, auto-parse format lama `08xxx`).
  Sinkronisasi WA←HP via checkbox "Sama dengan nomor HP".
- Visibilitas kontak: `public.contacts` punya 3 kolom boolean `is_phone_public`,
  `is_whatsapp_public`, `is_email_public` (default `false`, privat) — checkbox "Publik" di bawah
  tiap field, tersimpan via `upsertMemberContactAction` + `PATCH /api/akun/member-contact`.
- Visibilitas alamat — aturan FIXED (bukan toggle user): Provinsi & Kabupaten/Kota publik;
  Kecamatan, Desa/Kelurahan, Kode Pos, Alamat Detail tidak ditampilkan ke publik. Implementasi via
  prop `hints` di `WilayahSelect` (teks keterangan di bawah tiap input), tidak perlu kolom DB.
- Sosial media: semua opsional, semua otomatis publik jika diisi (tidak ada toggle per-platform).
- Urutan tampil alamat standar Indonesia: Alamat detail → Desa/Kelurahan → Kecamatan →
  Kabupaten/Kota → Provinsi → Kode Pos (spesifik ke umum, bukan sebaliknya). `refVillages` wajib
  di-fetch untuk melengkapi alamat.
- `WilayahSelect` — props yang valid: `defaultValue`, `onChange`, `namePrefix`, `disabled`,
  `requiredLevel`, `labels`, `className` (TIDAK ada prop `level`/`placeholder`). Prop `labels`
  dipakai untuk rename label level (mis. birth place hanya butuh province+regency, tapi komponen
  tetap render 4 level).
- (Minor, opsional) Singleton page enforcement untuk template "terms"/"privacy":
  `createSingletonPageAction` cek existing sebelum insert, return existing ID — di level action,
  bukan DB constraint.

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

### Hapus Akun — Soft Delete (Self-Service) vs Hard Delete (Admin)

Dua jalur hapus yang berbeda tujuan, jangan disamakan:

**Soft delete — `DELETE /api/akun/profil`** (self-service, dipanggil user sendiri saat login):
```typescript
await db.update(profiles).set({ deletedAt: new Date(), updatedAt: new Date() })
  .where(eq(profiles.id, p.id));
await auth.api.signOut(...);
```
Hanya set `deletedAt` — `email`/`phone` (kolom `UNIQUE NOT NULL`) **tetap terkunci**, dan
`public.user` (Better Auth) **tidak pernah dihapus**. Cukup untuk "nonaktifkan akun sendiri",
TIDAK cukup untuk membebaskan email/HP agar bisa dipakai daftar ulang.

**Hard delete — `deleteProfileAction(slug, profileId)`** (admin, `/app/{slug}/accounts/[id]`,
tombol "Hapus Akun" — `apps/web/app/(dashboard)/app/[tenant]/accounts/actions.ts` +
`accounts/[id]/delete-account-button.tsx`):
```typescript
await db.transaction(async (tx) => {
  if (existing.betterAuthUserId) {
    await tx.delete(authUser).where(eq(authUser.id, existing.betterAuthUserId));
  }
  await tx.delete(profiles).where(eq(profiles.id, profileId));
});
```
Dipakai untuk membersihkan registrasi yang **salah jalur** — orang yang harusnya daftar sebagai
Anggota IKPM tapi terlanjur pilih "Bukan Anggota" (jalur publik), sehingga email/HP-nya terjebak
di `public.profiles` dan tidak bisa dipakai lagi untuk daftar ulang yang benar (`checkEmailTaken()`
di `/api/akun/register` selalu menolak selama `public.user`-nya masih ada).

**Kenapa aman jadi hard delete** (bukan cuma soft delete diperkuat):
- `session`/`account` sudah `onDelete: "cascade"` dari `public.user` — hapus `user` otomatis
  bersihkan sesi login & kredensialnya.
- `profile_id` di **semua** tabel transaksi tenant (`invoices`, `orders`, `donations`,
  `event_registrations`) adalah `REFERENCES public.profiles(id) ON DELETE SET NULL` — riwayat
  transaksi TIDAK ikut terhapus, hanya kehilangan tautan ke profil ini (jadi transaksi guest).
- Diverifikasi empiris (bukan cuma dibaca): insert user+session+profile test → jalankan logic
  delete → user/session/profile lenyap semua (cascade session terbukti jalan) → insert profile
  baru dengan email/phone yang SAMA berhasil (bukti kolom UNIQUE genuinely bebas).

**Batasan yang diketahui, belum diperbaiki**: halaman `/app/{slug}/accounts/[id]` (baik untuk
lihat maupun hapus) tidak memvalidasi bahwa profil ini terdaftar di tenant yang sedang dibuka —
admin tenant manapun yang tahu/menebak `profileId` bisa melihat dan menghapus profil publik
tenant lain. Gap pre-existing di halaman detail, bukan yang baru diperkenalkan fitur ini.

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

## Mobile "App Mode" + Kartu Anggota (2026-07-21)

> Detail teknis lengkap (spacer, z-index, skema header): `docs/arsitektur-mobile-shell.md` § 2.3.

Di layar mobile (`<768px`), SELURUH `/akun/*` (semua kedalaman) beralih ke tampilan "app mode"
mandiri — terinspirasi referensi desain fintech (`design-refs/akun/design-mobile-akun.jpg`,
konsep visual saja, TIDAK ditiru literal — tidak ada saldo/deposit/withdraw/beneficiary, itu
konsep bank yang tidak relevan untuk platform ini):

- **Header situs + `BottomNav` situs disembunyikan total** (dideteksi via
  `isAkunAppMode(pathname, baseUrl)`, `lib/mobile-route-checks.ts`), diganti chrome milik
  `/akun` sendiri.
- **`AkunMobileHeader`** (`components/akun/mobile/akun-mobile-header.tsx`) — avatar + "Halo,
  {nama}" + badge label (org member label / "Akun Publik") + ikon lonceng notifikasi
  **non-fungsi** (belum ada sistem notifikasi in-app — murni visual, keputusan sadar, bukan
  belum sempat, lihat sesi 2026-07-21).
- **`MemberCard`** (`components/akun/mobile/member-card.tsx`) — kartu identitas bergaya "kartu
  anggota", HANYA tampil di dashboard (`akun/page.tsx`, bagian mobile-only). Warna ikut tema
  tenant (`bg-primary`/`text-primary-foreground`, CSS var — BUKAN warna hardcode dari mockup
  referensi). Isi: logo+nama **hasil resolusi branding** (lihat § "Resolusi Branding Kartu
  Anggota" di bawah — TIDAK selalu tenant yang sedang dibrowsing), nama anggota, No. Anggota
  (mono, meniru "nomor kartu"), badge status. Varian `type==="public"` lebih sederhana (tanpa
  No. Anggota — akun publik tidak punya data itu).
- **`AkunBottomNav`** (`components/akun/mobile/akun-bottom-nav.tsx`) — bottom tab bar khusus
  akun: 3 tab utama (Beranda/Transaksi/Profil) + tombol "Lainnya" (drawer slide-up berisi sisa
  item nav + tombol Keluar). Daftar item nav **diimpor dari `akun-nav.tsx`**
  (`MEMBER_NAV_ITEMS`/`PUBLIC_NAV_ITEMS`, di-export supaya sidebar desktop dan bottom nav mobile
  tidak punya 2 daftar independen yang bisa drift).

**Desktop (`≥768px`) TIDAK DISENTUH SAMA SEKALI** — sidebar+konten existing di
`akun/layout.tsx`/`akun/page.tsx` tetap identik seperti sebelum fitur ini. Perubahan 100%
di-scope via `hidden md:block`/`hidden md:flex` (desktop) vs `md:hidden` (mobile) — pola split
yang sama dipakai di halaman detail Event/Campaign/Produk sebelumnya.

### Resolusi Branding Kartu Anggota (2026-07-21)

**Masalah**: implementasi awal `MemberCard` (di atas) mengambil logo+nama SELALU dari tenant
yang sedang dibrowsing (`getSettings(createTenantDb(browsedSlug), "general")`). Ini salah secara
konseptual — platform ini "1 ID for all": satu akun bisa browsing `/akun` di tenant MANAPUN,
terlepas apakah dia genuine anggota tenant itu. Contoh nyata: alumnus yang BUKAN "Angkatan 1999
Akhir" (bukan anggota genuine tenant "Visikita") tidak seharusnya melihat badge "Visikita" hanya
karena kebetulan browsing `visikita.com/akun`.

**Helper terpusat**: `apps/web/lib/resolve-akun-branding.ts` — `resolveAkunBranding(memberId,
browsedSlug)`, dipanggil independen oleh `akun/layout.tsx` (badge label sidebar+header mobile)
dan `akun/page.tsx` (badge label "Info keanggotaan" desktop + logo/nama/warna `MemberCard`
mobile) — TIDAK di-`cache()`, konsisten dengan pola duplikasi query session/identity yang sudah
ada di kedua file itu sejak awal. Return type `ResolvedAkunBranding` punya 4 field: `logoUrl`,
`orgName`, `memberLabel`, `primaryColor` — **ketiganya (logo, nama, warna) SELALU dari tenant
hasil resolusi yang SAMA**, tidak pernah campur (mis. logo dari tenant A tapi warna dari tenant B).

**4 langkah resolusi, urut**:
1. **Genuine member tenant yang sedang dibrowsing** — cek `tenant_memberships` untuk
   `(memberId, browsedTenantId)`. Kalau ADA baris → pakai branding tenant itu (perilaku sebelum
   fix ini, tidak berubah untuk kasus ini). **Kolom `membershipType` (cabang/marhalah/forum)
   TIDAK dicek** — dikonfirmasi via grep menyeluruh, kolom itu tidak pernah dipakai sebagai
   filter WHERE di manapun di seluruh codebase, hanya sebagai value saat INSERT. Jadi "ada baris"
   = genuine member, apapun tipenya. Ini yang membuat contoh "Angkatan 1999 Akhir" di atas
   otomatis benar: kalau member itu GENUINE ikut angkatan itu (ada baris `tenant_memberships`
   `membershipType='marhalah'` untuk tenant Visikita), badge Visikita MEMANG seharusnya tampil.
2. **Bukan genuine member tenant yang dibrowsing** → cari tenant cabang resmi member sendiri:
   `members.primaryCabangRefId → tenants WHERE refCabangId = X AND isActive = true`. Kalau
   ketemu → pakai branding tenant cabang resmi itu (bukan tenant yang sedang dibrowsing).
3. **Cabang resmi member belum onboard jadi tenant sama sekali** (`primaryCabangRefId` ada tapi
   tidak ada tenant dengan `refCabangId` yang cocok, atau `primaryCabangRefId` belum diisi) →
   fallback ke **branding default platform** (`public.platform_settings`, lihat di bawah).
4. **Akun publik** (`identity.type === "public"`) — TIDAK lewat `resolveAkunBranding` sama sekali,
   selalu pakai tenant yang sedang dibrowsing langsung via `getTenantSeoBase(slug)` — akun publik
   tidak punya konsep "cabang sendiri".

Simplifikasi yang disengaja: TIDAK ada cascading fallback logo kalau tenant hasil resolusi
(langkah 2) ADA tapi belum upload logo sendiri — `MemberCard` sudah punya fallback badge-huruf
untuk `logoUrl=null`, itu cukup, tidak perlu query tambahan ke platform default.

Efek samping yang menguntungkan: kalau auto-join `tenant_memberships` pernah gagal untuk cabang
yang sebenarnya sudah match (`refCabangId` cocok tapi baris membership belum pernah ter-insert),
langkah 2 akan menemukan tenant yang SAMA lewat `primaryCabangRefId` — hasil akhirnya tetap
benar meski langkah 1 gagal mendeteksinya sebagai "genuine member".

**Tabel baru `public.platform_settings`** (`packages/db/migrations/0035_platform_settings.sql`)
— singleton row (`id="default"`, di-seed via migration), kolom `defaultLogoUrl` +
`defaultOrgName` (default `"IKPM Gontor"`). Dikelola dari `/platform/settings` (halaman platform
admin yang sudah ada — sebelumnya cuma berisi status env var RajaOngkir, sekarang ditambah card
"Branding Default IKPM"): upload logo via `POST /api/platform/settings/upload-logo` (path FIXED
`branding/logo.webp` di bucket MinIO BARU `platform-assets` — terpisah total dari bucket
`tenant-{slug}`, lihat `apps/web/lib/minio.ts` fungsi `platformPublicUrl`/`uploadPlatformFile`/
`ensurePlatformBucket`; konversi via `sharp` ke WebP 480×480, TANPA variant system tenant — aset
tunggal, selalu overwrite) + input teks nama organisasi, disimpan via
`updatePlatformBrandingAction` (`(platform)/platform/(protected)/actions.ts`, pola identik
`createCabangAction` yang sudah ada).

**TIDAK disentuh** (sudah benar sejak awal, tidak kena bug ini):
- `anggota/[id]/page.tsx` — "PC IKPM" sudah diambil langsung dari `primaryCabangRefId →
  ref_ikpm_cabang.nama` (independen tenant manapun); "Marhalah & Forum" sudah dari
  `tenant_memberships` lintas SEMUA tenant yang diikuti member (bukan cuma tenant yang dibrowsing).
- `akun/page.tsx`'s `membershipInfo.primaryCabangNama` — sama seperti di atas, independen tenant.
- `akun/page.tsx`'s `membershipInfo.status`/`memberNumber` — fakta "status SAYA DI TENANT INI",
  secara semantik memang harus tetap scoped ke tenant yang dibrowsing (beda konsep dari branding).

### Resolusi Warna Kartu Anggota (2026-07-21, susulan)

**Pertanyaan user**: warna `MemberCard` juga harus ikut resolusi yang sama dengan logo/nama —
kalau saya genuine anggota IKPM Jogjakarta, kartu pakai warna IKPM Jogjakarta; kalau saya JUGA
genuine anggota Visikita (angkatan) dan sedang browsing di sana, pakai warna Visikita; kalau saya
BUKAN anggota Visikita, kartu tetap pakai warna cabang saya sendiri (bukan warna Visikita yang
sedang dibrowsing) — atau warna default IKPM kalau cabang saya belum onboard.

**Masalah sebelum fix**: `MemberCard` pakai class Tailwind `bg-primary`/`text-primary-foreground`
begitu saja — dua class ini resolve ke CSS variable `--primary`/`--primary-foreground` yang
di-inject **page-wide** oleh `PublicLayout` (`buildTenantThemeCss()`, `.public-layout` scope) untuk
tenant yang SEDANG DIBROWSING. Artinya meski logo+nama sudah benar (hasil resolusi § di atas),
warna kartu tetap ikut tenant yang dibrowsing — bisa beda dari logo+nama yang ditampilkan,
inkonsisten.

**Fix — CSS custom property di-override LOKAL di root `MemberCard`, bukan ubah tema halaman**:
```tsx
const cardVars = {
  "--primary":            color,               // hex dari resolveAkunBranding().primaryColor
  "--primary-foreground": foregroundFor(color), // lib/theme-palette.ts, sudah ada, export
} as CSSProperties;

<div className="... bg-primary text-primary-foreground ..." style={cardVars}>
```
CSS custom property yang di-set via inline `style` pada sebuah elemen **cascade ke semua
children**, dan **menang** atas nilai yang di-set `.public-layout` di ancestor lebih atas (CSS
variable resolve dari deklarasi TERDEKAT). Jadi seluruh JSX `MemberCard` yang sudah pakai
`bg-primary`/`text-primary-foreground`/`bg-primary-foreground/15`/dst **otomatis** ikut warna
LOKAL ini — tidak perlu ubah satu class pun di isi kartu. `foregroundFor()` (WCAG contrast
hitam/putih) dipakai lagi, sama seperti dipakai `buildTenantThemeCss()` untuk halaman.

**`resolveAkunBranding()` diperluas** — setiap langkah resolusi (genuine tenant / home tenant)
SEKARANG JUGA fetch `getSettings(createTenantDb(resolvedSlug), "display").primary_color` (helper
lokal `getTenantPrimaryColor()`, default `"#2563eb"` kalau tenant belum set warna — sama dengan
default yang dipakai `/settings/display`). Fallback platform (langkah 3) pakai
`platformSettings.defaultColor` (kolom baru, migration `0036_platform_settings_color.sql`, default
`#2563eb`). Akun publik (di luar `resolveAkunBranding`) fetch warna tenant yang dibrowsing langsung
di `akun/page.tsx`, konsisten dengan logo/nama publik yang juga selalu ikut tenant dibrowsing.

**`/platform/settings`** — card "Branding Default IKPM" ditambah color picker (`type="color"` +
input hex, pola sama `display-settings-form.tsx`), disimpan lewat `updatePlatformBrandingAction`
yang sekarang validasi format `^#[0-9a-fA-F]{6}$` (fallback ke `#2563eb` kalau tidak valid,
bukan reject — form tetap tersimpan).

### Standar Label Keanggotaan — "Lengkapi Data" vs "Anggota X" (2026-07-24)

**Masalah dilaporkan user**: saat mencoba tenant forum baru (`forcreator` di lokal), badge
"Anggota Forcreator" langsung muncul di sidebar `/akun` begitu mendaftar — padahal belum pernah
mengisi data apa pun, apalagi menyelesaikan alur `/gabung` (§ `docs/arsitektur-backbone-ikpm.md`
"Alur Pendaftaran Forum v2"). Investigasi menemukan **dua** root cause independen:

1. **`joinTenant()` di `/api/akun/register`** — meng-insert baris `tenant_memberships` dengan
   `status: "active"` untuk tenant APA PUN tempat orang mendaftar, TANPA cek `tenantType` sama
   sekali. Registrasi langsung di domain forum otomatis membuat baris keanggotaan aktif,
   melewati seluruh gate `/gabung` yang sudah dibangun.
2. **`resolveAkunBranding()`'s Step 1** ("genuine member") — sebelumnya cukup "ada baris
   `tenant_memberships` apa pun" untuk SEMUA tipe tenant, tidak pernah cek `forumStatus`.

**Standar baru yang dikunci** (dikonfirmasi user via `AskUserQuestion`, 3 keputusan):

1. **Prasyarat universal SEBELUM label apa pun bisa jadi "Anggota X"**: profil harus lolos
   `checkForumEligibility()` (reuse fungsi yang sama dari alur forum — data pribadi Step1+2
   `/akun/lengkapi` lengkap KECUALI Riwayat Pendidikan, PLUS minimal 1 dari 3 direktori
   usaha/pesantren/profesional). **Berlaku untuk SEMUA tipe tenant** (cabang/marhalah/forum) —
   dikonfirmasi eksplisit user, bukan cuma forum, meski ini berarti anggota PC IKPM/Angkatan
   lama yang auto-join tapi belum pernah isi `/akun/lengkapi` akan melihat labelnya berubah
   dari "Anggota PC IKPM X" jadi "Lengkapi Data" setelah deploy.
2. **Belum lolos** → `memberLabel = "Lengkapi Data"`, `verified: false` — caller TIDAK menampilkan
   ikon `BadgeCheck` (centang) untuk state ini, di SEMUA 3 titik render.
3. **Sudah lolos**:
   - Cabang/marhalah: TIDAK berubah dari perilaku sebelumnya — "ada baris `tenant_memberships`
     apa pun" tetap cukup untuk "genuine member" (auto-populate tidak punya tahap verifikasi
     terpisah seperti forum).
   - Forum: Step 1 SEKARANG mensyaratkan `forumStatus = 'active'` secara eksplisit (bukan cuma
     "ada baris") — kalau belum genuinely menyelesaikan `/gabung`, jatuh ke fallback existing
     (cabang resmi sendiri via `primaryCabangRefId`, atau platform default) — sesuai instruksi
     user: "jika belum sesuai standard maka tulisannya tertulis 'Anggota PC IKPM <cabang dia>'".

**Implementasi**:
- `resolveAkunBranding()` — restrukturisasi 3 `return` di 3 langkah jadi 1 variable `resolved`
  (di-assign per langkah, bukan return langsung), supaya eligibility override bisa diterapkan
  SEKALI di titik akhir (bukan diulang 3×). Tambah field `verified: boolean` ke
  `ResolvedAkunBranding`. Step 1 query pakai spread kondisional:
  `and(eq(memberId), eq(tenantId), ...(isForum ? [eq(forumStatus,"active")] : []))`.
  **Hanya `memberLabel` yang di-override jadi "Lengkapi Data"** saat belum eligible — `logoUrl`/
  `orgName`/`primaryColor` TETAP di-resolve normal (identitas visual kartu tidak berubah, cuma
  klaim status keanggotaan yang jujur — `MemberCard` yang menampilkan `orgName`/logo/warna sama
  sekali tidak perlu disentuh, karena field itu tidak pernah baca `memberLabel`).
- `akun/layout.tsx` + `akun/page.tsx` — tambah `memberVerified` (dari `branding.verified`),
  ikon `BadgeCheck` di kedua tempat sekarang digate `{isMember && memberVerified && <BadgeCheck/>}`
  / `{memberVerified && <BadgeCheck/>}`. `AkunMobileHeader` (badge teks polos, tanpa ikon) otomatis
  ikut benar tanpa disentuh — cukup teksnya yang berubah jadi "Lengkapi Data".
- `/api/akun/register/route.ts`'s `joinTenant()` — tambah cek `registeredAtTenantType`
  (kolom `tenantType` ditambah ke SELECT tenant lookup yang sudah ada) — SKIP insert
  `tenant_memberships` sama sekali kalau `tenantType === "forum"`. Cabang/marhalah TIDAK
  berubah. `tenantRefCabangId` (dipakai auto-set `primaryCabangRefId`) tidak perlu guard
  tambahan — kolom itu secara semantik hanya terisi untuk tenant cabang (forum tidak punya
  `refCabangId`), jadi sudah otomatis aman.

**Interaksi dengan `ForumJoinOverlay`**: untuk forum tenant yang belum `forumStatus='active'`,
overlay glass-effect (dibangun sesi sebelumnya) SUDAH menutupi kartu "Info keanggotaan"/
`MemberCard` sepenuhnya — label baru ("Lengkapi Data" atau fallback "Anggota PC IKPM X") tetap
di-resolve dan dirender DI BAWAH overlay (konsisten dengan desain overlay yang sengaja tidak
menyembunyikan konten asli, cuma menutup visual), tapi secara praktis tidak terlihat user
selama overlay aktif — tidak ada kontradiksi, sekadar duplikasi informasi yang tersembunyi.

**Efek samping**: `checkMemberEligibility()` sekarang bisa terpanggil 2× per render `/akun` untuk
forum tenant yang belum join (sekali oleh blok overlay yang sudah ada, sekali lagi di dalam
`resolveAkunBranding()`) — duplikasi query kecil, diterima (tidak di-cache/di-share) demi
menghindari refactor lintas fungsi yang tidak perlu untuk beberapa SELECT ringan.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev
server dimatikan dulu, `.next` dibersihkan, direstart setelah build). Nol migrasi DB. Belum
diverifikasi visual di browser oleh Claude — user yang punya tenant forum `forcreator` lokal
perlu mengonfirmasi langsung.

### Eligibility Overlay Generik — Digeneralisasi ke Semua Tipe Tenant (2026-07-24, susulan)

**Rangkaian 2 permintaan susulan dari user di sesi yang sama:**

1. **"Tombol rancu"** — overlay forum (dibangun sesi sebelumnya sebagai `ForumJoinOverlay`)
   selalu mengarahkan tombol "Lengkapi Data" ke `/gabung`, meski member belum eligible sama
   sekali — `/gabung` cuma menampilkan ulang info yang sama (double-hop membingungkan).
   **Fix**: overlay dipecah jadi **3 kondisi eksplisit** berdasar `missing:
   MemberEligibilityField[]` (bukan cuma `eligible: boolean`):
   1. Profil pribadi belum lengkap (ada field selain `"directory"`) → tombol "Lengkapi Data
      Pribadi" → langsung `/akun/lengkapi`.
   2. Profil pribadi lengkap, tinggal direktori (`missing` cuma `["directory"]`) → tombol
      "Lengkapi Data →" membuka **popup** (`DirectoryChoicePopover`, client component baru,
      `Popover`/`PopoverTrigger`/`PopoverContent` Radix — pola sama `Combobox`) — 3 pilihan:
      "Saya seorang profesional" → `/akun/profesional`, "Saya memiliki usaha" → `/akun/usaha`,
      "Saya memiliki lembaga pendidikan/kursus" → `/akun/pesantren`.
   3. Eligible → teks "Data Anda lengkap. Jika ingin mendaftar menjadi anggota X, klik tombol
      di bawah ini:" + tombol **"Gabung {tenantName}"** → `/gabung` (satu-satunya kasus yang
      benar-benar masuk `/gabung`, karena di situ tombol join sungguhan aktif).

2. **Generalisasi ke SEMUA tipe tenant** — user: "bedanya kan cuma: selain anggota forum tidak
   perlu masuk URL /gabung, tenant lain otomatis menjadi anggota... sehingga pesannya sama jika
   belum lengkap maka harus ada 2 kondisi tadi sebelum muncul informasi kartu... ini kita namakan
   eligibiliti kali ya biar konsisten." Overlay (dan seluruh helper di baliknya) di-rename total
   dari istilah forum-spesifik jadi generik:

   | Sebelum | Sesudah |
   |---|---|
   | `lib/forum-eligibility.ts` | `lib/member-eligibility.ts` |
   | `checkForumEligibility()` | `checkMemberEligibility()` |
   | `ForumEligibilityField`/`ForumEligibilityResult` | `MemberEligibilityField`/`MemberEligibilityResult` |
   | `FORUM_ELIGIBILITY_LABELS` | `MEMBER_ELIGIBILITY_LABELS` |
   | `forumEligibilityFixHref()` | `memberEligibilityFixHref()` |
   | `components/akun/forum-join-overlay.tsx` (`ForumJoinOverlay`) | `components/akun/membership-eligibility-overlay.tsx` (`MembershipEligibilityOverlay`) |

   Logic CHECK-nya (10 field data pribadi + minimal 1 direktori) TIDAK berubah sama sekali —
   murni rename supaya namanya mencerminkan pemakaian sebenarnya (dipakai semua tipe tenant),
   bukan cuma forum.

**Kapan overlay tampil — beda per tipe tenant, ditentukan di `akun/page.tsx`:**
```typescript
if (browsedTenant.tenantType === "forum") {
  const isJoined = forumStatus === "active";
  const eligibility = await checkMemberEligibility(...);   // SELALU dicek, tidak lagi digate forumStatus
  showOverlay = !eligibility.eligible || !isJoined;
} else { // cabang / marhalah
  showOverlay = !eligibility.eligible;      // begitu eligible, keanggotaan SUDAH otomatis
}
```
> **Revisi 2026-07-31** (`docs/arsitektur-import-anggota.md` § 22): sebelumnya untuk forum,
> eligibility HANYA dicek kalau `forumStatus !== "active"` — begitu status jadi "active",
> pengecekan data lengkap ikut ter-skip selamanya. Ini jadi bug nyata begitu forum bisa
> punya member `forumStatus="active"` TANPA lewat `/gabung` (yang selama ini memaksa
> eligibility check) — yaitu member yang di-auto-join admin lewat import massal atau tambah
> manual (§ 22.3 dokumen import). Fix: eligibility SEKARANG selalu dicek untuk forum,
> independen dari status join — member yang sudah joined tapi datanya belum lengkap tetap
> melihat overlay "Lengkapi Data", bukan langsung dianggap "selesai".

Untuk cabang/marhalah, keanggotaan (`tenant_memberships` row) SUDAH otomatis ter-insert oleh
mekanisme auto-populate yang sudah ada sejak lama (matching `primaryCabangRefId`/
`graduationYear`+`period`) — TIDAK BERUBAH dan TIDAK bergantung pada eligibility sama sekali.
Overlay di sini MURNI soal tampilan "informasi kartu belum layak ditampilkan sampai data
lengkap" — begitu eligible, overlay hilang dan kartu (yang datanya sudah ada dari auto-populate)
langsung terlihat, TANPA tombol "join" apa pun (beda dari forum yang perlu `/gabung` eksplisit).
`MembershipEligibilityOverlay` sendiri punya guard defensif `if (eligible && !isForum) return
null` — kalau ternyata terpanggil di kondisi ini (seharusnya tidak, caller sudah stop
merender), tidak akan pernah menyarankan "Gabung X" untuk tenant yang tidak punya alur itu.

**`akun/page.tsx` variable rename** (mengikuti generalisasi, bukan cuma forum lagi):
`showForumOverlay`→`showEligibilityOverlay`, `forumMissing`→`overlayMissing`,
`forumTenantName`→`overlayTenantName`, tambah `overlayIsForum: boolean` baru (diteruskan ke
`MembershipEligibilityOverlay` sebagai prop `isForum`).

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev
server dimatikan dulu, `.next` dibersihkan, direstart tiap kali karena user aktif menguji).
Grep akhir `checkForumEligibility|ForumEligibilityField|ForumJoinOverlay|forum-eligibility|
forum-join-overlay` di seluruh `apps/web` — nol hasil, rename bersih tanpa sisa referensi lama.
Nol migrasi DB. **Belum diverifikasi visual di browser** — khususnya kasus cabang/marhalah
yang BELUM eligible (member lama yang belum isi `/akun/lengkapi`) perlu dicoba user untuk
konfirmasi overlay-nya benar-benar muncul menutupi kartu, bukan cuma badge teks yang berubah.

---

### Toggle Per-Tenant untuk Modul Ekosistem (2026-08-01)

> Rencana lengkap (riset + desain): `/Users/webane/.claude/plans/binary-questing-river.md`.
> Cross-reference: `docs/arsitektur-ekosistem.md` (Fase 1+2, tag `offeredTags`/`neededTags` —
> fitur BERBEDA, tidak overlap; toggle ini murni visibility gate per modul, bukan pencocokan).

**Kebutuhan**: sebuah tenant (cabang/marhalah/forum) bisa jadi tidak relevan menawarkan
ketiga direktori (Usaha/Pesantren/Profesional) sekaligus — forum yang fokus bisnis mungkin
tidak butuh Pesantren; forum desain grafis mungkin cuma butuh Profesional. Sebelum fitur ini,
ketiga modul selalu tampil unconditional di semua tempat untuk semua tenant, tidak ada cara
mematikan salah satunya.

**Prinsip yang dikunci dari diskusi user (kutipan verbatim, jangan disederhanakan)**:

> "secara konstruksi sistem, bukan menghilangkan data, tetapi menyembunyikan. Artinya: dia
> tidak pernah dihapus dari sistem personal, karena kita memiliki single id tadi, yang
> memungkinkan di satu tenant memang ada atau dibutuhkan varian tersebut dan seorang boleh
> merasa sebagai profesional mandiri atau memiliki usaha untuk menunjang profesionalitasnya.
> sehingga tidak benar-benar hilang hanya tidak terlihat atau dianggap."

Konsekuensi arsitektural: `member_businesses`/`member_owned_pesantren`/`member_professionals`
adalah tabel `public` schema (data global milik member, bukan tenant-owned) — toggle ini
**TIDAK PERNAH** menghapus atau membatasi baris data. Ia murni gerbang VISIBILITAS front-end
untuk konteks tenant yang sedang dibrowsing. Data anggota yang sama tetap utuh dan bisa
tampil normal di tenant lain yang mengaktifkan modul itu.

**Aturan eligibility — kutipan verbatim (koreksi eksplisit dari kesalahpahaman saya
sebelumnya, jangan diinterpretasi ulang)**:

> "'harus mengisi salah satu' itu keyword utamanya, artinya: Jika yang diaktifkan 3 varian
> database (pesantren, usaha dan profesional) maka wajib mengisi salah satunya. Jika
> diaktifkan 2, maka wajib mengisi salah satu. Jika cuma satu: ya berarti wajib mengisi satu
> itu. ... Misal saya masuk komunitas atau forum design grafis, dan dia mengaktifkan
> profesional saja, ketika saya masuk forum bisnis yang mewajibkan punya usaha dan tidak
> mengaktifkan profesional, maka saya tidak eligibel, tetap harus mengisi data usaha terlebih
> dahulu."

Jadi aturan "directory" di `checkMemberEligibility()` SELALU "OR — minimal satu dari modul
yang AKTIF UNTUK TENANT INI", terlepas berapa banyak modul yang aktif (1, 2, atau 3). Sudah
punya data di modul yang TIDAK aktif di tenant ini TIDAK PERNAH cukup untuk lolos eligibility
di tenant itu — member harus mengisi salah satu modul yang memang ditawarkan tenant tersebut.

Kedua putaran `AskUserQuestion` lain yang dikonfirmasi user: (a) `checkMemberEligibility()`
ikut menyesuaikan toggle (bukan cuma UI form entri) — **Recommended, dipilih**; (b) semua tipe
tenant (cabang/marhalah/forum) bisa mengatur toggle — **Recommended, dipilih**, bukan cuma
forum.

**Storage — nol migrasi DB**: 3 boolean baru (`usaha_enabled`, `pesantren_enabled`,
`profesional_enabled`) di `tenant.settings` group `"general"` (grup yang SUDAH ADA sejak lama,
dipakai `site_name`/`logo_url`/dst) — tidak perlu `SETTING_GROUPS` migration baru. Semantik
`!== false` (bukan `=== true`) supaya default backward-compatible: tenant lama yang belum
pernah menyentuh setting ini otomatis dianggap SEMUA modul aktif (perilaku sebelum fitur ini).

**File baru — split client-safe/server-only** (pola yang SUDAH berulang 3× di project ini
untuk kelas bug client/server bundle boundary — `nav-menu.ts`/`.server.ts`,
`tenant-timezone.ts`/`.server.ts`, `forum-membership-number.ts`/`.server.ts`):
```typescript
// lib/ekosistem-modules.ts — pure, ZERO import @jalajogja/db, aman diimpor client component
export type EkosistemModule = "usaha" | "pesantren" | "profesional";
export const ALL_EKOSISTEM_MODULES: EkosistemModule[] = ["usaha", "pesantren", "profesional"];
export type EkosistemModulesConfig = Record<EkosistemModule, boolean>;

export function resolveEkosistemModulesConfig(raw: Record<string, unknown>): EkosistemModulesConfig {
  return {
    usaha:       raw.usaha_enabled       !== false,
    pesantren:   raw.pesantren_enabled   !== false,
    profesional: raw.profesional_enabled !== false,
  };
}

export function enabledModuleList(config: EkosistemModulesConfig): EkosistemModule[] {
  return ALL_EKOSISTEM_MODULES.filter((m) => config[m]);
}
```
```typescript
// lib/ekosistem-modules.server.ts — import "server-only"
export async function getEnabledEkosistemModules(tenantClient: TenantDb): Promise<EkosistemModulesConfig> {
  const settings = await getSettings(tenantClient, "general");
  return resolveEkosistemModulesConfig(settings);
}
```
Dites via disposable `bun -e` script: default-true saat setting absen, override eksplisit
`false` terbaca benar, `enabledModuleList()` filter benar — semua PASS sebelum dipakai produksi.

**`checkMemberEligibility(memberId, enabledDirectoryModules?)`** — parameter kedua baru,
default `ALL_EKOSISTEM_MODULES` (backward-compat — caller lama yang belum diupdate tetap
berperilaku identik sebelum fitur ini). Query "directory" requirement sekarang HANYA dibangun
untuk modul yang ada di `enabledDirectoryModules`. Kalau array kosong (tenant mematikan
SEMUA 3 modul sekaligus) → `hasDirectory = true` (requirement di-skip total, karena tidak
mungkin dipenuhi kalau tidak ada satu pun modul yang ditawarkan).

**`memberEligibilityFixHref(field, baseUrl, enabledModules?)`** — parameter ketiga baru,
untuk field `"directory"` pilih modul aktif PERTAMA dalam urutan prioritas
`["usaha", "profesional", "pesantren"]` (bukan hardcode `/akun/usaha` seperti sebelumnya).

**Semua 5 caller lama `checkMemberEligibility()` diupdate** mengirim parameter modul — bukan
dibiarkan pakai default supaya konsisten dengan toggle tenant yang sedang dibrowsing:
1. `gabung/actions.ts` (`joinForumAction`)
2. `gabung/page.tsx`
3. `akun/page.tsx` (2 cabang — forum & cabang/marhalah)
4. `lib/resolve-akun-branding.ts` (`resolveAkunBranding`)
5. `finance/billing/actions.ts` (`activateForumMembershipIfApplicable`)

**Admin toggle UI (lokasi ASLI saat dibangun 2026-08-01, sekarang basi — lihat "Susulan
2026-08-07" di akhir section ini untuk lokasi TERKINI)** — `/app/{slug}/settings/general`:
3 checkbox ("Aktifkan Modul Usaha/Pesantren/Profesional") dengan teks penjelasan "data anggota
yang sudah ada tidak akan dihapus, hanya disembunyikan dari tampilan" — konsisten prinsip yang
dikunci di atas, supaya admin yang mematikan modul tidak salah kira ini aksi destruktif.

**Titik-titik yang ikut menyembunyikan (bukan cuma form entri)** — dieksekusi 4 fase, `tsc`+
build genuine diverifikasi tiap fase:

- **Self-service** (`/akun/*`): `akun/layout.tsx` fetch config sekali, thread ke `<AkunNav>`
  (desktop) + `<AkunBottomNav>` (mobile) — keduanya filter `MEMBER_NAV_ITEMS` via
  `moduleKey` field baru + `filterNavItemsByModules()` (export baru dari `akun-nav.tsx`).
  `akun/usaha/page.tsx`+`akun/profesional/page.tsx` gate redirect ke `/akun` kalau modulnya
  off. `akun/pesantren/page.tsx` (sebelumnya CLIENT COMPONENT itu sendiri, tanpa server
  wrapper) direstrukturisasi jadi `pesantren-client.tsx` (ekstraksi murni, isi identik,
  `useParams()`/`useBaseUrl()` dihapus karena sekarang terima prop) + `page.tsx` server baru
  dengan gate yang sama. `akun/page.tsx` — 2 array quick-action (desktop grid + mobile "Menu
  Cepat") digabung jadi satu `directoryLinks` di-filter `moduleKey`; `checkMemberEligibility`
  dan overlay dapat config yang sama. `DirectoryChoicePopover` (popup 3 pilihan direktori) dan
  `MembershipEligibilityOverlay` dapat prop `enabledModules?` untuk filter opsi yang
  ditampilkan.
- **Admin dashboard**: `member-edit-shell.tsx` — tab "Usaha" (`TABS` array) di-exclude kalau
  modul off (Pesantren/Profesional tidak punya tab admin sama sekali — Profesional murni
  self-service, Pesantren cuma via dialog `member-data-sections.tsx`). `members/[id]/page.tsx`
  — render `<BusinessSection>`/`<PesantrenSection>` dibungkus kondisi `enabledModules.usaha`/
  `.pesantren`.
- **Publik + landing + statistik**: 6 halaman direktori publik (`usaha`/`pesantren`/
  `profesional` × list+detail) — gate `notFound()` sejajar pola `!tenant?.isActive` yang sudah
  ada. `directory-feed.server.ts` (`resolveDirectoryItems`) — kembalikan `items: []` kalau
  `directoryType` section itu dimatikan admin (bukan mock data, murni kosong). Route API baru
  `GET /api/ekosistem/modules?slug=` (auth `getTenantAccess`, pola sama
  `/api/instagram/oauth/status`) — dipanggil `DirectoryEditor` (section builder,
  `section-editors.tsx`, pola fetch client-side identik `InstagramEditor`) untuk memfilter
  opsi dropdown "Tipe Direktori" cuma menawarkan modul yang aktif. `statistik/page.tsx` — 3
  dari 4 blok breakdown (Usaha/Pesantren/Profesional; "Statistik Anggota" TETAP selalu
  tampil) dibungkus kondisi enabled. `EcosystemTagCrossLinks` (widget "Cari Sinergi") dapat
  prop `enabledModules?` — filter target link cross-directory ke modul yang aktif saja.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` di SETIAP fase (bukan
ditumpuk ke akhir) — 2× sempat salah jalankan dari root repo (bukan `apps/web`), langsung
terdiagnosis via `pwd` sebagai kesalahan cwd (root `tsconfig.json` tidak punya alias `@/*`),
bukan regresi nyata. `bun run build --filter=@jalajogja/web` genuine (dev server
dimatikan+`.next` dibersihkan+direstart, `Cached: 0 cached` dikonfirmasi) minimal 2× (akhir
Fase B dan Fase D). Curl sanity sweep ke setiap route yang disentuh (`/akun/*`,
`/{slug}/usaha`, `/{slug}/pesantren`, `/{slug}/profesional`, list+detail) plus regresi sweep
tipe konten LAIN yang tidak disentuh (produk/agenda/campaign/anggota — semua tetap 200, nol
collateral damage). Grep akhir `getEnabledEkosistemModules(` — 20 titik pemanggilan
terkonfirmasi ada di seluruh 4 fase. Nol migrasi DB.

**Belum diverifikasi visual di browser** (keterbatasan environment sesi ini) — user perlu
coba: matikan Pesantren di `/settings/general` sebuah tenant → cek `/akun` (card+nav item
hilang), `/akun/pesantren` (redirect ke `/akun`), `/{slug}/pesantren` (404), section builder
landing page (opsi "Pesantren" hilang dari dropdown "Tipe Direktori"), `/statistik` (blok
Pesantren hilang), dan alur `/gabung` (eligibility tidak lagi mensyaratkan Pesantren — cukup
Usaha/Profesional kalau keduanya masih aktif).

**Status: di-commit+push (`05ceef8`) tanpa migrasi DB.**

**Susulan (2026-08-01) — bug ditemukan dari testing sungguhan user pertama kali, langsung
difix**: user setup tenant forum baru "Forbis" dengan database anggota lengkap dari import
Excel (banyak nomor keanggotaan forum sudah terisi, sesuai rule auto-join § "Template Excel
Import + Auto-Join Forum" — member dengan nomor keanggotaan forum otomatis
`forumStatus='active'`). Begitu login aktif, salah satu anggota yang SUDAH punya
`forumStatus='active'` (No. Anggota Forum `2017.00001`, PC IKPM Subang) tetap melihat overlay
"Lengkapi Data" yang isinya "Anda harus melengkapi profil Anda terlebih dahulu **sebelum
dapat mendaftar menjadi anggota Forbis**" — kontradiktif, karena kartu di baliknya SUDAH
menunjukkan mereka anggota aktif (Status: active). User: "harusnya jika memang sudah menjadi
anggota kita ubah notifikasi yang menutupi itu dengan notifikasi Data keanggotaan belum
lengkap aja gitu ... padahal kan sudah menjadi anggota forbis."

**Root cause**: `showEligibilityOverlay = !eligibility.eligible || !isJoined` (forum) —
overlay tampil begitu profil TIDAK eligible, TERLEPAS dari `isJoined`. Tapi teks pesan
overlay tidak pernah tahu soal `isJoined` — selalu memakai framing "sebelum dapat mendaftar
menjadi anggota X" (seolah belum jadi anggota), padahal untuk member yang SUDAH
`forumStatus='active'` (via auto-join import/admin-add), framing itu salah — mereka BUKAN
sedang "akan mendaftar", mereka SUDAH anggota tapi datanya belum lengkap.

**Fix**: `MembershipEligibilityOverlay` dapat prop baru `isJoined: boolean` — kalau `true`
DAN belum eligible, pakai framing "Anda **sudah menjadi anggota** {tenantName}. Lengkapi
[profil/salah satu data Usaha-Profesional-Pesantren] Anda agar data keanggotaan tercatat
dengan benar" — bukan lagi "sebelum dapat mendaftar". Framing lama (`isJoined=false`) tetap
dipertahankan utuh untuk kasus yang genuinely belum jadi anggota. Tombol/routing (Lengkapi
Data Pribadi → `/akun/lengkapi`, popup 3 pilihan direktori, Gabung X) TIDAK berubah — hanya
teksnya.

**`overlayIsJoined` dihitung di `akun/page.tsx`, beda sumber per tipe tenant**:
- Forum: reuse `isJoined` yang sudah dihitung (`forumStatus === "active"`).
- Cabang/marhalah: `membershipInfo?.status != null` — auto-populate (`syncAutoTenantMemberships`,
  `packages/db/src/helpers/member-sync.ts`) SELALU insert `status: "active"` langsung, TIDAK
  ADA lifecycle "pending" seperti forum (`forumStatus`) — jadi baris `tenant_memberships` yang
  sudah ada untuk tenant ini berarti genuinely anggota, terlepas kelengkapan datanya.
  `membershipInfo.status` sudah di-fetch lebih awal di file yang sama (query lain, untuk
  display "No. Anggota"/"Status" di kartu) — di-reuse, bukan query baru.

**Verifikasi**: `tsc --noEmit` 0 error kedua package + `bun run build --filter=@jalajogja/web`
genuine sukses (`Cached: 0 cached`, 46.75s, dev server dimatikan+`.next` dibersihkan+direstart).
Curl sanity check `/akun` di 2 tenant lokal (307 redirect ke login tanpa sesi, bukan 500 —
konfirmasi rute compile+jalan normal). Nol migrasi DB — murni perubahan copy/logic aplikasi.
**Belum diverifikasi visual di browser sungguhan** (tidak ada session member forum lokal yang
persis mereplikasi skenario "forumStatus active tapi data belum lengkap" untuk dicoba langsung)
— user perlu konfirmasi ulang di tenant Forbis: anggota yang sudah `forumStatus='active'`
sekarang harus melihat teks "Anda sudah menjadi anggota Forbis. Lengkapi ..." bukan lagi
"sebelum dapat mendaftar menjadi anggota Forbis".

**Susulan (2026-08-07) — toggle dipindah ke modul admin baru "Ekosistem"**: setelah
konsolidasi hardcode taksonomi Usaha (`docs/arsitektur-usaha.md` § 11), user membuka diskusi
soal per-tenant taxonomy customization untuk field Kategori/Sektor/Bidang Usaha (rekomendasi
hybrid: taksonomi baku + hide/show per tenant, ditunda ke sesi lain) — tapi mengusulkan
konkret: modul dashboard admin BARU khusus untuk "menaungi semua setting form" (Usaha/
Pesantren/Profesional), termasuk memindahkan toggle on/off yang tadinya numpang di
`/settings/general`. Detail arsitektur, struktur modul, dan alasan tiap keputusan teknis:
**`docs/arsitektur-ekosistem.md` § 7 "Modul Admin: Ekosistem (2026-08-07)"**.

**Ringkasan yang relevan untuk halaman ini**: toggle 3 checkbox ("Aktifkan Modul Usaha/
Pesantren/Profesional") DIPINDAH TOTAL dari `/app/{slug}/settings/general` ke
`/app/{slug}/ekosistem/pengaturan` — isi/perilaku/guard akses (`canManageUsers`) TIDAK
BERUBAH, cuma lokasinya. Storage settings JUGA pindah — `usaha_enabled`/`pesantren_enabled`/
`profesional_enabled` sekarang di `tenant.settings` group `"ekosistem"` (group baru, migration
`0061_settings_group_ekosistem.sql`), bukan lagi group `"general"`. **Satu-satunya titik yang
perlu tahu perubahan group** ini adalah `getEnabledEkosistemModules()` (`lib/ekosistem-
modules.server.ts`) — ~20 caller lain di seluruh app tidak perlu disentuh sama sekali, karena
semuanya cuma memanggil fungsi itu tanpa tahu (atau perlu tahu) group storage internalnya.
Semua rujukan "toggle di `/settings/general`" di section ini di atas (termasuk kutipan
`AskUserQuestion` yang sudah dikunci sebelumnya) TETAP AKURAT SECARA HISTORIS untuk kapan
ditulis — dipertahankan apa adanya, bukan ditulis ulang, sesuai keputusan produk sadar.

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
- [x] **Hard delete akun publik oleh admin** — `deleteProfileAction` +
      tombol "Hapus Akun" di `/app/{slug}/accounts/[id]`, untuk bersihkan registrasi salah
      jalur (lihat § "Hapus Akun — Soft Delete vs Hard Delete" di atas)

### ✅ Bug Diperbaiki
- [x] **`createOfficerWithAccountAction`** — sekarang set `members.better_auth_user_id`
      `UPDATE public.members SET better_auth_user_id = userId WHERE id = memberId AND better_auth_user_id IS NULL`
- [x] **`activateUserDirectAction`** — sama, sudah set `better_auth_user_id`
- [x] **`acceptInviteAction` + `registerAndAcceptAction`** — sudah set `better_auth_user_id` jika `invite.memberId` tidak null
- [x] **Redirect loop `akun ↔ dashboard-redirect ↔ /no-tenant-access`** (tujuan akhir sekarang
      `/no-tenant-access`, BUKAN `/register?error=no-tenant` lagi — lihat ralat di
      `docs/arsitektur-login-universal.md` § "Alur Login & Routing Pasca Login") — dua root cause:
  1. `login-form.tsx`: `router.push(dest)` → stale server cache → session null → loop.
     **Fix**: `window.location.href = dest` (full reload) untuk semua alur login.
  2. `akun/layout.tsx`: `if (!identity) redirect('/app/${slug}/dashboard')` tanpa cek.
     Jika user bukan pengurus tenant ini → admin layout redirect lagi → loop.
     **Fix**: cek `tenant.users` dulu; kalau ada → admin dashboard; kalau tidak → `/{slug}/login`
     atau, kalau identity null DAN bukan pengurus tenant ini, → halaman dead-end
     `/{slug}/akun-error` (lihat di bawah) — bukan redirect lagi.

**Halaman dead-end `/{slug}/akun-error`** — dipakai saat `getAkunIdentity()` null DAN user bukan
pengurus tenant ini (kasus: akun Better Auth ada tapi tidak terhubung ke `public.members` maupun
`public.profiles`, mis. data anggota diinput admin manual sebelum user register sendiri, atau
register flow yang skip `UPDATE members SET better_auth_user_id`). Halaman ini SENGAJA di LUAR
route `/akun/*` (tidak kena `akun/layout.tsx` guard) — hanya tampilkan pesan + tombol sign-out,
tidak redirect ke mana pun. `akun/layout.tsx` dan `akun/page.tsx` redirect ke sini (bukan ke
`/login`) untuk kasus ini.

**Aturan umum, berlaku di seluruh aplikasi**: sebelum menetapkan target redirect di halaman A,
trace dulu — apakah halaman target B punya kondisi yang bisa redirect balik ke A? Kalau ya, itu
LOOP. Solusinya: cari target yang genuinely tidak punya redirect balik, atau buat halaman
dead-end khusus (seperti `akun-error`) yang murni menampilkan pesan tanpa logic redirect lebih
lanjut. Data historis yang bisa memicu kondisi ini bisa dibackfill manual — lihat
`docs/fix-akun-tidak-terhubung.sql`.

### Pengurus Lama Tanpa `members.betterAuthUserId`
Pengurus yang diaktifkan SEBELUM fix `createOfficerWithAccountAction` punya:
- `tenant.users.betterAuthUserId` = nanoid ✅
- `public.members.betterAuthUserId` = **null** ← menyebabkan `getAkunIdentity()` null

Setelah fix `akun/layout.tsx`, mereka tetap bisa akses dashboard admin (redirect benar).
Tapi mereka tidak bisa akses front-end `/akun` sampai `members.betterAuthUserId` diisi.

Untuk backfill manual di VPS:
```sql
-- Cari pengurus yang belum punya betterAuthUserId di members
SELECT m.id, m.name, tu.better_auth_user_id
FROM public.members m
JOIN "tenant_pc-ikpm-jogjakarta".users tu ON tu.member_id = m.id
WHERE m.better_auth_user_id IS NULL;

-- Set betterAuthUserId dari tenant.users
UPDATE public.members m
SET better_auth_user_id = tu.better_auth_user_id
FROM "tenant_pc-ikpm-jogjakarta".users tu
WHERE tu.member_id = m.id
  AND m.better_auth_user_id IS NULL;
```

### Tidak Akan Diimplementasi
- Auto-create member dari front-end jika tidak ketemu di `public.members` → DILARANG.
  Anggota baru wajib didaftarkan oleh admin via `/{slug}/members/new`.
  Register jalur IKPM hanya untuk klaim data yang sudah ada.
