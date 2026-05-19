# Evaluasi Arsitektur URL — jalakarta

> Status: **Evaluasi — rencana migrasi sudah tersedia**
> Dokumen ini menjelaskan masalah dan analisis. **Rencana eksekusi ada di `docs/rencana-migrasi-url.md`**.
> Dokumen ini akan dihapus saat Fase 4 migrasi selesai (kontennya sudah masuk ke plan).

---

## Kondisi Saat Ini

### Route Groups di Next.js (File System)

```
app/
├── (auth)/              → login/register platform-level
├── (dashboard)/[tenant] → admin dashboard per tenant
├── (public)/[tenant]    → website publik per tenant
├── (platform)/          → super admin jalakarta
└── api/                 → semua API routes
```

Route groups `(auth)`, `(dashboard)`, `(public)`, `(platform)` adalah konsep Next.js saja — **tidak terlihat di URL browser**. Di browser, semuanya hanya terlihat sebagai path biasa.

### URL yang Dihasilkan (Perspektif Browser)

**Platform jalakarta (tidak ada tenant):**
```
/login                     ← login untuk dashboard admin tenant
/register                  ← daftar tenant baru (dinonaktifkan)
/platform/login            ← login super admin jalakarta
/platform/*                ← super admin panel
/dashboard-redirect        ← routing helper post-login
```

**Admin dashboard per tenant:**
```
/{slug}/dashboard
/{slug}/members/*          ← kelola anggota
/{slug}/pengurus/*         ← kelola pengurus
/{slug}/divisi/*           ← kelola divisi
/{slug}/accounts/*         ← kelola akun publik
/{slug}/media/*            ← media library
/{slug}/website/*          ← CMS konten
/{slug}/letters/*          ← modul surat
/{slug}/finance/*          ← keuangan
/{slug}/donasi/*           ← admin kampanye donasi
/{slug}/event/*            ← admin event
/{slug}/dokumen/*          ← admin dokumen
/{slug}/toko/*             ← admin toko
/{slug}/settings/*         ← pengaturan tenant
```

**Website publik per tenant (diakses pengunjung/anggota):**
```
/{slug}/login              ← login anggota/member (beda dari /login!)
/{slug}/register           ← daftar akun anggota
/{slug}/forgot-password
/{slug}/reset-password
/{slug}/akun/*             ← dashboard anggota
/{slug}/post/*             ← blog/berita
/{slug}/produk/*           ← katalog produk (bukan /toko — konflik!)
/{slug}/campaign/*         ← halaman donasi (bukan /donasi — konflik!)
/{slug}/agenda/*           ← halaman event (bukan /event — konflik!)
/{slug}/keranjang          ← cart belanja
/{slug}/checkout
/{slug}/invoice/*
/{slug}/anggota            ← direktori anggota publik
/{slug}/pesantren/*
/{slug}/usaha/*
/{slug}/statistik
/{slug}/dokumen/[id]       ← lihat dokumen publik (berbagi namespace dengan admin!)
/{slug}/invite             ← terima undangan pengurus
/{slug}/sign/*             ← TTD surat
/{slug}/verify/*           ← verifikasi surat
```

---

## Masalah yang Ditemukan

### Masalah 1 — Namespace Admin dan Publik Bertabrakan

Admin dan publik berbagi prefix `/{slug}/*` yang sama. Next.js route groups mencegah error build, tapi tidak ada pemisahan konseptual di URL.

**Konflik yang sudah terjadi dan diselesaikan dengan penamaan ulang:**

| Konsep | URL Admin | URL Publik | Catatan |
|--------|-----------|------------|---------|
| Produk/Toko | `/{slug}/toko` | `/{slug}/produk` | harus rename publik |
| Donasi | `/{slug}/donasi` | `/{slug}/campaign` | harus rename publik |
| Event | `/{slug}/event` | `/{slug}/agenda` | harus rename publik |

Penamaan ulang ini adalah workaround, bukan solusi. Makin banyak modul → makin banyak rename.

**Konflik yang masih ada:**
- `/{slug}/dokumen` → dipakai admin (list) DAN publik (detail `/{slug}/dokumen/[id]`) — kebetulan tidak bentrok karena levelnya berbeda, tapi sangat rawan

### Masalah 2 — Dua Login Page dengan URL Berbeda

```
/login             ← login dashboard admin (akun pengurus)
/{slug}/login      ← login website publik (akun anggota/member)
```

Ini membingungkan pengguna dan developer. Pengurus yang salah ketik URL bisa mendarat di halaman yang berbeda sama sekali.

### Masalah 3 — Post-Login Routing Tidak Deterministik (Multi-Tenant)

`getFirstTenantForUser()` di `lib/tenant.ts` tidak ada `ORDER BY` — mengembalikan tenant pertama yang ditemukan di loop. Jika satu pengurus aktif di dua tenant, dia bisa dikirim ke tenant mana saja.

```typescript
// lib/tenant.ts — loop tanpa ordering
for (const { slug } of allTenants) {
  if (found) return slug; // ← tidak ada prioritas
}
```

### Masalah 4 — Middleware Tidak Bisa Bedakan Admin vs Publik dari URL

```typescript
// middleware.ts
const PROTECTED_PATTERN = /^\/[a-z0-9-]+\/(dashboard|members|letters|...)/;
```

Middleware harus hardcode setiap module name untuk tahu apakah suatu URL adalah admin. Ketika tambah modul baru, middleware harus diupdate. Tidak ada pola struktural yang bisa diandalkan.

### Masalah 5 — API Routes Tidak Terstruktur

```
/api/akun/*        ← API front-end anggota
/api/auth/*        ← Better Auth
/api/tenant/*      ← tenant management
/api/letters/*     ← modul surat (admin)
/api/media/*       ← media (admin)
/api/ref/*         ← reference data
/api/internal/*    ← internal (middleware)
/api/ongkir/*      ← ongkos kirim (publik?)
/api/mitra/*       ← mitra API
```

Tidak ada pemisahan antara API untuk admin vs API untuk front-end publik vs API internal.

### Masalah 6 — Auth Session Berbeda, URL Serupa

Ada tiga konteks auth berbeda yang beroperasi di URL yang terlihat mirip:

| Konteks | Session | Login URL |
|---------|---------|-----------|
| Super admin jalakarta | Cookie `platform_session` | `/platform/login` |
| Admin dashboard tenant | Better Auth (tenant.users) | `/login` |
| Member/anggota website | Better Auth (profiles/members) | `/{slug}/login` |

---

## Arsitektur URL Ideal

### Prinsip

1. **Satu prefix untuk satu konteks** — URL harus langsung memberitahu siapa penggunanya
2. **Tidak ada rename karena konflik** — struktur URL mencegah konflik by design
3. **Middleware yang simpel** — bisa membedakan konteks hanya dari prefix URL

### Proposal: Path Prefix `/app/` untuk Admin

Ini perubahan paling minimal yang paling besar dampaknya:

```
SEKARANG:                          IDEAL:
/{slug}/dashboard          →       /app/{slug}/dashboard
/{slug}/members/*          →       /app/{slug}/members/*
/{slug}/toko/*             →       /app/{slug}/toko/*      ← tidak perlu rename!
/{slug}/donasi/*           →       /app/{slug}/donasi/*    ← tidak perlu rename!
/{slug}/event/*            →       /app/{slug}/event/*     ← tidak perlu rename!
/{slug}/settings/*         →       /app/{slug}/settings/*
                                   
/{slug}/produk/*           →       /{slug}/produk/*        ← publik tetap
/{slug}/campaign/*         →       /{slug}/donasi/*        ← bisa kembali ke nama asli
/{slug}/agenda/*           →       /{slug}/event/*         ← bisa kembali ke nama asli
/{slug}/login              →       /{slug}/login           ← publik tetap
                                   
/login                     →       /app/login              ← login admin jelas
/platform/*                →       /platform/*             ← tetap
```

**Middleware menjadi trivial:**
```typescript
if (pathname.startsWith("/app/")) {
  // → admin dashboard, cek Better Auth session
} else if (pathname.startsWith("/platform/")) {
  // → super admin, cek platform_session
} else {
  // → publik, tidak butuh auth (kecuali beberapa halaman tertentu)
}
```

**API juga bisa ikut distrukturkan:**
```
/api/app/{slug}/*     ← API untuk admin dashboard (dilindungi)
/api/pub/{slug}/*     ← API untuk website publik
/api/platform/*       ← API super admin
/api/auth/*           ← Better Auth (tidak berubah)
/api/internal/*       ← internal middleware (tidak berubah)
```

### Alternatif: Subdomain (Jangka Panjang)

Lebih bersih tapi lebih besar perubahan infrastrukturnya:

```
admin.jalakarta.com/{slug}/*   ← tenant dashboard
jalakarta.com/{slug}/*         ← website publik tenant
platform.jalakarta.com/*       ← super admin
```

Butuh:
- Nginx wildcard subdomain
- Cookie domain lintas subdomain (perubahan Better Auth config)
- CORS setup

---

## Estimasi Dampak Migrasi ke `/app/`

| Komponen | Yang Berubah |
|----------|-------------|
| Next.js route structure | Pindah `(dashboard)/[tenant]` ke `(dashboard)/app/[tenant]` |
| Semua `href` dan `redirect` di dashboard | Tambah `/app` prefix |
| `middleware.ts` | Ganti `PROTECTED_PATTERN` dengan `startsWith("/app/")` |
| `sidebar-nav.tsx` | Update path semua nav items |
| `getTenantAccess()` dan `getFirstTenantForUser()` | Tidak berubah |
| `SidebarNav` links | Semua `/{slug}/module` → `/app/{slug}/module` |
| API routes admin | Opsional — bisa bertahap |
| Public routes | Tidak berubah |
| Login URL dashboard | `/login` → `/app/login` |

File yang paling banyak berubah: semua `redirect()`, semua `href`, semua `revalidatePath()` di setiap server action.

**Perkiraan scope:** Besar, tapi mekanis — cari-ganti yang bisa dilakukan bertahap per modul.

---

## Kapan Harus Diperbaiki

**Saat ini tidak mendesak** karena:
- Hanya ada satu tenant aktif
- Next.js route groups mencegah actual URL conflict secara teknis
- Permission system sudah bekerja dengan baik

**Harus diperbaiki sebelum:**
- Onboarding tenant kedua yang berbeda operator
- Launch publik (SEO admin URL bisa terindeks)
- Multi-tenant self-service (user bingung dua login URL)

---

## Lessons Learned

**Pelajaran utama**: Membangun tanpa konvensi URL yang jelas dari awal menyebabkan masalah yang akumulatif. Setiap modul baru menambah konflik potensial.

**Urutan yang benar seharusnya:**
1. Tentukan: siapa saja pengguna dan URL prefix-nya
2. Buat aturan: admin selalu di `/app/`, publik selalu di `/`
3. Baru build fitur di atasnya

**Workaround yang harus di-revert saat migrasi:**
- `toko` di admin → nama asli sudah benar; publik dikembalikan dari `produk` ke `toko` (atau tetap `produk` kalau lebih masuk akal secara UX)
- `donasi` di admin → publik dikembalikan dari `campaign` ke `donasi`
- `event` di admin → publik dikembalikan dari `agenda` ke `event`
