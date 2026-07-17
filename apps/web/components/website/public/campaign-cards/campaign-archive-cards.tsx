import type { CampaignCardData } from "@/lib/campaign-card-templates";
import type { CampaignArchiveCardDesignId } from "@/lib/campaign-archive-card-designs";
import { CampaignArchiveCardsDesign1 } from "./campaign-archive-cards-design-1";

type Props = {
  design:     CampaignArchiveCardDesignId;
  campaigns:  CampaignCardData[];
  tenantSlug: string;
};

// Dispatcher desain kartu arsip — dipakai di /campaign (arsip) dan "Campaign Lainnya" (detail).
// Nambah desain baru: tambah ID di lib/campaign-archive-card-designs.ts + case di sini +
// komponen campaign-archive-cards-design-N.tsx baru (ikuti pola Design1 — grid desktop/list mobile).
export function CampaignArchiveCards({ design, campaigns, tenantSlug }: Props) {
  switch (design) {
    default: return <CampaignArchiveCardsDesign1 campaigns={campaigns} tenantSlug={tenantSlug} />;
  }
}
