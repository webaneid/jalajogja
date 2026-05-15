# Arsitektur Alur Donasi Publik

> Dokumen ini menjelaskan alur front-end donasi publik secara lengkap.
> Konteks skema DB, campaign types, dan admin flow ada di `docs/arsitektur-donasi.md` § 1–10.
> Implementasi halaman publik ada di `docs/arsitektur-donasi.md` § 11.

---

## Tiga Jalur Donatur

Sistem mengenali donatur dalam tiga kondisi. Penentuan terjadi saat form diisi, **sebelum** checkout.

```
┌─────────────────────────────────────────────────────┐
│              Halaman Campaign Detail                │
│           /{slug}/campaign/{campaignSlug}           │
└─────────────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    [Sudah Login]  [HP Dikenal]  [Guest Murni]
    session aktif  ada di DB     tidak ada di DB
          │             │             │
          └─────────────┼─────────────┘
                        ▼
              addToCartAction (sama)
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Popup "ask"   Popup "ask"   Popup "guest"
     (sama)        (sama)        (berbeda)
```

### Jalur 1 — Sudah Login (session aktif)

- Nama dan nomor HP sudah pre-filled dari session (server-side)
- Field nomor HP tidak tampil (sudah terisi dari session)
- Popup **"ask"**: "Ya, lihat program lain" → `/campaign` | "Tidak, lanjut bayar" → express checkout
- Express checkout menggunakan `memberPhone` + `memberEmail` dari session props

### Jalur 2 — HP Dikenal (tidak login, tapi nomor ada di DB)

- User input nomor HP → debounce 500ms → lookup → nama auto-fill
- Perlakuan **sama persis** dengan Jalur 1 setelah nama terisi
- Popup **"ask"**: "Ya, lihat program lain" → `/campaign` | "Tidak, lanjut bayar" → express checkout
- Express checkout menggunakan nama dari lookup + nomor HP dari input
- Server-side: `resolveIdentity` menemukan member/profile via phone → invoice ter-link ke akun mereka

### Jalur 3 — Guest Murni (nomor tidak ada di DB)

- User input nomor HP → lookup → not found → field nama kosong → user isi sendiri
- Popup **"guest"** (berbeda dari "ask"):
  - "Daftar Akun" → redirect ke `/{slug}/register` (cart tetap via cookie, TTL 24 jam)
  - "Lanjut Tanpa Akun" → express checkout sebagai guest
- Express checkout: invoice menyimpan `customerName` + `customerPhone`, tidak ada link ke akun
- Donatur tidak bisa melihat histori sendiri (tapi admin bisa lihat via invoice)

---

## Phone Lookup — Dua Sumber Data

Nomor HP dicari di **dua tabel berbeda** secara paralel:

```
Input: nomor HP (setelah normalizePhone → E.164)
         │
    ┌────┴────┐
    ▼         ▼
public.contacts  public.profiles
via members      (akun publik)
.contactId
    │         │
    └────┬────┘
         ▼
   { found, name, type }
   type: "member" | "profile"
```

**Endpoint:** `GET /api/akun/lookup-member?phone={nomor}`

Response:
```json
// Ditemukan
{ "found": true, "name": "Ahmad Fulan", "type": "member" }

// Tidak ditemukan
{ "found": false }
```

**Catatan keamanan:**
- Rate limit: 10 req/menit/IP (sudah ada di `lib/rate-limit.ts`)
- Hanya `name` yang dikembalikan — tidak ada ID, tidak ada kontak lain
- Lookup berjalan client-side (debounce 500ms setelah user berhenti ketik)

**Update yang diperlukan di endpoint:**
Endpoint saat ini hanya cek `contacts → members`. Perlu tambah query ke `public.profiles.phone`.

---

## Form Donasi — Struktur Field

### Donasi Reguler (bukan qurban)

```
[Nomor HP / WhatsApp]          ← field baru, diisi pertama
  ↓ (lookup otomatis saat berhenti ketik)
[Nama Donatur]                 ← auto-fill jika ditemukan, kosong jika tidak
  Sembunyikan nama (anonim) ☐

[Pilih Nominal]
  [Rp 10.000] [Rp 25.000] [Rp 50.000] [Rp 100.000]
  Nominal lain: Rp ________

[Donasi Rp X]  ← tombol submit
```

### Qurban

```
[Nomor HP / WhatsApp]          ← field baru
  ↓ (lookup otomatis)
[Nama Pemesan]                 ← auto-fill jika ditemukan

[Pilih Hewan]
  ...
[Atas Nama (Shohibul Qurban)]
  Sama dengan nama saya ☐

[Tambah ke Keranjang]
```

### UX Rules

- Tombol submit **aktif** meski phone belum diisi (phone opsional — memudahkan donatur baru)
- Nama **wajib diisi** sebelum submit (validasi existing tidak berubah)
- Jika phone diisi tapi lookup sedang berjalan → tampil spinner kecil di field nama
- Jika phone tidak valid format → skip lookup, tidak error

---

## Popup States

### Popup "ask" — untuk Jalur 1 dan 2

```
┌─────────────────────────────────┐
│  ✓ Berhasil ditambahkan!        │
│                                 │
│  Ingin donasi program lain?     │
│                                 │
│  [Ya, lihat program lain]       │
│  [Tidak, lanjut bayar →]        │
└─────────────────────────────────┘
```

Klik "Tidak, lanjut bayar":
- Sudah login → `handleExpressCheckout()` langsung
- HP dikenal (Jalur 2) → `handleExpressCheckout()` dengan phone dari input
- Belum login dan tidak dikenal → **tidak mungkin masuk sini** (sudah dipisah ke popup "guest")

### Popup "guest" — untuk Jalur 3

```
┌─────────────────────────────────┐
│  ✓ Berhasil ditambahkan!        │
│                                 │
│  Nomor HP belum terdaftar.      │
│  Daftar agar donasi tersimpan   │
│  di riwayat akun Anda.          │
│                                 │
│  [Daftar Akun]                  │
│  [Lanjut Tanpa Akun]            │
└─────────────────────────────────┘
```

- "Daftar Akun" → `window.location.href = /{slug}/register` (cart tetap via cookie)
- "Lanjut Tanpa Akun" → `handleExpressCheckout()` dengan phone + nama yang diketik

### Popup "processing" — sama untuk semua jalur

```
┌─────────────────────────────────┐
│        ◌ Membuat invoice...     │
└─────────────────────────────────┘
```

---

## Cart Persistence saat Redirect ke Register

Cart disimpan sebagai `sessionToken` di httpOnly cookie (TTL 24 jam). Saat user:
1. Klik "Daftar Akun" → redirect ke `/register`
2. Selesai register → redirect kembali (atau ke `/keranjang`)
3. Cookie masih ada → cart masih ada → bisa lanjut checkout

Tidak ada action khusus yang diperlukan — cookie TTL sudah cukup.

---

## Checkout Resolution — resolveIdentity

Semua jalur berakhir di `checkoutAction(slug, { name, phone, method })`.

Server-side `resolveIdentity` menentukan link akun:

```
checkoutAction({ name, phone, email? })
      │
      ▼
resolveIdentity(db, { betterAuthUserId, phone, email })
      │
      ├── Session aktif → link ke member/profile dari session
      ├── Phone cocok di profiles → link ke profileId
      ├── Phone cocok di members (via contacts) → link ke memberId
      └── Tidak ada → invoice standalone (customerName + customerPhone saja)
```

Invoice selalu menyimpan `customerName` dan `customerPhone` terlepas dari apakah ada link akun.

---

## Perubahan File yang Diperlukan

### 1. `app/api/akun/lookup-member/route.ts`
- Tambah query ke `public.profiles WHERE phone = normalizedPhone`
- Jalankan paralel dengan query existing (contacts → members)
- Response: tambah field `type: "member" | "profile"` (opsional, untuk audit)
- Member takes priority jika keduanya ditemukan

### 2. `components/donasi/public/campaign-detail-client.tsx`
- Tambah state: `phone`, `phoneLoading`, `isKnown` (boolean)
- Tambah prop: tidak ada perubahan props dari server (phone tidak ada di session untuk non-login)
- Tambah field nomor HP di form (sebelum nama)
- Lookup logic: `useEffect` + debounce 500ms pada `phone` state
- Update popup selection: `isKnown || isLoggedIn` → popup "ask" | else → popup "guest"
- Tambah popup "guest" JSX
- `handleExpressCheckout` menerima phone dari state

### 3. `app/(public)/[tenant]/campaign/[slug]/page.tsx`
- Tidak ada perubahan besar — props yang dikirim ke client sudah cukup

---

## State Machine Lengkap

```
States:
  phone        = ""
  phoneLoading = false
  isKnown      = false          ← true jika lookup found
  donorName    = defaultName    ← auto-fill dari lookup atau session
  popup        = "hidden" | "ask" | "guest" | "processing"

Transitions:
  phone diubah → (500ms debounce) → phoneLoading = true → lookup
    → found    → isKnown = true, donorName = lookupName, phoneLoading = false
    → not found → isKnown = false, phoneLoading = false

  handleAddToCart success:
    → isLoggedIn || isKnown → popup = "ask"
    → else                  → popup = "guest"

  popup "ask":
    "Ya, lihat program lain" → navigate /campaign
    "Tidak, lanjut bayar"   → handleExpressCheckout() → popup = "processing"
                              → success → navigate /invoice/{id}
                              → error   → popup = "ask" + loginError

  popup "guest":
    "Daftar Akun"           → navigate /register (cart tetap)
    "Lanjut Tanpa Akun"     → handleExpressCheckout() → popup = "processing"
                              → success → navigate /invoice/{id}
                              → error   → popup = "guest" + error message
```

---

## Open Questions / Keputusan yang Sudah Dikunci

| Topik | Keputusan |
|-------|-----------|
| Guest "Daftar Akun" | Redirect ke `/register`, bukan inline popup |
| Popup untuk HP dikenal | Sama persis dengan popup logged-in ("ask") |
| Phone field | Opsional — submit tetap bisa tanpa phone |
| OTP verifikasi | Tidak diimplementasikan saat ini — ditunda ke phase WA gateway |
| Silent account creation | Tidak — guest tetap guest, tidak auto-buat akun |
| Tracking guest lintas sesi | Tidak bisa — unless mereka daftar akun |
| Priority jika phone ada di dua tabel | `members` > `profiles` |
