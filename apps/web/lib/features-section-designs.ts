// Section Keunggulan/Layanan (features) — tetap "Design 1" tunggal, sub-opsi flat field,
// pola sama cta-section-designs.ts. Arsitektur lengkap: docs/arsitektur-keunggulan-section.md

export const FEATURES_TITLE_ALIGN_IDS = ["left", "center", "right"] as const;
export type FeaturesTitleAlign = typeof FEATURES_TITLE_ALIGN_IDS[number];
export const FEATURES_TITLE_ALIGN_LABELS: Record<FeaturesTitleAlign, string> = {
  left:   "Kiri",
  center: "Tengah (default)",
  right:  "Kanan",
};

export const FEATURES_DESC_POSITION_IDS = ["below", "beside"] as const;
export type FeaturesDescPosition = typeof FEATURES_DESC_POSITION_IDS[number];
export const FEATURES_DESC_POSITION_LABELS: Record<FeaturesDescPosition, string> = {
  below:  "Di Bawah Judul (default)",
  beside: "Di Samping Judul",
};

export const FEATURES_BACKGROUND_IDS = ["light", "primary", "secondary", "white"] as const;
export type FeaturesBackground = typeof FEATURES_BACKGROUND_IDS[number];
export const FEATURES_BACKGROUND_LABELS: Record<FeaturesBackground, string> = {
  light:     "Terang (default)",
  primary:   "Warna Utama",
  secondary: "Warna Sekunder",
  white:     "Putih",
};

export const FEATURES_WIDTH_IDS = ["full", "boxed"] as const;
export type FeaturesWidth = typeof FEATURES_WIDTH_IDS[number];
export const FEATURES_WIDTH_LABELS: Record<FeaturesWidth, string> = {
  full:  "Lebar Penuh (default)",
  boxed: "Terkotak (dalam container)",
};

export const FEATURES_ICON_STYLE_IDS = ["plain", "colored"] as const;
export type FeaturesIconStyle = typeof FEATURES_ICON_STYLE_IDS[number];
export const FEATURES_ICON_STYLE_LABELS: Record<FeaturesIconStyle, string> = {
  plain:   "Icon Saja (default)",
  colored: "Icon + Background Warna",
};

export const FEATURES_ICON_COLOR_IDS = ["primary", "secondary"] as const;
export type FeaturesIconColor = typeof FEATURES_ICON_COLOR_IDS[number];
export const FEATURES_ICON_COLOR_LABELS: Record<FeaturesIconColor, string> = {
  primary:   "Warna Utama (default)",
  secondary: "Warna Sekunder",
};

export const FEATURES_ICON_SHAPE_IDS = ["square", "rounded", "square-radius"] as const;
export type FeaturesIconShape = typeof FEATURES_ICON_SHAPE_IDS[number];
export const FEATURES_ICON_SHAPE_LABELS: Record<FeaturesIconShape, string> = {
  square:        "Kotak Siku",
  rounded:       "Bulat Penuh",
  "square-radius": "Kotak Sudut Membulat (default)",
};

export const FEATURES_CARD_BACKGROUND_IDS = ["none", "white"] as const;
export type FeaturesCardBackground = typeof FEATURES_CARD_BACKGROUND_IDS[number];
export const FEATURES_CARD_BACKGROUND_LABELS: Record<FeaturesCardBackground, string> = {
  none:  "Tanpa Background",
  white: "Putih (default)",
};

export const FEATURES_HIGHLIGHT_COLOR_IDS = ["primary", "secondary"] as const;
export type FeaturesHighlightColor = typeof FEATURES_HIGHLIGHT_COLOR_IDS[number];
export const FEATURES_HIGHLIGHT_COLOR_LABELS: Record<FeaturesHighlightColor, string> = {
  primary:   "Warna Utama (default)",
  secondary: "Warna Sekunder",
};

export type FeatureItem = {
  icon:  string;   // nama icon dari lib/icon-catalog.ts, resolve via resolveIcon()
  title: string;
  desc:  string;
};

export type FeaturesSectionData = {
  eyebrow?:         string;   // "judul kecil"
  title?:           string;   // "judul besar"
  headerDesc?:      string;   // "deskripsi" header section — BEDA dari FeatureItem.desc per-item
  titleAlign?:      FeaturesTitleAlign;
  descPosition?:    FeaturesDescPosition;
  background?:      FeaturesBackground;
  width?:           FeaturesWidth;
  iconStyle?:       FeaturesIconStyle;
  iconColor?:       FeaturesIconColor;
  iconShape?:       FeaturesIconShape;
  cardRadius?:      boolean;
  cardBackground?:  FeaturesCardBackground;
  highlightFirst?:  boolean;
  highlightColor?:  FeaturesHighlightColor;
  items?:           FeatureItem[];
};
