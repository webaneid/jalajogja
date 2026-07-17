import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CampaignCard } from "./campaign-card";

// Desain 1 — Klasik. Grid di desktop, List di mobile (wajib untuk semua desain di registry
// ini — lihat lib/campaign-archive-card-designs.ts). Dual-render CSS breakpoint, SSR-safe,
// tidak perlu "use client" — pola sama AnggotaDirectoryClient (tabel desktop / card mobile).
export function CampaignArchiveCardsDesign1({
  campaigns,
  tenantSlug,
}: {
  campaigns:  CampaignCardData[];
  tenantSlug: string;
}) {
  return (
    <>
      {/* Desktop: Grid 3 kolom */}
      <div className="hidden md:grid grid-cols-3 gap-5">
        {campaigns.map(c => (
          <CampaignCard key={c.id} campaign={c} variant="grid" tenantSlug={tenantSlug} />
        ))}
      </div>
      {/* Mobile: List */}
      <div className="md:hidden flex flex-col">
        {campaigns.map(c => (
          <CampaignCard key={c.id} campaign={c} variant="list" tenantSlug={tenantSlug} />
        ))}
      </div>
    </>
  );
}
