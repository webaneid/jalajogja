# Arsitektur Role & User Management

> Status: **SELESAI — Implementasi aktual per commit 95c4dd6**
> Dokumen ini mencerminkan kode aktual. Selalu verifikasi ke kode sebelum menyimpulkan status fitur.

---

## Prinsip Desain

1. **Pengurus wajib berasal dari anggota** — tidak ada pengurus yang tidak terdaftar di `public.members`
2. **`tenant.users` = akses dashboard saja** — anggota biasa tidak ada di tabel ini
3. **Satu akun Better Auth, dua konteks** — password yang sama berlaku untuk front-end dan dashboard
4. **Email dari data anggota** — email untuk aktivasi diambil dari `public.contacts` via `members.contactId`, tidak pernah dari input admin
5. **Tiga lapisan perlindungan akses** — session check, tenant check, dan module permission check di setiap modul
6. **Custom role diterapkan di tiga tempat** — sidebar (filter menu), module layout/page (server redirect), dan server action (mutation guard)

---

## Gambaran Relasi Tabel

```
public.user (Better Auth)
    │ id = better_auth_user_id
    ▼
tenant_{slug}.users          ← hanya pengurus + owner
    │ role: owner|ketua|sekretaris|bendahara|custom
    │ member_id ─────────────────────────── → public.members
    │ custom_role_id ───────────────────── → tenant.custom_roles (null kecuali role="custom")
    ▼
public.members               ← identitas global lintas semua cabang
    │ better_auth_user_id ──────────────── → public.user (akun front-end, nullable)
    │ contact_id ───────────────────────── → public.contacts (email, phone, whatsapp)
```

**Kolom `members.better_auth_user_id` menentukan jalur aktivasi:**

| Kondisi | Nilai | Jalur aktivasi yang dipakai |
|---------|-------|------------------------------|
| Sudah daftar di front-end | Terisi | Jalur A — beri akses, tidak perlu password baru |
| Belum punya akun | `null` | Jalur B — link undangan, atau Jalur C — langsung |

---

## Schema

### `tenant_{slug}.users`

```typescript
// packages/db/src/schema/tenant/users.ts
export const TENANT_ROLES = [
  "owner",      // 1 per tenant, full access + kelola pengguna
  "ketua",      // full access semua modul
  "sekretaris", // website/surat/dokumen/anggota/media/pengurus/event full, keuangan/toko/donasi read
  "bendahara",  // keuangan full, surat own, toko/donasi/event/dokumen/media/pengurus read, website/anggota none
  "custom",     // permissions dari custom_roles.permissions JSONB
] as const;
```

Kolom: `id` (uuid PK), `betterAuthUserId` (text UNIQUE), `role` (text), `customRoleId` (uuid nullable), `memberId` (uuid nullable), `createdAt`, `updatedAt`.

`memberId` null hanya untuk owner awal yang dibuat saat register tenant — semua pengurus aktif wajib terhubung ke `public.members`.

**DB Constraint:**
```sql
CONSTRAINT users_custom_role_check CHECK (
  (role IN ('owner','ketua','sekretaris','bendahara') AND custom_role_id IS NULL)
  OR (role = 'custom' AND custom_role_id IS NOT NULL)
)
```

---

### `tenant_{slug}.custom_roles`

```typescript
{
  id:          uuid PRIMARY KEY,
  name:        text NOT NULL,
  description: text nullable,
  permissions: jsonb NOT NULL DEFAULT '{}',
  // Format: { "website": "none", "surat": "own", "keuangan": "full", ... }
  // Key: Module, Value: Level ("full"|"read"|"own"|"none")
  is_system:   boolean DEFAULT false,
  created_at:  timestamptz,
}
```

---

### `tenant_{slug}.tenant_invites`

Dipakai hanya untuk Jalur B (link undangan). Jalur A dan C tidak menggunakan tabel ini.

```typescript
{
  id:              uuid PRIMARY KEY,
  email:           text nullable,        // dari public.contacts, null jika belum punya email
  member_id:       uuid nullable,        // FK public.members
  role:            text NOT NULL,        // "ketua"|"sekretaris"|"bendahara"|"custom"
  custom_role_id:  uuid nullable,        // wajib jika role="custom"
  token:           text NOT NULL UNIQUE, // UUID v4
  delivery_method: text DEFAULT 'manual',
  expires_at:      timestamptz NOT NULL, // +7 hari dari created_at
  accepted_at:     timestamptz nullable, // null = belum diterima
  created_by:      uuid nullable,        // FK tenant.users
  created_at:      timestamptz,
}
```

Catatan: baris tetap ada setelah accepted (audit trail). Upsert: jika member sudah punya invite lama → UPDATE token + expiry, bukan INSERT baru.

---

## Permission System

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

### Permission Matrix (System Roles)

|            | website | surat | keuangan | toko | donasi | event | dokumen | anggota | media | pengurus |
|------------|---------|-------|----------|------|--------|-------|---------|---------|-------|----------|
| owner      | full    | full  | full     | full | full   | full  | full    | full    | full  | full     |
| ketua      | full    | full  | full     | full | full   | full  | full    | full    | full  | full     |
| sekretaris | full    | full  | read     | read | read   | full  | full    | full    | full  | full     |
| bendahara  | none    | own   | full     | read | read   | read  | read    | none    | read  | read     |
| custom     | *dari `custom_roles.permissions` JSONB*                                           |

### Hierarki Level

**Linear:** `full(3) > read(1) > none(0)`

**`own` adalah special case** — tidak masuk hierarki linear:
- `canAccess(user, mod, "own")` → `true` jika level adalah `own`, `read`, atau `full`
- `canAccess(user, mod, "read")` → `own` TIDAK cukup (own ≠ lihat semua)
- `canAccess(user, mod, "full")` → `own` TIDAK cukup

### Helper Functions

```typescript
// Core
getPermission(user, module)           → Level
canAccess(user, module, required)     → boolean

// Convenience
hasFullAccess(u, m)    → canAccess(u, m, "full")   // full only
hasReadAccess(u, m)    → canAccess(u, m, "read")   // read atau lebih, tidak include own
isOwnOnly(u, m)        → getPermission(u, m) === "own"
hasNoAccess(u, m)      → getPermission(u, m) === "none"

// Cross-cutting
canConfirmPayment(u, module)   → hasFullAccess(u, module) || hasFullAccess(u, "keuangan")
getSuratScope(u)               → "all" | "own" | "none"
  // "all": full/read, "own": own level, "none": none

// Management
canManageUsers(u)      → ["owner","ketua"].includes(u.role)
isDashboardBlocked(u)  → !["owner","ketua","sekretaris","bendahara","custom"].includes(u.role)
```

---

## `lib/tenant.ts` — TenantAccessResult

```typescript
export type TenantAccessResult = {
  tenant: typeof tenants.$inferSelect;
  tenantUser: {
    id:           string;    // UUID dari tenant.users — BUKAN userId dari Better Auth
    role:         string;
    memberId:     string | null;
    customRoleId: string | null;
    customRole:   { permissions: unknown } | null; // diisi jika role="custom"
  };
  userId: string;            // nanoid dari Better Auth (public.user.id)
};
```

**PENTING:** `access.tenantUser.id` ≠ `access.userId`. Yang pertama UUID dari `tenant.users`, yang kedua nanoid dari Better Auth. Kolom bertipe UUID di tabel finance (`confirmed_by`, `created_by`, dll) wajib pakai `access.tenantUser.id`.

**Flow `getTenantAccess`:**
1. `getCurrentSession()` → ambil session dari cookie
2. Query `public.tenants` → cek tenant ada dan aktif
3. Query `tenant.users WHERE betterAuthUserId = session.user.id` → dapat role + customRoleId
4. Jika `customRoleId != null` → query `custom_roles` → dapat permissions
5. Return `{ tenant, tenantUser: { ...user, customRole }, userId }`

---

## Tiga Lapisan Perlindungan Akses

### Lapisan 1 — Session (Middleware + Layout)

`TenantLayout` (`app/(dashboard)/[tenant]/layout.tsx`) memastikan user login:

```typescript
const session = await getCurrentSession();
if (!session?.user) redirect(`/login?redirect=/${slug}/dashboard`);

const access = await getTenantAccess(slug);
if (!access) redirect("/dashboard-redirect");
```

### Lapisan 2 — Module Guard (Server-Side)

Setiap modul punya guard di layout atau page-nya. Redirect ke `/{slug}/dashboard` jika tidak punya akses minimum.

**7 modul dengan layout:**

```typescript
// website/layout.tsx
if (!hasReadAccess(access.tenantUser, "website")) redirect(`/${slug}/dashboard`);

// letters/layout.tsx — level minimum "own" agar bendahara tetap bisa akses
if (!canAccess(access.tenantUser, "surat", "own")) redirect(`/${slug}/dashboard`);

// finance/layout.tsx
if (!hasReadAccess(access.tenantUser, "keuangan")) redirect(`/${slug}/dashboard`);

// toko/layout.tsx
if (!hasReadAccess(access.tenantUser, "toko")) redirect(`/${slug}/dashboard`);

// donasi/layout.tsx
if (!hasReadAccess(access.tenantUser, "donasi")) redirect(`/${slug}/dashboard`);

// event/layout.tsx
if (!hasReadAccess(access.tenantUser, "event")) redirect(`/${slug}/dashboard`);

// dokumen/layout.tsx
if (!hasReadAccess(access.tenantUser, "dokumen")) redirect(`/${slug}/dashboard`);
```

**3 modul tanpa layout (guard di page utama):**

```typescript
// members/page.tsx
if (!hasReadAccess(access.tenantUser, "anggota")) redirect(`/${slug}/dashboard`);

// media/page.tsx
if (!hasReadAccess(access.tenantUser, "media")) redirect(`/${slug}/dashboard`);

// pengurus/page.tsx
if (!hasReadAccess(access.tenantUser, "pengurus")) redirect(`/${slug}/dashboard`);
```

### Lapisan 3 — Action Guard (Mutation)

Server actions di setiap modul memvalidasi level sebelum mutation:

```typescript
// Contoh di letters/actions.ts
if (!hasFullAccess(access.tenantUser, "surat")) {
  return { success: false, error: "Akses ditolak." };
}
```

---

## Navigasi Sidebar

### Komponen

```
TenantLayout (server)
  ├── Sidebar (server) ← menerima tenantUser
  │     └── SidebarNav (client) ← menerima tenantUser, filter menu
  └── MobileSidebar (client) ← menerima tenantUser, render Sidebar di dalam drawer
```

### SidebarNav — Filter Menu

`components/dashboard/sidebar-nav.tsx`

```typescript
const NAV_ITEMS = [
  { label: "Dashboard",  path: "dashboard",  module: null       }, // selalu tampil
  { label: "Anggota",    path: "members",    module: "anggota"  },
  { label: "Pengurus",   path: "pengurus",   module: "pengurus" },
  { label: "Akun",       path: "accounts",   module: "anggota"  },
  { label: "Media",      path: "media",      module: "media"    },
  { label: "Website",    path: "website",    module: "website"  },
  { label: "Surat",      path: "letters",    module: "surat"    }, // ← level "own"
  { label: "Keuangan",   path: "finance",    module: "keuangan" },
  { label: "Donasi",     path: "donasi",     module: "donasi"   },
  { label: "Event",      path: "event",      module: "event"    },
  { label: "Dokumen",    path: "dokumen",    module: "dokumen"  },
  { label: "Toko",       path: "toko",       module: "toko"     },
  { label: "Pengaturan", path: "settings",   module: null       }, // selalu tampil
];

// Filter logic:
const visibleItems = NAV_ITEMS.filter((item) => {
  if (!item.module) return true;
  if (item.module === "surat") return canAccess(tenantUser, "surat", "own");
  return canAccess(tenantUser, item.module, "read");
});
```

**Kenapa Surat pakai `"own"`:** Bendahara punya `surat: "own"` — menu Surat tetap tampil tapi hanya bisa akses surat milik sendiri. `canAccess(user, "surat", "read")` akan mengembalikan `false` untuk level `own`, sehingga menu akan tersembunyi padahal seharusnya tidak.

**Kenapa Pengaturan selalu tampil:** Semua role bisa akses settings general (nama org, tampilan, dll). User management di settings hanya bisa diakses owner/ketua — difilter di dalam halaman settings itu sendiri.

---

## User Management UI

### Route Structure

```
app/(dashboard)/[tenant]/settings/
├── users/page.tsx              → server: fetch data, render UI
├── roles/page.tsx              → server: fetch custom roles, render UI
└── actions.ts                  → semua server actions

app/(public)/[tenant]/invite/
├── page.tsx                    → server: validasi token, render status
├── invite-accept-client.tsx    → client: form terima undangan
└── actions.ts                  → acceptInviteAction, registerAndAcceptAction

components/settings/
├── users-manage-client.tsx     → list users + dialog tiga jalur
└── roles-manage-client.tsx     → list system roles + CRUD custom roles
```

---

### `/settings/users` — Data yang Di-fetch

```typescript
// 1. Pengguna aktif
tenant.users → JOIN public.user (name, email) → JOIN public.members (name) → JOIN custom_roles (name)

// 2. Undangan
tenant.tenant_invites → JOIN public.members (name)

// 3. Anggota yang bisa ditambah (availableMembers)
tenant_memberships WHERE tenantId = current
  → public.members (name, memberNumber, betterAuthUserId)
  → public.contacts (email)
  → EXCLUDE: sudah ada di tenant.users
  → EXCLUDE: punya invite pending (belum expired + belum accepted)
  → hasAccount: !!members.betterAuthUserId (dipakai untuk deteksi jalur A)

// 4. Custom roles (untuk dropdown pilih role)
tenant.custom_roles ORDER BY name
```

---

### Dialog "Tambah Pengurus" — Tiga Jalur

Jalur ditentukan **otomatis** berdasarkan `hasAccount` dari member yang dipilih. Admin tidak perlu tahu kondisi teknis akun anggota.

#### Jalur A — Anggota sudah punya akun front-end (`hasAccount = true`)

```
Anggota : [combobox → badge "Punya akun" di samping nama]

  ┌─ Banner hijau ────────────────────────────────────────────────────┐
  │ 🛡 Anggota ini sudah punya akun.                                  │
  │    Password yang sama berlaku untuk dashboard.                    │
  └───────────────────────────────────────────────────────────────────┘

Role    : [Ketua] [Sekretaris] [Bendahara] [Role Kustom]

                         [Batal] [Beri Akses Dashboard]
```

Action: `addExistingAccountAction` → fetch `members.betterAuthUserId` → INSERT `tenant.users`. Tidak ada pembuatan akun baru.

#### Jalur B — Kirim Link Undangan (`hasAccount = false`)

```
  [ Kirim Link Undangan ] [Aktifkan Langsung]

Anggota : [combobox]
Role    : [Ketua] [Sekretaris] [Bendahara] [Role Kustom]

                         [Batal] [Buat Link Undangan]
```

Action: `createInviteAction` → INSERT `tenant_invites` dengan token UUID, expired 7 hari.
Hasil: banner hijau + link copy di halaman. Format: `{APP_URL}/{slug}/invite?token={uuid}`.

#### Jalur C — Aktifkan Langsung (`hasAccount = false`)

```
  [Kirim Link Undangan] [ Aktifkan Langsung ]

Anggota : [combobox]
Role    : [Ketua] [Sekretaris] [Bendahara] [Role Kustom]

  ┌ Kredensial Akun ──────────────────────────────────────────────────┐
  │ Email:         [ ahmad@gmail.com ]  ← READ-ONLY dari contacts     │
  │ Set Password:  [ ••••••••••   👁 ]  ← min 8 karakter             │
  └───────────────────────────────────────────────────────────────────┘

                         [Batal] [Aktifkan Sekarang]
```

Jika member belum punya email: field email warning kuning, password disabled.

---

### `/settings/roles` — Manajemen Role Kustom

**Section 1 — Role Bawaan (read-only, collapsible):**
Owner, Ketua, Sekretaris, Bendahara — expand untuk lihat permission matrix.

**Section 2 — Role Kustom:**
List + badge permission per modul. Tombol edit + hapus. Tombol "Buat Role".

**Dialog Buat/Edit Role:**
```
Nama Role   : [input]
Deskripsi   : [input, opsional]

┌──────────┬──────┬───────┬─────────┬──────┐
│ Modul    │ Full │ Lihat │ Sendiri │ Tidak│
├──────────┼──────┼───────┼─────────┼──────┤
│ Website  │  ○   │   ○   │    ○    │  ●  │
│ Surat    │  ○   │   ●   │    ○    │  ○  │
│ ...      │                              │
└──────────┴──────┴───────┴─────────┴──────┘
```

**Reset form:** Komponen `RoleDialog` menggunakan `key={editingRole?.id ?? "new"}` sehingga React me-remount komponen setiap kali berganti antara role berbeda atau antara create/edit. State form selalu bersih.

---

## Server Actions

### `settings/actions.ts`

```typescript
// ── Types ─────────────────────────────────────────────────────────────────────

type StrictActionResult = { success: true } | { success: false; error: string };
export type CustomRoleResult = { success: true; id: string } | { success: false; error: string };
export type InviteResult = { success: true; inviteId: string; token: string } | { success: false; error: string };
export type ActivateResult = { success: true; name: string } | { success: false; error: string };

export type InviteFormData = {
  memberId: string;
  role: "ketua" | "sekretaris" | "bendahara" | "custom";
  customRoleId?: string;
  deliveryMethod: string;
};

export type CustomRoleFormData = {
  name: string;
  description?: string;
  permissions: Record<string, string>;
};

export type ActivateUserData = {
  memberId: string;
  role: "ketua" | "sekretaris" | "bendahara" | "custom";
  customRoleId?: string;
  email: string;
  password: string;
  name: string;
};

export type AddExistingData = {
  memberId: string;
  role: "ketua" | "sekretaris" | "bendahara" | "custom";
  customRoleId?: string;
};

// ── Custom Role CRUD ──────────────────────────────────────────────────────────

createCustomRoleAction(slug, data: CustomRoleFormData) → CustomRoleResult
  // INSERT custom_roles, .returning({ id })
  // Return: { success: true, id } → client menggunakan ID asli dari DB

updateCustomRoleAction(slug, roleId, data) → StrictActionResult
  // Guard: is_system = true → tolak
  // UPDATE custom_roles

deleteCustomRoleAction(slug, roleId) → StrictActionResult
  // Guard: is_system = true → tolak
  // Guard: ada user dengan customRoleId ini → tolak (cegah orphan)

// ── Invite management ─────────────────────────────────────────────────────────

createInviteAction(slug, data: InviteFormData) → InviteResult
  // Validasi: member ada di tenant, belum jadi user aktif
  // Upsert: jika sudah ada invite untuk memberId → UPDATE token + expiry
  // Email diambil otomatis dari contacts, bukan dari form

revokeInviteAction(slug, inviteId) → StrictActionResult
  // DELETE dari tenant_invites

// ── User management ───────────────────────────────────────────────────────────

removeUserAction(slug, userId) → StrictActionResult
  // Guard: tidak bisa hapus diri sendiri, tidak bisa hapus owner
  // DELETE dari tenant.users (akun Better Auth tetap ada)

updateUserRoleAction(slug, userId, role, customRoleId?) → StrictActionResult
  // Guard: tidak bisa ubah role owner

// ── Tiga jalur aktivasi ───────────────────────────────────────────────────────

addExistingAccountAction(slug, data: AddExistingData) → ActivateResult
  // JALUR A — anggota sudah punya akun front-end
  // 1. Validate member ada di tenant
  // 2. Fetch members.betterAuthUserId → error jika null
  // 3. Guard: belum ada di tenant.users
  // 4. INSERT tenant.users dengan betterAuthUserId yang ada
  // Tidak buat akun baru, tidak butuh password

activateUserDirectAction(slug, data: ActivateUserData) → ActivateResult
  // JALUR C — anggota belum punya akun
  // Safety check: cek members.betterAuthUserId dulu
  //   → jika sudah ada: INSERT tenant.users langsung (fallback)
  // Jika belum ada betterAuthUserId:
  //   → cek email di public.user: ada → pakai akun lama (cross-tenant)
  //   → belum ada → auth.api.signUpEmail() → buat akun baru
  // UPDATE members SET betterAuthUserId WHERE betterAuthUserId IS NULL (idempotent)
  // INSERT tenant.users
```

### `(public)/[tenant]/invite/actions.ts`

```typescript
acceptInviteAction(slug, token)
  // Perlu user sudah login
  // Validasi token: valid, belum expired, belum accepted
  // INSERT tenant.users + UPDATE accepted_at

registerAndAcceptAction(slug, token, name, email, password)
  // Validasi token sebelum buat akun
  // Cek email belum terdaftar di Better Auth
  // auth.api.signUpEmail() → buat akun
  // UPDATE members.betterAuthUserId (jika invite punya memberId)
  // INSERT tenant.users + UPDATE accepted_at
```

---

## Alur Lengkap

### Jalur A — Anggota sudah punya akun

```
Admin klik "Undang Pengurus"
→ Pilih anggota → badge "Punya akun" muncul
→ Banner hijau: "Password yang sama berlaku untuk dashboard"
→ Pilih role → klik "Beri Akses Dashboard"
→ addExistingAccountAction()
    fetch members.betterAuthUserId
    INSERT tenant.users { betterAuthUserId, role, memberId }
→ Banner: "Akun {nama} berhasil diaktifkan"
→ Anggota langsung bisa login /{slug}/dashboard
  (email + password sama dengan akun front-end)
```

### Jalur B — Link Undangan

```
Admin klik "Undang Pengurus"
→ Pilih anggota (belum punya akun) → toggle "Kirim Link Undangan"
→ Pilih role → klik "Buat Link Undangan"
→ createInviteAction()
    INSERT tenant_invites { token=UUID, expiresAt=+7hari, ... }
→ Banner: link + tombol copy
→ Admin kirim link manual

→ Anggota buka /{slug}/invite?token={uuid}
    ├── Belum login → form daftar (nama/email pre-filled dari DB)
    │     isi password → registerAndAcceptAction()
    │     UPDATE members.betterAuthUserId
    │     INSERT tenant.users + mark accepted
    │     redirect /{slug}/dashboard
    └── Sudah login → tombol "Terima Undangan"
          acceptInviteAction()
          INSERT tenant.users + mark accepted
          redirect /{slug}/dashboard
```

### Jalur C — Aktifkan Langsung

```
Admin klik "Undang Pengurus"
→ Pilih anggota (belum punya akun) → toggle "Aktifkan Langsung"
→ Email otomatis muncul dari contacts (read-only)
→ Isi password (min 8 karakter) → klik "Aktifkan Sekarang"
→ activateUserDirectAction()
    Safety: cek members.betterAuthUserId → ada? → INSERT langsung
    Tidak ada:
      cek email di public.user → ada → pakai akun lama
      tidak ada → auth.api.signUpEmail() → buat akun baru
    UPDATE members.betterAuthUserId WHERE IS NULL
    INSERT tenant.users
→ Banner: "Akun {nama} berhasil diaktifkan"
→ Anggota bisa langsung login dengan password yang di-set admin
```

---

## Halaman Publik `/[tenant]/invite?token=...`

Route group `(public)` — tidak butuh auth.

**Status yang ditangani:**

| Kondisi | Tampil |
|---------|--------|
| Token tidak ada di URL | `notFound()` |
| Tenant tidak ada / tidak aktif | `notFound()` |
| Token tidak ditemukan di DB | "Link Tidak Valid" |
| Invite sudah `accepted_at` terisi | "Undangan Sudah Diterima" + link dashboard |
| Invite kadaluarsa | "Undangan Kadaluarsa" |
| Valid + user login + sudah di tenant.users | "Anda sudah memiliki akses" + link dashboard |
| Valid + user sudah login | `InviteAcceptClient` — tombol "Terima Undangan" |
| Valid + belum login | `InviteAcceptClient` — form daftar dengan nama/email pre-filled |

**Info yang ditampilkan:**
- Nama organisasi
- Nama member yang diundang (dari `public.members`)
- Role (label bahasa Indonesia atau nama custom role)
- Tanggal kadaluarsa

---

## Skenario Edge Case

### Pengurus di dua cabang
Satu `public.members` bisa jadi pengurus di IKPM Jogja dan IKPM Jakarta. Akun Better Auth satu. Saat aktivasi Jalur C: email yang sama sudah ada di Better Auth → pakai akun lama, tidak buat baru.

### Owner awal tanpa memberId
`memberId = null` — hanya untuk owner yang dibuat saat `registerAction`. Tidak bisa diundang melalui invite flow. Tidak bisa dihapus via `removeUserAction`.

### Re-invite
Admin undang anggota yang sudah punya invite lama (expired/belum diterima) → `createInviteAction` melakukan upsert: UPDATE token + expiresAt + reset `acceptedAt = null`. Tidak ada duplikat baris.

### Hapus akses
`removeUserAction` hanya hapus dari `tenant.users`. Akun Better Auth tetap ada. Pengurus bisa di-invite kembali. Data yang pernah dibuat tidak terhapus.

### Anggota `betterAuthUserId` ada tapi admin pakai Jalur C
`activateUserDirectAction` cek `members.betterAuthUserId` di awal. Jika sudah ada → INSERT `tenant.users` langsung dengan ID yang ada. Tidak buat akun ganda.

---

## Keputusan Teknis

| Keputusan | Alasan |
|-----------|--------|
| Jalur A tidak butuh password | Satu akun Better Auth, dua konteks — arsitektur yang benar |
| Jalur otomatis berdasarkan `hasAccount` | Admin tidak perlu tahu kondisi teknis akun anggota |
| Email dari contacts, read-only | Satu sumber kebenaran, mencegah typo |
| Token UUID bukan JWT | Lebih simpel, bisa di-revoke langsung |
| Invite tidak dihapus setelah accepted | Audit trail |
| `createCustomRoleAction` return `id` | Client butuh ID asli untuk optimistic update yang benar |
| `RoleDialog` pakai `key` prop | Force re-mount = state form selalu reset — lebih simpel dari `useEffect` |
| Guard di module layout, bukan hanya action | Mencegah akses halaman via URL langsung, bukan hanya mencegah mutation |
| Surat guard pakai `"own"`, bukan `"read"` | Bendahara (level `own`) tetap bisa akses modul surat |
| `canManageUsers` = owner + ketua saja | Sekretaris/bendahara tidak perlu kelola user |
| `access.tenantUser.id` untuk UUID DB cols | Berbeda dari `access.userId` (nanoid) — salah satunya menyebabkan PostgreSQL error |

---

## Files yang Diubah / Dibuat

### Schema & DB (tidak ada perubahan setelah initial implementation)

```
packages/db/src/schema/tenant/
├── users.ts                  → TENANT_ROLES enum + customRoleId column
├── custom-roles.ts           → tabel custom_roles
└── tenant-invites.ts         → tabel tenant_invites
```

### Application Layer

```
apps/web/lib/
├── permissions.ts            → Module, Level, semua helper functions
└── tenant.ts                 → TenantAccessResult + getTenantAccess()

apps/web/app/(dashboard)/[tenant]/
├── layout.tsx                → pass tenantUser ke Sidebar + MobileSidebar
├── settings/
│   ├── users/page.tsx        → fetch availableMembers + hasAccount
│   ├── roles/page.tsx        → fetch + render RolesManageClient
│   └── actions.ts            → semua actions (invite, activate, custom roles)
├── website/layout.tsx        → guard: hasReadAccess("website")
├── letters/layout.tsx        → guard: canAccess("surat","own")
├── finance/layout.tsx        → guard: hasReadAccess("keuangan")
├── toko/layout.tsx           → guard: hasReadAccess("toko")
├── donasi/layout.tsx         → guard: hasReadAccess("donasi")
├── event/layout.tsx          → guard: hasReadAccess("event")
├── dokumen/layout.tsx        → guard: hasReadAccess("dokumen")
├── members/page.tsx          → guard: hasReadAccess("anggota")
├── media/page.tsx            → guard: hasReadAccess("media")
└── pengurus/page.tsx         → guard: hasReadAccess("pengurus")

apps/web/app/(public)/[tenant]/invite/
├── page.tsx                  → status checks + InviteAcceptClient
├── invite-accept-client.tsx  → form terima / daftar
└── actions.ts                → acceptInviteAction, registerAndAcceptAction

apps/web/components/dashboard/
├── sidebar.tsx               → terima + teruskan tenantUser
├── sidebar-nav.tsx           → filter NAV_ITEMS berdasarkan canAccess()
└── mobile-sidebar.tsx        → terima + teruskan tenantUser ke Sidebar

apps/web/components/settings/
├── users-manage-client.tsx   → list users + dialog tiga jalur (A/B/C)
└── roles-manage-client.tsx   → system roles (readonly) + custom roles CRUD
```

---

## TODO / Yang Belum Diimplementasikan

- [ ] **SMTP email otomatis untuk invite** — saat `deliveryMethod = "email"` (saat ini link di-copy manual)
- [ ] **Update role pengguna aktif dari UI** — `updateUserRoleAction` sudah ada di actions, UI dropdown belum ada di list users
- [ ] **Notifikasi login pertama** — email selamat datang setelah invite diterima / akun diaktifkan
- [ ] **Reset password self-service** — pengurus minta reset password sendiri (Better Auth endpoint sudah ada)
