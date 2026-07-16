import type { NavItem } from "@/lib/nav-menu";

type ContactSettings = {
  contact_email?:   string;
  contact_phone?:   string;
  contact_address?: { detail?: string };
  socials?:         Record<string, string>;
};

export type FooterProps = {
  tenantSlug:      string;
  siteName:        string;
  logoUrl:         string | null;
  tagline:         string | null;
  description:     string | null;
  navMenu:         NavItem[];
  contactSettings: ContactSettings;
  primaryColor:    string;
  baseUrl:         string; // "" jika custom domain, "/{slug}" jika path mode
};

export const FOOTER_DESIGN_IDS = ["dark", "light", "modern"] as const;
export type FooterDesignId = typeof FOOTER_DESIGN_IDS[number];

export const FOOTER_DESIGN_LABELS: Record<FooterDesignId, string> = {
  dark:   "Gelap",
  light:  "Terang",
  modern: "Modern (Melengkung)",
};

export const FOOTER_DESIGNS: Record<FooterDesignId, {
  label:       string;
  description: string;
}> = {
  dark: {
    label:       "Gelap",
    description: "Background gelap, teks putih. Logo + sosmed | nav | kontak.",
  },
  light: {
    label:       "Terang",
    description: "Background putih, teks gelap. Struktur identik dengan desain Gelap.",
  },
  modern: {
    label:       "Modern (Melengkung)",
    description: "Kartu gelap dengan sudut atas melengkung, 1 baris 3-kolom (brand+sosmed | nav | kontak).",
  },
};
