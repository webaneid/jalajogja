// ─── Types ────────────────────────────────────────────────────────────────────

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

// Urutan hierarki linear
// "own" adalah special case — tidak masuk hierarki linear
const LEVEL_ORDER: Record<Exclude<Level, "own">, number> = {
  full: 3,
  read: 1,
  none: 0,
};

export type TenantUserForPermission = {
  role: string;
  customRole?: { permissions: unknown } | null;
};

// ─── Permission Matrix (System Roles) ────────────────────────────────────────
//
// Levels:
//   full  = CRUD + admin actions (publish, delete, confirmPayment, bulk)
//   read  = view list + detail saja, tidak bisa create/edit/delete
//   own   = special: buat sendiri + lihat/edit milik sendiri
//           Untuk surat: buat + lihat (surat yang dibuat sendiri
//           ATAU surat yang perlu TTD user ini via letter_signatures)
//   none  = tidak ada akses sama sekali

const SYSTEM_PERMISSIONS: Record<string, Record<Module, Level>> = {
  owner: {
    website:  "full", surat:    "full", keuangan: "full",
    toko:     "full", donasi:   "full", event:    "full",
    dokumen:  "full", anggota:  "full", media:    "full", pengurus: "full",
  },
  ketua: {
    website:  "full", surat:    "full", keuangan: "full",
    toko:     "full", donasi:   "full", event:    "full",
    dokumen:  "full", anggota:  "full", media:    "full", pengurus: "full",
  },
  sekretaris: {
    website:  "full", surat:    "full", keuangan: "read",
    toko:     "read", donasi:   "read", event:    "full",
    dokumen:  "full", anggota:  "full", media:    "full", pengurus: "full",
  },
  bendahara: {
    website:  "none", surat:    "own",  keuangan: "full",
    toko:     "read", donasi:   "read", event:    "read",
    dokumen:  "read", anggota:  "none", media:    "read", pengurus: "read",
  },
};

// ─── Core: getPermission ──────────────────────────────────────────────────────

/**
 * Ambil level akses user untuk modul tertentu.
 * System role → dari SYSTEM_PERMISSIONS.
 * Custom role → dari custom_roles.permissions JSONB.
 */
export function getPermission(user: TenantUserForPermission, module: Module): Level {
  if (user.role in SYSTEM_PERMISSIONS) {
    return SYSTEM_PERMISSIONS[user.role]![module] ?? "none";
  }

  if (user.role === "custom" && user.customRole) {
    const perms = user.customRole.permissions as Record<string, string> | null;
    const level = perms?.[module];
    if (level && (["full", "read", "own", "none"] as string[]).includes(level)) {
      return level as Level;
    }
  }

  return "none";
}

// ─── Core: canAccess ─────────────────────────────────────────────────────────

/**
 * Cek apakah user punya akses minimal `required` untuk modul.
 *
 * Hierarki linear: full(3) > read(1) > none(0)
 *
 * "own" adalah special case:
 *   canAccess(user, mod, "own")  → true jika level adalah own/read/full (bukan none)
 *   canAccess(user, mod, "read") → "own" TIDAK cukup (own ≠ read semua item)
 *   canAccess(user, mod, "full") → "own" TIDAK cukup
 *
 * Contoh:
 *   bendahara (surat: "own") + required "own"  → true (bisa buat + lihat milik sendiri)
 *   bendahara (surat: "own") + required "read" → false (tidak bisa lihat semua surat)
 *   sekretaris (surat: "full") + required "own" → true (full mencakup own)
 */
export function canAccess(
  user: TenantUserForPermission,
  module: Module,
  required: Level,
): boolean {
  const level = getPermission(user, module);

  if (level === "none") return false;
  if (level === required) return true;

  // "own" required: semua level selain "none" memenuhi
  if (required === "own") return true;

  // user punya "own" tapi required "read" atau "full" → tidak cukup
  if (level === "own") return false;

  // Linear comparison: full(3) vs read(1)
  return (
    LEVEL_ORDER[level as Exclude<Level, "own">] >=
    LEVEL_ORDER[required as Exclude<Level, "own">]
  );
}

// ─── Convenience Functions ────────────────────────────────────────────────────

/** Full access: CRUD + semua admin actions */
export const hasFullAccess = (u: TenantUserForPermission, m: Module): boolean =>
  canAccess(u, m, "full");

/** Read access: minimal bisa lihat list + detail */
export const hasReadAccess = (u: TenantUserForPermission, m: Module): boolean =>
  canAccess(u, m, "read");

/** Own-only access: level akses persis "own" — buat + lihat milik sendiri */
export const isOwnOnly = (u: TenantUserForPermission, m: Module): boolean =>
  getPermission(u, m) === "own";

/** Tidak punya akses apapun ke modul ini */
export const hasNoAccess = (u: TenantUserForPermission, m: Module): boolean =>
  getPermission(u, m) === "none";

/**
 * Konfirmasi pembayaran — cross-cutting concern.
 * Bisa confirm payment jika:
 *   (a) punya full access ke modul sumber (owner/ketua/sekretaris untuk event dll)
 *   (b) punya full access ke keuangan (bendahara + custom dengan keuangan:full)
 */
export const canConfirmPayment = (u: TenantUserForPermission, module: Module): boolean =>
  hasFullAccess(u, module) || hasFullAccess(u, "keuangan");

/**
 * Scope surat untuk query filter.
 * "all"  → lihat semua surat organisasi (owner, ketua, sekretaris, custom:full/read)
 * "own"  → hanya surat yang dibuat sendiri + surat yang perlu TTD via letter_signatures
 * "none" → tidak bisa akses halaman surat sama sekali
 */
export function getSuratScope(user: TenantUserForPermission): "all" | "own" | "none" {
  const level = getPermission(user, "surat");
  if (level === "none") return "none";
  if (level === "own")  return "own";
  return "all"; // full atau read → lihat semua
}

/** User harus diblok dari dashboard (tidak ada di tenant.users, atau role tidak valid) */
export const isDashboardBlocked = (u: TenantUserForPermission): boolean =>
  !["owner", "ketua", "sekretaris", "bendahara", "custom"].includes(u.role);

/** User bisa manage users dan roles (Settings → Users, Settings → Roles) */
export const canManageUsers = (u: TenantUserForPermission): boolean =>
  ["owner", "ketua"].includes(u.role);
