"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Menu, X } from "lucide-react";
import type { NavItem } from "@/lib/nav-menu";

type Props = {
  backHref: string;   // fallback kalau tidak ada history browser (mis. buka dari link share langsung)
  navMenu:  NavItem[];
  siteName: string;
};

// Overlay back+menu untuk shell mobile halaman single (post/event/campaign/produk/page).
// Melekat di gambar fitur saat halaman dibuka (transparan, tanpa backdrop) — ikut ter-scroll
// ke atas bersama gambar saat user scroll ke bawah, lalu otomatis muncul lagi mengambang
// (dengan backdrop, karena saat itu posisinya di atas body teks bukan gambar) begitu user
// scroll ke atas sedikit saja. Lihat docs/arsitektur-mobile-shell.md.
export function SingleMobileTopBar({ backHref, navMenu, siteName }: Props) {
  const router = useRouter();
  const [revealed,       setRevealed]       = useState(true);
  const [scrolledPastTop, setScrolledPastTop] = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const lastScrollY = useRef(0);
  const ticking     = useRef(false);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    function handleScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y    = window.scrollY;
        const last = lastScrollY.current;
        const delta = y - last;

        if (Math.abs(delta) > 8) {
          setRevealed(delta < 0 || y < 40); // scroll ke atas ATAU masih dekat puncak → tampil
          lastScrollY.current = y;
        }
        setScrolledPastTop(y > 40);
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleBack() {
    if (window.history.length > 1) router.back();
    else router.push(backHref);
  }

  return (
    <>
      <div
        className={`md:hidden fixed top-0 left-0 right-0 z-[70] flex items-center justify-between px-4 py-3 transition-transform duration-300 ${
          revealed ? "translate-y-0" : "-translate-y-full"
        } ${scrolledPastTop ? "bg-background/95 backdrop-blur-md border-b border-border" : ""}`}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Kembali"
          className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${
            scrolledPastTop
              ? "bg-muted text-foreground"
              : "bg-black/30 text-white backdrop-blur-sm"
          }`}
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Buka menu"
          className="flex items-center justify-center h-9 w-9 rounded-full bg-primary text-white shadow-sm"
        >
          <Menu size={18} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[80] bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold">{siteName}</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Tutup menu"
              className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-4">
            <ul className="space-y-1">
              {navMenu.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="block rounded-lg px-3 py-3 text-base font-medium hover:bg-muted transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
