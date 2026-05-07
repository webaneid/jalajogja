# Arsitektur Login Universal — jalajogja

Login, registrasi, lupa password, dan dashboard akun publik yang berlaku seragam
untuk **semua tenant** — baik untuk anggota IKPM maupun akun publik umum.

---

## Prinsip Desain

| Prinsip | Penjelasan |
|---------|-----------|
| **One identity** | Satu akun login berlaku di semua tenant (domain jalajogja) |
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

### UI
```
[Logo tenant / site_name]

┌─────────────────────┐
│ Email               │
│ Password            │
│ [Lupa password?]    │  ← link ke /forgot-password
│                     │
│ [  Masuk  ]         │
└─────────────────────┘
Belum punya akun? [Daftar sekarang]
```

### Flow
1. Submit email + password → `authClient.signIn.email()`
2. Sukses → redirect ke `/{slug}/akun`
3. Gagal → tampilkan pesan error dari Better Auth

### Implementasi
- File: `app/(public)/[tenant]/login/page.tsx` (client component)
- Auth: Better Auth client `signIn.email`
- Redirect setelah login: `/{slug}/akun` (bukan `/{slug}`)

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

### Flow Registrasi
```
User isi form
  ↓
Blur email/HP → lookup member (background, tidak blocking)
  ↓
Submit form → POST /api/akun/register
  ↓
Validasi: nama, email, HP, password (≥8 karakter)
  ↓
Cek duplikat: profiles.email + profiles.phone + profiles.whatsapp
  ↓
Jika email/HP cocok member:
  → link profiles.memberId = members.id
  → set profiles.accountType = "member"
  → pakai nama dari members.fullName (override input jika blank)
  ↓
Buat Better Auth user (hash password)
  ↓
Insert public.profiles (betterAuthUserId, name, email, phone, whatsapp, memberId?)
  ↓
[DISABLED] Kirim OTP WhatsApp — skip sampai gateway aktif
  ↓
Auto login via authClient.signIn.email()
  ↓
Redirect ke /{slug}/akun
```

### Verifikasi WhatsApp OTP (DITUNDA)
- Kolom `profiles.phoneVerifiedAt` dan `profiles.emailVerifiedAt` belum ada — tambahkan saat diaktifkan
- Saat aktif: setelah insert profiles → kirim OTP 6 digit ke WA → halaman verifikasi `/register/verify`
- Saat belum aktif: langsung login tanpa verifikasi

---

## Halaman Lupa Password (`/forgot-password`)

### UI
```
┌─────────────────────┐
│ Masukkan email Anda  │
│ Email               │
│                     │
│ [Kirim Link Reset]  │
└─────────────────────┘
[link kembali ke login]
```

### Flow
1. Submit email → `authClient.forgetPassword({ email, redirectTo: '/{slug}/reset-password' })`
2. Better Auth kirim email dengan link reset (SMTP dari settings tenant)
3. Tampilkan pesan sukses: "Cek email Anda untuk link reset password"
4. Link reset berlaku 1 jam (default Better Auth)

### Catatan
- WhatsApp OTP sebagai alternatif lupa password → DITUNDA
- Reset via HP number → DITUNDA sampai WA gateway aktif

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

## Fase Implementasi

### Fase 1 (sekarang)
- [x] Schema: tambah kolom `whatsapp` ke `public.profiles`
- [ ] API: update `POST /api/akun/register` (whatsapp + member auto-link)
- [ ] API: `GET /api/akun/lookup-member`
- [ ] Update `PATCH /api/akun/profil` (tambah whatsapp)
- [ ] Login page: tambah link "Lupa password?", update redirect ke `/akun`
- [ ] Register page: tambah field WA, member lookup live, auto-fill nama
- [ ] Forgot password page
- [ ] Reset password page
- [ ] Dashboard `/akun` (beranda + profil + transaksi)

### Fase 2 (saat WA gateway aktif)
- [ ] Tambah kolom `phone_verified_at`, `email_verified_at` ke `public.profiles`
- [ ] Halaman `/register/verify` — input OTP 6 digit
- [ ] `/forgot-password` via WA OTP sebagai opsi kedua
- [ ] Endpoint: `POST /api/akun/send-otp`, `POST /api/akun/verify-otp`

---

## File yang Perlu Dibuat / Diubah

| File | Aksi |
|------|------|
| `packages/db/src/schema/public/profiles.ts` | Tambah kolom `whatsapp` |
| `packages/db/src/helpers/create-tenant-schema.ts` | Tidak perlu (profiles di public schema) |
| `app/api/akun/register/route.ts` | Tambah whatsapp + member auto-link |
| `app/api/akun/lookup-member/route.ts` | BARU |
| `app/api/akun/profil/route.ts` | Tambah whatsapp di PATCH |
| `app/(public)/[tenant]/login/page.tsx` | Tambah lupa password link, ubah redirect |
| `app/(public)/[tenant]/register/page.tsx` | Tambah WA field + member lookup |
| `app/(public)/[tenant]/forgot-password/page.tsx` | BARU |
| `app/(public)/[tenant]/reset-password/page.tsx` | BARU |
| `app/(public)/[tenant]/akun/page.tsx` | BARU (dashboard) |
| `app/(public)/[tenant]/akun/profil/page.tsx` | BARU |
| `app/(public)/[tenant]/akun/transaksi/page.tsx` | BARU |
