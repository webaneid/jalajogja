# Arsitektur Login Universal — jalakarta

Login, registrasi, lupa password, dan dashboard akun publik yang berlaku seragam
untuk **semua tenant** — baik untuk anggota IKPM maupun akun publik umum.

---

## Prinsip Desain

| Prinsip | Penjelasan |
|---------|-----------|
| **One identity** | Satu akun login berlaku di semua tenant (domain jalakarta) |
| **Two tiers** | `member` = alumni IKPM verifikasi admin; `akun` = publik umum mandiri |
| **OTP-ready** | Kolom `whatsapp` ada di schema; verifikasi WA OTP diaktifkan saat gateway tersedia |
| **Auto-link** | Daftar dengan email/HP yang cocok data member → otomatis terhubung tanpa langkah manual |
| **Graceful degradation** | Lupa password via email saja dulu; WA OTP menyusul |

---

## Schema Change: `public.profiles`

Kolom baru yang perlu ditambah via migration:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp TEXT UNIQUE;

-- Rename semantik: phone sekarang = nomor HP biasa (bukan WA)
-- Nilai yang sudah ada di phone tetap valid, hanya framing yang berubah
```

> **Perubahan dari schema lama:** `phone` dulu dikomentari "nomor WhatsApp" — sekarang
> artinya bergeser ke nomor HP (bisa beda dari WA). `whatsapp` adalah kolom baru khusus
> untuk OTP dan notifikasi WA.

### Schema Drizzle (tambahan)

```typescript
// packages/db/src/schema/public/profiles.ts
whatsapp: text("whatsapp").unique(),  // nullable — nomor WA, untuk OTP
```

---

## Route Structure

```
app/(public)/[tenant]/
├── login/page.tsx               ← email + password; link ke lupa password + daftar
├── register/page.tsx            ← nama, email, HP, WA, password; member lookup live
├── forgot-password/page.tsx     ← input email → kirim link reset (Better Auth)
├── reset-password/page.tsx      ← input password baru via token URL
└── akun/                        ← protected: redirect login jika belum auth
    ├── page.tsx                 ← dashboard ringkasan
    ├── profil/page.tsx          ← edit profil (nama, HP, WA, alamat)
    └── transaksi/page.tsx       ← riwayat invoice + status
```

---

## Halaman Login (`/login`)

### UI — Dua Tab
```
┌─────────────────────┬──────────────────────┐
│  ✉ Email & Password │  💬 WhatsApp OTP     │
└─────────────────────┴──────────────────────┘

Tab Email:                    Tab WhatsApp (Step 1 — nomor):
┌─────────────────────┐       ┌─────────────────────┐
│ Email               │       │ [🇮🇩] Nomor WhatsApp  │
│ Password            │       │                     │
│ [Lupa password?]    │       │ [Kirim Kode OTP]    │
│ [  Masuk  ]         │       └─────────────────────┘
└─────────────────────┘
                              Tab WhatsApp (Step 2 — kode):
                              ┌─────────────────────┐
                              │ 1  2  3  4  5  6    │
                              │ [  Masuk  ]          │
                              │ Kirim ulang / Ubah nomor │
                              └─────────────────────┘
Belum punya akun? [Daftar sekarang]
```

### Flow Email & Password
1. Submit email + password → `authClient.signIn.email({ email, password })`
   (tanpa `callbackURL` — hindari double redirect)
2. Sukses → **`window.location.href = dest`** (full reload, bukan `router.push`)
3. Gagal → tampilkan pesan error

### Flow WhatsApp OTP
1. Step 1: Input nomor WA → `POST /api/akun/send-otp` (type=`"login"`)
2. Step 2: Input 6 digit OTP → `POST /api/akun/login-via-otp`
3. Sukses → **`window.location.href = dest`** (full reload)

### ⚠️ `window.location.href` wajib, bukan `router.push`
`router.push` tidak trigger full page reload — Next.js App Router bisa pakai
server component cache yang masih belum ada session → layout baca session null
→ redirect ke login lagi → loop. `window.location.href` memastikan browser
kirim cookie baru ke server dari awal.

Ini berlaku untuk **semua alur login** di seluruh aplikasi (email, WA OTP, dll).

### Implementasi
- File: `app/(public)/[tenant]/login/login-form.tsx` (client component)
- `LoginMode = "email" | "whatsapp"`, `WaStep = "phone" | "otp"`
- Redirect default: `/{slug}/akun`; bisa di-override via `?redirect=` query param

---

## Halaman Registrasi (`/register`)

### UI
```
[Logo tenant / site_name]

┌─────────────────────────────────────────────┐
│ Nama Lengkap                                 │
│ Email                    [lookup saat blur]  │
│ Nomor HP                 [lookup saat blur]  │
│ Nomor WhatsApp (opsional, jika beda dari HP) │
│ Password                                     │
│ Konfirmasi Password                          │
│                                              │
│ [banner member jika ditemukan]               │
│  "Halo [Nama], data anggota IKPM ditemukan.  │
│   Nama akan terhubung otomatis."             │
│                                              │
│ [  Daftar  ]                                 │
└─────────────────────────────────────────────┘
Sudah punya akun? [Masuk di sini]
```

### Member Lookup (Live)
- Trigger: `onBlur` di field **Email** atau **Nomor HP**
- Endpoint: `GET /api/akun/lookup-member?email=X` atau `?phone=X`
- Lookup path: `public.contacts` → `public.members` (via FK `members.contactId`)
- Jika ditemukan: auto-isi nama, tampilkan banner info
- Jika tidak: registrasi normal sebagai akun umum

### Flow Registrasi (✅ SELESAI — OTP kondisional otomatis, 2026-07-21)

> **SUPERSEDED**: kalimat "OTP tidak bisa dinonaktifkan" di bawah ini pernah jadi keputusan
> terkunci, tapi direvisi setelah insiden nyata 2026-07-20 (`docs/arsitektur-whatsapp.md` §
> 14.1) — nomor WA sebuah tenant kena restriksi WhatsApp, registrasi di tenant itu buntu total
> tanpa fallback. Sekarang OTP registrasi otomatis di-skip kalau WA tidak tersedia — BUKAN via
> toggle manual yang bisa lupa dinyalakan admin saat kejadian, tapi via pengecekan live setiap
> submit ke `GET /api/wa/available` (endpoint ini sebenarnya SUDAH dibuat sejak awal untuk
> tujuan ini — komentarnya sendiri bilang "dipakai oleh register form dan forgot-password untuk
> memutuskan apakah tampilkan OTP step" — tapi tidak pernah benar-benar dipanggil sampai fix
> ini).

```
User pilih jalur:
  ├─ "Anggota IKPM Gontor" → isi stambuk (opsional) + form
  └─ "Bukan Anggota" → isi form langsung

Isi form (nama, email, HP, WA, password)
  ↓
Submit → GET /api/wa/available?slug=X → { registerOtp: boolean }
  ├─ registerOtp = true  → POST /api/akun/send-otp (type="register")
  │                         → step input OTP 6 digit → verify-otp → doRegister()
  └─ registerOtp = false → doRegister() LANGSUNG, tanpa verifikasi nomor sama sekali
  ↓
doRegister() → POST /api/akun/register:
  - Jalur IKPM: cari member via stambuk/email/HP
    → jika ketemu + belum punya akun: UPDATE members.better_auth_user_id
    → jika tidak ketemu: INSERT baru ke public.members + contacts
  - Jalur publik: INSERT public.profiles
  ↓
Auto login via authClient.signIn.email()
  ↓
window.location.href = /{slug}/akun
```

**Kenapa aman skip verifikasi nomor saat fallback**: registrasi bukan aksi sensitif — tidak ada
yang bisa "diambil alih" hanya dengan tahu nomor HP orang lain, beda dengan reset password (lihat
di bawah). Risiko terburuk: seseorang daftar dengan nomor yang bukan miliknya — sama persis
risiko yang sudah diterima SEBELUM fitur OTP register pernah ada.
OTP inline (state machine di form yang sama) — tidak ada halaman `/register/verify` terpisah.

---

## Halaman Lupa Password (`/forgot-password`)

### UI — WA OTP + Fallback Email (✅ SELESAI, direvisi 2026-07-21)

> **SUPERSEDED**: "Email tab dihapus — WA OTP saja" (di bawah) adalah keputusan lama, direvisi
> setelah insiden WA ban 2026-07-20 (`docs/arsitektur-whatsapp.md` § 14.1). Beda dengan
> registrasi, reset password **TIDAK BOLEH** skip verifikasi sama sekali saat WA down — itu
> lubang keamanan (siapa saja bisa reset password orang lain cuma modal nomor HP-nya). Fallback-
> nya WAJIB verifikasi lain: email, via jalur native Better Auth (`sendResetPassword`, sebelumnya
> tidak pernah dikonfigurasi sama sekali — `POST /api/auth/request-password-reset` akan selalu
> error `RESET_PASSWORD_DISABLED` tanpa ini).

```
Step 1 — cek /api/wa/available:
  ├─ resetOtp = true  → alur WA OTP (seperti semula, lihat di bawah)
  └─ resetOtp = false → step berubah otomatis ke form EMAIL:
       Input email → POST /api/auth/request-password-reset
                      { email, redirectTo: /{slug}/reset-password }
                      ↓
       Better Auth generate token → emailAndPassword.sendResetPassword()
       di lib/auth.ts → sendPlatformMail() (lib/mail.ts, SMTP env var platform)
                      ↓
       "Kalau email terdaftar, cek inbox" (pesan generik, cegah user enumeration)
                      ↓
       User klik link di email → /{slug}/reset-password?token=X (flow sama seperti WA)
```

**Alur WA OTP (kalau tersedia) — tidak berubah dari sebelumnya:**
```
Step 1 — nomor WA:           Step 2 — kode OTP:
┌─────────────────────┐      ┌─────────────────────┐
│ 💬 [🇮🇩] Nomor WA   │      │  1  2  3  4  5  6   │
│                     │      │                     │
│ [Kirim Kode OTP]   │      │ [Verifikasi & Reset] │
└─────────────────────┘      │ Kirim ulang / Ubah  │
                             └─────────────────────┘
```
1. Input nomor WA → `POST /api/akun/send-otp` (type=`"reset_password"`)
2. Input 6 digit OTP → `POST /api/akun/verify-otp`
3. Server inject token ke `public.verification` (Better Auth internal table):
   ```typescript
   await db.insert(verification).values({
     identifier: `reset-password:${resetToken}`,  // format Better Auth
     value:      betterAuthUserId,
     expiresAt:  new Date(Date.now() + 15 * 60 * 1000),  // 15 menit
   });
   ```
4. Redirect ke `/{slug}/reset-password?token={resetToken}`
5. User input password baru → `authClient.resetPassword({ newPassword, token })`

### Keputusan desain yang dikunci
- Deteksi WA/email OTOMATIS via `/api/wa/available` — bukan toggle manual, supaya tidak
  tergantung admin sadar+bertindak saat kejadian (mirip pola register).
- Fallback email pakai SMTP **platform** (env var `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`,
  `lib/mail.ts` `sendPlatformMail()`), BUKAN SMTP per-tenant (`settings.smtp_config`) — alasan:
  ini jalur auth-critical, harus selalu jalan terlepas tenant sudah setting SMTP sendiri atau
  belum. SMTP per-tenant (`/settings/email`) tetap ada terpisah, untuk notifikasi bisnis
  bermerek tenant (anggota baru, pembayaran) — dua concern berbeda, dua transport berbeda.
- Token inject langsung ke Better Auth `verification` table (jalur WA) → `resetPassword()`
  client bekerja normal. TTL token WA: 15 menit. Token dari jalur email native Better Auth: 1 jam
  (default Better Auth, tidak di-override).
- Kalau `/api/wa/available` gagal di-fetch sama sekali (network error) → default ke jalur email
  juga (fail-safe ke arah yang paling mungkin masih berfungsi).

---

## Halaman Reset Password (`/reset-password`)

### URL
`/{slug}/reset-password?token=XXXX`

### Flow
1. Baca token dari query string
2. User input password baru + konfirmasi
3. Submit → `authClient.resetPassword({ token, newPassword })`
4. Sukses → redirect ke `/login` dengan pesan sukses

---

## Dashboard Akun (`/akun`)

### Auth Guard
Server component: cek session via `auth.api.getSession(headers)`.
Tidak ada session → redirect ke `/{slug}/login?redirect=/{slug}/akun`.

### Navigasi
```
[Profil Saya] [Transaksi] [Keanggotaan*]
                          *hanya jika accountType === "member"
```

### Halaman Beranda `/akun`
```
┌──────────────────────────────────────────────────┐
│  [Gravatar]  Nama Lengkap                         │
│              member / akun umum                   │
│              [Edit Profil]                        │
├──────────────────────────────────────────────────┤
│  Ringkasan Transaksi                              │
│  • N invoice aktif                                │
│  • N invoice lunas                                │
│  [Lihat Semua Transaksi →]                        │
├──────────────────────────────────────────────────┤
│  (jika member)                                    │
│  Informasi Keanggotaan                            │
│  Nomor Anggota: IKPM-XXXXXX                       │
│  Cabang: PC IKPM Yogyakarta                       │
│  Status: Aktif / Alumni                           │
└──────────────────────────────────────────────────┘
```

### Halaman Profil `/akun/profil`
Form edit:
- Nama Lengkap (wajib)
- Nomor HP (wajib)
- Nomor WhatsApp (opsional, label: "Jika berbeda dari HP")
- Alamat (opsional — WilayahSelect cascade, detail)
- Email (read-only — ubah email butuh verifikasi terpisah)

Aksi: `PATCH /api/akun/profil` (endpoint sudah ada, perlu tambah `whatsapp` field)

### Halaman Transaksi `/akun/transaksi`
- Fetch: `GET /api/akun/transaksi?slug={tenant}` (endpoint sudah ada)
- Tampilkan: tabel invoice (nomor, sumber, total, status, tanggal)
- Status badge: lunas (hijau), menunggu (kuning), dibatalkan (merah)
- Link: klik baris → `/[tenant]/invoice/[id]` (halaman publik invoice)

---

## API Endpoints

### Sudah ada (perlu update)

| Endpoint | Perubahan |
|----------|-----------|
| `POST /api/akun/register` | Tambah field `whatsapp`; tambah member auto-link logic |
| `PATCH /api/akun/profil` | Tambah field `whatsapp` |

### Baru

| Endpoint | Fungsi |
|----------|--------|
| `GET /api/akun/lookup-member` | Cek apakah email/HP cocok dengan data member; return `{ found, name, memberId }` |

### Endpoint lookup-member
```
GET /api/akun/lookup-member?email=xxx@xxx.com
GET /api/akun/lookup-member?phone=0812xxxx

Response (found):
{ found: true, name: "Ahmad Fulan", memberId: "uuid" }

Response (not found):
{ found: false }
```

Lookup path:
```sql
-- Via email
SELECT m.id, m.full_name
FROM public.contacts c
JOIN public.members m ON m.contact_id = c.id
WHERE c.email = $email
LIMIT 1

-- Via phone
SELECT m.id, m.full_name
FROM public.contacts c
JOIN public.members m ON m.contact_id = c.id
WHERE c.phone = $phone
LIMIT 1
```

---

## Member Auto-Link Logic (di `/api/akun/register`)

```typescript
// Setelah validasi, sebelum insert profiles
let memberId:    string | null = null;
let autoName:    string | null = null;

// Lookup via email
const contactByEmail = await db.query.contacts.findFirst({
  where: eq(contacts.email, normalizedEmail),
  with: { member: true },
});
if (contactByEmail?.member && !contactByEmail.member.deletedAt) {
  memberId = contactByEmail.member.id;
  autoName = contactByEmail.member.fullName;
}

// Fallback lookup via phone jika email tidak ketemu
if (!memberId) {
  const contactByPhone = await db.query.contacts.findFirst({
    where: eq(contacts.phone, normalizedPhone),
    with: { member: true },
  });
  if (contactByPhone?.member && !contactByPhone.member.deletedAt) {
    memberId = contactByPhone.member.id;
    autoName = contactByPhone.member.fullName;
  }
}

// Insert profiles
await db.insert(profiles).values({
  name:        autoName ?? name.trim(),      // prioritas nama dari data member
  email:       normalizedEmail,
  phone:       normalizedPhone,
  whatsapp:    normalizedWhatsapp ?? null,
  memberId:    memberId ?? null,
  accountType: memberId ? "member" : "akun",
  betterAuthUserId: signUpResult.user.id,
  registeredAtTenant,
});
```

---

## Session & Auth Pattern

### Server component (halaman `/akun/*`)
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
if (!session?.user) redirect(`/${slug}/login?redirect=/${slug}/akun`);
```

### Client component (login/register/forgot-password)
```typescript
import { authClient } from "@/lib/auth-client";
// signIn, forgetPassword, resetPassword via Better Auth client
```

---

## Perbedaan Tampilan: Member vs Akun Umum

| Section | Member (`accountType === "member"`) | Akun Umum |
|---------|--------------------------------------|-----------|
| Badge header | "Anggota IKPM" biru | "Akun Publik" abu |
| Info keanggotaan | Nomor anggota, cabang, status | — |
| Transaksi | Invoice, donasi, event, produk | Invoice, donasi, event, produk |
| Edit profil | Nama + HP + WA + Alamat (email read-only) | Sama |

---

## Status Implementasi (✅ Semua SELESAI)

### Fase 1 — Auth Dasar
- [x] Schema: kolom `whatsapp` di `public.profiles`
- [x] `POST /api/akun/register` — 2 jalur (IKPM + publik) + member auto-link
- [x] `GET /api/akun/lookup-member` — live lookup stambuk/email/HP
- [x] Login page — dua tab: Email/Password + WhatsApp OTP
- [x] Register page — form + OTP wajib + stambuk lookup
- [x] Forgot password page — WA OTP only
- [x] Reset password page — token dari OTP flow

### Fase 2 — WA OTP
- [x] `POST /api/akun/send-otp` — kirim OTP via GOWA, rate limit 1/menit
- [x] `POST /api/akun/verify-otp` — verifikasi + tandai used
- [x] `POST /api/akun/login-via-otp` — login tanpa password via WA
- [x] OTP wajib di register (tidak bisa skip)
- [x] Forgot password via WA OTP + inject ke Better Auth verification table

### API & File yang Sudah Ada

| File | Status |
|------|--------|
| `app/(public)/[tenant]/login/login-form.tsx` | ✅ Dua tab, `window.location.href` setelah login |
| `app/(public)/[tenant]/register/register-form.tsx` | ✅ OTP wajib, state machine 3 langkah |
| `app/(public)/[tenant]/forgot-password/page.tsx` | ✅ WA OTP only |
| `app/(public)/[tenant]/reset-password/page.tsx` | ✅ `authClient.resetPassword()` |
| `app/(public)/[tenant]/akun/layout.tsx` | ✅ Guard + redirect logic (lihat di bawah) |
| `app/api/akun/register/route.ts` | ✅ 2 jalur |
| `app/api/akun/login-via-otp/route.ts` | ✅ Cookie signing dengan `encodeURIComponent` |
| `app/api/akun/send-otp/route.ts` | ✅ Rate limit 1/menit |
| `app/api/akun/verify-otp/route.ts` | ✅ |

---

## Catatan Teknis Kritis

### Cookie signing untuk login via OTP
`app/api/akun/login-via-otp/route.ts` mereplikasi format cookie Better Auth:
```typescript
// WAJIB: encodeURIComponent di akhir — tanpa ini Better Auth tidak bisa verify
async function signCookieValue(value: string, secret: string): Promise<string> {
  const key       = await crypto.subtle.importKey("raw", ...HMAC-SHA256...);
  const sigBytes  = await crypto.subtle.sign("HMAC", key, encode(value));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  return encodeURIComponent(`${value}.${signature}`);
}
```
Sumber: `better-call/dist/crypto.mjs` fungsi `signCookieValue`. Jika format berubah di
versi Better Auth baru, ini perlu diupdate.

### `otp_tokens.type` — migration wajib
Tabel `public.otp_tokens` punya CHECK constraint `type IN ('register', 'reset_password', 'login')`.
Migration: `packages/db/migrations/0017_otp_login_type.sql`.
Jika deploy ke VPS baru tanpa migration ini, `POST /api/akun/login-via-otp` akan error.

### `akun/layout.tsx` — logic redirect saat identity null
```typescript
const identity = await getAkunIdentity(session.user.id);
if (!identity) {
  // Cek apakah user adalah pengurus di tenant ini
  const { db: tenantDb, schema } = createTenantDb(slug);
  const [tenantUser] = await tenantDb.select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.betterAuthUserId, session.user.id)).limit(1);
  // Pengurus → admin dashboard; selain itu → login
  redirect(tenantUser ? `/app/${slug}/dashboard` : `/${slug}/login`);
}
```
Dua kasus identity null yang berbeda treatment:
- **Pengurus lama** (ada di `tenant.users`, belum punya `members.betterAuthUserId`) → `/app/{slug}/dashboard`
- **User tidak dikenal** (tidak ada di mana-mana) → `/{slug}/login`

Redirect langsung ke `/app/${slug}/dashboard` tanpa cek ini menyebabkan loop:
pengurus non-anggota → admin layout cek tenant.users → redirect `/app/login`
→ middleware: ada session → `/dashboard-redirect` → `getFirstTenantForUser()` null
→ `/register?error=no-tenant` → loop.

> **Update (2026-07-25): tujuan akhir redirect "sesi valid, tanpa akses tenant mana pun" BUKAN
> LAGI `/register?error=no-tenant`.** Alur lengkap: `(dashboard)/app/[tenant]/layout.tsx`'s
> `getTenantAccess(slug)` null → `redirect("/dashboard-redirect")` → `getFirstTenantForUser()`
> null (akun ini tidak punya `tenant.users` di tenant mana pun) → sekarang
> `redirect("/no-tenant-access")` (bukan `/register?error=no-tenant` lagi).
>
> **Kenapa bukan redirect ke `/app/login`**: middleware punya aturan
> `if (pathname === "/app/login" && isLoggedIn) redirect("/dashboard-redirect")` (mencegah user
> yang sudah login melihat form login lagi). Kalau `/dashboard-redirect` mengarahkan balik ke
> `/app/login` untuk kasus "sesi valid tanpa akses tenant", middleware akan lempar balik ke
> `/dashboard-redirect` lagi — infinite loop. Solusinya harus berupa halaman yang berada DI LUAR
> `/app/*` sehingga tidak kena aturan bounce-back manapun.
>
> **Halaman baru `app/no-tenant-access/page.tsx`** (di luar `/app/*`) — menampilkan email akun
> yang sedang login + pesan "belum terdaftar sebagai pengurus di tenant mana pun, hubungi admin
> platform" + tombol "Keluar & Coba Akun Lain" (`sign-out-button.tsx`, pakai
> `window.location.href` setelah `signOut()`, bukan `router.push`).
>
> **`/register?error=no-tenant` handling DIHAPUS TOTAL** dari `(auth)/register/page.tsx` (sudah
> 100% dead code sejak `REGISTRATION_OPEN=false` — pesan itu tidak pernah terlihat karena
> short-circuit ke "Pendaftaran Ditutup" duluan).
>
> **Aturan umum**: setiap kali menambah/mengubah target redirect untuk kasus "sesi valid tapi
> tidak diizinkan", wajib cek dulu apakah tujuan baru itu sendiri punya aturan redirect-balik
> untuk kondisi "sudah login" — kalau ya, jangan arahkan ke situ, cari/buat tujuan yang netral
> terhadap status login.
>
> Perbaikan terkait (murni UI admin platform): halaman `/platform/tenants/[slug]` sekarang
> menampilkan section "Pengurus / Login Tenant" (nama+email+role tiap pengurus, join manual ke
> `public.user` karena FK tidak didefinisikan Drizzle untuk tenant tables) — sebelumnya hanya cek
> `hasOwner: boolean` tanpa detail.

| `app/api/akun/profil/route.ts` | Tambah whatsapp di PATCH |
| `app/(public)/[tenant]/login/page.tsx` | Tambah lupa password link, ubah redirect |
| `app/(public)/[tenant]/register/page.tsx` | Tambah WA field + member lookup |
| `app/(public)/[tenant]/forgot-password/page.tsx` | BARU |
| `app/(public)/[tenant]/reset-password/page.tsx` | BARU |
| `app/(public)/[tenant]/akun/page.tsx` | BARU (dashboard) |
| `app/(public)/[tenant]/akun/profil/page.tsx` | BARU |
| `app/(public)/[tenant]/akun/transaksi/page.tsx` | BARU |
