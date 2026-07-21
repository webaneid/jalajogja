// Section CTA — tetap "Design 1" tunggal (bukan registry multi-desain seperti Hero/Modules),
// sub-opsi hidup sebagai flat enum field di data, pola sama funfactStyle di hero-section-designs.ts.
// Arsitektur lengkap: docs/arsitektur-cta-section.md

export const CTA_TEXT_ALIGN_IDS = ["left", "center", "right"] as const;
export type CtaTextAlign = typeof CTA_TEXT_ALIGN_IDS[number];
export const CTA_TEXT_ALIGN_LABELS: Record<CtaTextAlign, string> = {
  left:   "Kiri (default)",
  center: "Tengah",
  right:  "Kanan",
};

export const CTA_BACKGROUND_IDS = ["secondary", "primary"] as const;
export type CtaBackground = typeof CTA_BACKGROUND_IDS[number];
export const CTA_BACKGROUND_LABELS: Record<CtaBackground, string> = {
  secondary: "Warna Sekunder (default)",
  primary:   "Warna Utama",
};

export const CTA_WIDTH_IDS = ["full", "boxed"] as const;
export type CtaWidth = typeof CTA_WIDTH_IDS[number];
export const CTA_WIDTH_LABELS: Record<CtaWidth, string> = {
  full:  "Lebar Penuh (default)",
  boxed: "Terkotak (dalam container)",
};

export const CTA_BUTTON_POSITION_IDS = ["below", "beside"] as const;
export type CtaButtonPosition = typeof CTA_BUTTON_POSITION_IDS[number];
export const CTA_BUTTON_POSITION_LABELS: Record<CtaButtonPosition, string> = {
  below:  "Di Bawah Teks (default)",
  beside: "Di Samping Teks",
};

export type CtaSectionData = {
  title?:             string;
  subtitle?:          string;
  ctaLabel?:          string;
  ctaUrl?:            string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?:   string;
  textAlign?:         CtaTextAlign;
  background?:        CtaBackground;
  width?:             CtaWidth;
  boxedRadius?:       boolean;
  buttonPosition?:    CtaButtonPosition;
};
