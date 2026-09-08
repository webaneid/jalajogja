---
name: jalakarta-security-review
description: Audit kode yang baru ditulis/diedit di project jalajogja/Jalakarta terhadap checklist keamanan project ini (docs/arsitektur-keamanan.md) — bukan checklist generik. Gunakan setelah selesai bikin Server Action baru, route handler API, fitur auth, upload MinIO, atau query lintas-tenant — sebelum dianggap "selesai"/commit. Beda dari skill "security-review" bawaan (generik, tidak tahu isolasi schema-per-tenant project ini) — pakai skill ini untuk project jalajogja secara spesifik.
---

# Skill: Jalakarta Security Review

Tujuan: mengecek kode yang baru ditulis terhadap checklist konkret KHUSUS project ini — bukan
opini umum "sudah cukup aman", dan bukan checklist generik framework lain (project ini Next.js
App Router + Server Actions + Better Auth + Drizzle + isolasi schema-per-tenant, BUKAN Elysia
API terpisah dengan JWT custom). Setiap poin dijawab merujuk baris kode spesifik, bukan asumsi.

## Langkah

1. Identifikasi file yang baru diubah di sesi ini (Server Action di `*/actions.ts`, route
   handler `app/api/**/route.ts`, file terkait auth/upload/media/payment/billing).
   Kalau tidak jelas, tanya user file mana yang mau di-review.

2. Baca `docs/arsitektur-keamanan.md` untuk checklist lengkap (jangan hafal dari memori — bisa
   sudah diupdate). Kalau file yang direview menyentuh query lintas-tenant (direktori publik,
   pencarian anggota, endpoint publik yang terima `id`+`slug`), fokuskan ke § 3b dokumen itu —
   isolasi schema-per-tenant, kategori Critical khusus project ini.

3. Untuk TIAP file yang direview, cek poin yang relevan:

   **Kalau file adalah Server Action (`*/actions.ts`) atau route handler admin:**
   - [ ] Ada `getTenantAccess(slug)` di awal, ditolak (`return`) kalau `null` — kecuali memang
         action publik yang SENGAJA tanpa auth (lihat § 4b `arsitektur-keamanan.md` untuk kapan
         itu valid, mis. `registerForEventAction`)
   - [ ] Authorization pakai `canAccess`/`hasFullAccess`/`hasReadAccess` dari `lib/permissions.ts`
         — BUKAN cek `role` manual (`if (user.role === "owner")`)
   - [ ] Field wajib dari input divalidasi eksplisit sebelum dipakai di query (lihat pola yang
         sudah ada di action sejenis di file yang sama/modul yang sama)
   - [ ] Response/return value tidak membocorkan data sensitif yang tidak perlu (password hash
         — meski Better Auth sudah handle ini, hash NIK terenkripsi, dst)

   **Kalau file menyentuh database (query Drizzle):**
   - [ ] Semua akses tenant lewat `createTenantDb(slug)` yang `slug`-nya berasal dari
         `getTenantAccess()` — bukan `slug`/`tenantId` mentah dari body/query request tanpa
         validasi balik ke session
   - [ ] Query ke data global (`public.members`, `public.profiles`) yang tenant-scoped WAJIB
         JOIN `tenant_memberships WHERE tenant_id = ...` — cek tidak lupa filter ini
   - [ ] Tidak ada raw SQL dengan string concatenation manual — kalau ada `sql\`...\``, pakai
         interpolasi `${value}` (Drizzle auto-parameterize), bukan `${...}` di dalam string
         literal manual

   **Kalau file terkait auth (login/register/session):**
   - [ ] Pakai Better Auth API (`lib/auth.ts`), tidak reimplement hashing/token sendiri
   - [ ] Tidak ada penulisan token/session ke `localStorage` — httpOnly cookie saja
   - [ ] Tidak tercampur antara auth Platform (`lib/platform-auth.ts`, JWT) dan auth Tenant
         (Better Auth) — dua endpoint beda sistem tidak boleh saling terima token satu sama lain

   **Kalau file terkait upload file (MinIO):**
   - [ ] Ada batas ukuran file dicek di server (`file.size > MAX_SIZE`)
   - [ ] Format gambar divalidasi via proses ulang (Sharp) atau setara — bukan cuma trust
         `file.type` dari client
   - [ ] Nama file di-generate ulang server-side (`randomUUID()`), bukan nama asli dari client
   - [ ] Ada `getTenantAccess()` + permission check modul terkait sebelum terima file

   **Kalau file terkait pembayaran:**
   - [ ] Ingat: project ini manual confirmation (ADR-0002), BUKAN webhook gateway — kalau kode
         yang direview justru menambah endpoint webhook otomatis, itu perlu dikonfirmasi ke user
         dulu (kontradiksi ADR yang sudah Accepted, butuh ADR baru dengan Supersedes, bukan
         diam-diam ditambahkan)

   **Kalau ada secret/config baru:**
   - [ ] Diambil dari `process.env`, bukan hardcoded (hook `secret-scan.sh` sudah scan otomatis,
         tapi cek manual juga untuk pola yang mungkin lolos regex)
   - [ ] Ada di `.env.example` (tanpa nilai asli) kalau memang perlu didokumentasikan

4. Laporkan hasil dalam format:
   ```
   ## Security Review — [nama file/fitur]

   ✅ Lolos: [poin yang sudah benar]
   ⚠️  Perlu diperbaiki: [poin bermasalah + baris kode + saran fix]
   ❓ Perlu dicek manual: [hal yang tidak bisa dipastikan dari kode saja]
   ```

5. Kalau ketemu masalah kategori "⚠️ Perlu diperbaiki", JANGAN anggap task selesai — perbaiki
   dulu atau tanya user mau prioritaskan fix sekarang atau dicatat sebagai technical debt di
   `docs/lessons-learned.md`.

6. Kalau reviewnya kompleks/menyentuh banyak file sekaligus (misal audit seluruh modul Billing
   atau Keuangan), delegasikan ke subagent `security-auditor`
   (`.claude/agents/security-auditor.md`) supaya tidak menghabiskan context window sesi utama.
