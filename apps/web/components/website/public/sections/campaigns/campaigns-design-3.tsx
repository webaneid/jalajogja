import { PostsSectionTitle } from "../posts/posts-section-title";
import { CampaignCard } from "@/components/website/public/campaign-cards/campaign-card";
import type { CampaignsSectionProps } from "@/lib/campaigns-section-designs";

export function CampaignsDesign3({ data, campaigns, tenantSlug, sectionTitle, filterHref }: CampaignsSectionProps) {
  if (campaigns.length === 0) return null;
  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle
          title={sectionTitle}
          eyebrow={data.eyebrow}
          description={data.headerDesc}
          align={data.titleAlign}
          href={filterHref}
          linkLabel="Lihat Semua"
        />
        <div className="divide-y divide-border">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} variant="list" tenantSlug={tenantSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}
