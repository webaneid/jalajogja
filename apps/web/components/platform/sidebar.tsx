"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  Settings,
  MapPin,
} from "lucide-react";
import type { PlatformUserRole } from "@jalajogja/db";

const NAV_ITEMS = [
  { label: "Dashboard",  href: "/platform/dashboard", icon: LayoutDashboard },
  { label: "Tenant",     href: "/platform/tenants",   icon: Building2 },
  { label: "PC IKPM",   href: "/platform/cabang",    icon: MapPin },
  { label: "Tim",        href: "/platform/users",     icon: Users },
  { label: "Paket",      href: "/platform/packages",  icon: Package },
  { label: "Pengaturan", href: "/platform/settings",  icon: Settings },
];

export function PlatformSidebar({ role }: { role: PlatformUserRole }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-background border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">JJ</span>
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">jalakarta</p>
          <p className="text-[10px] text-muted-foreground">Platform Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/platform/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Role badge */}
      <div className="px-4 py-3 border-t border-border">
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
          {role}
        </span>
      </div>
    </aside>
  );
}
