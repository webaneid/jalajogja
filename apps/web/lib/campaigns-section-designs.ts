import type { CampaignCardData } from "./campaign-card-templates";
import type { CampaignArchiveCardDesignId } from "./campaign-archive-card-designs";
import type { SectionTitleAlign } from "./section-title-align";

export type CampaignsSectionData = {
  title:        string;
  eyebrow?:     string;             // judul kecil di atas title, opsional
  headerDesc?:  string;             // deskripsi di bawah title, opsional
  titleAlign?:  SectionTitleAlign;  // default "left" — lihat lib/section-title-align.ts
  count:        number;          // default 6
  categoryId:   string | null;
  campaignType: "donasi" | "zakat" | "wakaf" | "qurban" | null; // null = semua tipe
};

export const CAMPAIGNS_SECTION_DESIGN_IDS = ["1", "2", "3"] as const;
export type CampaignsSectionDesignId = typeof CAMPAIGNS_SECTION_DESIGN_IDS[number];

export type CampaignsSectionDesignMeta = {
  label:       string;
  description: string;
  minCount:    number;
};

// Desain 1 "Grid Donasi" ikut setting "Desain Kartu Arsip" (§ 14m/14o) secara otomatis — bukan
// pilihan kartu terpisah. Desain 2/3 tidak terpengaruh (2 = layout custom, 3 = sudah reuse List).
export const CAMPAIGNS_SECTION_DESIGNS: Record<CampaignsSectionDesignId, CampaignsSectionDesignMeta> = {
  "1": { label: "Grid Donasi",       description: "3 kolom grid — ikut Desain Kartu Arsip yang aktif (Klasik/Modern Capsule).", minCount: 3 },
  "2": { label: "Campaign Unggulan", description: "1 campaign besar + 2 kecil di samping.",               minCount: 3 },
  "3": { label: "Daftar Donasi",     description: "List vertikal ringkas, cocok untuk widget atau sidebar.", minCount: 2 },
};

export type CampaignsSectionProps = {
  data:         CampaignsSectionData;
  campaigns:    CampaignCardData[];
  tenantSlug:   string;
  sectionTitle: string;
  filterHref:   string;
  cardDesign:   CampaignArchiveCardDesignId;   // dipakai HANYA oleh CampaignsDesign1, § 14o
};
