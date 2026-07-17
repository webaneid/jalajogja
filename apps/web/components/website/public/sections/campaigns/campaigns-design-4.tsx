import { PostsSectionTitle } from "../posts/posts-section-title";
import { CampaignCardCapsule } from "@/components/website/public/campaign-cards/campaign-card-capsule";
import type { CampaignsSectionProps } from "@/lib/campaigns-section-designs";

// Desain 4 — Modern Capsule. Pola dual-render identik CampaignsDesign1 (grid desktop / slider
// mobile) — cuma komponen kartu yang beda (CampaignCardCapsule, bukan CampaignCard variant grid).
// Lihat docs/arsitektur-donasi.md § 14n.
export function CampaignsDesign4({ campaigns, tenantSlug, sectionTitle, filterHref }: CampaignsSectionProps) {
  if (campaigns.length === 0) return null;
  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />

        {/* Desktop: Grid Capsule 3 kolom */}
        <div className="hidden md:grid grid-cols-3 gap-5">
          {campaigns.map(c => (
            <CampaignCardCapsule key={c.id} campaign={c} tenantSlug={tenantSlug} />
          ))}
        </div>

        {/* Mobile: slider horizontal — bukan list, section landing punya ruang vertikal terbatas */}
        <div
          className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {campaigns.map(c => (
            <div key={c.id} className="flex-none w-[75%] sm:w-[45%] snap-start">
              <CampaignCardCapsule campaign={c} tenantSlug={tenantSlug} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
