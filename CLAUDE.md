# CLAUDE.md — jalajogja Project Brain

## Identitas Project
- Nama: jalajogja
- Klien pertama: IKPM (Ikatan Keluarga Pondok Modern Gontor)
- Tujuan: Super-app untuk organisasi (website, surat, anggota, keuangan, toko)
- Target: Multi-tenant SaaS — dibangun untuk IKPM, dijual ke banyak organisasi
- Developer: Webane (familiar dengan WordPress/PHP, belajar TypeScript/Next.js)

## Stack
- Runtime: Bun
- Framework: Next.js 15 App Router
- Monorepo: Turborepo
- Database: PostgreSQL (schema-per-tenant isolation)
- ORM: Drizzle ORM
- Auth: Better Auth
- Styling: Tailwind CSS v4 + shadcn/ui
- Icons: lucide-react
- Payment: Midtrans, Xendit, iPaymu (manual confirm + QRIS)
- Storage: MinIO (self-hosted)
- Deploy: Docker + Nginx di VPS

## Cara Claude Harus Bekerja
1. SELALU jelaskan pendekatan dan risikonya sebelum menulis kode
2. SELALU pertimbangkan implikasi multi-tenant di setiap keputusan
3. Pecah task besar menjadi sub-steps yang jelas
4. Jika ada lebih dari satu solusi, tampilkan trade-off-nya
5. Setelah setiap task selesai, update CLAUDE.md — lessons learned + context sesi
6. Jika menemukan bug atau masalah, catat polanya agar tidak terulang
7. Selalu tanya konfirmasi sebelum mengubah arsitektur atau keputusan besar

## Konvensi Kode
- Bahasa komentar: Indonesia
- TypeScript strict mode: aktif
- Selalu gunakan server components kecuali perlu interaktivitas
- Error handling wajib di setiap API route
- Semua fungsi database wajib multi-tenant aware (gunakan tenant schema)
- Penamaan: camelCase untuk variabel/fungsi, PascalCase untuk komponen/types

## UI Standards
- SEMUA dropdown/select wajib menggunakan Combobox (autocomplete), bukan plain `<select>` HTML
- Implementasi: shadcn/ui Command + Popover pattern
- Untuk data kecil (<100 items): filter client-side
- Untuk data besar (>100 items, misal wilayah): server-side fetch per keystroke / on-open
- Komponen standar: `components/ui/wilayah-select.tsx` untuk wilayah, generic combobox pattern untuk lainnya
- Konsisten di seluruh aplikasi: wizard form, edit form, filter tabel, search, semua

## Keputusan Arsitektur yang Sudah Dikunci
- Multi-tenant: schema isolation per tenant (bukan row-level tenant_id)
- **Member data: terpusat di `public.members`** — bukan di tenant schema
- **Akses member: dikontrol via `public.tenant_memberships`** — tenant hanya lihat member mereka sendiri
- Super admin jalajogja: akses semua `public.members` tanpa filter
- Payment: semua butuh konfirmasi manual (cash/transfer/QRIS/gateway)
- Storage: self-hosted MinIO di VPS
- Auth: Better Auth dengan Drizzle adapter
- Monorepo: Turborepo dengan workspace Bun
- Port dev: 6202 (frontend + API dalam satu Next.js app). Jalankan: `bun run dev --filter=@jalajogja/web`
- Port 6201: dicadangkan untuk API server terpisah di masa depan

## Keputusan Teknis Database

### Pattern: pgSchema Factory untuk Tenant Tables
Tenant tables menggunakan `pgSchema()` factory dari Drizzle, bukan `pgTable` biasa.
```typescript
const s = pgSchema(`tenant_${slug}`); // → "tenant_ikpm"
const users = s.table("users", { ... }); // → tenant_ikpm.users
```
- `getTenantSchema(slug)` di `packages/db/src/schema/tenant/index.ts` adalah entry point utama
- Result di-cache in-memory agar tidak buat objek baru setiap request
- `createTenantDb(slug)` di `tenant-client.ts` mengembalikan `{ db, schema }` siap pakai

### FK Constraints di Tenant Tables
FK **tidak** didefinisikan di Drizzle untuk tenant tables (menghindari circular ref di factory pattern).
FK tetap ada di DB via raw SQL DDL yang dijalankan saat tenant baru dibuat (`createTenantSchemaInDb`).
Drizzle schema dipakai untuk TypeScript types + query building saja.

### Enum di Tenant Tables
Gunakan `text` column dengan TypeScript enum constraint, **bukan** `pgEnum`:
```typescript
status: text("status", { enum: ["draft", "published"] }).notNull().default("draft")
```
Alasan: `pgEnum` bersifat schema-scoped di PostgreSQL → ratusan tenant = ribuan enum objects.

### drizzle-kit: Public Schema Only
`drizzle-kit` hanya mengelola **public schema**. Tenant schema dibuat programmatically via
`createTenantSchemaInDb(db, slug)` — dipanggil saat tenant baru dibuat, bukan via migration file.

### Double-Entry Accounting + Helpers
Helper di `packages/db/src/helpers/finance.ts`:
- `recordExpense(db, schema, { amount, expenseAccountId, cashAccountId, ... })`
- `recordIncome(db, schema, { amount, incomeAccountId, cashAccountId, ... })`
- `recordTransfer(db, schema, { amount, fromAccountId, toAccountId, ... })`

### Better Auth Tables: Public Schema
Tabel auth (user, session, account, verification) ada di `public` schema.
Satu user bisa akses multiple tenant. Mapping role per tenant ada di `tenant_{slug}.users`.

### Arsitektur Member: Federated Identity
Data anggota dipisah menjadi dua lapisan:

```
public.members           → identitas global (siapa orangnya)
  - id, member_number, stambuk_number, nik
  - name, gender, birth_place, birth_date
  - phone, email, address, photo_url

public.tenant_memberships → relasi (anggota ini di cabang mana)
  - tenant_id, member_id
  - status (active/inactive/alumni), joined_at, registered_via

public.member_number_seq  → PostgreSQL SEQUENCE global (atomic, tidak duplikat)
```

**Aturan akses (application-level, bukan PostgreSQL RLS):**
- Query tenant: selalu JOIN ke `tenant_memberships WHERE tenant_id = {id_tenant_ini}`
- Super admin: query `public.members` langsung tanpa filter
- Tenant tidak bisa lihat member tenant lain meskipun datanya ada di tabel yang sama

**Format nomor anggota:**
```
{tahun_daftar} + {DDMMYYYY_lahir} + {00001..99999}
Contoh: lahir 26-10-1981, daftar 2025, urutan ke-1 → 202526101981 00001
```
Generator: `generateMemberNumber(db, birthDate, year?)` di `packages/db/src/helpers/member-number.ts`

**Tenant schema TIDAK lagi punya tabel members.**
`orders.customer_id` dan `tenant.users.member_id` merujuk ke `public.members.id`.

### Struktur File packages/db/src/
```
src/
├── index.ts               ← public API
├── client.ts              ← public schema db instance
├── tenant-client.ts       ← factory: createTenantDb(slug)
├── schema/
│   ├── public/            ← auth.ts, tenants.ts, members.ts, tenant-memberships.ts
│   └── tenant/            ← factory tables: users, website, letters, finance, shop, settings
│                             (members TIDAK ADA di sini — sudah dipindah ke public)
└── helpers/
    ├── finance.ts         ← double-entry helper functions
    ├── member-number.ts   ← generateMemberNumber() via PostgreSQL SEQUENCE
    └── create-tenant-schema.ts ← DDL provisioning tenant baru
```

### Orders & Payment
`member_id` di `orders` nullable — untuk donasi dari luar yang tidak perlu login.
Semua payment butuh konfirmasi manual (cash/transfer/QRIS/gateway).

## Arsitektur Shell UI Dashboard

### Struktur Komponen
```
components/dashboard/
├── sidebar.tsx         — sidebar desktop, SERVER component
├── sidebar-nav.tsx     — nav items + active state, CLIENT component (butuh usePathname)
├── user-menu.tsx       — dropdown user + sign out, CLIENT component (butuh signOut + useState)
├── mobile-sidebar.tsx  — drawer overlay mobile, CLIENT component (butuh useState)
└── header.tsx          — tidak dipakai langsung; UserMenu di-embed langsung di layout
```

### Struktur Route Dashboard
```
app/(dashboard)/[tenant]/
├── layout.tsx              → wraps SEMUA halaman /{slug}/* — auth check di sini
├── page.tsx                → /{slug} → redirect ke /{slug}/dashboard
├── dashboard/
│   └── page.tsx            → /{slug}/dashboard
├── members/
│   ├── actions.ts          → Server Actions: create, update, removeMemberFromTenant
│   ├── page.tsx            → /{slug}/members — list + search + filter + pagination
│   ├── new/page.tsx        → /{slug}/members/new — form tambah anggota
│   └── [id]/
│       ├── page.tsx        → /{slug}/members/{id} — detail anggota
│       ├── delete-button.tsx → CLIENT component, inline confirm
│       └── edit/page.tsx   → /{slug}/members/{id}/edit — form edit anggota
├── website/                → (belum dibuat)
├── letters/                → (belum dibuat)
├── finance/                → (belum dibuat)
├── shop/                   → (belum dibuat)
└── settings/               → (belum dibuat)
```

### Pola Layout Dashboard
- `TenantLayout` mengambil `session` + `getTenantAccess()` satu kali untuk semua child
- Child page tidak perlu query ulang data tenant/user dasar
- Data spesifik modul (list anggota, dll) tetap diambil di page masing-masing

## Status Project
- [x] Setup monorepo & dependencies
- [x] Database schema (public + tenant schema)
- [x] Auth system (login, register, multi-role)
- [x] Shell UI (sidebar, header, user menu, mobile drawer)
- [x] Modul Anggota (list, tambah, detail, edit, hapus dari cabang)
- [x] Member Wizard 4-step (identitas, kontak+alamat, pendidikan, usaha)
- [ ] Modul Website (pages + posts)
- [ ] Modul Surat menyurat
- [ ] Modul Keuangan/Ledger
- [ ] Modul Toko
- [ ] Payment integration
- [ ] Modul Pengaturan
- [ ] Docker deployment

## Technical Debt
- `getFirstTenantForUser()` loop O(n) — perlu tabel `public.user_tenant_index` saat tenant > 100
- `check-slug` endpoint perlu rate limiting per-IP (saat ini hanya referer check)
- `getTenantAccess()` dipanggil di layout DAN page — perlu `React.cache()` saat query makin banyak

## Lessons Learned

### [2025-04] Database Schema Selesai
- 18 file schema: public (auth, tenants) + tenant (users, members, website, letters, finance, shop, settings)
- Pattern: getTenantSchema(slug) dengan in-memory cache
- drizzle-kit hanya kelola public schema, tenant schema via createTenantSchemaInDb()
- schemaFilter: ["public"] di drizzle.config.ts wajib ada untuk proteksi tenant schemas

### [2025-04] Auth System Selesai
- Two-layer auth: middleware (cookie check) + layout (session validation)
- Register flow: Better Auth signUp → Server Action buat tenant + schema
- Security fix: userId diambil dari session server, bukan dari client
- Rollback mechanism: gagal buat schema → hapus tenant dari public
- params di Next.js 15 adalah Promise<> — wajib await

### [2025-04] Bug: Port Change → BETTER_AUTH_URL Harus Ikut Diganti
- Error: "An unexpected response was received from the server" dari Better Auth client
- Artinya: server return HTML (bukan JSON) — biasanya karena port mismatch atau DB error
- Setiap ganti port: update `BETTER_AUTH_URL` + `NEXT_PUBLIC_APP_URL` di `.env.local`, restart server, clear cookie browser

### [2025-04] Bug: Infinite Redirect Loop — "Partial Registration" State
**Skenario**: `signUp.email()` berhasil, tapi `registerAction` (buat tenant) gagal → user punya session tapi tidak punya tenant.

**Root cause**: Auth gate diduplikasi di dua tempat yang saling bertabrakan:
1. `middleware.ts` blok `/register` → redirect `/dashboard-redirect`
2. `AuthLayout` JUGA redirect semua user login → `/dashboard-redirect`
3. `/dashboard-redirect` tidak ada tenant → redirect ke `/register?error=no-tenant`
4. Loop tak henti

**Fix**:
- `middleware.ts`: hapus `/register` dari `AUTH_PAGES`
- `AuthLayout`: cek tenant dulu. Punya tenant → redirect dashboard. Belum → render halaman
- `register/page.tsx`: jika email sudah ada, skip `signUp`, langsung ke `registerAction`

**Pelajaran utama**:
- Auth gate JANGAN diduplikasi di middleware DAN layout tanpa koordinasi
- Selalu pikirkan "partial state": jika step 1 berhasil tapi step 2 gagal, user bisa recover
- Setiap redirect chain harus punya exit condition — hindari pola A → B → A

### [2025-04] Bug: 404 pada `/{slug}/dashboard`
- `app/(dashboard)/[tenant]/page.tsx` hanya menangani `/{slug}`, bukan `/{slug}/dashboard`
- Solusi: buat subfolder `dashboard/` → `app/(dashboard)/[tenant]/dashboard/page.tsx`
- Root `[tenant]/page.tsx` dijadikan redirect ke `/{slug}/dashboard`

**Aturan route Next.js App Router**:
```
[tenant]/page.tsx            → /{slug}
[tenant]/dashboard/page.tsx  → /{slug}/dashboard
[tenant]/members/page.tsx    → /{slug}/members
```
Setiap modul baru = subfolder baru di dalam `[tenant]/`.

**Client vs Server component**:
- `usePathname`, `useState`, `useRouter`, `signOut` → wajib `"use client"`
- Data fetching DB → server component. Jangan jadikan seluruh layout client hanya karena satu bagian kecil butuh interaktivitas — pecah jadi komponen terpisah

### [2025-04] Shell UI Selesai
- Sidebar desktop: server component, SidebarNav (client) untuk `usePathname` active state
- Mobile drawer: client component, render `<Sidebar>` dalam overlay — tidak duplikasi markup
- UserMenu: dropdown dengan inisial avatar, role badge, tombol keluar via Better Auth `signOut`
- Layout TenantLayout mengambil session + tenant 1× — child pages tidak perlu query ulang
- `dashboard/page.tsx` terpisah dari `page.tsx` — root redirect, dashboard content di subfolder

### [2025-04] Modul Anggota Selesai
- 3 Server Actions: `createMemberAction`, `updateMemberAction`, `removeMemberFromTenantAction`
- Semua action: validasi `getTenantAccess()` terlebih dahulu — tidak ada aksi tanpa auth tenant
- Update: dua query (update `public.members` + update `public.tenant_memberships`) — selalu atomik berurutan
- Delete: hanya hapus dari `tenant_memberships` — data identitas global terlindungi
- NIK duplicate error: deteksi via constraint name `members_nik_not_null_unique` di catch block
- Form: MemberForm shared antara new + edit — `defaultValues` prop untuk pre-fill, `memberId` untuk teks tombol
- `joinedAt` default = `today()` client-side — tidak dari server untuk hindari hydration mismatch

### [2025-04] Keputusan Besar: Sentralisasi Data Anggota
**Konteks**: Visi jalajogja sebagai ekosistem big data alumni Gontor lintas cabang IKPM.

**Masalah dengan arsitektur lama**: Member di tenant schema → data terisolasi per cabang → tidak bisa deteksi duplikasi anggota lintas cabang → tidak bisa global member number.

**Keputusan**: Member data dipindah ke `public` schema dengan akses dikontrol application-level:
- `public.members` = single source of truth identitas anggota
- `public.tenant_memberships` = junction table siapa anggota di cabang mana
- Tenant hanya query member yang ada di tenant_memberships mereka

**Implikasi ke kode**:
- `tenant_{slug}.members` dihapus dari semua tenant schema
- `createTenantSchemaInDb` tidak lagi buat tabel members
- `generateMemberNumber()` pakai PostgreSQL SEQUENCE yang atomic
- DB di-reset total karena perubahan fundamental (data masih kosong, aman)

**Setelah reset DB**: user harus clear cookie browser dan register ulang.

**Pelajaran**: Saat data adalah "shared entity" lintas tenant (orang yang sama bisa di banyak cabang), data itu harus di public schema dengan access control di aplikasi — bukan di tenant schema yang terisolasi.

### [2025-04] UI Standard — Autocomplete
- Semua select/dropdown pakai Combobox (shadcn Command + Popover)
- Keputusan ini karena ref_villages 83k rows — plain select tidak feasible
- Berlaku untuk SEMUA form di seluruh aplikasi, bukan hanya wilayah
- Komponen `WilayahSelect` di `components/ui/wilayah-select.tsx` sebagai referensi implementasi
- Data kecil (<100): filter client-side via CommandInput; data besar: lazy fetch on-open per level

### [2025-04] Member Wizard Selesai
- 4-step wizard: submit wajib di Step 1 (buat record), Step 2–4 opsional (bisa skip/diisi nanti)
- WilayahSelect: lazy fetch per level (provinsi saat mount, kab/kec/desa on-select), 83k desa
- Semua select pakai Combobox — standar UI aplikasi, bukan plain `<select>`
- Cabang domisili otomatis dari context tenant (bukan pilihan user) — field read-only di UI
- Dynamic list education & business: replace-all strategy (hapus semua lama → insert batch baru)
- Alamat Indonesia/Luar Negeri: toggle pill button, mutual exclusive — LN simpan `country` text, wilayah di-null-kan; Indonesia sebaliknya. Berlaku untuk alamat rumah (Step 2) DAN alamat usaha (Step 4)
- `addresses` table shared helper: menambah kolom `country` otomatis berlaku ke semua jenis alamat (rumah + usaha) di DB level — tapi UI dan action tetap harus diupdate manual per form
- Sequence `public.member_number_seq` harus dibuat manual via raw SQL (tidak bisa di Drizzle schema)
- Bug: `nextval('member_number_seq')` tanpa schema prefix gagal jika search_path tidak set — selalu pakai `nextval('public.member_number_seq')`

### [2025-04] Setup Awal
- Struktur monorepo: apps/web + packages/db + packages/ui + packages/types
- Bun sebagai package manager, bukan npm/yarn
- Tailwind v4 tidak butuh tailwind.config.ts

## Context Sesi Terakhir
- Terakhir dikerjakan: Member Wizard 4-step selesai + toggle alamat Indonesia/Luar Negeri (rumah & usaha) + migration `addresses.country`. 0 TypeScript errors.
- State DB: migration 0002 applied (`addresses.country` column). Data wilayah lengkap, data profesi 25 rows.
- Commit terakhir: `ccdf38c` — feat: member wizard 4-step complete (16 files, +3812 lines)
- Komponen wizard: `components/members/wizard/` — shell, step1–4. Edit shell: `member-edit-shell.tsx`
- Next step: Modul Website (pages + posts) atau Modul Surat menyurat
