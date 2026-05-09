// Sistem Gallery Universal — dipakai di produk, event, donasi, editor, landing section

export type GalleryItem = {
  id:       string;
  url:      string;                          // URL primary (large atau square-large)
  variants?: Record<string, string> | null; // { square, medium, large, "square-large", ... }
  alt?:     string | null;
  caption?: string | null;
  order:    number;
};

export type GalleryLayout = "grid" | "masonry" | "carousel";

export type GalleryConfig = {
  layout:  GalleryLayout;
  columns: 2 | 3 | 4;
};

export const DEFAULT_GALLERY_CONFIG: GalleryConfig = {
  layout:  "grid",
  columns: 3,
};

// Pilih URL thumbnail sesuai konteks modul
export function getGalleryThumb(item: GalleryItem, module = "website"): string {
  if (module === "shop") return item.variants?.square ?? item.url;
  return item.variants?.medium ?? item.variants?.large ?? item.url;
}

// Pilih URL full size untuk lightbox
export function getGalleryFull(item: GalleryItem, module = "website"): string {
  if (module === "shop") return item.variants?.["square-large"] ?? item.url;
  return item.variants?.large ?? item.url;
}

// Konversi dari ProductImage[] ke GalleryItem[]
export function fromProductImages(
  images: Array<{ id: string; url: string; variants?: Record<string, string> | null; alt: string; order: number }>,
): GalleryItem[] {
  return images.map((img) => ({
    id:       img.id,
    url:      img.url,
    variants: img.variants,
    alt:      img.alt,
    order:    img.order,
  }));
}
