"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Settings,
  Globe,
  Phone,
  CreditCard,
  Palette,
  Mail,
  Bell,
  Users,
  ShieldCheck,
  LayoutTemplate,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Umum",            href: "general",       icon: Settings       },
  { label: "Domain",          href: "domain",        icon: Globe          },
  { label: "Kontak & Sosmed", href: "contact",       icon: Phone          },
  { label: "Pembayaran",      href: "payment",       icon: CreditCard     },
  { label: "Tampilan",        href: "display",       icon: Palette        },
  { label: "Website",         href: "website",       icon: LayoutTemplate },
  { label: "Email / SMTP",    href: "email",         icon: Mail           },
  { label: "Notifikasi",      href: "notifications", icon: Bell           },
  { label: "Pengguna",        href: "users",         icon: Users          },
  { label: "Role Kustom",     href: "roles",         icon: ShieldCheck    },
] as const;

export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
      {NAV_ITEMS.map((item) => {
        const href = `/${slug}/settings/${item.href}`;
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap",
              isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
