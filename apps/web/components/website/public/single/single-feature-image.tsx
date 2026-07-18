import type { NavItem } from "@/lib/nav-menu";
import { SingleMobileTopBar } from "./single-mobile-topbar";

type Props = {
  src?:      string | null;
  alt?:      string;
  children?: React.ReactNode;   // untuk produk — <ProductImageViewer> menggantikan <img> polos
  backHref:  string;
  navMenu:   NavItem[];
  siteName:  string;
};

// Wrapper full-bleed (tanpa px-4) untuk gambar fitur di shell mobile halaman single —
// satu-satunya elemen di halaman yang sengaja TIDAK pakai padding standar project (px-4),
// supaya gambar menyentuh tepi frame. SingleMobileTopBar di-render sebagai overlay
// (position: fixed) sehingga tidak perlu positioning context khusus dari komponen ini.
export function SingleFeatureImage({ src, alt, children, backHref, navMenu, siteName }: Props) {
  return (
    <div className="md:hidden relative w-full">
      <SingleMobileTopBar backHref={backHref} navMenu={navMenu} siteName={siteName} />
      {children ? (
        children
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ""} className="w-full aspect-video object-cover" />
      ) : null}
    </div>
  );
}
