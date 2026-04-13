"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Building2 } from "lucide-react";

const navItems = [
  { label: "Daftar Pengurus", icon: Users,     path: "pengurus" },
  { label: "Divisi / Bidang", icon: Building2, path: "divisi"   },
];

export function PengurusNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-2 py-3 border-r border-border h-full min-h-screen w-48 shrink-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
        Pengurus
      </p>
      {navItems.map(({ label, icon: Icon, path }) => {
        const href = `/${slug}/${path}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={path}
            href={href}
            className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
