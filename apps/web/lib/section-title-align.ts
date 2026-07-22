// Posisi judul untuk section berbasis `<PostsSectionTitle>` (Post/Produk/Campaign/Event) — HANYA
// 2 opsi (beda dari Keunggulan/CTA yang punya left/center/right). "center" memindahkan tombol
// "Lihat Semua" ke baris terpisah di bawah judul (bukan tetap sejajar di kanan seperti "left").
export const SECTION_TITLE_ALIGN_IDS = ["left", "center"] as const;
export type SectionTitleAlign = typeof SECTION_TITLE_ALIGN_IDS[number];

export const SECTION_TITLE_ALIGN_LABELS: Record<SectionTitleAlign, string> = {
  left:   "Kiri (tombol sejajar kanan)",
  center: "Tengah (tombol di bawah)",
};
