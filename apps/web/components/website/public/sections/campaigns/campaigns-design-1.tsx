import { PostsSectionTitle } from "../posts/posts-section-title";
import { CampaignCard } from "@/components/website/public/campaign-cards/campaign-card";
import type { CampaignsSectionProps } from "@/lib/campaigns-section-designs";

export function CampaignsDesign1({ campaigns, tenantSlug, sectionTitle, filterHref }: CampaignsSectionProps) {
  if (campaigns.length === 0) return null;
  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />

        {/* Desktop: Grid 3 kolom */}
        <div className="hidden md:grid grid-cols-3 gap-5">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} variant="grid" tenantSlug={tenantSlug} />
          ))}
        </div>

        {/* Mobile: slider horizontal — lebih nyaman di-scroll daripada grid sempit di layar kecil */}
        <div
          className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {campaigns.map(c => (
            <div key={c.id} className="flex-none w-[75%] sm:w-[45%] snap-start">
              <CampaignCard campaign={c} variant="grid" tenantSlug={tenantSlug} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
