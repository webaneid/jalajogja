"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tag,
  Handshake,
  Settings2,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard",   icon: LayoutDashboard, path: ""             },
  { label: "Produk",      icon: Package,         path: "/produk"      },
  { label: "Pesanan",     icon: ShoppingCart,    path: "/pesanan"     },
  { label: "Kategori",    icon: Tag,             path: "/kategori"    },
  { label: "Mitra",       icon: Handshake,       path: "/mitra"       },
  { label: "Pengaturan",  icon: Settings2,       path: "/pengaturan"  },
] as const;

export function TokoNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/app/${slug}/toko`;

  return (
    // Mobile (< md): strip horizontal-scroll di atas konten. Desktop (md+): kolom vertikal
    // seperti semula. Pola sama persis dengan components/event/event-nav.tsx — lihat
    // docs/arsitektur-event.md § "RENCANA — Modul Event Responsive (Mobile)" untuk alasannya.
    <nav className="md:w-48 md:shrink-0 border-b md:border-b-0 md:border-r border-border bg-muted/20 py-2 md:py-4 overflow-x-auto md:overflow-visible">
      <p className="hidden md:block px-4 pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Toko
      </p>
      <ul className="flex flex-row md:flex-col gap-1 md:gap-0.5 px-3 md:px-2">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const href     = `${base}${path}`;
          const isActive = path === ""
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(href);

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
