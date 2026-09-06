# ADR-0001: Multi-tenant via Schema Isolation (bukan row-level tenant_id)

**Status:** Accepted
**Tanggal:** 2026-09-06 (diekstrak dari CLAUDE.md, keputusan asli lebih awal)

## Context
jalajogja/jalakarta adalah super-app multi-cabang (tiap cabang IKPM = satu tenant).
Perlu isolasi data antar tenant yang kuat, sekaligus identitas anggota yang federated
lintas tenant (lihat `docs/arsitektur-keanggotaan.md`).

## Decision
Setiap tenant mendapat **PostgreSQL schema sendiri** (`tenant_{slug}`), bukan satu
tabel bersama dengan kolom `tenant_id` yang difilter di setiap query. Data anggota
(`public.members`, `public.tenant_memberships`) tetap terpusat di `public` schema —
lihat ADR ini untuk batas tabel apa yang schema-per-tenant vs global.

Super admin jalakarta mengakses semua `public.members` tanpa filter tenant.

## Alternatif yang Dipertimbangkan
- **Row-level tenant_id di tabel bersama** — lebih sederhana secara migrasi (satu set
  tabel), tapi risiko kebocoran data antar tenant kalau ada query yang lupa filter
  `WHERE tenant_id = ...` jauh lebih tinggi, dan tidak ada isolasi fisik di level DB.

## Konsekuensi
- Isolasi kuat di level database — bug query tidak bisa membocorkan data ke tenant lain.
- Provisioning tenant baru butuh DDL terpisah (lihat `createTenantSchemaInDb`,
  detail pattern di ADR-0003) — bukan sekadar insert baris.
- Query lintas tenant (mis. laporan super admin) butuh pendekatan khusus, tidak bisa
  `SELECT * FROM table` polos.

---
> Aturan: file ADR TIDAK diedit setelah Accepted. Kalau keputusan berubah,
> buat ADR baru dan tulis "Supersedes ADR-0001" di file baru itu.
