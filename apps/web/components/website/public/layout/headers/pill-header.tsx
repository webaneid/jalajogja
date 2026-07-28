"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Menu, X, ChevronDown, User, LogOut, LayoutDashboard } from "lucide-react";
import { authClient, signOut } from "@/lib/auth-client";
import { type NavItem, resolveNavHref } from "@/lib/nav-menu";
import type { HeaderProps } from "@/lib/header-designs";
import { CartButton } from "@/components/website/public/layout/cart-button";
import { checkDashboardAccessAction, getAkunAvatarAction } from "@/app/(public)/[tenant]/actions";
import { PublicButton } from "@/components/website/public/ui/public-button";

// ── Ikon bulat berbingkai — dipakai untuk tombol search di header ────────────

function IconButton({
  label,
  onClick,
  children,
}: {
  label:    string;
  onClick:  () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center h-9 w-9 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
    >
      {children}
    </button>
  );
}

// ── Search overlay — dialog terpusat, bukan input inline ─────────────────────

function SearchOverlay({
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
    posts:    { title: string; slug: string; href: string }[];
    pages:    { title: string; slug: string }[];
    events:   { name: string; slug: string }[];
    products: { name: string; slug: string; price: number }[];
    members:  { name: string; memberNumber: string }[];
  }>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

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
      className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center pt-[8vh] px-4"
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
            <a key={p.slug} href={`${baseUrl}${p.href}`} className="flex items-center gap-2 px-2 py-2.5 rounded-xl text-sm hover:bg-muted/60 transition-colors">
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

// ── User avatar / dropdown — sama datanya dengan FlexHeader, styling menyesuaikan ──

function UserMenu({ tenantSlug, baseUrl }: { tenantSlug: string; baseUrl: string }) {
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
  if (!mounted || !session) {
    return (
      <div className="hidden md:flex items-center gap-2">
        <PublicButton href={`${baseUrl}/login`} variant="outline-dark" size="sm" icon="none">
          Masuk
        </PublicButton>
        <PublicButton href={`${baseUrl}/register`} variant="primary" size="sm" icon="none">
          Daftar
        </PublicButton>
      </div>
    );
  }

  const name    = session.user.name ?? session.user.email ?? "U";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name}
            className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {initial}
          </div>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border rounded-2xl shadow-lg overflow-hidden z-50">
            <div className="px-3 py-2.5 border-b border-border">
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

// ── Overlay menu mobile — full-screen, bukan drawer/bottom-nav ───────────────

function MobileOverlay({
  navMenu,
  baseUrl,
  onClose,
}: {
  navMenu: NavItem[];
  baseUrl: string;
  onClose: () => void;
}) {
  const { data: session } = authClient.useSession();

  return (
    <div className="md:hidden fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 h-16 border-b border-border">
        <span className="font-bold text-sm">Menu</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="h-9 w-9 rounded-full border border-border flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-6 flex flex-col">
        <div className="border-t border-border flex flex-col">
          {navMenu.map((item) => {
            const href  = resolveNavHref(item);
            const isExt = item.external ?? false;
            return (
              <a
                key={item.id}
                href={href}
                target={isExt ? "_blank" : undefined}
                rel={isExt ? "noopener noreferrer" : undefined}
                onClick={onClose}
                className="border-b border-border py-4 font-normal text-[17px]"
              >
                {item.label}
              </a>
            );
          })}
        </div>
        {!session?.user && (
          <div className="flex gap-2 mt-6">
            <PublicButton href={`${baseUrl}/login`} variant="outline-dark" size="md" icon="none" className="flex-1 justify-center">
              Masuk
            </PublicButton>
            <PublicButton href={`${baseUrl}/register`} variant="primary" size="md" icon="none" className="flex-1 justify-center">
              Daftar
            </PublicButton>
          </div>
        )}
        {session?.user && (
          <a href={`${baseUrl}/akun`} onClick={onClose} className="mt-6">
            <PublicButton variant="primary" size="md" icon="none" className="w-full justify-center">
              Akun Saya
            </PublicButton>
          </a>
        )}
      </nav>
    </div>
  );
}

// ── PillHeader (main export) ──────────────────────────────────────────────────

export function PillHeader({ tenantSlug, siteName, logoUrl, navMenu, primaryColor, baseUrl }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 h-16">
            {/* Logo — nama tenant HANYA tampil sebagai fallback saat belum upload logo */}
            <a href={baseUrl || "/"} className="flex items-center gap-2.5 shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={siteName} className="h-10 w-auto object-contain" />
              ) : (
                <>
                  <span className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-base shrink-0">
                    {siteName.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-bold text-sm tracking-tight hidden sm:block max-w-[160px] line-clamp-1">
                    {siteName}
                  </span>
                </>
              )}
            </a>

            {/* Nav — pill container, desktop only */}
            {navMenu.length > 0 && (
              <nav className="hidden md:flex items-center gap-0.5 ml-2 bg-muted/60 rounded-full p-1">
                {navMenu.map((item) => {
                  const href  = resolveNavHref(item);
                  const isExt = item.external ?? false;
                  return (
                    <a
                      key={item.id}
                      href={href}
                      target={isExt ? "_blank" : undefined}
                      rel={isExt ? "noopener noreferrer" : undefined}
                      className="px-4 py-2 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-background transition-colors whitespace-nowrap"
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            )}

            <div className="ml-auto flex items-center gap-2">
              <IconButton label="Cari" onClick={() => setSearchOpen(true)}>
                <Search className="h-4 w-4" />
              </IconButton>
              <CartButton tenantSlug={tenantSlug} baseUrl={baseUrl} className="flex" />
              <UserMenu tenantSlug={tenantSlug} baseUrl={baseUrl} />
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Menu"
                className="md:hidden flex items-center justify-center h-9 w-9 rounded-full border border-border text-muted-foreground"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <MobileOverlay navMenu={navMenu} baseUrl={baseUrl} onClose={() => setMobileOpen(false)} />
      )}
      {searchOpen && (
        <SearchOverlay tenantSlug={tenantSlug} baseUrl={baseUrl} onClose={() => setSearchOpen(false)} />
      )}
    </>
  );
}
