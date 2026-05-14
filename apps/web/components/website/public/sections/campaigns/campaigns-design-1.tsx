import { PostsSectionTitle } from "../posts/posts-section-title";
import { CampaignCard } from "@/components/website/public/campaign-cards/campaign-card";
import type { CampaignsSectionProps } from "@/lib/campaigns-section-designs";

export function CampaignsDesign1({ campaigns, tenantSlug, sectionTitle, filterHref }: CampaignsSectionProps) {
  if (campaigns.length === 0) return null;
  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />
        {/* Mobile: 2 kolom (Shopee style). Desktop: 3 kolom */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} variant="grid" tenantSlug={tenantSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}
