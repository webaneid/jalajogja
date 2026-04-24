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
  navMenu:         NavItem[];
  contactSettings: ContactSettings;
  primaryColor:    string;
};

export const FOOTER_DESIGN_IDS = ["dark", "light"] as const;
export type FooterDesignId = typeof FOOTER_DESIGN_IDS[number];

export const FOOTER_DESIGN_LABELS: Record<FooterDesignId, string> = {
  dark:  "Gelap",
  light: "Terang",
};

// Registry — tambah desain baru di sini saja
export const FOOTER_DESIGNS: Record<FooterDesignId, {
  label:       string;
  description: string;
}> = {
  dark: {
    label:       "Gelap",
    description: "Background abu gelap, teks putih. 3 kolom: logo+sosmed | navigasi | kontak.",
  },
  light: {
    label:       "Terang",
    description: "Background putih, teks gelap. (Belum tersedia)",
  },
};
