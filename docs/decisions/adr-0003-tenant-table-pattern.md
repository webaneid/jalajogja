# ADR-0003: Pattern Implementasi Tabel Tenant (Drizzle pgSchema Factory)

**Status:** Accepted
**Tanggal:** 2026-09-06 (diekstrak dari CLAUDE.md, keputusan asli lebih awal)

## Context
ADR-0001 memutuskan isolasi tenant lewat PostgreSQL schema per tenant
(`tenant_{slug}`). Perlu pola konkret di level Drizzle ORM + `drizzle-kit` untuk
mengelola schema yang jumlahnya bisa ratusan (satu per tenant), tanpa migration
file terpisah per tenant dan tanpa masalah scoping enum/FK di PostgreSQL.

## Decision
1. **pgSchema factory, bukan `pgTable` biasa** — `getTenantSchema(slug)` di
   `packages/db/src/schema/tenant/index.ts` menghasilkan
   `pgSchema(\`tenant_${slug}\`)` lalu `.table(...)` di atasnya. Hasil di-cache
   in-memory (tidak dibuat ulang tiap request). `createTenantDb(slug)` di
   `tenant-client.ts` mengembalikan `{ db, schema }` siap pakai.
2. **FK tidak didefinisikan di level Drizzle** untuk tenant tables (menghindari
   circular reference di factory pattern) — FK tetap ada di database via raw SQL
   DDL yang dijalankan saat tenant baru dibuat (`createTenantSchemaInDb`). Drizzle
   schema hanya untuk TypeScript types + query building.
3. **Enum sebagai `text` + TypeScript constraint, bukan `pgEnum`** — `pgEnum`
   bersifat schema-scoped di PostgreSQL, dan ratusan tenant akan menghasilkan
   ribuan enum objects di database.
   ```typescript
   status: text("status", { enum: ["draft", "published"] }).notNull().default("draft")
   ```
4. **`drizzle-kit` hanya mengelola `public` schema.** Tenant schema dibuat
   programmatically via `createTenantSchemaInDb(db, slug)` saat tenant baru
   dibuat, bukan lewat migration file `drizzle-kit generate`.

## Alternatif yang Dipertimbangkan
- **`pgTable` statis per tenant lewat migration file** — tidak scalable untuk
  jumlah tenant yang bertambah dinamis; tiap tenant baru akan butuh migration run.
- **`pgEnum` asli** — ditolak karena scoping per-schema PostgreSQL akan
  menghasilkan ribuan enum object seiring pertumbuhan jumlah tenant.

## Konsekuensi
- Integritas referensial (FK) tidak divalidasi oleh Drizzle di compile-time —
  harus dijaga manual lewat DDL provisioning yang konsisten.
- Provisioning tenant baru adalah operasi terpisah (`createTenantSchemaInDb`),
  bukan bagian dari alur migration standar — harus didokumentasikan jelas di
  runbook deployment.

---
> Aturan: file ADR TIDAK diedit setelah Accepted. Kalau keputusan berubah,
> buat ADR baru dan tulis "Supersedes ADR-0003" di file baru itu.
