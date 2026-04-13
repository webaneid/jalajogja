"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Image,
  Globe,
  FileText,
  Wallet,
  ShoppingBag,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",  icon: LayoutDashboard, path: "dashboard"  },
  { label: "Anggota",    icon: Users,           path: "members"    },
  { label: "Media",      icon: Image,           path: "media"      },
  { label: "Website",    icon: Globe,           path: "website"    },
  { label: "Surat",      icon: FileText,        path: "letters"    },
  { label: "Keuangan",   icon: Wallet,          path: "finance"    },
  { label: "Toko",       icon: ShoppingBag,     path: "toko"       },
  { label: "Pengaturan", icon: Settings,        path: "settings"   },
];

export function SidebarNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {navItems.map(({ label, icon: Icon, path }) => {
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
