// Registry desain kartu untuk halaman arsip /campaign + "Campaign Lainnya" di detail campaign.
// Pola sama dengan HERO_SECTION_DESIGNS / MODULE_SECTION_DESIGNS — sekarang cuma 1 desain,
// nambah desain baru = tambah 1 ID di sini + 1 komponen render, tidak perlu ubah struktur lain.
//
// ATURAN WAJIB untuk SEMUA desain di registry ini (lihat docs/arsitektur-donasi.md § 14l):
// grid di desktop (md: ke atas), list di mobile (di bawah md:) — bukan pilihan per-desain,
// tapi baseline yang harus diikuti desain manapun yang ditambah ke sini nanti.

export const CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS = ["1"] as const;
export type CampaignArchiveCardDesignId = typeof CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS[number];

export const CAMPAIGN_ARCHIVE_CARD_DESIGNS: Record<CampaignArchiveCardDesignId, { label: string; description: string }> = {
  "1": {
    label:       "Klasik",
    description: "Grid 3 kolom di desktop, List satu kolom di mobile.",
  },
};
