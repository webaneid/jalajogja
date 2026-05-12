"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, User, Receipt, ClipboardList,
  BookOpen, Building2, Store, CalendarDays, LogOut,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";

type NavItem = {
  href:       string;
  label:      string;
  icon:       React.ElementType;
  memberOnly: boolean;
};

const MEMBER_NAV_ITEMS: NavItem[] = [
  { href: "",           label: "Beranda",   icon: LayoutDashboard, memberOnly: false },
  { href: "/profil",    label: "Profil",    icon: User,            memberOnly: false },
  { href: "/transaksi", label: "Transaksi", icon: Receipt,         memberOnly: false },
  { href: "/event",     label: "Event",     icon: CalendarDays,    memberOnly: false },
  { href: "/lengkapi",  label: "Data Diri", icon: ClipboardList,   memberOnly: false },
  { href: "/pesantren", label: "Pesantren", icon: BookOpen,        memberOnly: false },
  { href: "/usaha",     label: "Usaha",     icon: Building2,       memberOnly: false },
  { href: "/mitra",     label: "Mitra",     icon: Store,           memberOnly: false },
];

const PUBLIC_NAV_ITEMS: NavItem[] = [
  { href: "",           label: "Beranda",   icon: LayoutDashboard, memberOnly: false },
  { href: "/profil",    label: "Profil",    icon: User,            memberOnly: false },
  { href: "/transaksi", label: "Transaksi", icon: Receipt,         memberOnly: false },
  { href: "/event",     label: "Event",     icon: CalendarDays,    memberOnly: false },
  { href: "/data",      label: "Data Diri", icon: ClipboardList,   memberOnly: false },
];

type Props = {
  slug:     string;
  isMember: boolean;
};

export function AkunNav({ slug, isMember }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const base     = `/${slug}/akun`;

  const items = isMember ? MEMBER_NAV_ITEMS : PUBLIC_NAV_ITEMS;

  return (
    <nav className="space-y-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const fullHref  = `${base}${href}`;
        const isActive  = href === ""
          ? pathname === base
          : pathname.startsWith(fullHref);

        return (
          <a
            key={fullHref}
            href={fullHref}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </a>
        );
      })}

      <div className="pt-2 mt-2 border-t border-border">
        <button
          onClick={() => void signOut({ fetchOptions: { onSuccess: () => router.push(`/${slug}`) } })}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Keluar
        </button>
      </div>
    </nav>
  );
}
