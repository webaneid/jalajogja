"use client";

import { useState } from "react";
import { Store, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductImage = {
  id:       string;
  url:      string;
  variants?: Record<string, string> | null;
  alt:      string;
};

function getFullUrl(img: ProductImage): string {
  return img.variants?.["square-large"] ?? img.url;
}

function getThumbUrl(img: ProductImage): string {
  return img.variants?.square ?? img.variants?.["square-large"] ?? img.url;
}

export function ProductImageViewer({ images, productName }: { images: ProductImage[]; productName: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square rounded-xl bg-muted flex items-center justify-center text-muted-foreground/30">
        <Store className="h-20 w-20" />
      </div>
    );
  }

  const current = images[active]!;

  function prev() { setActive(i => (i - 1 + images.length) % images.length); }
  function next() { setActive(i => (i + 1) % images.length); }

  return (
    <div className="space-y-3">
      {/* Gambar utama */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={getFullUrl(current)}
          alt={current.alt || productName}
          className="w-full h-full object-cover"
        />

        {/* Nav panah — hanya jika lebih dari 1 gambar */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-1.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-1.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Indikator dot (mobile) */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i === active ? "bg-primary" : "bg-background/60",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip — hanya jika lebih dari 1 gambar */}
      {images.length > 1 && (
        <div className="hidden md:flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={cn(
                "shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                i === active
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getThumbUrl(img)}
                alt={img.alt || productName}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
