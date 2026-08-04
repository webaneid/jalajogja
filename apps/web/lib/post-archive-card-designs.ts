// Registry desain kartu untuk halaman arsip /post (search + filter kategori bersatu). Pola sama
// product-archive-card-designs.ts — cuma 1 desain sekarang, nambah desain baru = tambah 1 ID di
// sini + 1 komponen render + 1 case di dispatcher post-archive-cards.tsx.

export const POST_ARCHIVE_CARD_DESIGN_IDS = ["1"] as const;
export type PostArchiveCardDesignId = typeof POST_ARCHIVE_CARD_DESIGN_IDS[number];

export const POST_ARCHIVE_CARD_DESIGNS: Record<PostArchiveCardDesignId, { label: string; description: string }> = {
  "1": {
    label:       "Editorial Mix",
    description: "Post pertama Overlay, 4 berikutnya Klasik (grid 2 kolom), sisanya List. Resep sama di setiap halaman. Mobile: semua jadi List kecuali tiap kelipatan 6 tetap/jadi Overlay untuk variasi.",
  },
};
