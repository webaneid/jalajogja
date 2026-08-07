"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard, User, Receipt, ClipboardList,
  BookOpen, Building2, Briefcase, Store, CalendarDays, LogOut,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import type { EkosistemModule, EkosistemModulesConfig, EkosistemModuleLabels } from "@/lib/ekosistem-modules";

export type NavItem = {
  href:       string;
  label:      string;
  icon:       React.ElementType;
  memberOnly: boolean;
  // Kalau diisi, item ini cuma tampil kalau modul ekosistem itu aktif untuk tenant ini
  // (lib/ekosistem-modules.ts) — lihat docs/arsitektur-ekosistem.md § toggle per-tenant.
  moduleKey?: EkosistemModule;
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
  { href: "/pesantren",   label: "Pesantren",   icon: BookOpen,   memberOnly: false, moduleKey: "pesantren" },
  { href: "/usaha",       label: "Usaha",       icon: Building2,  memberOnly: false, moduleKey: "usaha" },
  { href: "/profesional", label: "Profesional", icon: Briefcase,  memberOnly: false, moduleKey: "profesional" },
  { href: "/mitra",       label: "Mitra",       icon: Store,      memberOnly: false },
];

// Filter item nav berdasarkan modul yang aktif untuk tenant ini — item tanpa `moduleKey`
// (Beranda, Info Login, dst) selalu tampil, tidak terpengaruh toggle ekosistem.
export function filterNavItemsByModules(items: NavItem[], enabledModules?: EkosistemModulesConfig): NavItem[] {
  if (!enabledModules) return items;
  return items.filter((item) => !item.moduleKey || enabledModules[item.moduleKey]);
}

// Resolve label item nav — item dengan `moduleKey` (Usaha/Pesantren/Profesional) pakai label
// custom tenant kalau diisi (2026-08-07, /ekosistem/pengaturan); item lain (Beranda, Info
// Login, dst) selalu pakai label bawaan. Di-export supaya AkunBottomNav pakai fungsi yang
// SAMA — cegah drift resolusi label sidebar vs bottom-nav.
export function resolveNavItemLabel(item: NavItem, moduleLabels?: EkosistemModuleLabels): string {
  if (!item.moduleKey || !moduleLabels) return item.label;
  return moduleLabels[item.moduleKey] || item.label;
}

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
  enabledModules?: EkosistemModulesConfig;
  moduleLabels?:   EkosistemModuleLabels;
};

export function AkunNav({ slug, isMember, baseUrl, enabledModules, moduleLabels }: Props) {
  const pathname = usePathname();
  const base     = `${baseUrl}/akun`;

  const items = filterNavItemsByModules(isMember ? MEMBER_NAV_ITEMS : PUBLIC_NAV_ITEMS, enabledModules);

  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const { href, icon: Icon } = item;
        const label     = resolveNavItemLabel(item, moduleLabels);
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
