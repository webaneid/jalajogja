import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CampaignCardCapsule } from "./campaign-card-capsule";
import { CampaignCardList }    from "./campaign-card-list";

// Desain 2 — Modern Capsule. Grid Capsule di desktop, List di mobile (wajib untuk semua desain
// di registry ini — lihat lib/campaign-archive-card-designs.ts). Mobile REUSE CampaignCardList
// yang sudah ada (bukan versi Capsule yang di-squeeze) — sama seperti Desain 1, cuma tampilan
// grid desktop yang beda per desain, list mobile adalah infrastruktur yang dibagi bersama.
export function CampaignArchiveCardsDesign2({
  campaigns,
  tenantSlug,
}: {
  campaigns:  CampaignCardData[];
  tenantSlug: string;
}) {
  return (
    <>
      {/* Desktop: Grid Capsule 3 kolom */}
      <div className="hidden md:grid grid-cols-3 gap-5">
        {campaigns.map(c => (
          <CampaignCardCapsule key={c.id} campaign={c} tenantSlug={tenantSlug} />
        ))}
      </div>
      {/* Mobile: List */}
      <div className="md:hidden flex flex-col">
        {campaigns.map(c => (
          <CampaignCardList key={c.id} campaign={c} tenantSlug={tenantSlug} />
        ))}
      </div>
    </>
  );
}
