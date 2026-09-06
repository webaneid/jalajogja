# ADR-0004: Auth Stack — Better Auth + Drizzle Adapter, Tabel di Public Schema

**Status:** Accepted
**Tanggal:** 2026-09-06 (diekstrak dari CLAUDE.md, keputusan asli lebih awal)

## Context
Sistem butuh satu auth stack yang dipakai konsisten lintas dashboard tenant dan
front-end publik, dengan satu akun bisa berlaku di banyak tenant sekaligus (lihat
model identitas di `docs/arsitektur-akun.md` dan `docs/arsitektur-keanggotaan.md`
untuk desain di atas auth ini — dokumen tersebut adalah referensi utama untuk
model levelnya, bukan ADR ini).

## Decision
- Auth library: **Better Auth** dengan **Drizzle adapter**.
- Tabel auth (`user`, `session`, `account`, `verification`) ada di **`public`
  schema** — bukan di schema tenant manapun.
- Satu user bisa akses multiple tenant; mapping role per tenant disimpan di
  `tenant_{slug}.users`, bukan di tabel auth itu sendiri.

## Alternatif yang Dipertimbangkan
- **Auth per-tenant (tabel user di tiap schema tenant)** — ditolak karena
  bertentangan langsung dengan kebutuhan satu akun lintas tenant (federated
  identity, lihat `docs/arsitektur-keanggotaan.md`).

## Konsekuensi
- Semua flow login/session selalu terhadap `public` schema — konsisten dan mudah
  diaudit satu tempat.
- Otorisasi per-tenant (role apa di tenant mana) adalah lapisan terpisah di atas
  auth, harus selalu dicek lewat `tenant_{slug}.users`, bukan diasumsikan dari
  sesi Better Auth saja.

---
> Aturan: file ADR TIDAK diedit setelah Accepted. Kalau keputusan berubah,
> buat ADR baru dan tulis "Supersedes ADR-0004" di file baru itu.
