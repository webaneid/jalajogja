import type { CampaignCardData, CampaignCardVariant } from "@/lib/campaign-card-templates";
import { CampaignCardGrid }    from "./campaign-card-grid";
import { CampaignCardList }    from "./campaign-card-list";
import { CampaignCardRingkas } from "./campaign-card-ringkas";

type Props = {
  campaign:   CampaignCardData;
  variant:    CampaignCardVariant;
  tenantSlug: string;
  className?: string;
};

export function CampaignCard({ campaign, variant, tenantSlug, className }: Props) {
  switch (variant) {
    case "list":    return <CampaignCardList    campaign={campaign} tenantSlug={tenantSlug} />;
    case "ringkas": return <CampaignCardRingkas campaign={campaign} tenantSlug={tenantSlug} className={className} />;
    default:        return <CampaignCardGrid    campaign={campaign} tenantSlug={tenantSlug} />;
  }
}
