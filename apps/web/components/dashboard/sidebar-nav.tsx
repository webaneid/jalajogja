"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  UserCircle,
  Image,
  Globe,
  Mail,
  Wallet,
  HeartHandshake,
  CalendarDays,
  FolderOpen,
  ShoppingBag,
  Settings,
} from "lucide-react";
import { canAccess, type Module, type TenantUserForPermission } from "@/lib/permissions";

type NavItem = {
  label:  string;
  icon:   React.ElementType;
  path:   string;
  module: Module | null; // null = selalu tampil
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",  icon: LayoutDashboard, path: "dashboard",  module: null       },
  { label: "Anggota",    icon: Users,           path: "members",    module: "anggota"  },
  { label: "Pengurus",   icon: UserCog,         path: "pengurus",   module: "pengurus" },
  { label: "Akun",       icon: UserCircle,      path: "accounts",   module: "anggota"  },
  { label: "Media",      icon: Image,           path: "media",      module: "media"    },
  { label: "Website",    icon: Globe,           path: "website",    module: "website"  },
  { label: "Surat",      icon: Mail,            path: "letters",    module: "surat"    },
  { label: "Keuangan",   icon: Wallet,          path: "finance",    module: "keuangan" },
  { label: "Donasi",     icon: HeartHandshake,  path: "donasi",     module: "donasi"   },
  { label: "Event",      icon: CalendarDays,    path: "event",      module: "event"    },
  { label: "Dokumen",    icon: FolderOpen,      path: "dokumen",    module: "dokumen"  },
  { label: "Toko",       icon: ShoppingBag,     path: "toko",       module: "toko"     },
  { label: "Pengaturan", icon: Settings,        path: "settings",   module: null       },
];

export function SidebarNav({
  slug,
  tenantUser,
}: {
  slug:       string;
  tenantUser: TenantUserForPermission;
}) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.module) return true;
    // Surat: level minimum "own" (bisa akses module dengan akses sendiri)
    if (item.module === "surat") return canAccess(tenantUser, "surat", "own");
    // Modul lain: minimum "read"
    return canAccess(tenantUser, item.module, "read");
  });

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {visibleItems.map(({ label, icon: Icon, path }) => {
        const href = `/${slug}/${path}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={path}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
              ${isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
