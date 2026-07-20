"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard, User, Receipt, ClipboardList,
  BookOpen, Building2, Briefcase, Store, CalendarDays, LogOut,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";

export type NavItem = {
  href:       string;
  label:      string;
  icon:       React.ElementType;
  memberOnly: boolean;
};

// Di-export — dipakai ulang oleh AkunBottomNav (components/akun/mobile/akun-bottom-nav.tsx)
// supaya daftar item nav TIDAK diketik ulang di dua tempat (cegah drift sidebar vs bottom nav).
//
// Label "Profil" vs "Data Diri" sengaja diubah jadi "Info Login" vs "Edit Profil" (2026-07-21)
// — disambiguasi: /akun/profil = kredensial login (email, password, h1 halaman itu sendiri
// SUDAH "Info Login" sejak lama, nav label-nya yang baru menyusul konsisten), /akun/lengkapi
// (member) atau /akun/data (publik) = data pribadi (nama, tanggal lahir, dst).
export const MEMBER_NAV_ITEMS: NavItem[] = [
  { href: "",           label: "Beranda",     icon: LayoutDashboard, memberOnly: false },
  { href: "/profil",    label: "Info Login",  icon: User,            memberOnly: false },
  { href: "/transaksi", label: "Transaksi",   icon: Receipt,         memberOnly: false },
  { href: "/event",     label: "Event",       icon: CalendarDays,    memberOnly: false },
  { href: "/lengkapi",  label: "Edit Profil", icon: ClipboardList,   memberOnly: false },
  { href: "/pesantren",   label: "Pesantren",   icon: BookOpen,   memberOnly: false },
  { href: "/usaha",       label: "Usaha",       icon: Building2,  memberOnly: false },
  { href: "/profesional", label: "Profesional", icon: Briefcase,  memberOnly: false },
  { href: "/mitra",       label: "Mitra",       icon: Store,      memberOnly: false },
];

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  { href: "",           label: "Beranda",     icon: LayoutDashboard, memberOnly: false },
  { href: "/profil",    label: "Info Login",  icon: User,            memberOnly: false },
  { href: "/transaksi", label: "Transaksi",   icon: Receipt,         memberOnly: false },
  { href: "/event",     label: "Event",       icon: CalendarDays,    memberOnly: false },
  { href: "/data",      label: "Edit Profil", icon: ClipboardList,   memberOnly: false },
];

type Props = {
  slug:     string;
  isMember: boolean;
  baseUrl:  string;
};

export function AkunNav({ slug, isMember, baseUrl }: Props) {
  const pathname = usePathname();
  const base     = `${baseUrl}/akun`;

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
          onClick={() => void signOut({ fetchOptions: { onSuccess: () => { window.location.href = baseUrl || "/"; } } })}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Keluar
        </button>
      </div>
    </nav>
  );
}
