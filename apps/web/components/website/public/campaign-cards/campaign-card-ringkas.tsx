import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_COLORS } from "@/lib/campaign-card-templates";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function CampaignCardRingkas({ campaign, tenantSlug, className }: { campaign: CampaignCardData; tenantSlug: string; className?: string }) {
  const typeColor = CAMPAIGN_TYPE_COLORS[campaign.campaignType] ?? "bg-primary/10 text-primary";

  return (
    <a
      href={`/${tenantSlug}/campaign/${campaign.slug}`}
      className={cn(
        "group flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all",
        className,
      )}
    >
      <div className="aspect-video bg-muted overflow-hidden">
        {campaign.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.coverUrl} alt={campaign.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Heart className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${typeColor}`}>
          {CAMPAIGN_TYPE_LABELS[campaign.campaignType]}
        </span>
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {campaign.title}
        </h3>
        {campaign.progressPercent !== null && (
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${campaign.progressPercent}%` }} />
          </div>
        )}
      </div>
    </a>
  );
}
