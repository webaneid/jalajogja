"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Menu, X, ChevronDown, User, LogOut, LayoutDashboard } from "lucide-react";
import { authClient, signOut } from "@/lib/auth-client";
import { resolveNavHref } from "@/lib/nav-menu";
import type { HeaderProps } from "@/lib/header-designs";
import { CartButton } from "@/components/website/public/layout/cart-button";
import { checkDashboardAccessAction, getAkunAvatarAction, getTickerPostsAction } from "@/app/(public)/[tenant]/actions";
import { PublicButton } from "@/components/website/public/ui/public-button";

type SearchResultItem = {
  title: string;
  url: string;
  category: string;
};

function formatGregorianDate(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const str = formatter.format(now);
    // Capitalize first character (misal "kamis, 30 juli 2026" -> "Kamis, 30 Juli 2026")
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return "Kamis, 30 Juli 2026";
  }
}

export function NewsHeader({
  tenantSlug,
  siteName,
  logoUrl,
  navMenu,
  primaryColor,
  baseUrl,
}: HeaderProps) {
  const { data: session } = authClient.useSession();
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);
  const [avatarUrl, setAvatarUrl]                   = useState<string | null>(null);

  // Marquee ticker posts state
  const [tickerPosts, setTickerPosts]               = useState<Array<{ title: string; href: string }>>([]);

  // Search state
  const [searchQuery, setSearchQuery]               = useState("");
  const [searchResults, setSearchResults]           = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading]           = useState(false);
  const [searchOpen, setSearchOpen]                 = useState(false);
  const searchRef                                   = useRef<HTMLDivElement>(null);

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen]         = useState(false);

  // User menu dropdown
  const [userDropdownOpen, setUserDropdownOpen]     = useState(false);
  const userDropdownRef                             = useRef<HTMLDivElement>(null);

  const formattedDate = formatGregorianDate();

  // Cek dashboard access & avatar saat session berubah
  useEffect(() => {
    if (!session?.user?.id) {
      setHasDashboardAccess(false);
      setAvatarUrl(null);
      return;
    }
    checkDashboardAccessAction(tenantSlug).then(setHasDashboardAccess);
    getAkunAvatarAction().then((url) => setAvatarUrl(url));
  }, [session?.user?.id, tenantSlug]);

  // Fetch recent posts untuk ticker marquee
  useEffect(() => {
    getTickerPostsAction(tenantSlug).then(setTickerPosts);
  }, [tenantSlug]);

  // Click outside to close user dropdown & search results
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live search debounce 300ms
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?slug=${tenantSlug}&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          const items: SearchResultItem[] = [];

          if (data.posts) {
            data.posts.forEach((p: { title: string; slug: string }) => {
              items.push({ title: p.title, url: `${baseUrl}/post/${p.slug}`, category: "Berita" });
            });
          }
          if (data.pages) {
            data.pages.forEach((p: { title: string; slug: string }) => {
              items.push({ title: p.title, url: `${baseUrl}/${p.slug}`, category: "Halaman" });
            });
          }
          if (data.events) {
            data.events.forEach((e: { name: string; slug: string }) => {
              items.push({ title: e.name, url: `${baseUrl}/agenda/${e.slug}`, category: "Agenda" });
            });
          }
          if (data.products) {
            data.products.forEach((pr: { name: string; slug: string }) => {
              items.push({ title: pr.name, url: `${baseUrl}/produk/${pr.slug}`, category: "Produk" });
            });
          }

          setSearchResults(items);
          setSearchOpen(items.length > 0);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, tenantSlug, baseUrl]);

  // Initial name for avatar fallback
  const userInitial = session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U";

  // Login & Register permalinks
  const loginHref    = `${baseUrl}/login`;
  const registerHref = `${baseUrl}/register`;

  // Ticker items (HANYA POSTINGAN BERITA SAJA)
  const displayTicker = tickerPosts.length > 0
    ? tickerPosts.map((p) => ({ title: p.title, url: p.href }))
    : [{ title: `Selamat datang di website resmi ${siteName}`, url: `${baseUrl}/post` }];

  return (
    <header className="w-full bg-background border-b border-border shadow-xs">
      
      {/* ── TOPBAR: Background Warna Utama (Primary) ── */}
      <div className="bg-primary text-primary-foreground py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs font-medium">
          
          {/* Sisi Kiri: Tanggal Masehi Single (Format ID) */}
          <div className="flex items-center gap-2 tracking-wide font-mono uppercase">
            <span>{formattedDate}</span>
          </div>

          {/* Sisi Kanan: Cart Button (Tombol Kapsul Sekunder Tenant — No Nested <a>) */}
          <div className="flex items-center gap-3">
            <CartButton
              tenantSlug={tenantSlug}
              baseUrl={baseUrl}
              className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs h-auto w-auto"
            />
          </div>

        </div>
      </div>

      {/* ── MAINBAR: Logo, Inline Search Form & User Auth ── */}
      <div className="py-4 px-4 border-b border-border/50 bg-background">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-8">
          
          {/* Logo Tenant / Site Name Dinamis (No Hardcode) */}
          <a href={baseUrl || "/"} className="flex items-center gap-3 shrink-0 no-underline group">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={siteName} className="h-10 sm:h-12 w-auto object-contain max-w-[200px]" />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center text-lg shadow-sm">
                  {siteName.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-lg sm:text-xl text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {siteName}
                </span>
              </div>
            )}
          </a>

          {/* Inline Search Input (Langsung Terbuka Tanpa Klik Toggle) */}
          <div ref={searchRef} className="relative flex-1 max-w-lg hidden sm:block">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                placeholder="Cari berita, agenda, topik atau informasi..."
                className="w-full h-10 pl-10 pr-9 text-sm rounded-full border border-border bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                autoComplete="off"
              />
              <span className="absolute right-3.5 text-[11px] font-mono text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded border border-border/60">
                /
              </span>
            </div>

            {/* Live Autocomplete Results Box */}
            {searchOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
                {searchLoading ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground">Mencari...</div>
                ) : (
                  searchResults.slice(0, 5).map((res, i) => (
                    <a
                      key={i}
                      href={res.url}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50 text-xs transition-colors no-underline"
                    >
                      <span className="font-medium text-foreground line-clamp-1">{res.title}</span>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                        {res.category}
                      </span>
                    </a>
                  ))
                )}
              </div>
            )}
          </div>

          {/* User Auth Buttons / Dropdown Profile (Presisi 2-Row FlexHeader Style) */}
          <div className="flex items-center gap-3">
            {session?.user ? (
              /* User Menu Logged-In */
              <div ref={userDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-full hover:bg-muted transition-colors border border-border/60"
                  aria-expanded={userDropdownOpen}
                >
                  {avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatarUrl} alt={session.user.name ?? ""} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs">
                      {userInitial}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-foreground max-w-[100px] truncate hidden md:inline">
                    {session.user.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {/* Dropdown Box */}
                {userDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border rounded-xl shadow-xl z-50 py-1.5">
                    <div className="px-3.5 py-2 border-b border-border/50">
                      <p className="text-xs font-semibold text-foreground truncate">{session.user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{session.user.email}</p>
                    </div>
                    {hasDashboardAccess && (
                      <a
                        href={`/${tenantSlug}/dashboard`}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted no-underline"
                      >
                        <LayoutDashboard className="w-4 h-4 text-primary" />
                        <span>Dashboard Pengurus</span>
                      </a>
                    )}
                    <a
                      href={`${baseUrl}/akun`}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted no-underline"
                    >
                      <User className="w-4 h-4 text-primary" />
                      <span>Akun Saya</span>
                    </a>
                    <div className="border-t border-border/50 my-1" />
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-destructive" />
                      <span>Keluar</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Guest Auth Buttons (2-Row FlexHeader Style) */
              <div className="hidden md:flex items-center gap-2">
                <PublicButton href={loginHref} variant="ghost" size="sm" icon="none">
                  Masuk
                </PublicButton>
                <PublicButton href={registerHref} variant="primary" size="sm" icon="none">
                  Daftar
                </PublicButton>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center p-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* ── DESKTOP NAVBAR: Links Menu Utama ── */}
      <nav className="hidden md:block border-b border-border/40 bg-background">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 overflow-x-auto scrollbar-none py-2.5">
          {navMenu.map((item) => {
            const href = resolveNavHref(item);
            return (
              <a
                key={item.id}
                href={href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors no-underline py-1 shrink-0"
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>

      {/* ── LIVE UPDATE / MARQUEE TICKER (POSTINGAN BERITA SAJA) ── */}
      <div className="bg-muted/40 border-b border-border/50 py-1.5 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-foreground animate-pulse" />
            Live Update
          </span>
          <div className="overflow-hidden relative w-full">
            <div className="flex items-center gap-8 whitespace-nowrap animate-marquee">
              {displayTicker.concat(displayTicker).map((item, idx) => (
                <a
                  key={idx}
                  href={item.url}
                  className="text-muted-foreground hover:text-primary transition-colors no-underline inline-flex items-center gap-2"
                >
                  <span className="text-secondary font-bold">•</span>
                  <span>{item.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE MENU DRAWER ── */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-background px-4 py-4 space-y-4">
          
          {/* Mobile Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari..."
              className="w-full h-9 pl-9 pr-3 text-xs rounded-full border border-border bg-muted/40"
            />
          </div>

          {/* Mobile Nav Links */}
          <div className="space-y-1">
            {navMenu.map((item) => {
              const href = resolveNavHref(item);
              return (
                <a
                  key={item.id}
                  href={href}
                  className="block py-2 text-sm font-semibold text-foreground hover:text-primary no-underline border-b border-border/40"
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          {/* Mobile Auth Actions (Jika Belum Login) */}
          {!session?.user && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <PublicButton href={loginHref} variant="outline-dark" size="sm" className="flex-1">
                Masuk
              </PublicButton>
              <PublicButton href={registerHref} variant="primary" size="sm" className="flex-1">
                Daftar
              </PublicButton>
            </div>
          )}

        </div>
      )}

    </header>
  );
}
