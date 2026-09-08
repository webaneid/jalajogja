# Arsitektur Keamanan

> Prinsip: defense in depth. Jangan andalkan satu lapis proteksi saja. Tiap layer di bawah
> harus aman secara independen, seolah layer lain bisa gagal/dilewati.

Diadaptasi dari standar keamanan `~/sites/master-typescript` (2026-09-08) — **bukan salinan
mentah**, disesuaikan ke stack project ini: Next.js App Router (Server Actions + route handler,
BUKAN Elysia API terpisah), Better Auth (BUKAN JWT custom access+refresh), Drizzle ORM, MinIO,
isolasi **schema-per-tenant** (BUKAN row-level `tenant_id`). Poin yang tidak relevan ke stack ini
(t.Object Elysia, CORS API terpisah, dst) sengaja tidak dipindah.

## 1. Secrets & Environment
- Semua secret (DB password, `BETTER_AUTH_SECRET`, `PLATFORM_JWT_SECRET`, `MINIO_SECRET_KEY`,
  dll) di `.env.local`, **tidak pernah** di kode/commit. `.env*` sudah di `.gitignore` sejak
  awal repo — `.env.example` tersedia tanpa nilai asli.
- **Enforcement sudah aktif, dua lapis** (lihat `.claude/hooks/README.md` untuk detail):
  1. `.claude/hooks/secret-scan.sh` — PostToolUse, block (exit 2) kalau Claude Code sendiri
     yang menulis file dengan pola secret ter-hardcode.
  2. `.githooks/pre-commit` — level git, independen dari Claude Code, tetap aktif meski
     commit dari editor lain/tool AI lain. **Wajib diaktifkan sekali per clone/mesin**:
     `git config core.hooksPath .githooks` (sudah aktif di mesin development saat ini —
     cek ulang di mesin baru manapun yang kerja di repo ini).
- Production (VPS): `.env.local` file manual di server (`docs/panduan-deploy-vps.md`) — bukan
  secret manager terpisah. Kalau project ini berkembang butuh rotasi rutin/audit akses,
  pertimbangkan Infisical/Doppler — belum jadi kebutuhan saat ini (single VPS, tim kecil).

## 2. Input Validation (Server Actions & Route Handlers)
Project ini **tidak pakai Zod atau schema validation library** — validasi dilakukan manual di
awal tiap Server Action/route handler (pola yang sudah konsisten dipakai di seluruh codebase,
lihat CLAUDE.md § "Error handling wajib di setiap API route"). Checklist saat review:
- Field wajib dicek eksplisit (`if (!x?.trim()) return { success: false, error: "..." }`)
  SEBELUM dipakai di query — bukan diasumsikan selalu terisi dari client.
- Angka/enum dari client di-cek terhadap whitelist nilai yang valid (mis. `status` cuma boleh
  salah satu dari state machine yang didefinisikan), bukan langsung dipakai mentah di `WHERE`.
- Kalau suatu field mulai butuh validasi kompleks berulang (format, range, dst di banyak
  tempat) dan manual check terasa rapuh — pertimbangkan Zod untuk field itu spesifik, bukan
  migrasi besar-besaran sekaligus.
- Rich text dari editor (Tiptap) — cek `lib/content-renderer` / sanitasi HTML sebelum render
  publik kalau ada jalur user-generated content yang dirender sebagai HTML mentah.

## 3. Database — Drizzle & Isolasi Tenant

### 3a. Query aman dari SQL injection
- Drizzle query builder = parameterized otomatis. Kalau terpaksa `sql\`...\`` raw, WAJIB pakai
  interpolasi `${value}` di dalam tagged template (Drizzle handle escaping) — **jangan pernah**
  concat string manual (`sql.raw()` HANYA untuk identifier tabel/kolom yang sumbernya trusted
  internal, mis. `create-tenant-schema.ts` yang interpolasi nama schema tenant — bukan untuk
  data dari user).

### 3b. Isolasi schema-per-tenant — kategori CRITICAL khusus project ini
Beda dari checklist generik "cek `tenant_id` di WHERE" (itu untuk row-level isolation) —
project ini isolasi via **schema Postgres terpisah per tenant** (`tenant_{slug}`, lihat
`docs/decisions/adr-0001-multi-tenant-schema-isolation.md`). Kegagalannya beda bentuk:
- **WAJIB** semua query tenant lewat `createTenantDb(slug)` yang di-resolve dari
  `getTenantAccess(slug)` — **jangan pernah** ambil `slug` dari body/query param request tanpa
  divalidasi terhadap access yang sedang login (celah: user tenant A kirim `slug` tenant B di
  request, kalau tidak dicek balik ke session-nya, bisa akses data tenant lain).
- Data GLOBAL (`public.members`, `public.profiles`) yang diakses lintas-tenant (mis. direktori
  publik, pencarian anggota) WAJIB di-scope lewat JOIN `tenant_memberships WHERE tenant_id =
  {tenantId milik slug yang sedang diakses}` — lihat pola di
  `docs/arsitektur-direktori-publik.md`. Lupa JOIN ini = bocor data anggota tenant lain lewat
  endpoint yang seharusnya cuma tenant-scoped.
- API publik tanpa auth yang menerima `id` (mis. `GET /api/member-public/[id]?slug=`) WAJIB
  cross-check `id` tersebut benar milik tenant `slug` yang diminta — jangan hanya `SELECT ...
  WHERE id = {id}` tanpa filter tenant, walau `id` adalah UUID yang "sudah pasti dari sistem".

### 3c. Privilege DB
- Development lokal pakai user `webane` (superuser lokal) — wajar untuk dev. Production
  (`docs/panduan-deploy-vps.md`) pakai user `jalakarta` khusus aplikasi, bukan superuser
  Postgres OS-level.

## 4. Authentication & Authorization

### 4a. Better Auth (bukan JWT custom)
- Password hashing, session token, expiry — ditangani Better Auth internal (`lib/auth.ts`),
  jangan reimplement hashing/token sendiri di luar itu.
- Session disimpan cookie httpOnly (default Better Auth) — jangan pernah baca/tulis token
  session secara manual ke `localStorage`.
- **Dua sistem auth terpisah, jangan dicampur** (lihat CLAUDE.md § "Tiga Level User"):
  Platform users (JWT sendiri, `lib/platform-auth.ts`, login di `/platform/login`) vs Tenant
  users + member/profile (Better Auth, login di `/app/login` dan `/{slug}/login`). Endpoint
  platform tidak boleh menerima session Better Auth sebagai bukti akses, dan sebaliknya.

### 4b. Authorization — permission matrix terpusat
- Endpoint/action yang butuh login tenant WAJIB panggil `getTenantAccess(slug)` di awal
  (`lib/tenant.ts`) — kalau `null`, tolak. Ini pattern yang SUDAH konsisten dipakai di semua
  `actions.ts`/route handler admin di codebase, pertahankan.
- Authorization (boleh/tidak boleh suatu aksi) WAJIB lewat `canAccess`/`hasFullAccess`/
  `hasReadAccess`/`isOwnOnly` (`lib/permissions.ts`) — **jangan** cek role manual
  (`if (user.role === "owner")`) di action individual, itu gampang berantakan begitu custom
  role ditambah. Levelnya: `full` (CRUD+admin) / `read` (lihat saja) / `own` (buat+lihat milik
  sendiri, khusus surat) / `none`.
- Endpoint publik TANPA `getTenantAccess()` (mis. `registerForEventAction`,
  `addEventTicketToCartAction`) itu **desain sengaja**, bukan celah — siapapun memang boleh
  daftar/checkout. Validasi tetap wajib ada di dalam (status published, kuota, jendela
  penjualan, dll) — lihat lesson "Public action tanpa auth" di `docs/arsitektur-event.md`.
  Kalau review ketemu action publik BARU tanpa validasi apa pun di dalamnya, itu baru masalah.

## 5. Frontend (Next.js App Router)
- Server Components untuk data yang butuh filter tenant/permission — jangan fetch data
  sensitif di Client Component lalu filter di client (authorization logic harus di server).
- Server Actions Next.js punya proteksi CSRF built-in (origin check) — tidak perlu token CSRF
  manual untuk mutasi lewat Server Action. Route handler (`app/api/**/route.ts`) yang menerima
  POST dari form/fetch eksternal tetap perlu auth check sendiri (lihat § 4b), CSRF built-in
  Next.js tidak otomatis mencakup route handler biasa.
- **Jangan** taruh apa pun sensitif di variabel `NEXT_PUBLIC_*` — itu ter-bundle ke JS client,
  bisa dibaca siapa saja yang buka DevTools.
- Security headers (CSP, `X-Frame-Options`, HSTS, dll) — **belum diset** di `next.config.ts`
  maupun `middleware.ts` saat ini. Bukan kategori Critical untuk urgensi sekarang (aplikasi
  admin butuh login, front-end publik tidak menerima input HTML mentah dari user secara luas),
  tapi dicatat sebagai gap yang layak ditutup — bukan diasumsikan sudah ada.

## 6. Pembayaran — Konfirmasi Manual (ADR-0002), BUKAN Webhook
Beda penting dari asumsi checklist generik (yang biasanya soal verifikasi signature webhook):
project ini **sengaja tidak pakai webhook gateway pembayaran otomatis** —
`docs/decisions/adr-0002-payment-manual-confirmation.md` mengunci payment WAJIB konfirmasi
manual admin (customer upload bukti transfer → admin review → klik konfirmasi). Tidak ada
endpoint `*/webhook`/`*/callback` untuk Midtrans/Xendit/iPaymu di codebase saat ini — ini
BUKAN sesuatu yang perlu "ditemukan lalu diperbaiki", memang begitu desainnya.

**Kalau nanti ADR-0002 di-supersede** dan webhook gateway ditambahkan: signature/HMAC WAJIB
diverifikasi SEBELUM payload diproses (reject kalau signature tidak valid), dan handler WAJIB
idempotent (webhook yang sama dikirim ulang gateway tidak boleh diproses 2x — pola yang sama
dengan lesson "Guard 'sudah ada sebelumnya' harus diulang di dalam transaction setelah lock" di
`docs/lessons-learned.md`, cross-cutting concern yang sama persis).

## 7. File Upload (MinIO)
Pola yang SUDAH konsisten dipakai (lihat `apps/web/app/api/finance/payment-proof/route.ts`
sebagai contoh baik) — pertahankan di upload handler baru mana pun:
- Batas ukuran file di-cek di server SEBELUM proses (`file.size > MAX_SIZE`), bukan cuma
  divalidasi di client.
- Format gambar divalidasi dengan cara PROSES ulang via Sharp (`sharp(buffer)...`) — ini lebih
  kuat dari sekadar cek magic bytes, karena kalau bukan gambar valid, Sharp akan throw dan
  request ditolak. Jangan percaya `file.type` dari browser mentah-mentah (bisa kosong/salah,
  terutama HEIC dari iPhone).
- Nama file di-generate ulang server-side (`randomUUID()`), TIDAK PERNAH pakai nama file asli
  dari client (path traversal risk, filename collision, kebocoran info).
- Upload admin WAJIB `getTenantAccess()` + permission check modul terkait (lihat contoh:
  `hasFullAccess(access.tenantUser, "keuangan")`) sebelum terima file.
- Bucket per tenant (`tenant-{slug}`, lihat CLAUDE.md § "Arsitektur Media Library") — jangan
  ada path upload yang menembus ke bucket tenant lain.

## 8. Dependency & Supply Chain
- `bun audit` dijalankan lewat hook `.claude/hooks/dependency-audit.sh` tiap `bun add` —
  warning (bukan block), butuh judgment manusia untuk lanjut/tidak.
- Review dependency baru sebelum ditambahkan, terutama untuk fungsi security-sensitive (auth,
  crypto, parsing file upload) — hindari package yang jarang di-maintain.

## 9. Logging & Monitoring
- **JANGAN** log data sensitif: password (Better Auth sudah handle, jangan log manual di luar
  itu), session token, NIK (lihat `docs/arsitektur-*.md` soal `member_nik_encryption`, migration
  0062 — NIK memang sensitif dan sudah dienkripsi di DB, jangan sampai muncul plaintext di log),
  data pribadi lengkap.
- `console.error` untuk error case sudah jadi pola konsisten di codebase (lihat hampir semua
  route handler) — pastikan yang di-log adalah pesan error/context, BUKAN payload request penuh
  yang mungkin berisi data pribadi peserta/anggota.
- Belum ada structured logging/error tracking terpusat (Sentry dst) — di luar scope dokumen
  ini, dicatat sebagai potensi peningkatan observability, bukan gap keamanan mendesak.

## Referensi Enforcement
- `.claude/hooks/secret-scan.sh` + `.githooks/pre-commit` — dua lapis block secret ter-hardcode.
- `.claude/hooks/security-review-reminder.sh` — reminder (bukan block) supaya skill
  `security-review` tidak kelupaan dipanggil saat edit file security-sensitive.
- `.claude/hooks/dependency-audit.sh` — `bun audit` otomatis tiap dependency baru.
- `.claude/hooks/adr-guard.sh` — tidak spesifik keamanan tapi disebut di sini karena mekanisme
  sama (enforcement deterministik lewat hook, bukan cuma tertulis di CLAUDE.md).
- `.claude/hooks/README.md` — penjelasan lengkap tiap hook.
- Skill `.claude/skills/security-review/SKILL.md` — checklist per-file, dipanggil setelah bikin
  fitur baru.
- Subagent `.claude/agents/security-auditor.md` — audit menyeluruh (banyak file), read-only,
  context terisolasi.
- Checklist ringkas versi CLAUDE.md ada di bagian "Security — Non-Negotiable".
