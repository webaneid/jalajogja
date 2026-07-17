import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_COLORS, daysRemaining } from "@/lib/campaign-card-templates";
import { CampaignCardInfoBlock } from "./campaign-card-info-block";
import { Heart } from "lucide-react";

// Desain 2 — Modern Capsule. Sumber ide: design-refs/Bantuanku/Bantuanku Landing.html,
// section "Aksi Prioritas" (lihat docs/arsitektur-donasi.md § 14n untuk detail keputusan).
// Badge urgensi ("MENDESAK"/"PRIORITAS") dari sumber SENGAJA tidak diambil — sistem kita tidak
// punya konsep urgensi campaign. Info block area reuse CampaignCardInfoBlock (§ 14k) — otomatis
// dapat dukungan qurban (harga+ketersediaan) tanpa kode tambahan.
export function CampaignCardCapsule({ campaign, tenantSlug }: { campaign: CampaignCardData; tenantSlug: string }) {
  const days      = daysRemaining(campaign.endsAt);
  const typeColor = CAMPAIGN_TYPE_COLORS[campaign.campaignType] ?? "bg-primary/10 text-primary";
  const ctaLabel  = campaign.campaignType === "qurban" ? "Pilih Hewan" : "Donasi Sekarang";
  const showMeta  = campaign.infoBlock.kind === "progress" && (days !== null || campaign.donorCount > 0);

  return (
    <a
      href={`/${tenantSlug}/campaign/${campaign.slug}`}
      className="group flex flex-col rounded-3xl overflow-hidden bg-card shadow-md hover:shadow-lg transition-shadow"
    >
      {/* Cover */}
      <div className="aspect-[3/2] bg-muted overflow-hidden">
        {campaign.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.coverUrl} alt={campaign.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Heart className="w-10 h-10" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${typeColor}`}>
            {campaign.categoryName ?? CAMPAIGN_TYPE_LABELS[campaign.campaignType]}
          </span>
        </div>

        <div>
          <h3 className="font-bold text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {campaign.title}
          </h3>
          {campaign.description && (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{campaign.description}</p>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <CampaignCardInfoBlock info={campaign.infoBlock} layout="grid" />

          {showMeta && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {days !== null
                ? <span>🕐 {days === 0 ? "Berakhir hari ini" : `${days} hari lagi`}</span>
                : <span />}
              {campaign.donorCount > 0 && <span>👥 {campaign.donorCount.toLocaleString("id-ID")} donatur</span>}
            </div>
          )}

          {/* CTA visual — bukan <a>/<button> sungguhan (nested di dalam <a> pembungkus card),
              lihat docs/arsitektur-donasi.md § 14n */}
          <span className="btn btn-primary btn-md btn-full">{ctaLabel}</span>
        </div>
      </div>
    </a>
  );
}
