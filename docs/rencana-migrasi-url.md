# Rencana Migrasi Arsitektur URL

> Status: **FASE 1–4 SELESAI — commit terkini**
> Fase 5 (admin subdomain custom domain) ditunda sampai production stable 2 minggu.
> Dokumen evaluasi (`docs/evaluasi-arsitektur-url.md`) sudah dihapus — kontennya ada di sini.

---

## Ringkasan Eksekutif

**Masalah inti:** Admin dashboard dan website publik berbagi namespace URL `/{slug}/*` yang sama. Tidak ada pemisahan struktural → konflik nama modul, dua login page yang membingungkan, middleware yang rapuh.

**Target akhir:**
```
SEKARANG (bermasalah)          SETELAH MIGRASI (bersih)
/pc-ikpm-jogja/dashboard   →  /app/pc-ikpm-jogja/dashboard
/pc-ikpm-jogja/toko        →  /app/pc-ikpm-jogja/toko
/pc-ikpm-jogja/donasi      →  /app/pc-ikpm-jogja/donasi
/pc-ikpm-jogja/event       →  /app/pc-ikpm-jogja/event
/login (admin)             →  /app/login
/pc-ikpm-jogja/login       →  /pc-ikpm-jogja/login  (tidak berubah)
admin.ikpmjogja.com/       →  admin dashboard via subdomain (fitur tambahan)
```

**Jaminan:** Front-end publik `/{slug}/*` **tidak berubah sama sekali**.

---

## Inventarisasi Dampak (Data Aktual)

Berdasarkan audit kode tanggal 2026-05:

| Kategori | Jumlah | File |
|----------|--------|------|
| `redirect()` calls di dashboard | ~127 | tersebar di semua modul |
| `revalidatePath()` calls di actions | ~131 | 18 file actions.ts |
| `href` / `Link` di dashboard components | ~10 | sidebar, nav, user-menu |
| Module layout files dengan guard | 9 | semua `*/layout.tsx` |
| Server action files | 18 | semua `*/actions.ts` |
| Middleware patterns hardcoded | 1 | `middleware.ts` |

**Pola redirect yang paling banyak (harus diubah semua):**
```
redirect("/login")              → redirect("/app/login")          [77x]
redirect("/dashboard-redirect") → redirect("/app/dashboard-redirect") atau logika baru  [25x]
redirect(`/${slug}/dashboard`)  → redirect(`/app/${slug}/dashboard`) [10x]
redirect(`/${slug}/module/...`) → redirect(`/app/${slug}/module/...`) [banyak]
```

---

## Bug Inventory Sebelum Migrasi

Bug yang sudah ada di kode saat ini dan harus dicatat sebelum migrasi dimulai. Beberapa mungkin selesai bersamaan dengan migrasi, beberapa harus difix terpisah.

### Bug Terkonfirmasi

**B1 — `getFirstTenantForUser()` tidak deterministik (multi-tenant)**
- File: `lib/tenant.ts` baris 77–101
- Masalah: Loop tanpa `ORDER BY`. User di 2 tenant → dikirim ke tenant mana saja.
- Dampak saat ini: Rendah (hanya 1 tenant aktif). Harus difix sebelum tenant kedua.
- Fix: Tambah prioritas atau halaman pemilih tenant.

**B2 — Middleware `PROTECTED_PATTERN` tidak mencakup semua modul admin**
- File: `middleware.ts`
- Pattern: `/^\/[a-z0-9-]+\/(dashboard|members|letters|finance|shop|settings)/`
- Modul yang tidak terlindungi di middleware: `toko`, `donasi`, `event`, `dokumen`, `media`, `pengurus`, `website`, `accounts`
- Catatan: Modul ini masih aman karena dilindungi di level layout/page (`getTenantAccess()`). Middleware hanya layer pertama.
- Fix: Setelah migrasi ke `/app/`, middleware tinggal `startsWith("/app/")` — semua modul tertutup otomatis.

**B3 — `/{slug}/dokumen` namespace shared admin + publik**
- Admin: `(dashboard)/[tenant]/dokumen/page.tsx` → `/{slug}/dokumen` (list)
- Publik: `(public)/[tenant]/dokumen/[id]/page.tsx` → `/{slug}/dokumen/[id]` (detail)
- Saat ini tidak bentrok karena levelnya berbeda. Tapi rawan jika admin tambah `[id]` page atau publik tambah root page.
- Fix: Selesai otomatis setelah migrasi (admin pindah ke `/app/{slug}/dokumen`).

**B4 — `cart` dan `keranjang` duplikat di public routes**
- Ada `/(public)/[tenant]/cart` DAN `/(public)/[tenant]/keranjang`
- Harus dicek mana yang aktif dipakai, mana yang legacy.

**B5 — `event` dan `agenda` duplikat di public routes**
- `(public)/[tenant]/event` DAN `(public)/[tenant]/agenda`
- Dicek: mana yang dipakai di front-end aktif.

---

## Arsitektur Target

### URL Structure Setelah Migrasi

```
jalakarta.com/
├── app/                        ← SEMUA admin dashboard (baru)
│   ├── login                   ← login admin (pindah dari /login)
│   ├── dashboard-redirect      ← routing helper post-login
│   └── [slug]/
│       ├── dashboard
│       ├── members/*
│       ├── pengurus/*
│       ├── divisi/*
│       ├── accounts/*
│       ├── media/*
│       ├── website/*
│       ├── letters/*
│       ├── finance/*
│       ├── donasi/*
│       ├── event/*
│       ├── dokumen/*
│       ├── toko/*
│       └── settings/*
│
├── [slug]/                     ← website publik (tidak berubah)
│   ├── login, register, akun, ...
│   ├── post/*, produk/*, campaign/*, ...
│   └── (semua yang ada sekarang)
│
└── platform/                   ← super admin (tidak berubah)
    ├── login
    └── ...

/register                       ← daftar tenant baru (sudah dinonaktifkan)
```

### Middleware Logic Setelah Migrasi

```
SEKARANG (rapuh):
  PROTECTED_PATTERN = /^\/[a-z0-9-]+\/(dashboard|members|letters|finance|shop|settings)/
  → hardcode nama modul, mudah lupa saat tambah modul baru

SETELAH (simpel):
  if pathname.startsWith("/app/") → cek admin auth
  if pathname.startsWith("/platform/") → cek platform auth
  else → publik (tidak butuh auth kecuali beberapa halaman /{slug}/akun/*)
```

---

## Fitur Tambahan: Admin Subdomain Custom Domain

> Fitur ini dijadwalkan di Fase 5 — setelah core migration selesai dan stabil.

### Konsep

Tenant yang punya custom domain `ikpmjogja.com` bisa akses admin di `admin.ikpmjogja.com` — tidak harus ingat jalakarta.com/app/pc-ikpm-jogja.

```
TANPA FITUR (tetap berfungsi):
  ikpmjogja.com/          → website publik IKPM Jogja
  jalakarta.com/app/pc-ikpm-jogja/  → admin dashboard

DENGAN FITUR (opsional, lebih profesional):
  ikpmjogja.com/          → website publik IKPM Jogja
  admin.ikpmjogja.com/    → admin dashboard IKPM Jogja
```

### Cara Kerja Teknis

**1. Sisi tenant (DNS setup):**
Tenant menambah satu A record atau CNAME baru:
```
admin.ikpmjogja.com → A → [IP VPS jalakarta]
```
Jika pakai Cloudflare (sudah direkomendasikan untuk custom domain) → orange cloud otomatis handle SSL.

**2. Tidak perlu kolom DB baru:**
`tenants.customDomain` sudah menyimpan `ikpmjogja.com`. Middleware cukup strip prefix `admin.` untuk resolve:
```
admin.ikpmjogja.com → strip "admin." → ikpmjogja.com → lookup slug → pc-ikpm-jogja
```

**3. Middleware logic tambahan:**
```typescript
const isAdminSubdomain = host.startsWith("admin.");
if (isAdminSubdomain) {
  const baseDomain = host.slice("admin.".length);
  const slug = await resolveCustomDomain(baseDomain);
  if (slug) {
    // Rewrite: admin.ikpmjogja.com/dashboard → /app/pc-ikpm-jogja/dashboard
    url.pathname = `/app/${slug}${pathname === "/" ? "/dashboard" : pathname}`;
    return NextResponse.rewrite(url);
  }
}
```

**4. `isOwnHost()` update:**
```typescript
export function isOwnHost(host: string): boolean {
  return (
    host === "jalakarta.com" ||
    host.endsWith(".jalakarta.com") ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1")
    // TIDAK include "admin.{customdomain}" → biar dihandle middleware terpisah
  );
}
```

**5. Settings UI:**
Tambah informasi di `/app/{slug}/settings/domain` — instruksi DNS untuk admin subdomain.

**Risiko fitur ini:** Jika tenant salah config DNS → admin subdomain tidak bisa diakses tapi jalakarta.com/app/{slug}/ tetap berfungsi sebagai fallback.

---

## Fase Eksekusi

> **ATURAN**: Setiap fase harus selesai dan ditest sebelum masuk fase berikutnya.
> Front-end publik tidak boleh terganggu di titik manapun.
> Dokumentasi lama yang sudah tidak berlaku dihapus seiring eksekusi fase.

---

### Fase 0 — Persiapan (Sebelum Kode Apapun Diubah)

**Tujuan:** Memastikan kita punya baseline yang jelas dan semua risiko terpetakan.

**0a — Fix bug yang tidak terkait migrasi:**
- Fix B4: cek dan hapus duplikat `cart` vs `keranjang`
- Fix B5: cek dan hapus duplikat `event` vs `agenda` di public routes
- Commit terpisah agar tidak campur dengan migrasi

**0b — Buat test checklist manual:**
Sebelum migrasi: verifikasi semua ini berfungsi normal:
```
[ ] Login admin di /login
[ ] Dashboard /{slug}/dashboard
[ ] Semua modul admin dapat diakses
[ ] Front-end publik /{slug}/post, /produk, /campaign, /agenda
[ ] Login anggota di /{slug}/login
[ ] Custom domain (jika aktif): ikpmjogja.com → website publik
[ ] Invite pengurus via link
[ ] Letter signing via link
[ ] PDF generation
```

**0c — Branch kerja:**
Semua pekerjaan migrasi di branch terpisah (`feat/url-refactor`), tidak di main sampai fase selesai dan ditest.

**0d — Hapus evaluasi-arsitektur-url.md:**
Dokumen evaluasi sudah tidak diperlukan setelah plan ini ada. Akan dihapus di Fase 1.

---

### Fase 1 — Struktur Route Next.js ✅ SELESAI (commit 6f81c76)

**Tujuan:** Pindah semua admin route ke `/app/[slug]/*` di filesystem.

**Lingkup perubahan:**
```
DARI: app/(dashboard)/[tenant]/
KE:   app/(dashboard)/app/[tenant]/
```

Ini perubahan Next.js routing yang pure — URL berubah, tidak ada logic lain.

**File yang berubah di fase ini:**
- Pindah folder `(dashboard)/[tenant]` ke `(dashboard)/app/[tenant]`
- Update `middleware.ts` — ganti `PROTECTED_PATTERN` dengan `startsWith("/app/")`
- Update `(auth)/login/page.tsx` — login admin pindah ke `/app/login`
- Buat `app/(dashboard)/app/login/page.tsx` atau pindah layout auth
- Update `dashboard-redirect` — pindah ke `/app/dashboard-redirect` atau tetap di root

**Yang TIDAK berubah di fase ini:**
- Semua file di `(public)/[tenant]` → tidak tersentuh
- Semua API routes → tidak tersentuh
- `lib/tenant.ts`, `lib/permissions.ts` → tidak tersentuh
- Database schema → tidak tersentuh

**Test setelah Fase 1:**
```
[ ] /app/{slug}/dashboard dapat diakses (baru)
[ ] /{slug}/dashboard redirect ke /app/{slug}/dashboard atau 404
[ ] /app/login berfungsi
[ ] Front-end publik /{slug}/post, /produk, dll masih berfungsi
[ ] Custom domain masih berfungsi
```

---

### Fase 2 — Update Redirect dan RevalidatePath di Actions ✅ SELESAI (commit 667d380)

**Tujuan:** Semua 127 `redirect()` dan 131 `revalidatePath()` di dashboard menggunakan path baru.

**Strategi:** Buat helper function dulu, ganti satu per satu per modul.

**Helper yang perlu dibuat:**
```typescript
// lib/admin-url.ts — centralized admin URL builder
export function adminUrl(slug: string, path: string = ""): string {
  return `/app/${slug}${path ? `/${path}` : ""}`;
}

export function revalidateAdmin(slug: string, path: string = ""): void {
  revalidatePath(adminUrl(slug, path));
}
```

**Urutan pengerjaan per modul (dari yang paling sederhana):**
1. `settings` — 7x revalidatePath, paling mudah
2. `members` — 5x
3. `media` — sedikit
4. `pengurus`, `divisi` — sedikit
5. `website` — 11x (pages + posts + categories + tags)
6. `letters` — 9x (terbanyak)
7. `finance`, `billing` — medium
8. `donasi` — medium
9. `event` — medium
10. `dokumen` — medium
11. `toko`, `toko/mitra`, `toko/pengaturan` — medium

**Untuk setiap modul, pattern yang dicari dan diganti:**
```
redirect("/login")              → redirect("/app/login")
redirect("/dashboard-redirect") → redirect("/app/dashboard-redirect")
redirect(`/${slug}/X`)         → redirect(`/app/${slug}/X`)
revalidatePath(`/${slug}/X`)   → revalidatePath(`/app/${slug}/X`)
```

**Yang tidak berubah:**
- `redirect()` di public routes — tidak ada yang berubah
- `revalidatePath()` untuk public routes dari public actions — tidak berubah

**Test setelah Fase 2:**
```
[ ] Create/update/delete di setiap modul berfungsi
[ ] Navigasi setelah action redirect ke URL yang benar
[ ] Tidak ada 404 setelah action selesai
```

---

### Fase 3 — Update Internal Links di Components ✅ SELESAI (commit 2ff026e)

**Tujuan:** Semua `href`, `Link`, dan `router.push` di komponen dashboard menggunakan path baru.

**File prioritas:**

**3a — `components/dashboard/sidebar.tsx`:**
```typescript
// href logo org: /${slug}/dashboard → /app/${slug}/dashboard
href={`/app/${slug}/dashboard`}
```

**3b — `components/dashboard/sidebar-nav.tsx`:**
```typescript
// NAV_ITEMS path mapping sudah ada — cukup ubah buildUrl-nya
const href = `/app/${slug}/${path}`;
```

**3c — `components/dashboard/user-menu.tsx`:**
```typescript
// logout redirect
router.push("/app/login");
```

**3d — Semua `*-nav.tsx` di setiap modul:**
Setiap modul punya komponen nav sendiri (website-nav, letters-nav, finance-nav, dll).
Semua `href` di dalam nav ini perlu diupdate ke `/app/{slug}/...`.

**Inventarisasi file nav per modul:**
```
components/website/website-nav.tsx
components/letters/letters-nav.tsx
components/keuangan/keuangan-nav.tsx
components/toko/toko-nav.tsx
components/donasi/donasi-nav.tsx
components/event/event-nav.tsx
components/dokumen/dokumen-nav.tsx
components/pengurus/pengurus-nav.tsx
components/settings/settings-nav.tsx
```

**3e — Semua link internal di dalam komponen dashboard:**
- Tombol "Buat Surat", "Lihat Detail", "Edit" — semua `href` yang mengarah ke admin routes
- Breadcrumb components
- "Kembali" buttons

**Test setelah Fase 3:**
```
[ ] Klik semua item di sidebar → URL benar
[ ] Navigation antar sub-halaman modul berfungsi
[ ] Breadcrumb URL benar
[ ] Link "Lihat Detail", "Edit", "Hapus" berfungsi
[ ] Tombol logout → redirect ke /app/login
```

---

### Fase 4 — Cleanup dan Konsolidasi ✅ SELESAI

**Tujuan:** Hapus sisa-sisa workaround lama, bersihkan dokumentasi yang tidak lagi valid.

**4a — Hapus atau redirect route lama:**
Setelah semua link diupdate, route lama `/{slug}/dashboard`, `/{slug}/members`, dll perlu ditangani.
Pilihan:
- Biarkan 404 (user yang pakai bookmark lama akan tahu harus update)
- Tambah redirect 301 dari path lama ke path baru (lebih ramah)

Rekomendasi: Redirect 301 selama 30 hari, lalu hapus.

**4b — Update `middleware.ts` PROTECTED_PATTERN:**
```typescript
// SEBELUM
const PROTECTED_PATTERN = /^\/[a-z0-9-]+\/(dashboard|members|letters|finance|shop|settings)/;

// SESUDAH
// Pattern tidak lagi diperlukan — cukup startsWith
const isAdminRoute = pathname.startsWith("/app/") && pathname !== "/app/login";
const isAuthPage = pathname === "/app/login";
```

**4c — Hapus duplikat route publik (jika ada):**
- Hapus `(public)/[tenant]/cart` jika `keranjang` yang aktif (atau sebaliknya)
- Hapus `(public)/[tenant]/event` jika `agenda` yang aktif (atau sebaliknya)

**4d — Pertimbangkan rename publik kembali:**
Ini keputusan UX, bukan teknis. Pilihan:
- Tetap: `produk`, `campaign`, `agenda` (sudah banyak link yang beredar)
- Rename: `produk→toko`, `campaign→donasi`, `agenda→event` (nama lebih natural)

Rekomendasi: **Tetap** — nama yang sudah jalan lebih aman. Rename publik berarti semua link yang sudah dibagikan di social media jadi mati.

**4e — Update dokumentasi:**
- Hapus `docs/evaluasi-arsitektur-url.md` (sudah tidak relevan setelah migrasi selesai)
- Update `docs/arsitektur-domain.md` — tambah section `/app/` prefix
- Update `CLAUDE.md` — update Technical Debt, hapus yang sudah selesai
- Update semua docs yang menyebut URL admin lama

---

### Fase 5 — Admin Subdomain Custom Domain (Fitur Opsional)

**Tujuan:** Tenant dengan custom domain bisa akses admin di `admin.{customdomain}`.

**Prasyarat:** Fase 1–4 selesai dan stabil di production minimal 2 minggu.

**5a — Schema DB (tidak perlu kolom baru):**
Gunakan `tenants.customDomain` yang sudah ada. Middleware cukup strip `admin.` prefix.

**5b — Update `middleware.ts`:**
```typescript
// Deteksi admin subdomain custom domain
const hostWithoutPort = host.split(":")[0];
const isAdminSubdomain = hostWithoutPort.startsWith("admin.");
const baseDomain = isAdminSubdomain ? hostWithoutPort.slice("admin.".length) : null;

if (isAdminSubdomain && baseDomain && !isOwnHost(baseDomain)) {
  // Resolve slug dari base domain
  const slug = await resolveCustomDomain(baseDomain);
  if (slug) {
    // Rewrite: admin.ikpmjogja.com/members → /app/pc-ikpm-jogja/members
    const url = request.nextUrl.clone();
    url.pathname = `/app/${slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  // Custom domain tidak dikenal → redirect ke jalakarta.com
  return NextResponse.redirect(new URL("/app/login", "https://jalakarta.com"));
}
```

**5c — Update `isOwnHost()`:**
Pastikan `admin.{customdomain}` tidak masuk ke `isOwnHost()` — sudah aman dengan implementasi sekarang.

**5d — Nginx config:**
Nginx sudah melayani semua request ke VPS. Tidak perlu config tambahan khusus — semua request ke IP VPS (apapun hostname-nya) sudah masuk ke Next.js.

**5e — Instruksi DNS di Settings UI:**
Tambah section di `/app/{slug}/settings/domain`:
```
Admin Subdomain (Opsional)
──────────────────────────
Akses dashboard admin melalui domain Anda sendiri:

Tambahkan A record:
  admin.ikpmjogja.com → [IP VPS]

Setelah DNS aktif, Anda bisa login di:
  admin.ikpmjogja.com
```

**5f — Test:**
```
[ ] admin.ikpmjogja.com/dashboard → admin dashboard benar
[ ] admin.ikpmjogja.com/login → form login admin
[ ] ikpmjogja.com/ → website publik (tidak terpengaruh)
[ ] jalakarta.com/app/pc-ikpm-jogja/ → masih berfungsi (fallback)
[ ] DNS belum diset → tidak ada error aneh
```

---

## Risiko dan Mitigasi

| Risiko | Tingkat | Mitigasi |
|--------|---------|----------|
| Front-end publik terganggu | Rendah | Public routes `/{slug}/*` tidak disentuh sama sekali |
| Bookmark admin lama mati | Sedang | Tambah redirect 301 dari path lama (Fase 4a) |
| Server action redirect ke URL salah | Tinggi | Test setiap modul setelah Fase 2 |
| `revalidatePath` salah → cache tidak di-clear | Tinggi | Test create/edit/delete setiap modul |
| Custom domain publik terganggu | Rendah | Middleware custom domain tidak berubah sampai Fase 5 |
| Admin subdomain SSL | Sedang | Gunakan Cloudflare orange cloud (sudah direkomendasikan) |
| Sesi login lama expired setelah migrasi | Rendah | Better Auth session tidak terkait URL — sesi tetap valid |

---

## Urutan Prioritas Final

```
Fase 0 — Persiapan + bug fix kecil    (estimasi: 1 hari)
Fase 1 — Route structure              (estimasi: 1 hari) ← paling kritikal
Fase 2 — Redirect + revalidatePath    (estimasi: 2-3 hari, satu modul per sesi)
Fase 3 — Internal links               (estimasi: 1 hari)
Fase 4 — Cleanup + dokumentasi        (estimasi: 1 hari)
--- jeda dan observasi di production: minimal 2 minggu ---
Fase 5 — Admin subdomain              (estimasi: 1 hari)
```

Total core migration: ~6 hari kerja (tidak harus berturutan).
Admin subdomain: +1 hari, setelah production stable.

---

## Checklist Pre-Eksekusi

Sebelum mulai Fase 1, konfirmasi semua ini:

- [ ] Bug B4 (cart/keranjang duplikat) sudah dicek
- [ ] Bug B5 (event/agenda duplikat) sudah dicek
- [ ] Test checklist manual Fase 0 sudah dijalankan dan semua hijau
- [ ] Branch `feat/url-refactor` sudah dibuat
- [ ] Semua anggota tim tahu bahwa URL admin akan berubah
- [ ] Redirect 301 dari path lama sudah direncanakan
- [ ] Backup database dan kode terbaru ada
