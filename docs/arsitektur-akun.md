# Arsitektur Akun — jalajogja

> Status: **REFACTORING — arsitektur lama salah, dokumen ini adalah yang benar**
> Arsitektur lama mencampur anggota IKPM dan publik dalam `public.profiles` via `accountType` — ini salah.

---

## Visi

jalajogja adalah super-app untuk ekosistem IKPM (alumni Pondok Modern Gontor). Ada dua
kategori pengguna yang bisa berinteraksi dengan front-end publik tenant:

1. **Anggota IKPM** — alumni Gontor, identitas dikelola admin, bisa diangkat jadi pengurus
2. **Akun Publik** — orang umum yang ingin belanja, donasi, atau ikut event

Keduanya berbeda entitas, berbeda tabel, berbeda lifecycle.

---

## Tiga Level Akses

```
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 1 — PENGURUS (subset Anggota IKPM)                   │
│  ✓ Login dashboard tenant    ✓ Login front-end              │
│  Data: public.members + public.user + tenant.users          │
│  Diangkat oleh owner/super admin, masa jabatan terbatas     │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 2 — ANGGOTA IKPM (alumni Gontor)                     │
│  ✗ Login dashboard tenant    ✓ Login front-end semua tenant │
│  Data: public.members + public.user                         │
│  Kecuali diangkat jadi pengurus → naik ke Level 1           │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 3 — AKUN PUBLIK (orang umum)                         │
│  ✗ Login dashboard tenant    ✓ Login front-end semua tenant │
│  Data: public.profiles + public.user                        │
│  Tidak bisa diangkat jadi pengurus                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Relasi Tabel

```
public.user (Better Auth — satu tabel untuk SEMUA yang bisa login)
    │
    ├─── via tenant_{slug}.users ──────────────────→ PENGURUS
    │         role: owner|ketua|sekretaris|bendahara|custom
    │         member_id ──────────────────────────→ public.members
    │         masa jabatan via /pengurus module
    │
    ├─── via public.members.better_auth_user_id ──→ ANGGOTA IKPM
    │         (front-end login lintas semua tenant)
    │         stambuk, member_number, NIK, dll
    │
    └─── via public.profiles.better_auth_user_id ─→ AKUN PUBLIK
              (front-end login lintas semua tenant)
              nama, email, phone — no IKPM data
```

---

## Tabel `public.members` — Anggota IKPM

Tabel sakral. Hanya diisi oleh admin via dashboard (`/members/new`).
Tidak bisa self-register.

```sql
public.members
  id, member_number, stambuk_number, nik
  name, gender, birth_date, birth_place
  contact_id → public.contacts (phone, email, whatsapp)
  better_auth_user_id → public.user  ← kolom untuk front-end login
```

**Kolom `better_auth_user_id` di `public.members`:**
- `null` = anggota belum punya login (data ada tapi belum aktivasi akun)
- diisi = anggota sudah bisa login di front-end
- diisi VIA proses aktivasi mandiri (`/aktivasi`) atau admin aktifkan dari dashboard

---

## Tabel `public.profiles` — Akun Publik

Self-service. Siapapun bisa daftar via `/register`.
Tidak ada data keanggotaan IKPM di sini.

```sql
public.profiles
  id, name, email (unique), phone (unique)
  whatsapp, address_detail, province_id, regency_id, district_id, village_id
  better_auth_user_id → public.user
  registered_at_tenant → public.tenants
  created_at, updated_at, deleted_at (soft delete)
```

**Tidak ada kolom `member_id` atau `account_type`** — ini khusus untuk publik saja.

---

## Alur Register

### Jalur Anggota IKPM Gontor

Tujuan utama aplikasi adalah **pendataan anggota IKPM**. Siapapun yang mengaku alumni Gontor
bisa mendaftar — baik yang datanya sudah ada di DB maupun yang belum.

```
User buka /{slug}/register → pilih "Anggota IKPM Gontor"
→ Isi form: stambuk (opsional), nama, email, HP, password

→ Live lookup (onBlur stambuk/email/HP):
    Cari di public.members via stambuk → atau via contacts.email/phone
    → Ketemu  → banner "Data ditemukan atas nama {nama}"
                mode KLAIM: nama di-prefill (read-only)
    → Tidak   → mode DAFTAR BARU: nama input bebas

→ Submit:

    [Mode KLAIM — data sudah ada di public.members]
    → Cek members.better_auth_user_id:
        → Sudah terisi → "Akun sudah ada. Gunakan lupa password."
        → Belum ada    → Buat public.user (Better Auth)
                          UPDATE public.members SET better_auth_user_id = user.id
                          Login otomatis → redirect /{slug}/akun/lengkapi

    [Mode DAFTAR BARU — belum ada di public.members]
    → Cek duplikat email/HP di contacts → ada → "Email/HP sudah terdaftar"
    → Buat public.user (Better Auth)
    → INSERT public.contacts { email, phone }
    → INSERT public.members { name, stambuk?, contact_id, better_auth_user_id }
    → Login otomatis → redirect /{slug}/akun/lengkapi
```

> Redirect ke `/akun/lengkapi` (wizard pelengkap data) — data baru pasti belum lengkap.

### Jalur Akun Publik (Bukan Anggota)

```
User buka /{slug}/register → pilih "Bukan Anggota IKPM"
→ Isi form: nama, email, HP, password
→ Cek: email/HP sudah ada di public.profiles? → "Sudah terdaftar, silakan masuk"
→ Buat public.user (Better Auth)
→ INSERT public.profiles { name, email, phone, better_auth_user_id, registered_at_tenant }
→ Login otomatis → redirect /{slug}/akun
```

---

## Alur Login Front-end

```
POST /{slug}/login (email + password)
→ Better Auth signIn → dapat public.user.id
→ Cek public.members WHERE better_auth_user_id = user.id
    → Ketemu → login sebagai ANGGOTA IKPM
→ Cek public.profiles WHERE better_auth_user_id = user.id
    → Ketemu → login sebagai AKUN PUBLIK
→ Tidak ketemu di keduanya → ini pengurus, redirect dashboard
```

---

## Alur Pengangkatan Pengurus

```
Admin buka /{slug}/settings/users → "Tambah Pengurus"
→ Pilih dari public.members (combobox anggota aktif)
→ Pilih role (ketua/sekretaris/bendahara/custom)
→ Pilih masa jabatan (dari modul /pengurus)
→ Aktifkan: kirim link undangan ATAU admin set password
→ Insert tenant_{slug}.users:
    better_auth_user_id = public.user.id (sudah ada atau baru dibuat)
    member_id = public.members.id
    role = {pilihan}

Jika anggota belum punya better_auth_user_id:
→ Buat public.user baru
→ Update public.members.better_auth_user_id
→ Insert tenant.users
```

> Pengurus adalah anggota IKPM — `tenant.users.member_id` TIDAK BOLEH null.
> Tidak ada pengurus yang bukan alumni Gontor.

---

## Alur Masa Jabatan Berakhir

```
Masa jabatan berakhir (dari modul /pengurus)
→ DELETE atau DEACTIVATE tenant.users record
→ public.members.better_auth_user_id TETAP ada (tidak dihapus)
→ Pengurus turun kembali ke Level 2 (Anggota IKPM)
→ Masih bisa login di front-end, tidak bisa lagi masuk dashboard
```

---

## Hak Akses per Level

| Aksi | Pengurus | Anggota IKPM | Akun Publik |
|------|----------|--------------|-------------|
| Login dashboard tenant | ✓ | ✗ | ✗ |
| Login front-end semua tenant | ✓ | ✓ | ✓ |
| Belanja / donasi / ikut event | ✓ | ✓ | ✓ |
| Lihat riwayat transaksi sendiri | ✓ | ✓ | ✓ |
| Lengkapi data keanggotaan | ✓ | ✓ | ✗ |
| Diangkat jadi pengurus | ✓ (sudah) | ✓ (bisa) | ✗ (tidak bisa) |
| Akses data anggota lain | ✓ (sesuai role) | ✗ | ✗ |

---

## Route Publik

```
app/(public)/[tenant]/
├── login/page.tsx          → email + password (untuk semua level)
├── register/page.tsx       → 2 jalur: klaim anggota IKPM vs daftar publik
├── forgot-password/        → reset via email
├── reset-password/         → konfirmasi password baru
└── akun/
    ├── page.tsx            → dashboard front-end (anggota + publik)
    ├── profil/page.tsx     → edit profil
    ├── transaksi/page.tsx  → riwayat transaksi
    └── lengkapi/page.tsx   → wizard data keanggotaan (anggota IKPM saja)
```

---

## Tabel Transaksi — Dua Referensi

Transaksi (orders, donations, event_registrations, invoices) punya dua kolom identitas:

```sql
member_id   UUID REFERENCES public.members(id)   -- jika pelaku adalah anggota IKPM
profile_id  UUID REFERENCES public.profiles(id)  -- jika pelaku adalah akun publik
```

Keduanya nullable. Lookup saat checkout:

```
1. Ada session login?
   a. Cek public.members.better_auth_user_id → anggota IKPM → isi member_id
   b. Cek public.profiles.better_auth_user_id → akun publik → isi profile_id

2. Guest checkout (tanpa login) — isi email/HP manual:
   a. Cek public.members via contacts (email/phone) → isi member_id
   b. Cek public.profiles via email/phone → isi profile_id
   c. Tidak ketemu → guest (keduanya null, nama/email disimpan langsung di transaksi)
```

---

## Yang Perlu Direfactor

### Schema
- [ ] Tambah kolom `better_auth_user_id TEXT UNIQUE REFERENCES public.user(id)` ke `public.members`
- [ ] Hapus kolom `member_id` dan `account_type` dari `public.profiles`
- [ ] `public.profiles` murni untuk akun publik

### Kode
- [ ] `POST /api/akun/register` — pisah dua jalur benar-benar berbeda
- [ ] Jalur IKPM: cek `public.members`, update `better_auth_user_id` (bukan insert profiles)
- [ ] Jalur publik: insert `public.profiles` saja
- [ ] `resolveIdentity()` — update logic: cek `members.better_auth_user_id` dulu, lalu `profiles.better_auth_user_id`
- [ ] Front-end auth middleware: bedakan anggota vs publik dari tabel mana mereka berasal

### Register Page
- [ ] Jalur "Anggota IKPM" → stambuk/email/HP wajib diisi untuk verifikasi
- [ ] Jika tidak ketemu di `public.members` → tampilkan pesan "Hubungi admin cabang"
- [ ] Tidak ada auto-create member dari front-end
