import { notFound }            from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { createTenantDb, db, tenants, members, getSettings } from "@jalajogja/db";
import { auth }                from "@/lib/auth";
import { headers }             from "next/headers";
import { publicUrl }           from "@/lib/minio";
import { renderBody }          from "@/lib/letter-render";
import { CampaignDetailClient } from "@/components/donasi/public/campaign-detail-client";
import { CampaignCard }        from "@/components/website/public/campaign-cards/campaign-card";
import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_COLORS } from "@/lib/campaign-card-templates";
import type { Metadata }       from "next";
import { ChevronRight, Heart } from "lucide-react";
import { generateMetadata as buildMetadata, getTenantSeoBase } from "@/lib/seo";

export const revalidate = 60;

type Params = Promise<{ tenant: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, slug: campaignSlug } = await params;
  const [base] = await Promise.all([getTenantSeoBase(slug)]);
  const tenantClient = createTenantDb(slug);
  const { db: tdb, schema } = tenantClient;
  const [campaign] = await tdb
    .select({ title: schema.campaigns.title, metaTitle: schema.campaigns.metaTitle, metaDesc: schema.campaigns.metaDesc, coverId: schema.campaigns.coverId })
    .from(schema.campaigns).where(and(eq(schema.campaigns.slug, campaignSlug), eq(schema.campaigns.status, "active"))).limit(1);
  if (!campaign) return {};
  let ogImage = base.logoUrl;
  if (campaign.coverId) {
    const [media] = await tdb.select({ path: schema.media.path, variants: schema.media.variants })
      .from(schema.media).where(eq(schema.media.id, campaign.coverId)).limit(1);
    if (media) {
      const vv = media.variants as Record<string, string> | null;
      ogImage = vv?.["large"] ?? vv?.["original"] ?? publicUrl(slug, media.path);
    }
  }
  return buildMetadata({
    title:       campaign.metaTitle ?? campaign.title,
    description: campaign.metaDesc ?? undefined,
    siteName:    base.siteName,
    canonicalUrl: `${base.baseUrl}/campaign/${campaignSlug}`,
    ogImageUrl:  ogImage,
    ogType:      "article",
  });
}

export default async function CampaignDetailPage({ params }: { params: Params }) {
  const { tenant: slug, slug: campaignSlug } = await params;

  const [tenant] = await db.select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  const [campaign] = await tenantDb.select().from(schema.campaigns)
    .where(and(eq(schema.campaigns.slug, campaignSlug), eq(schema.campaigns.status, "active"))).limit(1);
  if (!campaign) notFound();

  // Cover
  let coverUrl: string | null = null;
  if (campaign.coverId) {
    const [m] = await tenantDb.select({ path: schema.media.path }).from(schema.media)
      .where(eq(schema.media.id, campaign.coverId)).limit(1);
    if (m) coverUrl = publicUrl(slug, m.path);
  }

  // Session
  const session   = await auth.api.getSession({ headers: await headers() });
  let defaultName = "";
  if (session?.user?.id) {
    const [member] = await db.select({ name: members.name }).from(members)
      .where(eq(members.betterAuthUserId, session.user.id)).limit(1);
    defaultName = member?.name ?? session.user.name ?? "";
  }

  // Progress
  const collected   = parseFloat(campaign.collectedAmount);
  const target      = campaign.targetAmount ? parseFloat(campaign.targetAmount) : null;
  const progressPct = target ? Math.min(100, Math.round((collected / target) * 100)) : 0;

  // Donasi terbaru
  type DonorRow = { donorName: string; isAnonymous: boolean };
  let donorList: DonorRow[] = [];
  if (campaign.showDonorList) {
    donorList = await tenantDb.select({ donorName: schema.donations.donorName, isAnonymous: schema.donations.isAnonymous })
      .from(schema.donations).where(eq(schema.donations.campaignId, campaign.id))
      .orderBy(desc(schema.donations.createdAt)).limit(10)
      .then(rows => rows.map(r => ({ donorName: r.isAnonymous ? "Anonim" : r.donorName, isAnonymous: r.isAnonymous })));
  }

  // Qurban data
  type QurbanAnimal = { id: string; animalType: "domba"|"kambing"|"sapi"; price: number; stock: number; booked: number; split: number | null; isActive: boolean };
  let qurbanAnimals: QurbanAnimal[] = [];
  let slaughterFees = { domba: 0, kambing: 0, sapi: 0 };

  if (campaign.campaignType === "qurban") {
    const [qRows, donasiSettings] = await Promise.all([
      tenantDb.select().from(schema.qurbanAnimals)
        .where(and(eq(schema.qurbanAnimals.campaignId, campaign.id), eq(schema.qurbanAnimals.isActive, true))),
      getSettings(tenantClient, "donasi"),
    ]);
    qurbanAnimals = qRows.map(r => ({
      id:         r.id,
      animalType: r.animalType as QurbanAnimal["animalType"],
      price:      parseFloat(r.price),
      stock:      r.stock,
      booked:     r.booked,
      split:      r.split ?? null,
      isActive:   r.isActive,
    }));
    const qc = donasiSettings.qurban_config as { slaughter_fees?: { domba?: number; kambing?: number; sapi?: number } } | undefined;
    slaughterFees = {
      domba:   qc?.slaughter_fees?.domba   ?? 0,
      kambing: qc?.slaughter_fees?.kambing ?? 0,
      sapi:    qc?.slaughter_fees?.sapi    ?? 0,
    };
  }

  // Nominal rekomendasi untuk donasi reguler
  let recommendedAmounts: number[] = [];
  if (campaign.campaignType !== "qurban") {
    const donasiSettings = await getSettings(tenantClient, "donasi");
    const dc = donasiSettings.donation_config as { recommended_amounts?: number[] } | undefined;
    recommendedAmounts = dc?.recommended_amounts ?? [10000, 25000, 50000, 100000];
  }

  // Kampanye terkait (kategori sama)
  let relatedCampaigns: CampaignCardData[] = [];
  if (campaign.categoryId) {
    const relRows = await tenantDb.select({
      id: schema.campaigns.id, title: schema.campaigns.title, slug: schema.campaigns.slug,
      description: schema.campaigns.description, campaignType: schema.campaigns.campaignType,
      coverId: schema.campaigns.coverId, targetAmount: schema.campaigns.targetAmount,
      collectedAmount: schema.campaigns.collectedAmount, endsAt: schema.campaigns.endsAt,
      categoryName: schema.campaignCategories.name,
    })
    .from(schema.campaigns)
    .leftJoin(schema.campaignCategories, eq(schema.campaignCategories.id, schema.campaigns.categoryId))
    .where(and(eq(schema.campaigns.status, "active"), eq(schema.campaigns.categoryId, campaign.categoryId)))
    .orderBy(desc(schema.campaigns.createdAt)).limit(4);

    const relCoverIds = [...new Set(relRows.map(r => r.coverId).filter(Boolean))] as string[];
    const relCoverMap = new Map<string, string>();
    if (relCoverIds.length > 0) {
      const media = await tenantDb.select({ id: schema.media.id, path: schema.media.path })
        .from(schema.media).where(inArray(schema.media.id, relCoverIds));
      media.forEach(m => relCoverMap.set(m.id, publicUrl(slug, m.path)));
    }

    relatedCampaigns = relRows
      .filter(r => r.id !== campaign.id)
      .slice(0, 3)
      .map(r => {
        const col = parseFloat(r.collectedAmount ?? "0");
        const tgt = r.targetAmount ? parseFloat(r.targetAmount) : null;
        return {
          id:              r.id, title: r.title, slug: r.slug, description: r.description,
          campaignType:    (r.campaignType ?? "donasi") as CampaignCardData["campaignType"],
          coverUrl:        r.coverId ? (relCoverMap.get(r.coverId) ?? null) : null,
          categoryName:    r.categoryName ?? null,
          targetAmount:    r.targetAmount ?? null,
          collectedAmount: String(col),
          progressPercent: tgt ? Math.min(100, Math.round((col / tgt) * 100)) : null,
          endsAt:          r.endsAt ? r.endsAt.toISOString() : null,
          isRecurring:     false,
        };
      });
  }

  const typeColor = CAMPAIGN_TYPE_COLORS[campaign.campaignType] ?? "bg-primary/10 text-primary";

  return (
    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href={`/${slug}/campaign`} className="hover:text-foreground transition-colors">Donasi</a>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{campaign.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Kiri: info */}
          <div className="lg:col-span-3 space-y-5">
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt={campaign.title} className="w-full rounded-xl object-cover aspect-video" />
            )}

            <div className="space-y-2">
              <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${typeColor}`}>
                {CAMPAIGN_TYPE_LABELS[campaign.campaignType]}
              </span>
              <h1 className="text-2xl font-bold">{campaign.title}</h1>
            </div>

            {/* Progress */}
            {campaign.campaignType !== "qurban" && target && campaign.showAmount && (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Terkumpul <span className="font-semibold text-primary">Rp {collected.toLocaleString("id-ID")}</span></span>
                  <span className="text-muted-foreground">{progressPct}% dari Rp {target.toLocaleString("id-ID")}</span>
                </div>
              </div>
            )}

            {/* Deskripsi */}
            {campaign.description && (
              <div className="prose prose-sm max-w-none [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3"
                dangerouslySetInnerHTML={{ __html: renderBody(campaign.description) }} />
            )}

            {/* Donatur */}
            {campaign.showDonorList && donorList.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-sm">Donatur Terbaru</h3>
                <ul className="space-y-1.5">
                  {donorList.map((d, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Heart className="h-3.5 w-3.5 text-primary shrink-0" />
                      {d.donorName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Kanan: form */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold mb-4">
                {campaign.campaignType === "qurban" ? "Pesan Qurban" : "Donasi Sekarang"}
              </h2>
              <CampaignDetailClient
                campaignId={campaign.id}
                campaignTitle={campaign.title}
                campaignType={campaign.campaignType as "donasi"|"zakat"|"wakaf"|"qurban"}
                tenantSlug={slug}
                recommendedAmounts={recommendedAmounts}
                qurbanAnimals={qurbanAnimals}
                slaughterFees={slaughterFees}
                defaultName={defaultName}
              />
            </div>
          </div>
        </div>

        {/* Related campaigns */}
        {relatedCampaigns.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border">Campaign Lainnya</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} variant="grid" tenantSlug={slug} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
