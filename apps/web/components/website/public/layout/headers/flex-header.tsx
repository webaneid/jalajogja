"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Menu, X, ChevronDown, User, LogOut, Home, LayoutDashboard } from "lucide-react";
import { authClient, signOut } from "@/lib/auth-client";
import { type NavItem, resolveNavHref } from "@/lib/nav-menu";
import type { HeaderProps } from "@/lib/header-designs";
import { CartButton } from "@/components/website/public/layout/cart-button";
import { checkDashboardAccessAction, getAkunAvatarAction } from "@/app/(public)/[tenant]/actions";
import { PublicButton } from "@/components/website/public/ui/public-button";
import { iconForHref } from "@/components/ui/public-link-icon";

// ── Mobile bottom nav — Beranda melayang di tengah + maks 4 item + "Lainnya" ────────────────
// Diekspor (dipakai `footer-bottom-nav.tsx`) — dirender OLEH LAYOUT SETELAH footer, BUKAN di
// sini bersama <header>. Spacer-nya (h-14) harus reserve ruang di PALING BAWAH halaman (setelah
// {children} + footer), bukan tepat di bawah header — kalau dibundel di sini, spacer nyangkut
// di ATAS {children} karena FlexHeader dirender sebelum <main> oleh PublicLayout. Lihat lesson
// CLAUDE.md soal bug ini (kelas sama dengan bug spacer /keranjang & /checkout).
//
// Ikon per item di-resolve dari pola href (iconForHref, lihat public-link-icon.tsx) — NavItem
// tidak simpan metadata type, hanya href string, jadi tidak bisa lookup langsung seperti
// PublicLinkPicker. Tabel ikonnya SAMA (satu sumber kebenaran), cuma cara resolve-nya beda.

function isHomeHref(href: string, baseUrl: string): boolean {
  return href === "/" || href === baseUrl || href === `${baseUrl}/`;
}

function NavIconLink({ item, baseUrl, onClick }: { item: NavItem; baseUrl: string; onClick?: () => void }) {
  const href = resolveNavHref(item);
  const Icon = iconForHref(href, baseUrl);
  return (
    <a
      href={href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener noreferrer" : undefined}
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] leading-tight truncate max-w-[56px] text-center">
        {item.label}
      </span>
    </a>
  );
}

export function BottomNav({
  navMenu,
  baseUrl,
}: {
  navMenu: NavItem[];
  baseUrl: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Beranda selalu tampil sebagai tombol melayang di tengah — item navMenu yang juga menunjuk
  // ke beranda difilter agar tidak duplikat. Maks 3 item menu asli ditampilkan (kiri 2 + kanan 1),
  // slot ke-4 (kanan) SELALU direservasi untuk "Lainnya" kalau ada overflow — supaya kiri/kanan
  // selalu seimbang 2-2, bukan kiri 2 vs kanan 3 seperti sebelumnya.
  const items         = navMenu.filter((item) => !isHomeHref(resolveNavHref(item), baseUrl));
  const mainItems     = items.slice(0, 3);
  const extra         = items.slice(3);
  const hasMore       = extra.length > 0;
  const left          = mainItems.slice(0, 2);
  const right         = mainItems.slice(2, 3);
  const homeHref      = baseUrl === "" ? "/" : `${baseUrl}/`;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="relative">
          {/* Beranda — tombol melayang, HANYA ~15% tingginya yang overlap di atas garis bar
              (bukan 50% — -translate-y-[15%] menggeser naik 15% dari tinggi elemen itu sendiri,
              bukan 15% dari parent, karena persentase pada CSS transform relatif ke reference
              box elemen sendiri) */}
          <a
            href={homeHref}
            aria-label="Beranda"
            className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[15%] flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-white transition-transform active:scale-95"
          >
            <Home className="h-6 w-6" />
          </a>

          <div className="bg-white border-t border-border rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,0.08)] pt-3">
            <div className="flex items-center justify-around h-16 px-1">
              {left.map((item) => (
                <NavIconLink key={item.id} item={item} baseUrl={baseUrl} />
              ))}

              <div className="w-16 shrink-0" aria-hidden="true" />

              {right.map((item) => (
                <NavIconLink key={item.id} item={item} baseUrl={baseUrl} />
              ))}

              {hasMore && (
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="flex flex-col items-center gap-1 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Menu className="h-5 w-5" />
                  <span className="text-[10px]">Lainnya</span>
                </button>
              )}
            </div>
          </div>
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
                const href = resolveNavHref(item);
                const Icon = iconForHref(href, baseUrl);
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

// ── Search overlay mobile — dialog terpusat, dipicu dari ikon search header ──────────────
// Duplikasi sengaja dari SearchBar di bawah (fetch logic sama) — SearchBar didesain untuk
// input inline desktop (hidden md:block), overlay ini untuk trigger ikon mobile. Pola sama
// dengan file header lain di project ini (tiap desain self-contained, lihat pill-header.tsx).

function MobileSearchOverlay({
  tenantSlug,
  baseUrl,
  onClose,
}: {
  tenantSlug: string;
  baseUrl:    string;
  onClose:    () => void;
}) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<null | {
    posts:    { title: string; slug: string }[];
    pages:    { title: string; slug: string }[];
    events:   { name: string; slug: string }[];
    products: { name: string; slug: string; price: number }[];
    members:  { name: string; memberNumber: string }[];
  }>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults(null); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?slug=${encodeURIComponent(tenantSlug)}&q=${encodeURIComponent(query)}`
        );
        if (res.ok) setResults(await res.json());
      } catch { /* ignore */ }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, tenantSlug]);

  const total = results
    ? results.posts.length + results.pages.length + results.events.length +
      results.products.length + results.members.length
    : 0;

  return (
    <div
      className="md:hidden fixed inset-0 z-[100] bg-black/40 flex items-start justify-center pt-[8vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-background rounded-3xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 bg-muted/60 rounded-full mx-3 mt-3 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari berita, produk, atau kegiatan..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="h-7 w-7 rounded-full bg-background flex items-center justify-center shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-3">
          {total === 0 && query.length >= 2 && (
            <p className="text-sm text-muted-foreground px-2 py-3">Tidak ada hasil untuk &quot;{query}&quot;.</p>
          )}
          {results?.posts.map((p) => (
            <a key={p.slug} href={`${baseUrl}/post/${p.slug}`} className="flex items-center gap-2 px-2 py-2.5 rounded-xl text-sm hover:bg-muted/60 transition-colors">
              <span className="text-[10px] uppercase tracking-wide bg-muted rounded-full px-2 py-0.5 text-muted-foreground shrink-0">Post</span>
              {p.title}
            </a>
          ))}
          {results?.pages.map((p) => (
            <a key={p.slug} href={`${baseUrl}/${p.slug}`} className="flex items-center gap-2 px-2 py-2.5 rounded-xl text-sm hover:bg-muted/60 transition-colors">
              <span className="text-[10px] uppercase tracking-wide bg-muted rounded-full px-2 py-0.5 text-muted-foreground shrink-0">Halaman</span>
              {p.title}
            </a>
          ))}
          {results?.events.map((ev) => (
            <a key={ev.slug} href={`${baseUrl}/agenda/${ev.slug}`} className="flex items-center gap-2 px-2 py-2.5 rounded-xl text-sm hover:bg-muted/60 transition-colors">
              <span className="text-[10px] uppercase tracking-wide bg-muted rounded-full px-2 py-0.5 text-muted-foreground shrink-0">Event</span>
              {ev.name}
            </a>
          ))}
          {results?.products.map((p) => (
            <a key={p.slug} href={`${baseUrl}/produk/${p.slug}`} className="flex items-center gap-2 px-2 py-2.5 rounded-xl text-sm hover:bg-muted/60 transition-colors">
              <span className="text-[10px] uppercase tracking-wide bg-muted rounded-full px-2 py-0.5 text-muted-foreground shrink-0">Produk</span>
              {p.name}
            </a>
          ))}
          {results?.members.map((m) => (
            <div key={m.memberNumber} className="flex items-center gap-2 px-2 py-2.5 text-sm text-muted-foreground">
              <span className="text-[10px] uppercase tracking-wide bg-muted rounded-full px-2 py-0.5 shrink-0">Anggota</span>
              {m.name} <span className="text-xs">#{m.memberNumber}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Ikon mobile — search + keranjang saja, flat hitam-putih dengan border tipis (bukan kapsul
// warna). Menu navigasi TETAP di bawah (BottomNav/footer, tidak disentuh) — bukan di header.
// Style sama dengan IconButton di pill-header.tsx, disalin ke sini (pola self-contained per
// file header, bukan di-share).

function MobileHeaderIcons({
  tenantSlug,
  baseUrl,
  onSearchClick,
}: {
  tenantSlug:    string;
  baseUrl:       string;
  onSearchClick: () => void;
}) {
  return (
    <div className="flex md:hidden items-center gap-2">
      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Cari"
        className="flex items-center justify-center h-8 w-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>
      <CartButton
        tenantSlug={tenantSlug}
        baseUrl={baseUrl}
        className="relative flex items-center justify-center h-8 w-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      />
    </div>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────

function SearchBar({ tenantSlug, baseUrl }: { tenantSlug: string; baseUrl: string }) {
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
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Postingan</p>
              {results.posts.map((p) => (
                <a key={p.slug} href={`${baseUrl}/post/${p.slug}`} className="block px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                  {p.title}
                </a>
              ))}
            </section>
          )}
          {results.pages.length > 0 && (
            <section>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Halaman</p>
              {results.pages.map((p) => (
                <a key={p.slug} href={`${baseUrl}/${p.slug}`} className="block px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                  {p.title}
                </a>
              ))}
            </section>
          )}
          {results.events.length > 0 && (
            <section>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Event</p>
              {results.events.map((e) => (
                <a key={e.slug} href={`${baseUrl}/agenda/${e.slug}`} className="block px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                  {e.name}
                </a>
              ))}
            </section>
          )}
          {results.products.length > 0 && (
            <section>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">Produk</p>
              {results.products.map((p) => (
                <a key={p.slug} href={`${baseUrl}/produk/${p.slug}`} className="block px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
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

function UserButton({ tenantSlug, baseUrl }: { tenantSlug: string; baseUrl: string }) {
  const { data: session }          = authClient.useSession();
  const [mounted, setMounted]      = useState(false);
  const [open, setOpen]            = useState(false);
  const [hasDashboard, setHasDash] = useState(false);
  const [photoUrl, setPhotoUrl]    = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!session?.user) { setHasDash(false); setPhotoUrl(null); return; }
    checkDashboardAccessAction(tenantSlug).then(setHasDash);
    getAkunAvatarAction().then(setPhotoUrl);
  }, [session?.user?.id, tenantSlug]);

  // Saat hydration, server dan client keduanya render guest state agar tidak mismatch.
  // Setelah mount, baru switch ke state sebenarnya berdasarkan session.
  if (!mounted || !session) {
    return (
      <div className="flex items-center gap-2">
        <PublicButton href={`${baseUrl}/login`} variant="ghost" size="sm" icon="none">
          Masuk
        </PublicButton>
        <PublicButton href={`${baseUrl}/register`} variant="primary" size="sm" icon="arrow">
          Daftar
        </PublicButton>
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
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name}
            className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
            {initial}
          </div>
        )}
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
                href={`${baseUrl}/akun`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
              >
                <User className="h-4 w-4" />
                Akun Saya
              </a>
              {hasDashboard && (
                <a
                  href={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com"}/app/${tenantSlug}/dashboard`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard Admin
                </a>
              )}
              <div className="border-t border-border my-1" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void signOut({ fetchOptions: { onSuccess: () => { window.location.href = baseUrl || "/"; } } });
                }}
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
// Catatan: `<BottomNav>` TIDAK dirender di sini — lihat komentar di definisi `BottomNav` di
// atas dan `footer-bottom-nav.tsx` (dirender oleh PublicLayout SETELAH footer).

export function FlexHeader({ tenantSlug, siteName, logoUrl, navMenu, primaryColor, baseUrl }: HeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        {/* TopBar */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 h-14">
            {/* Logo */}
            <a href={baseUrl || "/"} className="flex items-center gap-2.5 shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={siteName} className="h-12 w-auto object-contain" />
              ) : (
                <>
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center font-bold shrink-0 bg-primary text-primary-foreground"
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
            <SearchBar tenantSlug={tenantSlug} baseUrl={baseUrl} />

            <div className="ml-auto flex items-center gap-2">
              {/* Ikon mobile — search + keranjang (desktop pakai SearchBar inline + CartButton
                  biasa di bawah, jadi ini md:hidden). Menu navigasi tetap di BottomNav bawah. */}
              <MobileHeaderIcons
                tenantSlug={tenantSlug}
                baseUrl={baseUrl}
                onSearchClick={() => setMobileSearchOpen(true)}
              />

              {/* Keranjang belanja — desktop saja (mobile: di dalam kapsul di atas) */}
              <CartButton tenantSlug={tenantSlug} baseUrl={baseUrl} />

              {/* User */}
              <UserButton tenantSlug={tenantSlug} baseUrl={baseUrl} />
            </div>
          </div>
        </div>

        {/* NavBar — hanya desktop */}
        {navMenu.length > 0 && (
          <div className="hidden md:block border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4">
              <nav className="flex items-center gap-0.5 h-10">
                {navMenu.map((item) => {
                  const href  = resolveNavHref(item);
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

      {mobileSearchOpen && (
        <MobileSearchOverlay
          tenantSlug={tenantSlug}
          baseUrl={baseUrl}
          onClose={() => setMobileSearchOpen(false)}
        />
      )}
    </>
  );
}
