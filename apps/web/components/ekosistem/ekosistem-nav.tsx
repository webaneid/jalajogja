"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Settings2, Tags } from "lucide-react";

// Sub-nav modul Ekosistem. Pola PERSIS TokoNav (components/toko/toko-nav.tsx) — tambah entry
// baru di sini kalau ada ide config lanjutan (docs/arsitektur-ekosistem.md § 9.5/9.6).
const NAV_ITEMS = [
  { label: "Pengaturan",     icon: Settings2, path: "/pengaturan" },
  { label: "Taksonomi Usaha", icon: Tags,      path: "/taksonomi" },
] as const;

export function EkosistemNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/app/${slug}/ekosistem`;

  return (
    <nav className="w-48 shrink-0 border-r border-border bg-muted/20 py-4">
      <p className="px-4 pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Ekosistem
      </p>
      <ul className="space-y-0.5 px-2">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const href     = `${base}${path}`;
          const isActive = pathname.startsWith(href);

          return (
            <li key={label}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
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
