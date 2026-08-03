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
  url: string | null; // null = tidak bisa diklik (mis. Anggota — tidak ada halaman profil publik per-orang dari hasil pencarian ini)
  category: string;
};

function formatGregorianDate(): string {
  try {
    const now = new Date();
    // timeZone WAJIB eksplisit — server (VPS) tidak dijamin WIB (nol TZ= env var di manapun di
    // repo). Tanpa ini, string tanggal hasil SSR bisa beda dengan hasil render client saat
    // hydration → React hydration mismatch (kelas bug yang sudah berkali-kali dikunci di project
    // ini untuk komponen client manapun yang menampilkan tanggal).
    const formatter = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const str = formatter.format(now);
    // Capitalize first character (misal "kamis, 30 juli 2026" -> "Kamis, 30 Juli 2026")
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    const now = new Date();
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
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

  // Search popup state — dipicu ikon di top bar, dipakai bersama desktop+mobile (satu mekanisme,
  // bukan lagi input inline desktop + drawer input mobile yang terpisah)
  const [searchOpen, setSearchOpen]                 = useState(false);
  const [searchQuery, setSearchQuery]               = useState("");
  const [searchResults, setSearchResults]           = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading]           = useState(false);
  const searchInputRef                              = useRef<HTMLInputElement>(null);

  // Mobile menu state (nav links + auth — search sudah ditangani popup terpisah)
  const [mobileMenuOpen, setMobileMenuOpen]         = useState(false);

  // User menu dropdown
  const [userDropdownOpen, setUserDropdownOpen]     = useState(false);
  const userDropdownRef                             = useRef<HTMLDivElement>(null);

  // Dihitung via useEffect (BUKAN langsung saat render) — formatGregorianDate() panggil
  // new Date() yang bisa berbeda momen antara SSR (server) dan hydration (client), meski
  // granularitas cuma sampai hari (bukan jam/menit) risikonya sempit (hanya kalau kedua momen
  // itu melewati batas tengah malam WIB) — TAPI tetap risiko nyata & gratis dihindari total
  // dengan pola ini: null di render pertama (SSR & client SAMA PERSIS, nol teks) → terisi
  // SETELAH hydration selesai via effect (update state biasa, bukan hydration mismatch).
  const [formattedDate, setFormattedDate] = useState<string | null>(null);
  useEffect(() => {
    setFormattedDate(formatGregorianDate());
  }, []);

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

  // Click outside untuk tutup dropdown user (search popup tutup lewat backdrop-click sendiri)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Saat popup search dibuka: fokus input. Saat ditutup: reset query+hasil.
  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setSearchQuery("");
    setSearchResults([]);
  }, [searchOpen]);

  // Live search debounce 300ms — hanya jalan saat popup terbuka
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
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
            // p.href SUDAH resolved oleh resolvePostHrefs() (permalink-aware — hormati setting
            // permalink_structure tenant: post_name/date_name/dst) di /api/search — JANGAN
            // rekonstruksi manual dari slug, itu akan mengabaikan setting tenant.
            data.posts.forEach((p: { title: string; href: string }) => {
              items.push({ title: p.title, url: `${baseUrl}${p.href}`, category: "Berita" });
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
          if (data.members) {
            data.members.forEach((m: { name: string; memberNumber: string }) => {
              items.push({ title: `${m.name} #${m.memberNumber}`, url: null, category: "Anggota" });
            });
          }

          setSearchResults(items);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen, tenantSlug, baseUrl]);

  // Initial name for avatar fallback
  const userInitial = session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U";

  // Login & Register permalinks
  const loginHref    = `${baseUrl}/login`;
  const registerHref = `${baseUrl}/register`;

  // Ticker items (HANYA POSTINGAN BERITA SAJA)
  const displayTicker = tickerPosts.length > 0
    ? tickerPosts.map((p) => ({ title: p.title, url: p.href }))
    : [{ title: `Selamat datang di website resmi ${siteName}`, url: `${baseUrl}/post` }];

  // Satu render dipakai di dalam popup search — url=null (mis. hasil kategori "Anggota") →
  // baris info, tidak bisa diklik.
  function renderSearchResult(res: SearchResultItem, i: number) {
    const inner = (
      <>
        <span className="font-medium text-foreground line-clamp-1">{res.title}</span>
        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
          {res.category}
        </span>
      </>
    );
    if (!res.url) {
      return (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs">
          {inner}
        </div>
      );
    }
    return (
      <a
        key={i}
        href={res.url}
        onClick={() => setSearchOpen(false)}
        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 text-xs transition-colors no-underline"
      >
        {inner}
      </a>
    );
  }

  return (
    <header className="w-full bg-background border-b border-border shadow-xs">

      {/* ── ROW 1 — TOP BAR: Tanggal (kiri) + Search & Cart glass icon (kanan) ── */}
      <div className="bg-primary text-primary-foreground py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs font-medium">

          {/* Sisi Kiri: Tanggal Masehi Single (Format ID) */}
          <div className="flex items-center gap-2 tracking-wide font-mono uppercase">
            <span>{formattedDate}</span>
          </div>

          {/* Sisi Kanan: Search (icon → popup) + Cart — kapsul kaca (bg putih opacity kecil) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Cari"
              className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground hover:bg-white/25 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <CartButton
              tenantSlug={tenantSlug}
              baseUrl={baseUrl}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground hover:bg-white/25 transition-colors"
            />
          </div>

        </div>
      </div>

      {/* ── ROW 2 — LOGO / MENU / LOGIN (3 kolom) ── */}
      <div className="py-4 px-4 border-b border-border/50 bg-background">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center gap-4">

          {/* Kolom kiri: Logo Tenant / Site Name Dinamis (No Hardcode) */}
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

          {/* Kolom tengah: Nav Menu, desktop only — dipindah dari row navbar terpisah supaya
              header jadi 3 baris (bukan 4). Placeholder kosong tetap dirender saat navMenu
              kosong supaya grid-cols-[1fr_auto_1fr] tetap 3 kolom (logo/login tidak collapse). */}
          {navMenu.length > 0 ? (
            <nav className="hidden md:flex items-center justify-center gap-6">
              {navMenu.map((item) => {
                const href = resolveNavHref(item);
                return (
                  <a
                    key={item.id}
                    href={href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors no-underline whitespace-nowrap"
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          ) : (
            <div className="hidden md:block" />
          )}

          {/* Kolom kanan: User Auth Buttons / Dropdown Profile + Hamburger Mobile */}
          <div className="flex items-center justify-end gap-3">
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
                        // URL absolut WAJIB — /app/{slug}/dashboard bukan /{slug}/dashboard.
                        // Custom domain me-rewrite path relatif jadi /{slug}/{slug}/dashboard
                        // (404 double-slug); URL absolut ke jalakarta.com aman di domain manapun.
                        href={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com"}/app/${tenantSlug}/dashboard`}
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
              /* Guest Auth Buttons (desktop only, mobile lewat drawer hamburger) */
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

      {/* ── ROW 3 — LIVE UPDATE / MARQUEE TICKER (POSTINGAN BERITA SAJA) ── */}
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

      {/* ── MOBILE MENU DRAWER — nav links + auth (search sudah ditangani popup) ── */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-background px-4 py-4 space-y-4">

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

      {/* ── SEARCH POPUP — dipicu ikon di top bar, dipakai bersama desktop & mobile ── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center pt-[8vh] px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-background rounded-3xl shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 bg-muted/60 rounded-full mx-3 mt-3 px-4 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari berita, agenda, topik atau informasi..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Tutup"
                className="h-7 w-7 rounded-full bg-background flex items-center justify-center shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-3">
              {searchLoading ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">Mencari...</div>
              ) : searchResults.length > 0 ? (
                searchResults.slice(0, 8).map((res, i) => renderSearchResult(res, i))
              ) : searchQuery.trim().length >= 2 ? (
                <p className="text-sm text-muted-foreground px-2 py-3">Tidak ada hasil untuk &quot;{searchQuery}&quot;.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

    </header>
  );
}
