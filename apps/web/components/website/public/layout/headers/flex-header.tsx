"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Search, Menu, X, ChevronDown, User, LogOut } from "lucide-react";
import { authClient, signOut } from "@/lib/auth-client";
import { type NavItem, resolveNavHref, NAV_TYPE_ICONS } from "@/lib/nav-menu";
import type { HeaderProps } from "@/lib/header-designs";

// ── Mobile bottom nav — maks 3 item + "Lainnya" ──────────────────────────────

function BottomNav({
  navMenu,
  tenantSlug,
}: {
  navMenu: NavItem[];
  tenantSlug: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const main  = navMenu.slice(0, 3);
  const extra = navMenu.slice(3);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border">
        <div className="flex items-center justify-around h-14">
          {main.map((item) => {
            const href = resolveNavHref(item, tenantSlug);
            const Icon = NAV_TYPE_ICONS[item.type];
            return (
              <a
                key={item.id}
                href={href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] leading-tight truncate max-w-[52px] text-center">
                  {item.label}
                </span>
              </a>
            );
          })}

          {extra.length > 0 && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px]">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* Drawer slide-up */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl pb-safe">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm">Menu lainnya</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="px-4 py-2 space-y-0.5 max-h-80 overflow-y-auto">
              {extra.map((item) => {
                const href = resolveNavHref(item, tenantSlug);
                const Icon = NAV_TYPE_ICONS[item.type];
                return (
                  <a
                    key={item.id}
                    href={href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-2 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────

function SearchBar({ tenantSlug }: { tenantSlug: string }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<null | {
    posts:    { title: string; slug: string }[];
    pages:    { title: string; slug: string }[];
    events:   { name: string; slug: string }[];
    products: { name: string; slug: string; price: number }[];
    members:  { name: string; memberNumber: string }[];
  }>(null);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults(null); setOpen(false); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?slug=${encodeURIComponent(tenantSlug)}&q=${encodeURIComponent(query)}`
        );
        if (res.ok) { setResults(await res.json()); setOpen(true); }
      } catch { /* ignore */ }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, tenantSlug]);

  const total = results
    ? results.posts.length + results.pages.length + results.events.length +
      results.products.length + results.members.length
    : 0;

  return (
    <div className="relative flex-1 hidden md:block">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onFocus={() => { if (results && total > 0) setOpen(true); }}
          placeholder="Cari..."
          className="w-full h-9 pl-9 pr-4 text-sm bg-white rounded-full border border-gray-300 focus:border-gray-500 focus:outline-none transition-colors"
        />
      </div>

      {open && results && total > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.posts.length > 0 && (
            <section>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Blog</p>
              {results.posts.map((p) => (
                <a key={p.slug} href={`/${tenantSlug}/blog/${p.slug}`} className="block px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                  {p.title}
                </a>
              ))}
            </section>
          )}
          {results.pages.length > 0 && (
            <section>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Halaman</p>
              {results.pages.map((p) => (
                <a key={p.slug} href={`/${tenantSlug}/${p.slug}`} className="block px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                  {p.title}
                </a>
              ))}
            </section>
          )}
          {results.events.length > 0 && (
            <section>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Event</p>
              {results.events.map((e) => (
                <a key={e.slug} href={`/${tenantSlug}/event/${e.slug}`} className="block px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                  {e.name}
                </a>
              ))}
            </section>
          )}
          {results.products.length > 0 && (
            <section>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Produk</p>
              {results.products.map((p) => (
                <a key={p.slug} href={`/${tenantSlug}/toko/${p.slug}`} className="block px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                  {p.name}
                </a>
              ))}
            </section>
          )}
          {results.members.length > 0 && (
            <section>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Anggota</p>
              {results.members.map((m) => (
                <div key={m.memberNumber} className="px-3 py-2 text-sm text-muted-foreground">
                  {m.name} <span className="text-xs">#{m.memberNumber}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ── User avatar / dropdown ────────────────────────────────────────────────────

function UserButton({ tenantSlug }: { tenantSlug: string }) {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={`/${tenantSlug}/login`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Masuk
        </a>
        <a
          href={`/${tenantSlug}/register`}
          className="text-sm px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Daftar
        </a>
      </div>
    );
  }

  const name    = session.user.name ?? session.user.email ?? "U";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
          {initial}
        </div>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
            </div>
            <div className="py-1">
              <a
                href={`/${tenantSlug}/profil`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
              >
                <User className="h-4 w-4" />
                Profil Saya
              </a>
              <button
                type="button"
                onClick={() => { void signOut(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── FlexHeader (main export) ──────────────────────────────────────────────────

export function FlexHeader({ tenantSlug, siteName, logoUrl, navMenu, primaryColor }: HeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        {/* TopBar */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-4 h-14">
            {/* Logo */}
            <a href={`/${tenantSlug}`} className="flex items-center gap-2.5 shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={siteName} className="h-12 w-auto object-contain" />
              ) : (
                <>
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {siteName.charAt(0)}
                  </div>
                  <span className="font-semibold text-sm leading-tight hidden sm:block max-w-[160px] line-clamp-2">
                    {siteName}
                  </span>
                </>
              )}
            </a>

            {/* Search */}
            <SearchBar tenantSlug={tenantSlug} />

            <div className="ml-auto flex items-center gap-2">
              {/* Lonceng — placeholder */}
              <button
                type="button"
                className="hidden md:flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted/60 text-muted-foreground transition-colors"
                aria-label="Notifikasi"
              >
                <Bell className="h-4.5 w-4.5" />
              </button>

              {/* User */}
              <UserButton tenantSlug={tenantSlug} />
            </div>
          </div>
        </div>

        {/* NavBar — hanya desktop */}
        {navMenu.length > 0 && (
          <div className="hidden md:block border-t border-gray-200">
            <div className="max-w-6xl mx-auto px-4">
              <nav className="flex items-center gap-0.5 h-10">
                {navMenu.map((item) => {
                  const href  = resolveNavHref(item, tenantSlug);
                  const isExt = item.external ?? false;
                  return (
                    <a
                      key={item.id}
                      href={href}
                      target={isExt ? "_blank" : undefined}
                      rel={isExt ? "noopener noreferrer" : undefined}
                      className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/60 transition-colors whitespace-nowrap"
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Bottom nav — hanya mobile */}
      <BottomNav navMenu={navMenu} tenantSlug={tenantSlug} />

      {/* Spacer agar konten tidak tertimpa bottom nav di mobile */}
      <div className="h-14 md:hidden" />
    </>
  );
}
