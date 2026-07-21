import Link from "next/link";
import { ZoomIn } from "lucide-react";
import type { GalleryItem, GalleryAspectRatio } from "@/lib/gallery";
import { getGalleryThumb } from "@/lib/gallery";

const COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
};

const ASPECT: Record<GalleryAspectRatio, string> = {
  square:    "aspect-square",
  landscape: "aspect-[4/3]",
};

type Props = {
  items:        GalleryItem[];
  columns?:     2 | 3 | 4;
  aspectRatio?: GalleryAspectRatio;
  module?:      string;
  className?:   string;
  // openId: ID yang sedang terbuka di lightbox — di-set via URL ?gallery=id
  openHref:     (id: string) => string;  // URL untuk membuka lightbox item ini
};

export function GalleryGrid({ items, columns = 3, aspectRatio = "square", module = "website", className, openHref }: Props) {
  return (
    <div className={`grid gap-2 ${COLS[columns]} ${className ?? ""}`}>
      {items
        .sort((a, b) => a.order - b.order)
        .map((item) => (
          // Link + scroll={false} — WAJIB, bukan <a> polos. Membuka lightbox hanya mengganti
          // query string di halaman yang sama, tapi <a> biasa memicu navigasi native browser
          // yang scroll ke atas. Navigasi INTERNAL lightbox (prev/next/close, gallery-lightbox.tsx)
          // sudah benar pakai router.replace(..., {scroll:false}) — titik pembuka inilah yang
          // sebelumnya terlewat.
          <Link
            key={item.id}
            href={openHref(item.id)}
            scroll={false}
            className="group relative overflow-hidden rounded-lg bg-muted block"
            aria-label={item.alt ?? "Lihat gambar"}
          >
            <div className={ASPECT[aspectRatio]}>
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
            </div>
          </Link>
        ))}
    </div>
  );
}
