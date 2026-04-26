"use client";

import { useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PostCard } from "@/components/website/public/post-cards/post-card";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

const SLIDE_INTERVAL = 3000;

export function PostsDesign5({ posts, tenantSlug, sectionTitle, filterHref }: PostsSectionProps) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef  = useRef(false);

  const scrollBy = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild
      ? (el.firstElementChild as HTMLElement).offsetWidth + 16
      : 260;
    const maxLeft = el.scrollWidth - el.clientWidth;
    if (dir === "right") {
      el.scrollLeft >= maxLeft - 4
        ? (el.scrollLeft = 0)
        : el.scrollBy({ left: cardWidth, behavior: "smooth" });
    } else {
      el.scrollLeft <= 4
        ? (el.scrollLeft = maxLeft)
        : el.scrollBy({ left: -cardWidth, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) scrollBy("right");
    }, SLIDE_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [scrollBy]);

  return (
    <section
      className="py-10 px-4"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <PostsSectionTitle title={sectionTitle} href={filterHref} className="mb-0" />
          </div>
          <div className="flex items-center gap-1 shrink-0 pb-1">
            <button type="button" onClick={() => scrollBy("left")} aria-label="Sebelumnya"
              className="p-1 rounded-full border border-border hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => scrollBy("right")} aria-label="Berikutnya"
              className="p-1 rounded-full border border-border hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-4 px-4"
          style={{ scrollbarWidth: "none" }}
        >
          {posts.map(p => (
            <div
              key={p.id}
              className="shrink-0 snap-start w-[72%] sm:w-[calc(33.333%-11px)] lg:w-[calc(20%-13px)]"
            >
              <PostCard post={p} variant="overlay" tenantSlug={tenantSlug} className="aspect-[3/4]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
