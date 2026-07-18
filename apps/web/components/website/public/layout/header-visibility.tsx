"use client";

import { usePathname } from "next/navigation";
import { PublicHeader } from "./public-header";
import type { HeaderProps, HeaderDesignId } from "@/lib/header-designs";

// Top-level route folder di app/(public)/[tenant]/ yang BUKAN halaman single generik.
// WAJIB diupdate kalau ada folder static baru ditambah ke app/(public)/[tenant]/ — lihat
// docs/arsitektur-frontend-publik.md § "Mobile Single-Page Shell".
const STATIC_TOP_SEGMENTS = new Set([
  "agenda", "akun", "akun-error", "anggota", "campaign", "cart", "checkout",
  "dokumen", "event", "forgot-password", "invite", "invoice", "keranjang",
  "login", "pesantren", "post", "produk", "profesional", "register",
  "reset-password", "sign", "statistik", "usaha", "verify",
]);

// Halaman single mobile (post/agenda/campaign/produk detail + halaman generik) menyembunyikan
// header situs di layar mobile — diganti overlay back+menu yang melekat di gambar fitur
// (lihat SingleMobileTopBar). Header tetap tampil normal di tablet/desktop (≥768px) dan di
// semua halaman lain (arsip, homepage, dashboard akun, dll).
function isSingleMobileRoute(pathname: string, baseUrl: string): boolean {
  const rest = baseUrl !== "" && pathname.startsWith(baseUrl) ? pathname.slice(baseUrl.length) : pathname;
  const segments = rest.split("/").filter(Boolean);

  if (segments.length === 2) {
    if (segments[0] === "post" || segments[0] === "agenda" || segments[0] === "campaign") return true;
    if (segments[0] === "produk" && segments[1] !== "kategori") return true;
  }
  if (segments.length === 1 && !STATIC_TOP_SEGMENTS.has(segments[0])) return true;
  return false;
}

type Props = HeaderProps & { designId?: HeaderDesignId };

export function HeaderVisibility(props: Props) {
  const pathname = usePathname();
  const isSingle = isSingleMobileRoute(pathname, props.baseUrl);

  return (
    <div className={isSingle ? "hidden md:block" : ""}>
      <PublicHeader {...props} />
    </div>
  );
}
