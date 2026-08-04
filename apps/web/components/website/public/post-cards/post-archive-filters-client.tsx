"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; slug: string };

type Props = {
  categories:      Category[];
  currentCategory: string | null;
  currentSearch:   string;
  basePath:        string; // /{slug}/post
};

// Filter bar arsip post — search + chip kategori. Pola sama ProductArchiveClient
// (components/toko/public/product-archive-client.tsx), tanpa filter tag (tidak diminta).
export function PostArchiveFiltersClient({ categories, currentCategory, currentSearch, basePath }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const pushParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, val] of Object.entries(updates)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    params.delete("page"); // reset pagination
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }, [pathname, router]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Cari artikel..."
          defaultValue={currentSearch}
          className="pl-9 pr-9"
          onChange={(e) => {
            const val = e.target.value;
            if (val.length === 0 || val.length >= 2) {
              pushParams({ search: val || null });
            }
          }}
        />
        {currentSearch && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => pushParams({ search: null })}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Kategori chips */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => pushParams({ category: null })}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
              !currentCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-primary/50 hover:bg-muted",
            )}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => pushParams({ category: cat.slug })}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                currentCategory === cat.slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
