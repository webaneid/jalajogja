import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_COLORS, formatRp, daysRemaining } from "@/lib/campaign-card-templates";
import { Heart } from "lucide-react";

export function CampaignCardGrid({ campaign, tenantSlug }: { campaign: CampaignCardData; tenantSlug: string }) {
  const days = daysRemaining(campaign.endsAt);
  const typeColor = CAMPAIGN_TYPE_COLORS[campaign.campaignType] ?? "bg-primary/10 text-primary";

  return (
    <a
      href={`/${tenantSlug}/campaign/${campaign.slug}`}
      className="group flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
    >
      {/* Cover */}
      <div className="aspect-video bg-muted overflow-hidden">
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
      <div className="p-3 sm:p-4 flex flex-col gap-1.5 sm:gap-2 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
            {CAMPAIGN_TYPE_LABELS[campaign.campaignType]}
          </span>
          {campaign.categoryName && (
            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {campaign.categoryName}
            </span>
          )}
          {campaign.isRecurring && (
            <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Rutin</span>
          )}
        </div>

        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {campaign.title}
        </h3>

        {/* Progress / Terkumpul */}
        {campaign.campaignType !== "qurban" && (
          <div className="mt-auto space-y-1.5">
            {campaign.progressPercent !== null ? (
              <>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${campaign.progressPercent}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{formatRp(campaign.collectedAmount)}</span>
                  <span>{campaign.progressPercent}%</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Terkumpul <span className="font-semibold text-foreground">{formatRp(campaign.collectedAmount)}</span>
              </p>
            )}
          </div>
        )}

        {days !== null && (
          <p className="text-xs text-muted-foreground mt-auto">
            {days === 0 ? "Berakhir hari ini" : `${days} hari lagi`}
          </p>
        )}
      </div>
    </a>
  );
}
