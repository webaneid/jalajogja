import type { CampaignCardData } from "./campaign-card-templates";

export type CampaignsSectionData = {
  title:        string;
  count:        number;          // default 6
  categoryId:   string | null;
  campaignType: "donasi" | "zakat" | "wakaf" | "qurban" | null; // null = semua tipe
};

export const CAMPAIGNS_SECTION_DESIGN_IDS = ["1", "2", "3", "4"] as const;
export type CampaignsSectionDesignId = typeof CAMPAIGNS_SECTION_DESIGN_IDS[number];

export type CampaignsSectionDesignMeta = {
  label:       string;
  description: string;
  minCount:    number;
};

export const CAMPAIGNS_SECTION_DESIGNS: Record<CampaignsSectionDesignId, CampaignsSectionDesignMeta> = {
  "1": { label: "Grid Donasi",       description: "3 kolom grid dengan progress bar.",                    minCount: 3 },
  "2": { label: "Campaign Unggulan", description: "1 campaign besar + 2 kecil di samping.",               minCount: 3 },
  "3": { label: "Daftar Donasi",     description: "List vertikal ringkas, cocok untuk widget atau sidebar.", minCount: 2 },
  "4": { label: "Modern Capsule",    description: "Kartu bulat modern dengan progress + jumlah donatur. Slider di mobile.", minCount: 3 },
};

export type CampaignsSectionProps = {
  data:         CampaignsSectionData;
  campaigns:    CampaignCardData[];
  tenantSlug:   string;
  sectionTitle: string;
  filterHref:   string;
};
