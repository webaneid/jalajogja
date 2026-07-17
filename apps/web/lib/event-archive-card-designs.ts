// Registry desain kartu untuk halaman arsip /agenda. Pola sama campaign-archive-card-designs.ts
// (lihat docs/arsitektur-donasi.md § 14m) — cuma 1 desain sekarang, nambah desain baru = tambah
// 1 ID di sini + 1 komponen render, tidak perlu ubah struktur lain.
//
// ATURAN WAJIB untuk SEMUA desain di registry ini (lihat docs/arsitektur-event.md):
// grid di desktop (md: ke atas), list di mobile (di bawah md:) — bukan pilihan per-desain,
// tapi baseline yang harus diikuti desain manapun yang ditambah ke sini nanti.

export const EVENT_ARCHIVE_CARD_DESIGN_IDS = ["1"] as const;
export type EventArchiveCardDesignId = typeof EVENT_ARCHIVE_CARD_DESIGN_IDS[number];

export const EVENT_ARCHIVE_CARD_DESIGNS: Record<EventArchiveCardDesignId, { label: string; description: string }> = {
  "1": {
    label:       "Klasik",
    description: "Grid 3 kolom di desktop, List satu kolom di mobile.",
  },
};
