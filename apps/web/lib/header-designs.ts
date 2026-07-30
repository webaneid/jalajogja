import type { NavItem } from "@/lib/nav-menu";

export type HeaderProps = {
  tenantSlug:   string;
  siteName:     string;
  logoUrl:      string | null;
  navMenu:      NavItem[];
  primaryColor: string;
  baseUrl:      string; // "" jika custom domain, "/{slug}" jika path mode
  // currentUser diambil client-side di FlexHeader via authClient.useSession()
  // TIDAK di-pass lewat props agar PublicLayout tetap ISR-safe
};

export const HEADER_DESIGN_IDS = ["flex", "classic", "pill", "news"] as const;
export type HeaderDesignId = typeof HEADER_DESIGN_IDS[number];

export const HEADER_DESIGN_LABELS: Record<HeaderDesignId, string> = {
  flex:    "Flex (2 Baris)",
  classic: "Klasik",
  pill:    "Pill (Modern)",
  news:    "News",
};

// Registry — tambah desain baru di sini saja
export const HEADER_DESIGNS: Record<HeaderDesignId, {
  label:       string;
  description: string;
}> = {
  flex: {
    label:       "Flex (2 Baris)",
    description: "TopBar (logo + search + avatar) + NavBar di bawahnya. Mobile: bottom navigation bar.",
  },
  classic: {
    label:       "Klasik",
    description: "Logo + nav horizontal dalam satu baris. Hamburger menu di mobile.",
  },
  pill: {
    label:       "Pill (Modern)",
    description: "Nav kapsul, ikon bulat (cari/keranjang/menu), overlay pencarian + menu mobile full-screen.",
  },
  news: {
    label:       "News",
    description: "TopBar warna utama + tanggal masehi + Cart sekunder, MainBar logo + search input inline + auth, NavBar menu, & Marquee ticker.",
  },
};
