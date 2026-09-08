"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CalendarDays, FolderOpen, Settings } from "lucide-react";

const NAV_ITEMS = [
  { label: "Acara",      icon: CalendarDays, path: "/acara"      },
  { label: "Kategori",   icon: FolderOpen,   path: "/kategori"   },
  { label: "Pengaturan", icon: Settings,     path: "/pengaturan" },
] as const;

export function EventNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/app/${slug}/event`;

  return (
    // Mobile (< md): strip horizontal-scroll di atas konten. Desktop (md+): kolom vertikal
    // seperti semula, tidak berubah. Satu-satunya sumber sub-nav Event (dipakai di
    // event/layout.tsx yang membungkus semua halaman Event) — edit di sini kena semua halaman.
    <nav className="md:w-48 md:shrink-0 border-b md:border-b-0 md:border-r border-border bg-muted/20 py-2 md:py-4 overflow-x-auto md:overflow-visible">
      <p className="hidden md:block px-4 pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Event
      </p>
      <ul className="flex flex-row md:flex-col gap-1 md:gap-0.5 px-3 md:px-2">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const href     = `${base}${path}`;
          const isActive = pathname.startsWith(href);

          return (
            <li key={label} className="shrink-0">
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-background text-foreground font-medium shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
