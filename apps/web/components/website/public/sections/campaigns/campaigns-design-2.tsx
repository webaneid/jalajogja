import { PostsSectionTitle } from "../posts/posts-section-title";
import { CampaignCard } from "@/components/website/public/campaign-cards/campaign-card";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_COLORS, formatRp, daysRemaining } from "@/lib/campaign-card-templates";
import type { CampaignsSectionProps } from "@/lib/campaigns-section-designs";
import { Heart } from "lucide-react";

export function CampaignsDesign2({ campaigns, tenantSlug, sectionTitle, filterHref }: CampaignsSectionProps) {
  if (campaigns.length === 0) return null;

  const featured  = campaigns[0]!;
  const rest      = campaigns.slice(1, 5);
  const days      = daysRemaining(featured.endsAt);
  const typeColor = CAMPAIGN_TYPE_COLORS[featured.campaignType] ?? "bg-primary/10 text-primary";

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />

        {/* ── MOBILE: 2-col grid semua ── */}
        <div className="md:hidden grid grid-cols-2 gap-3">
          {campaigns.slice(0, 6).map(c => (
            <CampaignCard key={c.id} campaign={c} variant="grid" tenantSlug={tenantSlug} />
          ))}
        </div>

        {/* ── DESKTOP: featured besar + 2 kecil ── */}
        <div className="hidden md:grid grid-cols-2 gap-6">
          {/* Featured besar */}
          <a
            href={`/${tenantSlug}/campaign/${featured.slug}`}
            className="group flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="aspect-video overflow-hidden bg-muted">
              {featured.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.coverUrl} alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                  <Heart className="w-14 h-14" />
                </div>
              )}
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-1.5 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
                  {CAMPAIGN_TYPE_LABELS[featured.campaignType]}
                </span>
                {featured.categoryName && (
                  <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {featured.categoryName}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {featured.title}
              </h3>
              {featured.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{featured.description}</p>
              )}
              {featured.progressPercent !== null && (
                <div className="space-y-1.5">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${featured.progressPercent}%` }} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-primary">{formatRp(featured.collectedAmount)}</span>
                    <span className="text-muted-foreground">{featured.progressPercent}%</span>
                  </div>
                </div>
              )}
              {days !== null && (
                <p className="text-xs text-muted-foreground">{days === 0 ? "Berakhir hari ini" : `${days} hari lagi`}</p>
              )}
            </div>
          </a>

          {/* 2 kecil di kanan */}
          {rest.length > 0 && (
            <div className="flex flex-col gap-4">
              {rest.map(c => (
                <CampaignCard key={c.id} campaign={c} variant="grid" tenantSlug={tenantSlug} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
