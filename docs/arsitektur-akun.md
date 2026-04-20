# Arsitektur Modul Akun — jalajogja

## Visi

jalajogja bukan hanya untuk alumni Gontor. Siapapun — pembeli umum, donatur luar, peserta
event — bisa punya **satu identitas** yang berlaku di seluruh ekosistem. Daftar sekali di
tenant mana saja, langsung bisa bertransaksi di semua tenant lainnya tanpa isi data ulang.

Modul **Akun** adalah lapisan identitas universal untuk siapapun yang bukan (atau belum tentu)
anggota IKPM. Ia melengkapi `public.members` — bukan menggantikannya.

**Posisi di sistem:** Front-end publik saja. Akun publik tidak punya akses ke tenant dashboard.

---

## Posisi dalam Ekosistem

```
SIAPAPUN YANG PERNAH BERINTERAKSI DENGAN EKOSISTEM JALAJOGJA
──────────────────────────────────────────────────────────────
                    public.profiles
                  (identitas universal)
                         │
          ┌──────────────┴──────────────┐
          │                             │
   member_id (nullable)         better_auth_user_id (nullable)
          │                             │
   public.members              public.user (Better Auth)
  (alumni Gontor/IKPM)         (akun login)
  stambuk, member_number,
  NIK, tenant_memberships
```

**Empat jenis orang dalam ekosistem:**

| Jenis | public.profiles | public.members | Better Auth user |
|-------|-----------------|----------------|-----------------|
| Alumni IKPM dengan login | ✓ | ✓ | ✓ |
| Alumni IKPM tanpa login | ✓ (auto-link saat transaksi) | ✓ | ✗ |
| Publik dengan login | ✓ | ✗ | ✓ |
| Guest murni (checkout tanpa akun) | ✗ | ✗ | ✗ |

---

## Tabel Baru: `public.profiles`

```sql
CREATE TABLE public.profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identitas (ketiganya wajib)
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  phone                 TEXT NOT NULL UNIQUE,   -- nomor WhatsApp

  -- Tipe akun: 'akun' (publik) atau 'member' (alumni IKPM yang sudah di-link)
  -- Derived dari member_id, tapi disimpan eksplisit untuk kemudahan query
  account_type          TEXT NOT NULL DEFAULT 'akun'
                          CHECK (account_type IN ('akun', 'member')),

  -- Alamat (semua opsional — pakai tabel ref wilayah yang sama dengan modul anggota)
  address_detail        TEXT,
  province_id           TEXT,     -- ref: public.ref_provinces
  regency_id            TEXT,     -- ref: public.ref_regencies
  district_id           TEXT,     -- ref: public.ref_districts
  village_id            TEXT,     -- ref: public.ref_villages
  country               TEXT DEFAULT 'Indonesia',

  -- Link ke ekosistem (keduanya opsional)
  member_id             UUID UNIQUE REFERENCES public.members(id) ON DELETE SET NULL,
  better_auth_user_id   TEXT UNIQUE REFERENCES public.user(id) ON DELETE SET NULL,

  -- Tenant tempat pertama kali daftar (untuk tracing saja)
  registered_at_tenant  UUID REFERENCES public.tenants(id),

  created_at            TIMESTAMP DEFAULT now() NOT NULL,
  updated_at            TIMESTAMP DEFAULT now() NOT NULL,
  deleted_at            TIMESTAMP                         -- soft delete: null = aktif
);
```

**Keputusan desain yang dikunci:**

| Field | Status | Alasan |
|-------|--------|--------|
| `name` | Wajib | Untuk display di transaksi |
| `email` | Wajib + Unique | Identitas utama + login |
| `phone` | Wajib + Unique | WhatsApp — notifikasi + lookup |
| `account_type` | Wajib, default `akun` | Tipe akun eksplisit tanpa harus join ke members |
| Wilayah hierarkis | Semua opsional | Pakai helper yang sama dengan modul anggota |
| `photo_url` | **Tidak ada** | Tidak diperlukan untuk akun publik |

**Tipe Akun (`account_type`):**

| Nilai | Artinya | Kapan diset |
|-------|---------|-------------|
| `akun` | Pengguna publik (pembeli umum, donatur, dll) | Default saat daftar |
| `member` | Alumni IKPM yang sudah ter-link ke `public.members` | Diupdate otomatis saat admin link profile → member |

Saat admin menghubungkan profile ke member (`profile.member_id = member.id`), sistem juga
update `account_type = 'member'` secara otomatis. Jika link dilepas → kembali ke `'akun'`.

---

## Alamat dan Pengiriman Fisik

Wilayah hierarkis dipakai oleh modul Anggota — helper yang sama berlaku di sini.
Tidak ada tabel baru, tidak ada API baru: `WilayahSelect` di front-end, ref tables di DB sudah ada.

**Aturan kelengkapan alamat:**

| Konteks | Minimum Alamat |
|---------|----------------|
| Donasi / Event | Tidak perlu (transaksi non-fisik) |
| Toko — checkout barang fisik | Wajib minimal: `address_detail` + `province_id` + `regency_id` |

Jika user checkout barang fisik dan alamat belum lengkap sampai kabupaten, sistem
menampilkan prompt **"Lengkapi alamat pengiriman"** sebelum bisa lanjut. User diarahkan
ke halaman profil untuk melengkapi, lalu kembali ke checkout.

---

## Perubahan ke Tabel Transaksi

Semua tabel transaksi di tenant schema mendapat kolom `profile_id` tambahan:

```sql
-- Berlaku untuk: invoices, orders, donations, event_registrations
ALTER TABLE tenant_{slug}.invoices
  ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
```

`member_id` yang sudah ada **tidak dihapus** — tetap dipakai untuk alumni IKPM.
`profile_id` adalah tambahan, bukan pengganti.

**Prioritas referensi per transaksi:**

| Kondisi | member_id | profile_id |
|---------|-----------|------------|
| Alumni IKPM login | ✓ | ✓ (auto-link) |
| Publik dengan login | ✗ | ✓ |
| Publik tanpa login, ketemu di profiles | ✗ | ✓ |
| Publik tanpa login, ketemu di members | ✓ | ✓ (auto-create profile) |
| Guest murni | ✗ | ✗ |

---

## Alur Registrasi Akun Publik (Self-Service)

### Via Halaman Publik Tenant

```
User buka halaman event / donasi / toko
→ Klik "Masuk / Daftar"
→ Form register: nama, email, HP WhatsApp, password
→ System cek: email atau HP sudah ada di public.profiles?
    → Sudah ada + punya better_auth_user_id  → "Sudah terdaftar, silahkan masuk"
    → Sudah ada tanpa better_auth_user_id    → "Klaim akun ini" (verifikasi via email/WA OTP)
    → Belum ada                              → buat public.user + public.profiles
→ Akun aktif → redirect ke halaman asal
```

### Via Checkout (Lazy Registration)

```
User checkout tanpa login
→ Isi nama + email + HP
→ System lookup:
    a) Cek public.profiles by email atau phone → ketemu → tanya "Ini akun kamu? Masuk dulu"
    b) Cek public.members by contacts (email/phone) → ketemu → auto-create profile + link member_id
    c) Tidak ketemu → transaksi sebagai guest (profile_id = null)
→ Setelah transaksi selesai → tawarkan "Buat akun untuk lacak transaksimu"
    → Jika mau → set password → better_auth_user_id terisi di profile yang sudah ada
```

---

## Cross-Tenant Experience

```
User daftar akun di IKPM Jogja → profile_id: {X}

Buka IKPM Jakarta → login → system kenali profile_id {X}
→ Checkout otomatis ter-link ke profile_id {X}
→ Tidak perlu isi data lagi

Riwayat transaksi lintas tenant tersimpan atas nama profile_id {X}
(invoices/orders/donations di tiap tenant, tapi profile_id sama)
```

**Aturan akses lintas tenant:**
- Profile TIDAK punya `tenant_memberships` — mereka pelanggan, bukan anggota
- Tenant A hanya bisa lihat transaksi profile X **di tenant A saja**
- Super Admin jalajogja bisa query semua transaksi lintas tenant per profile (future)

---

## Hak Akses: Apa yang Bisa Dilakukan Akun Publik

### Di Halaman Publik (Front-end) — satu-satunya tempat akun publik beroperasi

| Aksi | Bisa? |
|------|-------|
| Lihat produk / event / campaign donasi | ✓ (tanpa login) |
| Tambah ke keranjang | ✓ (tanpa login, via cookie) |
| Checkout dengan login | ✓ — auto-link profile_id |
| Checkout tanpa login (HP+email) | ✓ — lookup + link |
| Lihat riwayat transaksi sendiri | ✓ (setelah login) |
| Edit profil sendiri (nama, HP, email, alamat) | ✓ (setelah login) |
| Login ke dashboard tenant | ✗ — mutlak tidak bisa |
| Edit data anggota IKPM | ✗ — hanya di home tenant |

---

## Admin: Link Profile → Member (Identity Merge)

Jika admin mengetahui bahwa pelanggan publik ternyata alumni Gontor yang belum di-link:

```
Admin dashboard → cari profile by nama/HP/email
→ Pilih profile → "Link ke Anggota"
→ Combobox search public.members
→ Konfirmasi → profile.member_id = member.id
```

**Aturan merge:**
- Satu profile → satu member (UNIQUE constraint di `profiles.member_id`)
- Merge tidak menghapus data — hanya menambah link FK
- Jika member sudah ter-link ke profile lain → sistem warning, resolve manual

---

## Struktur Route

### Front-end Publik (satu-satunya lokasi akun publik)

```
app/(public)/[tenant]/
└── akun/
    ├── daftar/page.tsx          → form register: nama, email, HP, password
    ├── masuk/page.tsx           → login
    ├── lupa-password/page.tsx   → reset via email
    └── profil/page.tsx          → lihat + edit profil (login required)
        └── transaksi/page.tsx   → riwayat transaksi di tenant ini
```

### Dashboard Admin (read-only + link action)

```
app/(dashboard)/[tenant]/
└── akun/
    ├── page.tsx      → list akun publik yang pernah transaksi di tenant ini
    └── [id]/page.tsx → detail + riwayat transaksi + tombol "Link ke Anggota"
```

Tidak ada create/edit dari dashboard — akun publik sepenuhnya self-service.

---

## Struktur File Database

```
packages/db/src/schema/public/
├── members.ts              → identitas IKPM (tidak berubah)
├── tenant-memberships.ts   → relasi cabang IKPM (tidak berubah)
├── profiles.ts             → identitas universal publik (BARU)
└── auth.ts                 → public.user, session, account (tidak berubah)
```

---

## Lookup Logic di Checkout

```typescript
async function resolveIdentity(db: PublicDb, opts: {
  phone?: string;
  email?: string;
  sessionUserId?: string;
}): Promise<{ profileId: string | null; memberId: string | null }> {
  const { phone, email, sessionUserId } = opts;

  // 1. Session login → ambil profile dari better_auth_user_id
  if (sessionUserId) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.betterAuthUserId, sessionUserId),
    });
    return { profileId: profile?.id ?? null, memberId: profile?.memberId ?? null };
  }

  // 2. Lookup di public.profiles by email atau phone
  if (email || phone) {
    const profile = await db.query.profiles.findFirst({
      where: or(
        email ? eq(profiles.email, email) : undefined,
        phone ? eq(profiles.phone, phone) : undefined,
      ),
    });
    if (profile) return { profileId: profile.id, memberId: profile.memberId ?? null };
  }

  // 3. Fallback: lookup di public.members via contacts table
  if (email || phone) {
    const rows = await db.select().from(members)
      .innerJoin(contacts, eq(contacts.id, members.contactId))
      .where(or(
        email ? eq(contacts.email, email) : undefined,
        phone ? eq(contacts.phone, phone) : undefined,
      ))
      .limit(1);

    if (rows[0]) {
      // Auto-create profile, linked ke member (lazy creation)
      const [newProfile] = await db.insert(profiles).values({
        name:     rows[0].members.name,
        email:    email ?? "",
        phone:    phone ?? "",
        memberId: rows[0].members.id,
      }).returning();
      return { profileId: newProfile.id, memberId: rows[0].members.id };
    }
  }

  // 4. Pure guest — tidak ada di sistem
  return { profileId: null, memberId: null };
}
```

---

## Keputusan Desain yang Dikunci

| Keputusan | Nilai |
|-----------|-------|
| Tabel identitas publik | `public.profiles` (bukan extend `public.members`) |
| Field wajib | `name`, `email`, `phone` (WhatsApp) |
| Field opsional | wilayah hierarkis — pakai helper sama dengan modul anggota |
| Field tidak ada | `photo_url` |
| Tipe akun | `account_type: 'akun' \| 'member'` — eksplisit, default `akun` |
| Verifikasi daftar | OTP WhatsApp **atau** link email — WA jika add-on aktif, fallback email |
| Password reset | OTP WhatsApp atau link email — sama seperti verifikasi |
| Hapus akun | Soft delete via `deleted_at` — data tidak hilang dari DB |
| Login scope | Front-end publik saja — mutlak tidak bisa masuk dashboard tenant |
| Dashboard tenant | Hanya read + link ke member — tidak ada create/edit |
| Alamat untuk toko | Wajib sampai kabupaten jika checkout barang fisik (prompt di checkout) |
| Transaksi existing | `member_id` tetap ada, `profile_id` ditambahkan (additive) |
| Lazy profile creation | Alumni yang checkout tanpa login → auto-create profile + link member |

---

## Roadmap Implementasi

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 — Schema | `public.profiles` + kolom `profile_id` di tabel transaksi | 🔲 Belum |
| Phase 2 — Checkout | `resolveIdentity()` di checkout actions | 🔲 Belum |
| Phase 3 — Auth publik | Halaman daftar/masuk/profil di `/(public)/[tenant]/akun/` | 🔲 Belum |
| Phase 4 — Dashboard admin | `/akun` di dashboard — list + link ke member | 🔲 Belum |
| Phase 5 — Cross-tenant history | Agregasi transaksi lintas tenant (platform admin) | 🔲 Belum |

**Urutan wajib diikuti** — Phase 3 bergantung pada Phase 1+2.

---

## Keputusan Verifikasi & Keamanan (Locked)

| Keputusan | Nilai |
|-----------|-------|
| Verifikasi saat daftar | OTP WhatsApp **atau** link email — salah satu cukup |
| Password reset | OTP WhatsApp atau link email — salah satu cukup |
| Hapus akun | **Soft delete** — tambah kolom `deleted_at`, data tidak benar-benar dihapus |
| Alasan soft delete | Transaksi lama tetap punya referensi `profile_id` yang valid untuk audit |

**Implikasi soft delete ke schema:**
```sql
-- Tambah ke public.profiles
deleted_at  TIMESTAMP,  -- null = aktif; diisi = akun sudah dihapus

-- Semua query pakai filter
WHERE profiles.deleted_at IS NULL
```

**Alur verifikasi saat daftar:**
```
Isi form (nama, email, HP, password)
→ Jika add-on WhatsApp aktif di tenant:
    Kirim OTP ke WhatsApp → user input OTP → akun aktif
→ Jika tidak ada WhatsApp:
    Kirim link verifikasi ke email → user klik → akun aktif
```

Sama persis untuk password reset: coba WA dulu, fallback ke email jika WA tidak tersedia.
