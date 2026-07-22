import { PostsSectionTitle } from "../posts/posts-section-title";
import { CampaignCard } from "@/components/website/public/campaign-cards/campaign-card";
import { CampaignCardCapsule } from "@/components/website/public/campaign-cards/campaign-card-capsule";
import type { CampaignCardData } from "@/lib/campaign-card-templates";
import type { CampaignsSectionProps } from "@/lib/campaigns-section-designs";

// "Grid Donasi" — satu-satunya layout section landing yang berbentuk grid generik (bukan
// featured/list custom), jadi WAJIB ikut setting "Desain Kartu Arsip" (§ 14m/14o) — bukan
// pilihan kartu terpisah. `cardDesign` menentukan kartu grid mana yang dipakai, berlaku untuk
// desktop grid MAUPUN slider mobile.
function renderCard(c: CampaignCardData, tenantSlug: string, cardDesign: CampaignsSectionProps["cardDesign"]) {
  return cardDesign === "2"
    ? <CampaignCardCapsule campaign={c} tenantSlug={tenantSlug} />
    : <CampaignCard campaign={c} variant="grid" tenantSlug={tenantSlug} />;
}

export function CampaignsDesign1({ data, campaigns, tenantSlug, sectionTitle, filterHref, cardDesign }: CampaignsSectionProps) {
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

        {/* Desktop: Grid 3 kolom */}
        <div className="hidden md:grid grid-cols-3 gap-5">
          {campaigns.map(c => (
            <div key={c.id}>{renderCard(c, tenantSlug, cardDesign)}</div>
          ))}
        </div>

        {/* Mobile: slider horizontal — lebih nyaman di-scroll daripada grid sempit di layar kecil */}
        <div
          className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {campaigns.map(c => (
            <div key={c.id} className="flex-none w-[75%] sm:w-[45%] snap-start">
              {renderCard(c, tenantSlug, cardDesign)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
