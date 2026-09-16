// Badge status untuk /app/{slug}/members — SATU badge prioritas per baris, bukan ditumpuk.
// Lihat docs/arsitektur-gabung-forum.md § 3 (forum) dan § 8 (cabang/marhalah). Pure function,
// tidak ada import DB — aman dipakai langsung dari Server Component manapun.

export type ForumStatus = "pending" | "active" | "suspended" | "rejected";

export type StatusBadge = { label: string; colorClass: string };

// Forum: satu badge per baris. "Pending Claim" MENGGANTIKAN "Aktif" (bukan berdampingan)
// kalau forum_status='active' TAPI member belum pernah klaim akun (belum bisa login) —
// definisi persis dikunci user 2026-09-17: "aktif secara keanggotaan, tp pending karena
// blm set password."
export function resolveForumStatusBadge(
  forumStatus: ForumStatus | null,
  hasAccount:  boolean,
): StatusBadge {
  switch (forumStatus) {
    case "pending":
      return { label: "Menunggu Persetujuan", colorClass: "bg-amber-100 text-amber-700" };
    case "active":
      return hasAccount
        ? { label: "Aktif", colorClass: "bg-green-100 text-green-700" }
        : { label: "Pending Claim", colorClass: "bg-amber-100 text-amber-700" };
    case "suspended":
      return { label: "Ditangguhkan", colorClass: "bg-orange-100 text-orange-700" };
    case "rejected":
      return { label: "Ditolak", colorClass: "bg-red-100 text-red-700" };
    default:
      // Defensif — baris forum seharusnya selalu punya forumStatus terisi (dijamin di titik
      // insert). Kalau kosong (data legacy/anomali), perlakukan sebagai "Menunggu Persetujuan"
      // daripada crash/undefined.
      return { label: "Menunggu Persetujuan", colorClass: "bg-amber-100 text-amber-700" };
  }
}

// Badge "Akun" terpisah (kecil, redup) — muncul kalau member belum klaim akun DAN badge Status
// utama BELUM sudah mewakilinya (forum "Pending Claim" sudah mewakili, jangan render dobel).
export function shouldShowAccountBadge(
  isForumTenant: boolean,
  forumStatus:   ForumStatus | null,
  hasAccount:    boolean,
): boolean {
  if (hasAccount) return false;
  if (isForumTenant && forumStatus === "active") return false; // sudah terwakili "Pending Claim"
  return true;
}
