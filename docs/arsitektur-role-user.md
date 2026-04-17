# Arsitektur Role & User Management

> Status: **SELESAI — Sudah Diimplementasikan**
> Dokumen ini mencerminkan implementasi aktual, bukan proposal.

---

## Prinsip Desain

1. **Pengurus wajib berasal dari anggota** — tidak ada pengurus yang tidak terdaftar di `public.members`
2. **`tenant.users` = akses dashboard saja** — anggota biasa yang belum jadi pengurus tidak ada di tabel ini
3. **Satu akun Better Auth, dua konteks** — akun yang sama dipakai untuk dashboard (sebagai pengurus dengan role tertentu) dan portal frontend (sebagai anggota)
4. **Email dari data anggota** — email untuk aktivasi diambil otomatis dari `public.contacts` via `members.contactId`, bukan diketik manual oleh admin
5. **Dua metode aktivasi** — admin bisa pilih: kirim link undangan (user set password sendiri) atau aktifkan langsung (admin set password)

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
    │ contact_id ─────────────────────────────────── → public.contacts
                                                        (email, phone, whatsapp)
```

**Anggota biasa (belum jadi pengurus):**
```
public.members ← ada di sini
    ↓ via tenant_memberships
tenant_{slug}  ← terdaftar di cabang ini

    ✗ TIDAK ada di tenant.users   (tidak punya akses dashboard)
    ✗ TIDAK ada di tenant.officers (belum ditunjuk sebagai pengurus)
```

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

Menyimpan role kustom yang dibuat admin. Permissions disimpan sebagai flat JSONB.

```typescript
// packages/db/src/schema/tenant/custom-roles.ts

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

```typescript
// packages/db/src/schema/tenant/tenant-invites.ts

export const INVITE_ROLES = ["ketua", "sekretaris", "bendahara", "custom"] as const;
// Owner tidak bisa diundang — hanya ada 1, dibuat saat register tenant

{
  id:              uuid PRIMARY KEY,
  email:           text nullable,        -- dari public.contacts, null jika member belum punya email
  member_id:       uuid nullable,        -- FK public.members via DDL
  role:            text NOT NULL,        -- enum INVITE_ROLES
  custom_role_id:  uuid nullable,        -- FK custom_roles via DDL, wajib jika role=custom
  token:           text NOT NULL UNIQUE, -- UUID v4, untuk URL invite
  delivery_method: text DEFAULT 'manual',-- 'manual'|'email' (email = via SMTP, belum aktif)
  expires_at:      timestamptz NOT NULL, -- +7 hari dari created_at
  accepted_at:     timestamptz nullable, -- null = belum diterima, diisi saat accept
  created_by:      uuid nullable,        -- FK tenant.users via DDL
  created_at:      timestamptz,
}

// Index: idx_tenant_invites_token, idx_tenant_invites_email, idx_tenant_invites_member
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

|           | website | surat | keuangan | toko | donasi | event | dokumen | anggota | media | pengurus |
|-----------|---------|-------|----------|------|--------|-------|---------|---------|-------|----------|
| owner     | full    | full  | full     | full | full   | full  | full    | full    | full  | full     |
| ketua     | full    | full  | full     | full | full   | full  | full    | full    | full  | full     |
| sekretaris| full    | full  | read     | read | read   | full  | full    | full    | full  | full     |
| bendahara | none    | own   | full     | read | read   | read  | read    | none    | read  | read     |
| custom    | *dari custom_roles.permissions JSONB*                                            |

**Hierarki level (linear):** `full(3) > read(1) > none(0)`

**`own` adalah special case** — tidak masuk hierarki linear:
- `canAccess(user, mod, "own")` → true jika level adalah own/read/full (bukan none)
- `canAccess(user, mod, "read")` → `own` TIDAK cukup (own ≠ bisa lihat semua item)
- `canAccess(user, mod, "full")` → `own` TIDAK cukup

**Scope surat `own` (bendahara + custom:surat=own):**
- Surat yang `created_by` = user ini
- Surat yang ada di `letter_signatures` dengan officer milik user ini (butuh TTD)

### Helper Functions

```typescript
getPermission(user, module)           → Level
canAccess(user, module, required)     → boolean
hasFullAccess(user, module)           → boolean  // full only
hasReadAccess(user, module)           → boolean  // read atau lebih (tidak include own)
isOwnOnly(user, module)               → boolean  // persis level "own"
hasNoAccess(user, module)             → boolean  // level "none"
canConfirmPayment(user, module)       → boolean  // full di module ATAU full di keuangan
getSuratScope(user)                   → "all" | "own" | "none"
canManageUsers(user)                  → boolean  // hanya owner dan ketua
isDashboardBlocked(user)              → boolean  // role tidak valid
```

---

## `lib/tenant.ts` — TenantAccessResult

`getTenantAccess(slug)` sekarang mengembalikan `customRole` secara otomatis jika `role = "custom"`:

```typescript
export type TenantAccessResult = {
  tenant:     typeof tenants.$inferSelect;
  tenantUser: {
    id:           string;
    role:         string;
    memberId:     string | null;
    customRoleId: string | null;
    customRole:   { permissions: unknown } | null;  // ← diisi jika role=custom
  };
  userId: string;
};
```

Flow di `getTenantAccess`:
1. Query `tenant.users` → dapat `role`, `customRoleId`, `memberId`
2. Jika `customRoleId != null` → query `custom_roles` → dapat `permissions`
3. Return `tenantUser` dengan `customRole` diisi

---

## User Management UI

### Route Structure

```
app/(dashboard)/[tenant]/settings/
├── users/page.tsx              → list users + invite management
├── roles/page.tsx              → CRUD custom roles + permission matrix
└── actions.ts                  → semua server actions (append ke file existing)

app/(public)/[tenant]/invite/
├── page.tsx                    → halaman terima undangan (PUBLIC, no auth)
├── invite-accept-client.tsx    → form terima (client component)
└── actions.ts                  → acceptInviteAction, registerAndAcceptAction

components/settings/
├── users-manage-client.tsx     → list users + invite dialog (dua metode)
├── roles-manage-client.tsx     → permission matrix + CRUD custom roles
└── settings-nav.tsx            → tambah "Pengguna" + "Role Kustom"
```

---

### `/settings/users` — Manajemen Pengguna

**Ditampilkan:**
- Daftar pengguna aktif (nama, email, role badge, tombol hapus)
- Daftar undangan tertunda (nama anggota, link, expire date, tombol batalkan)
- Riwayat undangan (diterima / kadaluarsa)
- Tombol "Tambah Pengurus"

**Guard:** Hanya owner/ketua (`canManageUsers()`) yang bisa akses. Jika bukan, redirect ke `/settings/general`.

**Data yang di-fetch di server:**
```
tenant.users
  → JOIN public.user (Better Auth) → nama, email
  → JOIN public.members            → nama member
  → JOIN custom_roles              → nama custom role
tenant.tenant_invites
  → JOIN public.members            → nama member yang diundang
available members:
  tenant_memberships
  → public.members + public.contacts  → nama, memberNumber, EMAIL
  → filter: belum ada di tenant.users DAN tidak punya invite pending aktif
```

---

### Dialog "Tambah Pengurus" — Dua Metode

Toggle di bagian atas dialog memilih metode:

#### Metode 1 — Kirim Link Undangan

```
[  Kirim Link Undangan  ] [Aktifkan Langsung]

"Generate link 7 hari. User buka link → isi password sendiri → langsung aktif."

Anggota : [combobox — nama + email kecil di bawah]
Role    : [Ketua] [Sekretaris] [Bendahara] [Role Kustom]
(jika Role Kustom dipilih: combobox pilih dari custom_roles)

                   [Batal] [Buat Link Undangan]
```

Setelah berhasil → banner hijau dengan link + tombol copy di halaman `/settings/users`.
Link format: `{NEXT_PUBLIC_APP_URL}/{slug}/invite?token={uuid}`

#### Metode 2 — Aktifkan Langsung

```
[Kirim Link Undangan] [  Aktifkan Langsung  ]

"Admin tentukan email dan password. User bisa langsung login tanpa klik link."

Anggota : [combobox — nama + email kecil di bawah]
Role    : [Ketua] [Sekretaris] [Bendahara] [Role Kustom]

┌ Kredensial Akun ─────────────────────────────┐
│ Email:       [ ahmad@gmail.com ]  ← READ-ONLY │
│              dari data anggota (public.contacts)│
│                                               │
│ Set Password: [ ••••••••••   👁 ]             │
│ Informasikan password ini ke pengurus.        │
│ Mereka bisa ubah sendiri nanti.               │
└───────────────────────────────────────────────┘

                   [Batal] [Aktifkan Sekarang]
```

**Jika anggota belum punya email:**
```
Email: [ ⚠ Anggota ini belum punya email — isi dulu di data anggota. ]
Password: [disabled]
```

---

### `/settings/roles` — Manajemen Role

**Ditampilkan:**

**Section 1 — Role Bawaan (read-only, collapsible):**
- Owner, Ketua, Sekretaris, Bendahara
- Expand → tampilkan permission matrix (radio button read-only)

**Section 2 — Role Kustom (editable):**
- List role kustom + ringkasan permission (badge per modul)
- Tombol edit (Pencil) + hapus (Trash)
- Tombol "Buat Role"

**Dialog Buat/Edit Role:**
```
Nama Role   : [input teks]
Deskripsi   : [input teks, opsional]

Hak Akses per Modul:
┌──────────┬──────┬───────┬─────────┬──────┐
│ Modul    │ Full │ Lihat │ Sendiri │ Tidak│
├──────────┼──────┼───────┼─────────┼──────┤
│ Website  │  ○   │   ○   │    ○    │  ●  │
│ Surat    │  ○   │   ●   │    ○    │  ○  │
│ Keuangan │  ○   │   ○   │    ○    │  ●  │
│ ...      │                              │
└──────────┴──────┴───────┴─────────┴──────┘

              [Batal] [Buat Role / Simpan Perubahan]
```

**Guard saat hapus:** Cek dulu apakah ada user dengan `customRoleId = roleId`. Jika ada → tolak dengan pesan error.

---

### Halaman Publik `/[tenant]/invite?token=...`

**Aksesibel tanpa login.** Route group `(public)` di luar `(dashboard)`.

**State yang ditangani:**

| Kondisi | Tampil |
|---------|--------|
| Token tidak ditemukan | "Link Tidak Valid" |
| Invite sudah accepted | "Undangan Sudah Diterima" + link dashboard |
| Invite kadaluarsa | "Undangan Kadaluarsa — minta link baru" |
| Valid + user sudah login + sudah member tenant | "Anda sudah memiliki akses" + link dashboard |
| Valid + user sudah login | Tombol "Terima Undangan & Masuk Dashboard" |
| Valid + user belum login | Form daftar akun (nama, email, password) |

**Jika belum login — form daftar:**
- `prefillName` dari `public.members`
- `prefillEmail` dari `public.contacts`
- Setelah submit → `registerAndAcceptAction` → buat akun Better Auth + insert `tenant.users` + mark accepted → redirect dashboard

**Jika sudah login:**
- Tampilkan "Login sebagai {nama} ({email})"
- Tombol "Terima Undangan" → `acceptInviteAction` → insert `tenant.users` + mark accepted → redirect dashboard

---

## Server Actions

### `settings/actions.ts` (append)

```typescript
// Invite management
createInviteAction(slug, data: InviteFormData)
  → { success: true; inviteId: string; token: string }
  → Upsert: jika sudah ada invite untuk memberId ini, update token + expiry

revokeInviteAction(slug, inviteId)
  → DELETE dari tenant_invites

removeUserAction(slug, userId)
  → Guard: tidak bisa hapus diri sendiri, tidak bisa hapus owner
  → DELETE dari tenant.users

updateUserRoleAction(slug, userId, role, customRoleId?)
  → Guard: tidak bisa ubah role owner
  → UPDATE role + customRoleId di tenant.users

// Custom roles
createCustomRoleAction(slug, data: CustomRoleFormData)
updateCustomRoleAction(slug, roleId, data: CustomRoleFormData)
  → Guard: is_system = true → tolak
deleteCustomRoleAction(slug, roleId)
  → Guard: is_system = true → tolak
  → Guard: ada user dengan customRoleId ini → tolak

// Aktivasi langsung
activateUserDirectAction(slug, data: ActivateUserData)
  → Email dari data: bukan dari form, diambil server dari member.contactId → contacts.email
  → Jika email sudah ada di Better Auth → pakai akun yang ada (cross-tenant pengurus)
  → Jika belum → auth.api.signUpEmail() → buat akun baru
  → INSERT tenant.users
```

### `(public)/[tenant]/invite/actions.ts`

```typescript
acceptInviteAction(slug, token)
  → Perlu: user sudah login (getCurrentSession())
  → Verifikasi token valid + belum expired + belum accepted
  → INSERT tenant.users dengan role dari invite
  → UPDATE accepted_at di tenant_invites

registerAndAcceptAction(slug, token, name, email, password)
  → Validasi token dulu sebelum buat akun
  → Cek email belum terdaftar (reject jika sudah ada)
  → auth.api.signUpEmail() → buat akun
  → INSERT tenant.users
  → UPDATE accepted_at
```

---

## Alur Lengkap: Metode Link Undangan

```
Admin buka /{slug}/settings/users
    │
    ▼ Klik "Tambah Pengurus" → pilih tab "Kirim Link Undangan"
    │
    ├── Pilih anggota dari combobox (hanya yang belum jadi user/invite pending)
    ├── Pilih role (ketua/sekretaris/bendahara/custom)
    ├── Klik "Buat Link Undangan"
    │
    ▼ createInviteAction()
    │   INSERT tenant_invites { memberId, email, role, token=UUID, expiresAt=+7hari }
    │
    ▼ Banner hijau: link undangan + tombol copy
    │   Format: {APP_URL}/{slug}/invite?token={uuid}
    │
    ▼ Admin kirim link manual (WA / email pribadi)
    │
    ▼ Pengurus buka link → /[slug]/invite?token={uuid}
    │
    ├── [Belum punya akun] → Form daftar akun
    │     nama + email pre-filled dari data anggota
    │     isi password → registerAndAcceptAction()
    │     buat akun Better Auth + tenant.users + mark accepted
    │     redirect /{slug}/dashboard
    │
    └── [Sudah punya akun dan login] → Tombol "Terima Undangan"
          acceptInviteAction()
          INSERT tenant.users + mark accepted
          redirect /{slug}/dashboard
```

---

## Alur Lengkap: Metode Aktifkan Langsung

```
Admin buka /{slug}/settings/users
    │
    ▼ Klik "Tambah Pengurus" → pilih tab "Aktifkan Langsung"
    │
    ├── Pilih anggota → email otomatis muncul (dari public.contacts)
    │   Jika tidak punya email → warning kuning, form disabled
    ├── Pilih role
    ├── Set password (min 8 karakter)
    ├── Klik "Aktifkan Sekarang"
    │
    ▼ activateUserDirectAction()
    │   Cek email di public.user (Better Auth):
    │   ├── Sudah ada → pakai userId yang ada (pengurus dari cabang lain)
    │   └── Belum ada → auth.api.signUpEmail() → buat akun baru
    │   INSERT tenant.users { betterAuthUserId, role, memberId }
    │
    ▼ Banner hijau: "Akun {nama} berhasil diaktifkan"
    │   "Pengguna sekarang bisa login dengan email dan password yang sudah diset."
    │
    ▼ Pengurus langsung bisa login via /login
      email = dari data anggota
      password = yang di-set admin
      (bisa ubah password sendiri nanti)
```

---

## Skenario Edge Case

### Pengurus di dua cabang
Satu orang (`public.members`) bisa jadi pengurus di cabang IKPM Jogja DAN IKPM Jakarta.
Akun Better Auth satu, tapi punya dua baris di `tenant_jogja.users` dan `tenant_jakarta.users`.
Saat aktivasi langsung: jika email sudah ada di Better Auth → pakai akun yang ada, tidak buat akun baru.

### Owner awal tanpa memberId
Owner yang dibuat saat register tenant (`memberId = null`) masih valid.
Tidak bisa diundang karena owner dibuat programatically di `registerAction`, bukan lewat invite flow.

### Re-invite
Jika admin klik "Undang" untuk anggota yang sudah punya invite lama (expired/belum diterima):
- `createInviteAction` melakukan **upsert** — UPDATE baris yang ada dengan token baru + expiresAt baru
- Baris lama tidak duplikat
- `acceptedAt` di-reset ke null agar invite aktif kembali

### Hapus akses pengguna
`removeUserAction` hanya hapus dari `tenant.users` — akun Better Auth tetap ada.
Pengurus yang dihapus aksesnya bisa di-invite kembali.
Data yang mereka buat (surat, dll) tetap ada, `created_by` tidak berubah.

---

## Keputusan Teknis

| Keputusan | Alasan |
|-----------|--------|
| Email dari data anggota, bukan form admin | Data konsisten, tidak ada typo email, satu sumber kebenaran |
| Token = UUID v4, bukan JWT | Lebih simpel, bisa di-revoke langsung via DELETE/UPDATE |
| Invite tidak dihapus setelah accepted | Audit trail — bisa lihat siapa yang diundang kapan oleh siapa |
| `activateUserDirect` reuse akun jika email sudah ada | Pengurus lintas cabang tidak perlu buat akun baru |
| `canManageUsers` = owner + ketua saja | Sekretaris/bendahara tidak perlu kelola user |
| Hapus user: hanya dari tenant.users, bukan Better Auth | Akun bisa dipakai di tenant lain, data historis tetap utuh |

---

## Files yang Diubah / Dibuat

### Dibuat Baru
```
packages/db/src/schema/tenant/
├── custom-roles.ts
└── tenant-invites.ts

apps/web/app/(dashboard)/[tenant]/settings/
├── users/page.tsx
└── roles/page.tsx

apps/web/app/(public)/[tenant]/invite/
├── page.tsx
├── invite-accept-client.tsx
└── actions.ts

apps/web/components/settings/
├── users-manage-client.tsx
└── roles-manage-client.tsx

apps/web/lib/
└── permissions.ts
```

### Diubah
```
packages/db/src/schema/tenant/
├── users.ts              → TENANT_ROLES enum baru, tambah customRoleId
└── index.ts              → import + export custom-roles, tenant-invites

packages/db/src/helpers/
└── create-tenant-schema.ts → DDL baru: custom_roles (step 2), users (step 3 update),
                              tenant_invites, index baru

apps/web/lib/
└── tenant.ts             → TenantAccessResult tambah customRole field,
                            getTenantAccess() fetch custom_roles jika customRoleId ada

apps/web/app/(dashboard)/[tenant]/settings/
└── actions.ts            → append: invite actions + custom role actions +
                            activateUserDirectAction

apps/web/components/settings/
└── settings-nav.tsx      → tambah "Pengguna" (Users) + "Role Kustom" (ShieldCheck)

apps/web/app/(dashboard)/[tenant]/
└── [semua modul]/actions.ts   → ganti ["owner","admin"].includes(role)
                                  dengan canAccess() / hasFullAccess() / canManageUsers()
```

---

## TODO / Belum Diimplementasikan

- [ ] **Kirim email otomatis** saat `deliveryMethod = "email"` — perlu SMTP dari `/settings/email`
- [ ] **Update role pengguna aktif** via dropdown di list users (`updateUserRoleAction` sudah ada, UI belum)
- [ ] **Notifikasi login pertama** — email selamat datang setelah invite diterima
- [ ] **Portal frontend (Phase 2)** — konteks anggota untuk halaman publik, menggunakan Better Auth session yang sama tapi tanpa lookup `tenant.users`
- [ ] **Reset password** — pengurus minta reset password sendiri (Better Auth sudah support via email verification)
