export type QuoteSectionData = {
  quoteText?:       string;   // Teks kutipan utama
  authorName?:      string;   // Nama pemberi quote (mis. "Sigit Ariansyah")
  authorTitle?:     string;   // Profesi / Jabatan (mis. "Sutradara Film 'Jejak Langkah 2 Ulama'")
  authorSub?:       string;   // Sub-label / Alumni (mis. "Alumni Gontor 1990")
  authorAvatarUrl?: string;   // URL foto pemberi quote (MediaPicker)
  statLabel?:       string;   // Keterangan di bawah angka (opsional, fallback ke dynamic orgName)
  ctaLabel?:        string;   // Label link CTA (opsional, fallback ke "Direktori {orgName} →")
  ctaUrl?:          string;   // Target URL link CTA (opsional, fallback ke "/{slug}/anggota")
};

export const QUOTE_SECTION_DESIGN_IDS = ["1"] as const;
export type QuoteSectionDesignId = typeof QUOTE_SECTION_DESIGN_IDS[number];

export type QuoteSectionDesignMeta = {
  label:       string;
  description: string;
};

export const QUOTE_SECTION_DESIGNS: Record<QuoteSectionDesignId, QuoteSectionDesignMeta> = {
  "1": {
    label:       "Quote & Statistik Anggota",
    description: "Tampilan kutipan tokoh/anggota di sisi kiri dan counter statistik anggota terdaftar real-time dari database di sisi kanan.",
  },
};
