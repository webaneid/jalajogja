// Section Galeri Foto (gallery) — tetap "Design 1" tunggal, sub-opsi flat field, pola sama
// cta/features/about-section-designs.ts. Arsitektur lengkap: docs/arsitektur-gallery.md.
//
// Background pakai standar SAMA yang dikunci di section Tentang Kami (lib/section-background.ts).
// Kolom + rasio gambar reuse tipe dari lib/gallery.ts (GalleryConfig) — sistem Gallery bersama,
// dipakai lintas modul (produk/event/donasi/editor), bukan didefinisikan ulang di sini.

import type { GalleryItem, GalleryAspectRatio } from "./gallery";
import type { SectionBackground } from "./section-background";
import type { SectionTitleAlign } from "./section-title-align";

export { SECTION_BACKGROUND_IDS, SECTION_BACKGROUND_LABELS } from "./section-background";
export type { SectionBackground } from "./section-background";

export const GALLERY_COLUMNS_IDS = [3, 4] as const;
export type GalleryColumnsId = typeof GALLERY_COLUMNS_IDS[number];
export const GALLERY_COLUMNS_LABELS: Record<GalleryColumnsId, string> = {
  3: "3 Kolom (default)",
  4: "4 Kolom",
};

export const GALLERY_IMAGE_RATIO_IDS = ["square", "landscape"] as const satisfies readonly GalleryAspectRatio[];
export const GALLERY_IMAGE_RATIO_LABELS: Record<GalleryAspectRatio, string> = {
  square:    "Persegi 1:1 (default)",
  landscape: "Landscape 4:3",
};

export type GallerySectionData = {
  eyebrow?:    string;
  title?:      string;
  headerDesc?: string;
  titleAlign?: SectionTitleAlign;  // default "center" (BEDA dari Post/Produk/dst — lihat landing-template.tsx)
  background?: SectionBackground;
  columns?:    GalleryColumnsId;
  imageRatio?: GalleryAspectRatio;
  items?:      GalleryItem[];
};
