"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./headers/flex-header";
import type { NavItem } from "@/lib/nav-menu";
import type { HeaderDesignId } from "@/lib/header-designs";
import { isSingleMobileRoute, hasOwnMobileActionBar, isAkunAppMode } from "@/lib/mobile-route-checks";

type Props = {
  designId: HeaderDesignId;
  navMenu:  NavItem[];
  baseUrl:  string;
};

// `<BottomNav>` (tab navigasi khas FlexHeader) + spacer-nya WAJIB dirender DI SINI — dipanggil
// oleh PublicLayout SETELAH {children} dan <PublicFooter>, BUKAN dibundel dengan <header>
// (yang render SEBELUM {children}). Spacer harus reserve ruang kosong di PALING BAWAH halaman
// (tempat BottomNav yang `fixed` itu sungguhan berada secara visual), bukan tepat di bawah
// header — bug lama: spacer dibundel dengan header, jadi nyangkut di ATAS {children} di SEMUA
// halaman (kelas bug yang sama dengan spacer /keranjang & /checkout, tapi berlaku global).
// Lihat lesson CLAUDE.md.
export function FooterBottomNav({ designId, navMenu, baseUrl }: Props) {
  const pathname = usePathname();

  if (designId !== "flex") return null;
  if (isSingleMobileRoute(pathname, baseUrl)) return null;
  if (hasOwnMobileActionBar(pathname, baseUrl)) return null;
  if (isAkunAppMode(pathname, baseUrl)) return null; // /akun/* punya bottom nav sendiri

  return (
    <>
      <BottomNav navMenu={navMenu} baseUrl={baseUrl} />
      {/* h-20 (bukan h-14) — bar sekarang h-16 + pt-3 (76px) karena tombol Beranda melayang */}
      <div className="h-20 md:hidden" />
    </>
  );
}
