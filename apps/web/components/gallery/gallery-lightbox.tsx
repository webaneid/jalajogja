"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { GalleryItem } from "@/lib/gallery";
import { getGalleryFull } from "@/lib/gallery";

type Props = {
  items:   GalleryItem[];
  module?: string;
  param?:  string;   // query param name — default "gallery"
};

export function GalleryLightbox({ items, module = "website", param = "gallery" }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const openId      = searchParams.get(param);
  const touchStartX = useRef<number | null>(null);

  const sorted  = [...items].sort((a, b) => a.order - b.order);
  const current = sorted.findIndex((i) => i.id === openId);
  const item    = current >= 0 ? sorted[current] : null;

  const close = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete(param);
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, pathname, searchParams, param]);

  const go = useCallback((dir: "prev" | "next") => {
    const next = dir === "prev" ? current - 1 : current + 1;
    if (next < 0 || next >= sorted.length) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set(param, sorted[next].id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [current, sorted, router, pathname, searchParams, param]);

  // Keyboard navigation
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")     close();
      if (e.key === "ArrowLeft")  go("prev");
      if (e.key === "ArrowRight") go("next");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item, close, go]);

  // Scroll lock saat lightbox terbuka
  useEffect(() => {
    if (item) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  if (!item) return null;

  const hasPrev = current > 0;
  const hasNext = current < sorted.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={close}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 50) go(delta > 0 ? "prev" : "next");
        touchStartX.current = null;
      }}
    >
      {/* Tutup */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        onClick={close}
        aria-label="Tutup"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); go("prev"); }}
          aria-label="Sebelumnya"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); go("next"); }}
          aria-label="Berikutnya"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Gambar */}
      <div
        className="relative max-w-5xl max-h-[90vh] w-full mx-8 flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={item.id}
          src={getGalleryFull(item, module)}
          alt={item.alt ?? ""}
          className="max-h-[80vh] max-w-full object-contain rounded-lg"
        />
        {/* Caption + counter */}
        <div className="flex items-center justify-between w-full px-1 text-white/70 text-sm">
          <span>{item.caption ?? item.alt ?? ""}</span>
          <span className="text-xs">{current + 1} / {sorted.length}</span>
        </div>
      </div>
    </div>
  );
}
