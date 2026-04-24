import type { NavItem } from "@/lib/nav-menu";

export type HeaderProps = {
  tenantSlug:   string;
  siteName:     string;
  logoUrl:      string | null;
  navMenu:      NavItem[];
  primaryColor: string;
  // currentUser diambil client-side di FlexHeader via authClient.useSession()
  // TIDAK di-pass lewat props agar PublicLayout tetap ISR-safe
};

export const HEADER_DESIGN_IDS = ["flex", "classic"] as const;
export type HeaderDesignId = typeof HEADER_DESIGN_IDS[number];

export const HEADER_DESIGN_LABELS: Record<HeaderDesignId, string> = {
  flex:    "Flex (2 Baris)",
  classic: "Klasik",
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
};
