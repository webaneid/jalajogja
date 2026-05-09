import { ZoomIn } from "lucide-react";
import type { GalleryItem } from "@/lib/gallery";
import { getGalleryThumb } from "@/lib/gallery";

const COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
};

type Props = {
  items:      GalleryItem[];
  columns?:   2 | 3 | 4;
  module?:    string;
  className?: string;
  // openId: ID yang sedang terbuka di lightbox — di-set via URL ?gallery=id
  openHref:   (id: string) => string;  // URL untuk membuka lightbox item ini
};

export function GalleryGrid({ items, columns = 3, module = "website", className, openHref }: Props) {
  return (
    <div className={`grid gap-2 ${COLS[columns]} ${className ?? ""}`}>
      {items
        .sort((a, b) => a.order - b.order)
        .map((item) => (
          <a
            key={item.id}
            href={openHref(item.id)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-muted block"
            aria-label={item.alt ?? "Lihat gambar"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getGalleryThumb(item, module)}
              alt={item.alt ?? ""}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* Overlay hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        ))}
    </div>
  );
}
