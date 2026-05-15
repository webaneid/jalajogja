import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_COLORS, formatRp } from "@/lib/campaign-card-templates";
import { Heart } from "lucide-react";

export function CampaignCardList({ campaign, tenantSlug }: { campaign: CampaignCardData; tenantSlug: string }) {
  const typeColor = CAMPAIGN_TYPE_COLORS[campaign.campaignType] ?? "bg-primary/10 text-primary";

  return (
    <a
      href={`/${tenantSlug}/campaign/${campaign.slug}`}
      className="group flex gap-3 items-start py-3 border-t border-border first:border-0 hover:bg-muted/40 px-2 -mx-2 rounded-lg transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-20 h-16 shrink-0 rounded-lg overflow-hidden bg-muted">
        {campaign.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.coverUrl} alt={campaign.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Heart className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${typeColor}`}>
            {CAMPAIGN_TYPE_LABELS[campaign.campaignType]}
          </span>
        </div>
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {campaign.title}
        </h3>
        {campaign.campaignType !== "qurban" && (
          <div className="flex items-center gap-2">
            {campaign.progressPercent !== null ? (
              <>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${campaign.progressPercent}%` }} />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatRp(campaign.collectedAmount)}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Terkumpul: <span className="font-medium text-foreground">{formatRp(campaign.collectedAmount)}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </a>
  );
}
