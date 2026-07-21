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
- [x] **Redirect loop `akun ↔ dashboard-redirect ↔ register?error=no-tenant`** — dua root cause:
  1. `login-form.tsx`: `router.push(dest)` → stale server cache → session null → loop.
     **Fix**: `window.location.href = dest` (full reload) untuk semua alur login.
  2. `akun/layout.tsx`: `if (!identity) redirect('/app/${slug}/dashboard')` tanpa cek.
     Jika user bukan pengurus tenant ini → admin layout redirect lagi → loop.
     **Fix**: cek `tenant.users` dulu; kalau ada → admin dashboard; kalau tidak → login.

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
