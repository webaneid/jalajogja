"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, User, Menu, X, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import {
  MEMBER_NAV_ITEMS, PUBLIC_NAV_ITEMS, filterNavItemsByModules, resolveNavItemLabel, type NavItem,
} from "@/components/akun/akun-nav";
import type { EkosistemModulesConfig, EkosistemModuleLabels } from "@/lib/ekosistem-modules";

// Bottom nav khusus "app mode" /akun (mobile) — beda dari BottomNav situs (flex-header.tsx):
// bar flat, tanpa tombol melayang (itu gimmick branding situs, tidak relevan di sini). Struktur
// drawer "Lainnya" diadaptasi dari pola yang sama (docs/arsitektur-mobile-shell.md § 3).
// 3 tab utama + Lainnya (grid icon) — daftar item diimpor dari akun-nav.tsx (SATU sumber
// kebenaran, dipakai juga oleh sidebar desktop) supaya tidak drift.

const MAIN_HREFS = new Set(["", "/transaksi", "/profil"]);
const MAIN_ICONS: Record<string, React.ElementType> = {
  "":           LayoutDashboard,
  "/transaksi": Receipt,
  "/profil":    User,
};

type Props = {
  slug:     string;
  baseUrl:  string;
  isMember: boolean;
  enabledModules?: EkosistemModulesConfig;
  moduleLabels?:   EkosistemModuleLabels;
};

export function AkunBottomNav({ baseUrl, isMember, enabledModules, moduleLabels }: Props) {
  const pathname    = usePathname();
  const [open, setOpen] = useState(false);
  const base         = `${baseUrl}/akun`;

  const items: NavItem[] = filterNavItemsByModules(isMember ? MEMBER_NAV_ITEMS : PUBLIC_NAV_ITEMS, enabledModules);
  const mainItems    = items.filter((i) => MAIN_HREFS.has(i.href));
  const extraItems   = items.filter((i) => !MAIN_HREFS.has(i.href));

  function isActive(href: string) {
    const fullHref = `${base}${href}`;
    return href === "" ? pathname === base : pathname.startsWith(fullHref);
  }

  return (
    <>
      <div className="h-16 md:hidden" />
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background">
        <div className="flex items-center justify-around px-1 py-2">
          {mainItems.map((item) => {
            const Icon   = MAIN_ICONS[item.href] ?? LayoutDashboard;
            const active = isActive(item.href);
            return (
              <a
                key={item.href}
                href={`${base}${item.href}`}
                className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] leading-tight">{resolveNavItemLabel(item, moduleLabels)}</span>
              </a>
            );
          })}
          {extraItems.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex flex-col items-center gap-1 px-3 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] leading-tight">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {open && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-background pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Menu Lainnya</span>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="max-h-80 space-y-0.5 overflow-y-auto px-4 py-2">
              {extraItems.map((item) => (
                <a
                  key={item.href}
                  href={`${base}${item.href}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-2 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {resolveNavItemLabel(item, moduleLabels)}
                </a>
              ))}
              <button
                type="button"
                onClick={() => void signOut({ fetchOptions: { onSuccess: () => { window.location.href = baseUrl || "/"; } } })}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-destructive"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Keluar
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
