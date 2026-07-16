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
  // showModuleStrip berarti beda per desain: Desain 1 = tampilkan HERO_MODULES (strip kartu
  // modul, seperti sejak awal). Desain 2 = tampilkan Funfact (statistik live dari funfactItems).
  showModuleStrip?:   boolean;
  funfactItems?:      string[]; // FunfactId[], maks 4 — HANYA dipakai Desain 2, diabaikan Desain 1
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

// Data statis strip modul — HANYA dipakai Hero Desain 1 (Klasik). Desain 2 pakai Funfact
// (FUNFACT_CATALOG di bawah) untuk slot yang sama, bukan strip modul ini lagi.
// Untuk strip modul independen (di luar hero), lihat lib/module-strip-designs.ts — katalog
// terpisah dan lebih lengkap (8 modul), sengaja tidak dibagi dengan konstanta ini.
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

// ── Funfact — HANYA Hero Desain 2 ───────────────────────────────────────────────
// Statistik dihitung live dari database (bukan diketik manual admin) — admin cuma pilih
// metrik mana yang mau ditampilkan (maks 4). Query per metrik ada di sections/hero/hero-section.tsx.

export const FUNFACT_CATALOG = {
  anggota:     { label: "Total Anggota" },
  campaign:    { label: "Program Donasi Aktif" },
  donasi_rp:   { label: "Total Donasi Terkumpul" },
  event:       { label: "Event Terlaksana" },
  produk:      { label: "Produk Tersedia" },
  dokumen:     { label: "Dokumen Publik" },
  post:        { label: "Artikel Diterbitkan" },
  usaha:       { label: "Usaha Terdaftar" },
  pesantren:   { label: "Pesantren Terdaftar" },
  profesional: { label: "Profesional Terdaftar" },
} as const;

export type FunfactId = keyof typeof FUNFACT_CATALOG;
export const FUNFACT_IDS = Object.keys(FUNFACT_CATALOG) as FunfactId[];
export const FUNFACT_MAX = 4;

export type FunfactResult = {
  id:     FunfactId;
  number: string;
  label:  string;
};
