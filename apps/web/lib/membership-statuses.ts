// Status keanggotaan yang TAMPIL di halaman publik (direktori, statistik, sitemap, landing, kutipan).
// Keputusan user 2026-10-10: alumni BUKAN anggota; non-aktif tetap boleh tampil. Hak anggota (harga,
// tiket, mitra, produsen) memakai aturan lain yang lebih ketat: lib/tenant-membership.server.ts.
// Lihat docs/arsitektur-keanggotaan.md § "Definisi anggota per konteks". Client-safe (konstanta murni).
export const PUBLIC_DIRECTORY_MEMBER_STATUSES = ["active", "inactive"] as const;
