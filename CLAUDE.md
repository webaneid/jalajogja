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
- Payment: Midtrans, Xendit, iPaymu (manual confirm + QRIS)
- Storage: MinIO (self-hosted)
- Deploy: Docker + Nginx di VPS

## Cara Claude Harus Bekerja
1. SELALU jelaskan pendekatan dan risikonya sebelum menulis kode
2. SELALU pertimbangkan implikasi multi-tenant di setiap keputusan
3. Pecah task besar menjadi sub-steps yang jelas
4. Jika ada lebih dari satu solusi, tampilkan trade-off-nya
5. Setelah setiap task selesai, update section Lessons Learned
6. Jika menemukan bug atau masalah, catat polanya agar tidak terulang
7. Selalu tanya konfirmasi sebelum mengubah arsitektur atau keputusan besar

## Konvensi Kode
- Bahasa komentar: Indonesia
- TypeScript strict mode: aktif
- Selalu gunakan server components kecuali perlu interaktivitas
- Error handling wajib di setiap API route
- Semua fungsi database wajib multi-tenant aware (gunakan tenant schema)
- Penamaan: camelCase untuk variabel/fungsi, PascalCase untuk komponen/types

## Keputusan Arsitektur yang Sudah Dikunci
- Multi-tenant: schema isolation per tenant (bukan row-level tenant_id)
- Payment: semua butuh konfirmasi manual (cash/transfer/QRIS/gateway)
- Storage: self-hosted MinIO di VPS
- Auth: Better Auth dengan Drizzle adapter
- Monorepo: Turborepo dengan workspace Bun

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
Validasi dilakukan di aplikasi layer.

### drizzle-kit: Public Schema Only
`drizzle-kit` hanya mengelola **public schema**. `drizzle.config.ts` diarahkan ke `schema/public/`.
Tenant schema dibuat programmatically via `createTenantSchemaInDb(db, slug)` — dipanggil saat tenant baru dibuat, bukan via migration file.

### Double-Entry Accounting + Helpers
Keuangan pakai double-entry dari awal (transactions + transaction_entries).
Helper di `packages/db/src/helpers/finance.ts` agar user tidak perlu input debit/kredit manual:
- `recordExpense(db, schema, { amount, expenseAccountId, cashAccountId, ... })`
- `recordIncome(db, schema, { amount, incomeAccountId, cashAccountId, ... })`
- `recordTransfer(db, schema, { amount, fromAccountId, toAccountId, ... })`

### Better Auth Tables: Public Schema
Tabel auth (user, session, account, verification) ada di `public` schema.
Satu user bisa akses multiple tenant. Mapping role per tenant ada di `tenant_{slug}.users`.
Auth schema diekspor dari `@jalajogja/db` untuk dipakai di `apps/web/lib/auth.ts`.

### Struktur File packages/db/src/
```
src/
├── index.ts               ← public API
├── client.ts              ← public schema db instance
├── tenant-client.ts       ← factory: createTenantDb(slug)
├── schema/
│   ├── public/            ← auth.ts, tenants.ts
│   └── tenant/            ← factory tables: users, members, website,
│                             letters, finance, shop, settings
└── helpers/
    └── finance.ts         ← double-entry helper functions
```

### Orders & Payment
`member_id` di `orders` nullable — untuk donasi dari luar yang tidak perlu login.
Semua payment butuh konfirmasi manual (cash/transfer/QRIS/gateway).

## Lessons Learned
<!-- Update bagian ini setelah setiap task penting -->

### [2025-04] Database Schema Selesai
- 18 file schema dibuat: public (auth, tenants) + tenant (users, members, website, letters, finance, shop, settings)
- Pattern: getTenantSchema(slug) dengan in-memory cache
- Shared postgresClient — satu connection pool untuk public dan tenant
- drizzle-kit hanya kelola public schema, tenant schema via createTenantSchemaInDb()
- Finance helpers: recordExpense, recordIncome, recordTransfer, recordJournal, getNextLetterNumber
- Bug yang dihindari: month dari parameter bukan new Date(), composite PK di pivot tables, unique constraint di sequences
- schemaFilter: ["public"] di drizzle.config.ts wajib ada untuk proteksi tenant schemas

### [2025-04] Auth System Selesai
- Two-layer auth: middleware (cookie check) + layout (session validation)
- Register flow: Better Auth signUp → Server Action buat tenant + schema
- Security fix: userId diambil dari session server, bukan dari client
- Rollback mechanism: gagal buat schema → hapus tenant dari public
- check-slug endpoint dengan referer validation
- params di Next.js 15 adalah Promise<> — wajib await
- getTenantAccess() belum di-cache — technical debt

### [2025-04] Setup Awal
- Struktur monorepo: apps/web + packages/db + packages/ui + packages/types
- Multi-tenant strategy: schema-per-tenant di PostgreSQL
- Bun sebagai package manager, bukan npm/yarn
- Tailwind v4 tidak butuh tailwind.config.ts

## Status Project
- [x] Setup monorepo & dependencies
- [x] Database schema (public + tenant schema)
- [x] Auth system (login, register, multi-role)
- [ ] Website module (pages + posts)
- [ ] Surat menyurat module
- [ ] Database anggota module
- [ ] Ledger/keuangan module
- [ ] Online shop module
- [ ] Payment integration
- [ ] Settings module
- [ ] Docker deployment

## Technical Debt
- `getFirstTenantForUser()` loop O(n) di `apps/web/lib/tenant.ts` — perlu tabel `public.user_tenant_index` saat jumlah tenant > 100. Saat ini dibatasi `.limit(100)` sebagai safeguard.
- `check-slug` endpoint perlu rate limiting per-IP saat production. Saat ini hanya ada referer check sebagai abuse prevention dasar. Ganti dengan Redis + sliding window counter.
- `getTenantAccess()` dipanggil di layout DAN page — perlu di-wrap dengan React `cache()` saat sidebar mulai butuh data yang sama (saat ini dua DB query per request).

## Context Sesi Terakhir
<!-- Claude update bagian ini di akhir setiap sesi -->
- Terakhir dikerjakan: Database schema selesai (18 file), type-check dijalankan
- Pending: lihat hasil type-check, fix errors jika ada
- Next step: Auth system (login, register, multi-role)
