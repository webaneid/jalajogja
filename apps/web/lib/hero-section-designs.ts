import { Heart, CalendarDays, FolderOpen, Users } from "lucide-react";

export type HeroSectionData = {
  eyebrow?:           string;
  title?:             string;
  subtitle?:          string;
  ctaLabel?:          string;
  ctaUrl?:            string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?:   string;
  imageUrl?:          string;
  showModuleStrip?:   boolean;
};

export const HERO_SECTION_DESIGN_IDS = ["1", "2"] as const;
export type HeroSectionDesignId = typeof HERO_SECTION_DESIGN_IDS[number];

export const HERO_SECTION_DESIGNS: Record<HeroSectionDesignId, {
  label:       string;
  description: string;
}> = {
  "1": {
    label:       "Klasik",
    description: "Judul + subtitle + 2 CTA sejajar dengan gambar; kartu mengambang berisi event/berita terbaru.",
  },
  "2": {
    label:       "Full-Bleed Modern",
    description: "Gambar penuh layar dengan overlay gelap, badge, judul besar putih — cocok untuk foto suasana/kegiatan.",
  },
};

// Data statis strip modul — dipakai bersama oleh semua desain hero yang mengaktifkan showModuleStrip
export const HERO_MODULES = [
  { id: "campaign", path: "campaign", label: "Donasi",       desc: "Program & infaq",       Icon: Heart },
  { id: "agenda",   path: "agenda",   label: "Agenda",       desc: "Agenda & kegiatan",     Icon: CalendarDays },
  { id: "dokumen",  path: "dokumen",  label: "Dokumen",      desc: "Arsip & laporan",       Icon: FolderOpen },
  { id: "anggota",  path: "anggota",  label: "Data Anggota", desc: "Direktori anggota",     Icon: Users },
] as const;

export type HeroCardData = {
  type:  "event" | "post";
  label: string;
  title: string;
  href:  string;
  date:  string | null;
};

export type HeroDesignProps = {
  data:      HeroSectionData;
  baseUrl:   string;
  heroCard:  HeroCardData | null;
};
