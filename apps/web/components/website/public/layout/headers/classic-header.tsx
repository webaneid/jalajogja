"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { type NavItem, resolveNavHref } from "@/lib/nav-menu";
import type { HeaderProps } from "@/lib/header-designs";

export function ClassicHeader({ tenantSlug, siteName, logoUrl, navMenu, primaryColor }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 bg-white border-b border-border shadow-sm"
      style={{ "--primary-color": primaryColor } as React.CSSProperties}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Nama */}
          <a href={`/${tenantSlug}`} className="flex items-center gap-3 shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={siteName} className="h-10 w-auto object-contain" />
            ) : (
              <>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {siteName.charAt(0)}
                </div>
                <span className="font-semibold text-sm leading-tight hidden sm:block max-w-[180px] line-clamp-2">
                  {siteName}
                </span>
              </>
            )}
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navMenu.map((item: NavItem) => {
              const href  = resolveNavHref(item, tenantSlug);
              const isExt = item.external ?? false;
              return (
                <a
                  key={item.id}
                  href={href}
                  target={isExt ? "_blank" : undefined}
                  rel={isExt ? "noopener noreferrer" : undefined}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/60 transition-colors"
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white">
          <nav className="px-4 py-3 space-y-0.5">
            {navMenu.map((item: NavItem) => {
              const href  = resolveNavHref(item, tenantSlug);
              const isExt = item.external ?? false;
              return (
                <a
                  key={item.id}
                  href={href}
                  target={isExt ? "_blank" : undefined}
                  rel={isExt ? "noopener noreferrer" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors"
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
