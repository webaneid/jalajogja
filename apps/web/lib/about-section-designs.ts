// Section Tentang Kami (about_text) — tetap "Design 1" tunggal, sub-opsi flat field, pola sama
// cta-section-designs.ts / features-section-designs.ts. Arsitektur lengkap:
// docs/arsitektur-tentang-kami-section.md
//
// Background pakai standar BARU 5-opsi (lib/section-background.ts) — section pertama yang
// pakai standar ini, sengaja TIDAK diretrofit ke CTA/Keunggulan yang sudah lebih dulu selesai.

import type { FeaturesIconStyle, FeaturesIconColor, FeaturesIconShape } from "./features-section-designs";
import type { SectionBackground } from "./section-background";

export { SECTION_BACKGROUND_IDS, SECTION_BACKGROUND_LABELS } from "./section-background";
export type { SectionBackground } from "./section-background";

export const ABOUT_WIDTH_IDS = ["full", "boxed"] as const;
export type AboutWidth = typeof ABOUT_WIDTH_IDS[number];
export const ABOUT_WIDTH_LABELS: Record<AboutWidth, string> = {
  full:  "Lebar Penuh (default)",
  boxed: "Terkotak (dalam container)",
};

export const ABOUT_TEXT_VALIGN_IDS = ["top", "center", "bottom"] as const;
export type AboutTextVAlign = typeof ABOUT_TEXT_VALIGN_IDS[number];
export const ABOUT_TEXT_VALIGN_LABELS: Record<AboutTextVAlign, string> = {
  top:    "Atas",
  center: "Tengah (default)",
  bottom: "Bawah",
};

export const ABOUT_DESC_MODE_IDS = ["text", "list"] as const;
export type AboutDescMode = typeof ABOUT_DESC_MODE_IDS[number];
export const ABOUT_DESC_MODE_LABELS: Record<AboutDescMode, string> = {
  text: "Teks Biasa (default)",
  list: "List / Repeater (icon + judul + deskripsi per item)",
};

export const ABOUT_IMAGE_POSITION_IDS = ["left", "right"] as const;
export type AboutImagePosition = typeof ABOUT_IMAGE_POSITION_IDS[number];
export const ABOUT_IMAGE_POSITION_LABELS: Record<AboutImagePosition, string> = {
  left:  "Kiri",
  right: "Kanan (default)",
};

// "profile" = rasio 3:4 potret (sama seperti variant foto profil anggota, lib/image-processor.ts)
// — TIDAK generate variant baru, murni pilihan aspect-ratio CSS di tampilan.
export const ABOUT_IMAGE_RATIO_IDS = ["square", "profile"] as const;
export type AboutImageRatio = typeof ABOUT_IMAGE_RATIO_IDS[number];
export const ABOUT_IMAGE_RATIO_LABELS: Record<AboutImageRatio, string> = {
  square:  "Persegi 1:1 (default)",
  profile: "Potret 3:4 (seperti foto profil)",
};

export type AboutListItem = { icon: string; title: string; desc: string };

export type AboutSectionData = {
  eyebrow?:           string;
  title?:             string;
  body?:              string;           // dipakai saat descMode="text"
  items?:             AboutListItem[];  // dipakai saat descMode="list"
  descMode?:          AboutDescMode;
  listDividers?:      boolean;          // border-bottom antar item list, default false
  iconStyle?:         FeaturesIconStyle;   // reuse dari features-section-designs.ts
  iconColor?:         FeaturesIconColor;
  iconShape?:         FeaturesIconShape;
  ctaLabel?:          string;
  ctaUrl?:            string;
  background?:        SectionBackground;
  width?:             AboutWidth;
  textVAlign?:        AboutTextVAlign;
  imagePosition?:     AboutImagePosition;
  imageUrl?:          string;
  imageRatio?:        AboutImageRatio;
  imageRadius?:       boolean;
};
