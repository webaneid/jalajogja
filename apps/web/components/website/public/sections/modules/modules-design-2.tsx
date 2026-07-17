"use client";

import { useRef } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { MODULE_CATALOG, type ModuleId } from "@/lib/module-strip-designs";
import { renderAccentTitle } from "@/lib/render-accent-title";

// Desain 2 — Kartu Foto Overlay. Sumber ide: section "Ekosistem" di design-refs/jalakarta-v2/
// (lihat design-refs/README.md) — rail scroll horizontal, kartu portrait foto full-bleed.
// `imageUrl` di sini sudah RESOLVED (custom foto atau fallback foto-item-terbaru atau null),
// resolusi dilakukan server-side di modules-section.tsx (resolveModuleImages) — komponen ini
// murni presentasional, tidak query DB.

export type ResolvedModuleItem = {
  id:       ModuleId;
  imageUrl: string | null;
};

export function ModulesDesign2({
  title,
  items,
  baseUrl,
}: {
  title?:  string;
  items:   ResolvedModuleItem[];
  baseUrl: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 1 | -1) {
    railRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          {title ? (
            <h2 className="text-2xl sm:text-3xl font-bold m-0">{renderAccentTitle(title)}</h2>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Sebelumnya"
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted/60 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Berikutnya"
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted/60 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={railRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((item) => {
            const mod = MODULE_CATALOG[item.id];
            return (
              <a
                key={item.id}
                href={`${baseUrl}/${mod.path}`}
                className="group relative flex-none w-[220px] sm:w-[260px] aspect-[3/4] rounded-[22px] overflow-hidden snap-start"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={mod.label}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/25 to-secondary/25 flex items-center justify-center">
                    <mod.Icon className="w-12 h-12 text-primary/60" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute left-4 right-4 bottom-4 flex items-end justify-between gap-2">
                  <span className="text-white font-bold text-base leading-tight">{mod.label}</span>
                  <span className="shrink-0 w-8 h-8 rounded-full bg-white text-foreground flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
