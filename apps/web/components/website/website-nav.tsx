"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, FileStack, Tag, Inbox, Settings2 } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard",   icon: LayoutDashboard, path: ""             },
  { label: "Posts",       icon: FileText,         path: "/posts"       },
  { label: "Halaman",     icon: FileStack,         path: "/pages"       },
  { label: "Kategori",    icon: Tag,               path: "/categories"  },
  { label: "Pesan",       icon: Inbox,             path: "/pesan"       },
  { label: "Pengaturan",  icon: Settings2,         path: "/pengaturan"  },
] as const;

export function WebsiteNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/app/${slug}/website`;

  return (
    <nav className="w-48 shrink-0 border-r border-border bg-muted/20 py-4">
      <p className="px-4 pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Website
      </p>
      <ul className="space-y-0.5 px-2">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const href = `${base}${path}`;
          // Active: exact match untuk dashboard, prefix match untuk yang lain
          const isActive =
            path === ""
              ? pathname === base
              : pathname.startsWith(href);
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
