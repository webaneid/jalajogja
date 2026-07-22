import { Suspense } from "react";
import type { GalleryItem, GalleryConfig } from "@/lib/gallery";
import { DEFAULT_GALLERY_CONFIG } from "@/lib/gallery";
import { GalleryGrid } from "./gallery-grid";
import { GalleryLightbox } from "./gallery-lightbox";

type Props = {
  items:      GalleryItem[];
  config?:    Partial<GalleryConfig>;
  module?:    string;
  param?:     string;   // query param untuk lightbox — default "gallery"
  className?: string;
};

// Bangun URL untuk membuka lightbox — tambahkan/ganti ?{param}={id} di URL saat ini
// Karena ini server component, openHref hanya mengembalikan path + query string sederhana
// (GalleryLightbox yang handle routing client-side)
function buildOpenHref(baseParam: string) {
  return (id: string) => `?${baseParam}=${id}`;
}

export function Gallery({ items, config, module = "website", param = "gallery", className }: Props) {
  if (items.length === 0) return null;

  const { layout, columns, aspectRatio } = { ...DEFAULT_GALLERY_CONFIG, ...config };

  return (
    <div className={className}>
      {/* Display */}
      {layout === "grid" || layout === "masonry" ? (
        <GalleryGrid
          items={items}
          columns={columns}
          aspectRatio={aspectRatio}
          module={module}
          openHref={buildOpenHref(param)}
        />
      ) : null}
      {/* Carousel — di-import dinamis saat dibutuhkan */}

      {/* Lightbox — client component, butuh Suspense karena pakai useSearchParams */}
      <Suspense>
        <GalleryLightbox items={items} module={module} param={param} />
      </Suspense>
    </div>
  );
}
