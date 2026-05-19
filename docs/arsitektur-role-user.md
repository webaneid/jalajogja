# Arsitektur Role & User Management

> Status: **SELESAI — Sudah Diimplementasikan**
> Dokumen ini mencerminkan implementasi aktual. Selalu verifikasi ke kode sebelum mengasumsikan status fitur.

---

## Prinsip Desain

1. **Pengurus wajib berasal dari anggota** — tidak ada pengurus yang tidak terdaftar di `public.members`
2. **`tenant.users` = akses dashboard saja** — anggota biasa yang belum jadi pengurus tidak ada di sini
3. **Satu akun Better Auth, dua konteks** — akun yang sama dipakai untuk dashboard (pengurus) dan portal front-end (anggota). Password tunggal, tidak perlu buat akun baru jika sudah terdaftar di front-end
4. **Email dari data anggota** — email untuk aktivasi diambil dari `public.contacts` via `members.contactId`, bukan diketik manual admin
5. **Tiga jalur aktivasi** — disesuaikan dengan kondisi anggota: sudah punya akun, belum punya akun + link, belum punya akun + langsung

---

## Gambaran Relasi

```
public.user (Better Auth)
    │ id = better_auth_user_id
    ▼
tenant_{slug}.users          ← hanya pengurus + owner, BUKAN semua anggota
    │ role: owner|ketua|sekretaris|bendahara|custom
    │ member_id ──────────────────────────────────── → public.members
    │ custom_role_id ─────────────────────────────── → tenant.custom_roles
    │                                                  (null jika role bukan "custom")
    ▼
public.members               ← identitas tunggal lintas semua cabang
    │ name, nik, birth_date, stambuk_number, ...
    │ better_auth_user_id ───────────────────────── → public.user (akun front-end)
    │ contact_id ─────────────────────────────────── → public.contacts
                                                        (email, phone, whatsapp)
```

**Anggota biasa (belum jadi pengurus):**
```
public.members ← ada di sini
    │ better_auth_user_id ← bisa terisi (sudah daftar di front-end) atau null (belum)
    ↓ via tenant_memberships
tenant_{slug}  ← terdaftar di cabang ini

    ✗ TIDAK ada di tenant.users   (tidak punya akses dashboard)
```

**Kunci perbedaan tiga jalur aktivasi:**

| Kondisi anggota | `members.better_auth_user_id` | Jalur aktivasi |
|-----------------|-------------------------------|----------------|
| Sudah daftar di front-end | Terisi | Beri Akses — pilih role saja |
| Belum punya akun | `null` | Link undangan (user set password sendiri) |
| Belum punya akun | `null` | Aktifkan langsung (admin set password) |

---

## Schema

### `tenant_{slug}.users`

```typescript
// packages/db/src/schema/tenant/users.ts

export const TENANT_ROLES = [
  "owner",      // 1 per tenant, full access + user management
  "ketua",      // full access semua modul
  "sekretaris", // surat/dokumen/anggota/event full, keuangan read
  "bendahara",  // keuangan full, surat own
  "custom",     // permissions dari custom_roles.permissions JSONB
] as const;

// Kolom utama:
// id, betterAuthUserId (UNIQUE), role, customRoleId (null kecuali role=custom),
// memberId (null hanya untuk owner awal saat register), createdAt, updatedAt
```

**Constraint DB:**
```sql
CONSTRAINT users_custom_role_check CHECK (
  (role IN ('owner','ketua','sekretaris','bendahara') AND custom_role_id IS NULL)
  OR
  (role = 'custom' AND custom_role_id IS NOT NULL)
)
```

---

### `tenant_{slug}.custom_roles`

```typescript
{
  id:          uuid PRIMARY KEY,
  name:        text NOT NULL,          -- "Divisi Media", "Koordinator Wilayah", dll
  description: text nullable,
  permissions: jsonb NOT NULL DEFAULT '{}',
  // Contoh: { "website": "none", "surat": "own", "keuangan": "none",
  //           "toko": "read", "donasi": "full", ... }
  is_system:   boolean DEFAULT false,  // reserved, belum dipakai
  created_at:  timestamptz,
}
```

---

### `tenant_{slug}.tenant_invites`

Audit trail undangan. Baris tidak dihapus setelah accepted — tetap ada sebagai riwayat.
Hanya dipakai untuk dua jalur non-existing (link + langsung). Anggota yang sudah punya akun tidak butuh invite.

```typescript
export const INVITE_ROLES = ["ketua", "sekretaris", "bendahara", "custom"] as const;
// Owner tidak bisa diundang — hanya ada 1, dibuat saat register tenant

{
  id:              uuid PRIMARY KEY,
  email:           text nullable,        -- dari public.contacts, null jika belum punya email
  member_id:       uuid nullable,        -- FK public.members via DDL
  role:            text NOT NULL,        -- enum INVITE_ROLES
  custom_role_id:  uuid nullable,        -- FK custom_roles via DDL, wajib jika role=custom
  token:           text NOT NULL UNIQUE, -- UUID v4, untuk URL invite
  delivery_method: text DEFAULT 'manual',-- 'manual'|'email' (email via SMTP belum aktif)
  expires_at:      timestamptz NOT NULL, -- +7 hari dari created_at
  accepted_at:     timestamptz nullable, -- null = belum diterima
  created_by:      uuid nullable,        -- FK tenant.users via DDL
  created_at:      timestamptz,
}
```

---

## Permission Matrix

### `lib/permissions.ts`

```typescript
export type Module =
  | "website"   // Posts, pages, kategori, tag
  | "surat"     // Surat keluar, masuk, nota, template, kontak
  | "keuangan"  // Jurnal, akun, pemasukan, pengeluaran, laporan
  | "toko"      // Produk, pesanan, kategori produk
  | "donasi"    // Campaign, transaksi, kategori donasi
  | "event"     // Event, tiket, pendaftaran, check-in
  | "dokumen"   // Dokumen, kategori dokumen
  | "anggota"   // Data anggota, kontak, pendidikan, usaha
  | "media"     // Upload, hapus, metadata
  | "pengurus"; // Officer, divisi

export type Level = "full" | "read" | "own" | "none";
```

**Tabel permission system roles:**

|            | website | surat | keuangan | toko | donasi | event | dokumen | anggota | media | pengurus |
|------------|---------|-------|----------|------|--------|-------|---------|---------|-------|----------|
| owner      | full    | full  | full     | full | full   | full  | full    | full    | full  | full     |
| ketua      | full    | full  | full     | full | full   | full  | full    | full    | full  | full     |
| sekretaris | full    | full  | read     | read | read   | full  | full    | full    | full  | full     |
| bendahara  | none    | own   | full     | read | read   | read  | read    | none    | read  | read     |
| custom     | *dari custom_roles.permissions JSONB*                                             |

**Hierarki level (linear):** `full(3) > read(1) > none(0)`

**`own` adalah special case** — tidak masuk hierarki linear:
- `canAccess(user, mod, "own")` → true jika level adalah `own`, `read`, atau `full`
- `canAccess(user, mod, "read")` → `own` TIDAK cukup (own ≠ bisa lihat semua item)
- `canAccess(user, mod, "full")` → `own` TIDAK cukup

**Scope surat `own` (bendahara + custom:surat=own):**
- Surat yang `created_by` = user ini
- Surat yang ada di `letter_signatures` dengan officer milik user ini

### Helper Functions

```typescript
getPermission(user, module)       → Level
canAccess(user, module, required) → boolean
hasFullAccess(user, module)       → boolean   // full only
hasReadAccess(user, module)       → boolean   // read atau lebih (tidak include own)
isOwnOnly(user, module)           → boolean   // persis level "own"
hasNoAccess(user, module)         → boolean   // level "none"
canConfirmPayment(user, module)   → boolean   // full di module ATAU full di keuangan
getSuratScope(user)               → "all" | "own" | "none"
canManageUsers(user)              → boolean   // hanya owner dan ketua
isDashboardBlocked(user)          → boolean   // role tidak valid
```

---

## `lib/tenant.ts` — TenantAccessResult

`getTenantAccess(slug)` mengembalikan `customRole` otomatis jika `role = "custom"`:

```typescript
export type TenantAccessResult = {
  tenant:     typeof tenants.$inferSelect;
  tenantUser: {
    id:           string;
    role:         string;
    memberId:     string | null;
    customRoleId: string | null;
    customRole:   { permissions: unknown } | null;  // diisi jika role=custom
  };
  userId: string;
};
```

**PENTING:** `access.tenantUser.id` adalah UUID dari `tenant.users` — berbeda dengan `access.userId` yang adalah nanoid dari Better Auth. Selalu pakai `access.tenantUser.id` untuk kolom `confirmed_by`, `created_by`, dll yang bertipe UUID di tabel finance/billing.

---

## User Management UI

### Route Structure

```
app/(dashboard)/[tenant]/settings/
├── users/page.tsx              → server: fetch data + render
├── roles/page.tsx              → CRUD custom roles + permission matrix
└── actions.ts                  → semua server actions

app/(public)/[tenant]/invite/
├── page.tsx                    → halaman terima undangan (PUBLIC, no auth)
├── invite-accept-client.tsx    → form terima (client component)
└── actions.ts                  → acceptInviteAction, registerAndAcceptAction

components/settings/
├── users-manage-client.tsx     → list users + dialog tiga jalur
├── roles-manage-client.tsx     → permission matrix + CRUD custom roles
└── settings-nav.tsx            → item "Pengguna" + "Role Kustom"
```

---

### `/settings/users` — Data yang Di-fetch Server

```
tenant.users
  → JOIN public.user (Better Auth)  → nama, email
  → JOIN public.members             → nama member
  → JOIN custom_roles               → nama custom role

tenant.tenant_invites
  → JOIN public.members             → nama member yang diundang

available members (anggota yang BISA ditambah):
  tenant_memberships WHERE tenant_id = {current}
  → public.members  → nama, memberNumber, betterAuthUserId (hasAccount)
  → public.contacts → email
  → EXCLUDE: sudah ada di tenant.users
  → EXCLUDE: punya invite pending (belum expired + belum accepted)
```

**Guard:** Hanya `canManageUsers()` = owner/ketua. Bukan owner/ketua → redirect ke `/settings/general`.

---

### Dialog "Tambah Pengurus" — Tiga Jalur

Jalur ditentukan secara **otomatis** berdasarkan kondisi anggota yang dipilih — bukan pilihan manual admin.

#### Jalur A — Anggota Sudah Punya Akun Front-end

> Kondisi: `members.betterAuthUserId IS NOT NULL`

```
Anggota : [combobox → tampil badge "Punya akun" di samping nama]

  ┌─ Banner hijau ────────────────────────────────────────────────────┐
  │ 🛡 Anggota ini sudah punya akun. Password yang sama berlaku       │
  │    untuk dashboard.                                               │
  └───────────────────────────────────────────────────────────────────┘

Role    : [Ketua] [Sekretaris] [Bendahara] [Role Kustom]

                         [Batal] [Beri Akses Dashboard]
```

Action: `addExistingAccountAction` → INSERT `tenant.users` dengan `betterAuthUserId` yang diambil dari `public.members`. Tidak ada pembuatan akun baru, tidak ada password baru.

#### Jalur B — Anggota Belum Punya Akun, Kirim Link

> Kondisi: `members.betterAuthUserId IS NULL` + tab "Kirim Link Undangan"

```
  [ Kirim Link Undangan ] [Aktifkan Langsung]
  "Generate link 7 hari. User buka link → isi password sendiri → langsung aktif."

Anggota : [combobox]
Role    : [Ketua] [Sekretaris] [Bendahara] [Role Kustom]

                         [Batal] [Buat Link Undangan]
```

Action: `createInviteAction` → INSERT `tenant_invites` dengan token UUID.
Hasil: banner hijau + link yang bisa di-copy di halaman `/settings/users`.

#### Jalur C — Anggota Belum Punya Akun, Aktifkan Langsung

> Kondisi: `members.betterAuthUserId IS NULL` + tab "Aktifkan Langsung"

```
  [Kirim Link Undangan] [ Aktifkan Langsung ]
  "Admin tentukan password. User bisa langsung login tanpa klik link."

Anggota : [combobox]
Role    : [Ketua] [Sekretaris] [Bendahara] [Role Kustom]

  ┌ Kredensial Akun ──────────────────────────────────────────────────┐
  │ Email:         [ ahmad@gmail.com ]  ← READ-ONLY dari contacts     │
  │                                                                   │
  │ Set Password:  [ ••••••••••   👁 ]                                │
  │ Informasikan password ini ke pengurus. Mereka bisa ubah sendiri.  │
  └───────────────────────────────────────────────────────────────────┘

                         [Batal] [Aktifkan Sekarang]
```

**Jika anggota belum punya email:**
Email field menampilkan warning kuning, field password disabled.

Action: `activateUserDirectAction` → cek email di Better Auth → buat akun baru (atau pakai yang ada jika email sama dari cabang lain) → INSERT `tenant.users` → UPDATE `members.betterAuthUserId`.

---

### `/settings/roles` — Manajemen Role Kustom

**Section 1 — Role Bawaan (read-only, collapsible):**
- Owner, Ketua, Sekretaris, Bendahara
- Expand → permission matrix (radio button read-only)

**Section 2 — Role Kustom (editable):**
- List + badge permission per modul
- Tombol edit (Pencil) + hapus (Trash, dengan guard)
- Tombol "Buat Role"

**Dialog Buat/Edit Role:**
```
Nama Role   : [input teks]
Deskripsi   : [opsional]

┌──────────┬──────┬───────┬─────────┬──────┐
│ Modul    │ Full │ Lihat │ Sendiri │ Tidak│
├──────────┼──────┼───────┼─────────┼──────┤
│ Website  │  ○   │   ○   │    ○    │  ●  │
│ Surat    │  ○   │   ●   │    ○    │  ○  │
│ ...      │                              │
└──────────┴──────┴───────┴─────────┴──────┘
```

Guard hapus: cek ada user dengan `customRoleId = roleId` → tolak dengan pesan error.

---

### Halaman Publik `/[tenant]/invite?token=...`

Route group `(public)` — tidak butuh auth.

| Kondisi | Tampil |
|---------|--------|
| Token tidak ditemukan | "Link Tidak Valid" |
| Invite sudah accepted | "Undangan Sudah Diterima" + link dashboard |
| Invite kadaluarsa | "Undangan Kadaluarsa — minta link baru ke admin" |
| Valid + sudah login + sudah member tenant | "Anda sudah memiliki akses" + link dashboard |
| Valid + sudah login | Tombol "Terima Undangan & Masuk Dashboard" |
| Valid + belum login | Form daftar: nama + email pre-filled + password |

**Form daftar:** `registerAndAcceptAction` → buat akun Better Auth + INSERT `tenant.users` + UPDATE `accepted_at` + UPDATE `members.betterAuthUserId` → redirect `/{slug}/dashboard`.

**Sudah login:** `acceptInviteAction` → INSERT `tenant.users` + UPDATE `accepted_at` → redirect.

---

## Server Actions

### `settings/actions.ts`

```typescript
// ── Invite management ─────────────────────────────────────────────────────────

createInviteAction(slug, data: InviteFormData)
  // data: { memberId, role, customRoleId?, deliveryMethod }
  // Upsert: jika sudah ada invite untuk memberId ini → UPDATE token + expiry
  // Guard: member harus ada di tenant, belum jadi user aktif
  // Email diambil otomatis dari contacts (bukan dari form)
  → { success: true; inviteId: string; token: string }

revokeInviteAction(slug, inviteId)
  → DELETE dari tenant_invites
  → { success: true }

// ── User management ───────────────────────────────────────────────────────────

removeUserAction(slug, userId)
  // Guard: tidak bisa hapus diri sendiri, tidak bisa hapus owner
  → DELETE dari tenant.users (akun Better Auth tetap ada)

updateUserRoleAction(slug, userId, role, customRoleId?)
  // Guard: tidak bisa ubah role owner
  → UPDATE role + customRoleId di tenant.users

// ── Tiga jalur aktivasi ───────────────────────────────────────────────────────

addExistingAccountAction(slug, data: { memberId, role, customRoleId? })
  // JALUR A: untuk anggota yang sudah punya akun front-end
  // 1. Fetch members.betterAuthUserId
  // 2. Guard: betterAuthUserId harus ada, belum di tenant.users
  // 3. INSERT tenant.users dengan betterAuthUserId yang sudah ada
  // Tidak buat akun baru, tidak butuh email/password
  → { success: true; name: string }

activateUserDirectAction(slug, data: ActivateUserData)
  // JALUR C: untuk anggota yang belum punya akun
  // data: { memberId, role, customRoleId?, email, password, name }
  // 1. Cek members.betterAuthUserId: jika sudah ada → INSERT tenant.users langsung (safety fallback)
  // 2. Cek email di public.user: jika ada → pakai userId yang ada (cross-tenant reuse)
  // 3. Jika belum → auth.api.signUpEmail()
  // 4. UPDATE members SET betterAuthUserId WHERE betterAuthUserId IS NULL (idempotent)
  // 5. INSERT tenant.users
  → { success: true; name: string }

// ── Custom roles ──────────────────────────────────────────────────────────────

createCustomRoleAction(slug, data: CustomRoleFormData)
updateCustomRoleAction(slug, roleId, data: CustomRoleFormData)
  // Guard: is_system = true → tolak
deleteCustomRoleAction(slug, roleId)
  // Guard: is_system = true → tolak
  // Guard: ada user dengan customRoleId ini → tolak
```

### `(public)/[tenant]/invite/actions.ts`

```typescript
acceptInviteAction(slug, token)
  // Perlu: user sudah login
  // Verifikasi token valid + belum expired + belum accepted
  // INSERT tenant.users dengan role dari invite
  // UPDATE accepted_at

registerAndAcceptAction(slug, token, name, email, password)
  // Validasi token dulu sebelum buat akun
  // Cek email belum terdaftar di Better Auth
  // auth.api.signUpEmail() → buat akun
  // UPDATE members.betterAuthUserId (jika invite punya memberId)
  // INSERT tenant.users
  // UPDATE accepted_at
```

---

## Alur Lengkap: Jalur A — Anggota Sudah Punya Akun

```
Admin buka /{slug}/settings/users → Klik "Undang Pengurus"
    │
    ▼ Pilih anggota dari combobox
    │   ↳ Badge "Punya akun" muncul di samping nama
    │   ↳ Banner hijau muncul di dialog
    │
    ▼ Pilih role → Klik "Beri Akses Dashboard"
    │
    ▼ addExistingAccountAction()
    │   Fetch members.betterAuthUserId
    │   INSERT tenant.users { betterAuthUserId, role, memberId }
    │
    ▼ Banner hijau: "Akun {nama} berhasil diaktifkan"
    │
    ▼ Anggota bisa langsung login /{slug}/dashboard
      dengan email + password yang sama seperti front-end
```

---

## Alur Lengkap: Jalur B — Link Undangan

```
Admin buka /{slug}/settings/users → Klik "Undang Pengurus"
    │
    ▼ Pilih anggota (belum punya akun) → tab "Kirim Link Undangan"
    │   Pilih role → Klik "Buat Link Undangan"
    │
    ▼ createInviteAction()
    │   INSERT tenant_invites { memberId, email, role, token=UUID, expiresAt=+7hari }
    │
    ▼ Banner hijau: link + tombol copy
    │   Format: {APP_URL}/{slug}/invite?token={uuid}
    │
    ▼ Admin kirim link manual (WA / email)
    │
    ▼ Pengurus buka link → /{slug}/invite?token={uuid}
    │
    ├── [Belum login] → Form daftar
    │     nama + email pre-filled dari data anggota
    │     isi password → registerAndAcceptAction()
    │     UPDATE members.betterAuthUserId
    │     INSERT tenant.users + mark accepted
    │     redirect /{slug}/dashboard
    │
    └── [Sudah login] → Tombol "Terima Undangan"
          acceptInviteAction()
          INSERT tenant.users + mark accepted
          redirect /{slug}/dashboard
```

---

## Alur Lengkap: Jalur C — Aktifkan Langsung

```
Admin buka /{slug}/settings/users → Klik "Undang Pengurus"
    │
    ▼ Pilih anggota (belum punya akun) → tab "Aktifkan Langsung"
    │   Email muncul read-only (dari public.contacts)
    │   Isi password → Klik "Aktifkan Sekarang"
    │
    ▼ activateUserDirectAction()
    │   Safety check: members.betterAuthUserId sudah ada?
    │   ├── YA  → INSERT tenant.users langsung (edge case — harusnya pakai Jalur A)
    │   └── TIDAK →
    │       Cek email di public.user:
    │       ├── Ada → pakai userId yang ada (pengurus dari cabang lain)
    │       └── Belum → auth.api.signUpEmail() → buat akun baru
    │       UPDATE members SET betterAuthUserId WHERE betterAuthUserId IS NULL
    │       INSERT tenant.users
    │
    ▼ Banner hijau: "Akun {nama} berhasil diaktifkan"
    │
    ▼ Pengurus langsung bisa login /{slug}/dashboard
      dengan email dan password yang sudah di-set
```

---

## Skenario Edge Case

### Pengurus di dua cabang
Satu orang bisa jadi pengurus di IKPM Jogja DAN IKPM Jakarta. Akun Better Auth satu, tapi ada dua baris di `tenant_jogja.users` dan `tenant_jakarta.users`. Saat aktivasi: email yang sama di Better Auth → pakai akun yang ada.

### Owner awal tanpa memberId
Owner dibuat programatically saat `registerAction` (`memberId = null`). Tidak bisa diundang melalui flow invite. Tidak bisa dihapus via `removeUserAction`.

### Re-invite
Jika admin buat undangan untuk anggota yang sudah punya invite lama (expired/belum diterima):
- `createInviteAction` melakukan **upsert** — UPDATE baris yang ada dengan token baru + expiresAt baru + reset `acceptedAt = null`
- Tidak ada duplikat baris

### Hapus akses pengguna
`removeUserAction` hanya hapus dari `tenant.users`. Akun Better Auth tetap ada. Data yang pernah dibuat (surat, dll) tetap ada, `created_by` tidak berubah. Mantan pengurus bisa di-invite kembali.

### Anggota dengan akun front-end diundang via link (edge case)
Anggota yang sudah daftar di front-end (`members.betterAuthUserId` terisi) seharusnya menggunakan Jalur A. Jika terlanjur menggunakan Jalur B (link), halaman `/invite` mendeteksi user sudah login → tampil tombol "Terima Undangan" → `acceptInviteAction` → INSERT `tenant.users` dengan betterAuthUserId dari session. Hasilnya sama.

---

## Keputusan Teknis

| Keputusan | Alasan |
|-----------|--------|
| Jalur A (existing account) tidak butuh password | Satu akun Better Auth berlaku di dua konteks — arsitektur yang benar dari awal |
| Email dari data anggota, read-only | Satu sumber kebenaran, tidak ada typo, konsisten dengan data anggota |
| Token = UUID v4, bukan JWT | Lebih simpel, bisa di-revoke langsung via DELETE/UPDATE |
| Invite tidak dihapus setelah accepted | Audit trail — bisa lihat siapa diundang kapan oleh siapa |
| `activateUserDirect` reuse akun jika email sudah ada | Cross-tenant pengurus tidak perlu buat akun baru |
| `activateUserDirect` safety check `betterAuthUserId` | Cegah dua akun untuk satu orang jika admin masuk jalur yang salah |
| `canManageUsers` = owner + ketua saja | Sekretaris/bendahara tidak perlu kelola user |
| Hapus user: hanya dari `tenant.users` | Akun tetap valid di tenant lain, data historis utuh |
| `addExistingAccountAction` terpisah dari `activateUserDirect` | Dua konsep berbeda: beri akses vs buat akun. Jangan campur |

---

## Lessons Learned

### Bug: `hasAccount` tidak terdeteksi di `settings/users`

Fix `hasAccount` sudah ada di `pengurus/actions.ts` tapi tidak di `settings/users/page.tsx`. Akibatnya dialog selalu menampilkan form email+password meski anggota sudah punya akun front-end.

**Fix:** Tambah `betterAuthUserId` ke query `availableMembers`, pass `hasAccount: boolean` ke client.

**Aturan:** Setiap perubahan alur aktivasi pengurus harus dicek di **dua tempat**: `settings/users` dan `pengurus/`. Keduanya punya flow yang serupa tapi file terpisah.

### Bug: Dua akun untuk satu orang di `activateUserDirectAction`

Jika anggota sudah punya `members.betterAuthUserId` tapi admin menggunakan jalur "Aktifkan Langsung" dengan email berbeda:
1. Email baru belum ada di Better Auth → `signUpEmail` buat akun baru dengan id berbeda
2. `UPDATE members SET betterAuthUserId WHERE betterAuthUserId IS NULL` → skip (sudah ada)
3. `INSERT tenant.users SET betterAuthUserId = {id_baru}` → masuk

Hasil: `members.betterAuthUserId` (front-end) dan `tenant.users.betterAuthUserId` (dashboard) berbeda. Satu orang, dua akun, tidak terhubung.

**Fix:** Cek `members.betterAuthUserId` di awal `activateUserDirectAction`. Jika sudah ada → INSERT `tenant.users` langsung tanpa menyentuh Better Auth. Ini juga jadi safety fallback untuk kasus admin yang seharusnya menggunakan Jalur A tapi terlanjur masuk Jalur C.

### Prinsip: jalur ditentukan otomatis, bukan pilihan admin

Toggle "Kirim Link / Aktifkan Langsung" hanya muncul ketika anggota **belum punya akun**. Jika sudah punya akun, UI langsung menampilkan Jalur A tanpa toggle. Admin tidak perlu tahu kondisi teknis akun anggota — UI yang menentukan jalur yang tepat.

---

## Files yang Dibuat / Diubah

### Awal (implementasi pertama)

```
packages/db/src/schema/tenant/
├── custom-roles.ts          (baru)
└── tenant-invites.ts        (baru)

apps/web/app/(dashboard)/[tenant]/settings/
├── users/page.tsx           (baru)
└── roles/page.tsx           (baru)

apps/web/app/(public)/[tenant]/invite/
├── page.tsx                 (baru)
├── invite-accept-client.tsx (baru)
└── actions.ts               (baru)

apps/web/components/settings/
├── users-manage-client.tsx  (baru)
└── roles-manage-client.tsx  (baru)

apps/web/lib/permissions.ts  (baru)
```

### Update arsitektur tiga jalur + bug fixes

```
apps/web/app/(dashboard)/[tenant]/settings/users/page.tsx
  → availableMembers tambah kolom betterAuthUserId
  → pass hasAccount: boolean ke client

apps/web/app/(dashboard)/[tenant]/settings/actions.ts
  → TAMBAH addExistingAccountAction (Jalur A)
  → FIX   activateUserDirectAction: safety check betterAuthUserId dulu

apps/web/components/settings/users-manage-client.tsx
  → AvailableMember type tambah hasAccount: boolean
  → Dialog: tiga jalur berdasarkan hasAccount
  → Combobox: badge "Punya akun" untuk anggota yang sudah terdaftar
  → RolePicker() di-extract sebagai inner component (dipakai ketiga jalur)
```

---

## TODO / Belum Diimplementasikan

- [ ] **Kirim email otomatis** saat `deliveryMethod = "email"` — perlu SMTP aktif dari `/settings/email`
- [ ] **Update role pengguna aktif** via dropdown di list users — `updateUserRoleAction` sudah ada, UI belum
- [ ] **Notifikasi login pertama** — email selamat datang setelah invite diterima
- [ ] **Reset password self-service** — pengurus minta reset password sendiri (Better Auth sudah support)
