"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PostsSectionTitle } from "../posts/posts-section-title";
import { ProductCard } from "@/components/website/public/product-cards/product-card";
import type { ProductsSectionProps } from "@/lib/products-section-designs";

export function ProductsDesign3({ products, tenantSlug, sectionTitle, filterHref }: ProductsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll    = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" });

  if (products.length === 0) return null;

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" className="mb-0" />
          </div>
          <div className="flex items-center gap-1 shrink-0 pb-1">
            <button type="button" onClick={() => scroll("left")} aria-label="Sebelumnya"
              className="p-1 rounded-full border border-border hover:bg-muted">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => scroll("right")} aria-label="Berikutnya"
              className="p-1 rounded-full border border-border hover:bg-muted">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel: -mx overflow keluar dari container tapi snap tetap terkontrol */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-hide"
        >
          {products.map(p => (
            <div key={p.id} className="shrink-0 snap-start w-[48%] sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)]">
              <ProductCard product={p} variant="ringkas" tenantSlug={tenantSlug} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
