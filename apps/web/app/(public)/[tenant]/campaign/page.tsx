import { notFound }           from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { createTenantDb, db, tenants, getSettings } from "@jalajogja/db";
import { publicUrl }          from "@/lib/minio";
import { CampaignArchiveCards } from "@/components/website/public/campaign-cards/campaign-archive-cards";
import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CAMPAIGN_TYPE_LABELS, buildProgressInfoBlock } from "@/lib/campaign-card-templates";
import { resolveQurbanInfoBlocks } from "@/lib/campaign-info-block";
import { resolveDonorCounts } from "@/lib/campaign-donor-count";
import { CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS, type CampaignArchiveCardDesignId } from "@/lib/campaign-archive-card-designs";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import type { Metadata }      from "next";
import { Heart }              from "lucide-react";

export const revalidate = 60;

type Params       = Promise<{ tenant: string }>;
type SearchParams  = Promise<{ type?: string; category?: string }>;

const VALID_TYPES = ["donasi", "zakat", "wakaf", "qurban"] as const;

// SEO ringan per kategori (Fase 2, docs/arsitektur-seo.md § 3.2) — kalau ?category= aktif dan
// kategori itu punya metaTitle/metaDesc, timpa default hardcode "Donasi & Infaq". Filter `type`
// (donasi/zakat/wakaf/qurban) di luar scope Fase 2 — tidak ada tabel kategori untuk itu.
export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const { category }     = await searchParams;
  const base = await getTenantSeoBase(slug);

  let title       = "Donasi & Infaq";
  let description: string | undefined;
  let canonicalUrl = `${base.baseUrl}/campaign`;

  if (category) {
    const { db: tenantDb, schema } = createTenantDb(slug);
    const [cat] = await tenantDb
      .select({ name: schema.campaignCategories.name, metaTitle: schema.campaignCategories.metaTitle, metaDesc: schema.campaignCategories.metaDesc })
      .from(schema.campaignCategories).where(eq(schema.campaignCategories.slug, category)).limit(1);
    if (cat) {
      title        = cat.metaTitle || `Donasi ${cat.name}`;
      description  = cat.metaDesc || undefined;
      canonicalUrl = `${base.baseUrl}/campaign?category=${category}`;
    }
  }

  return buildMetadata({ title, description, siteName: base.siteName, ogImageUrl: base.logoUrl, canonicalUrl });
}

export default async function CampaignArchivePage({
  params, searchParams,
}: {
  params: Params; searchParams: SearchParams;
}) {
  const { tenant: slug }     = await params;
  const { type, category }   = await searchParams;

  const [tenant] = await db.select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Resolve filter
  const validType = VALID_TYPES.includes(type as typeof VALID_TYPES[number])
    ? (type as "donasi" | "zakat" | "wakaf" | "qurban") : null;

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  if (category) {
    const [cat] = await tenantDb.select({ id: schema.campaignCategories.id, name: schema.campaignCategories.name })
      .from(schema.campaignCategories).where(eq(schema.campaignCategories.slug, category)).limit(1);
    if (cat) { categoryId = cat.id; categoryName = cat.name; }
  }

  const clauses = [
    eq(schema.campaigns.status, "active"),
    ...(validType   ? [eq(schema.campaigns.campaignType, validType)]  : []),
    ...(categoryId  ? [eq(schema.campaigns.categoryId,  categoryId)]  : []),
  ];

  const rows = await tenantDb
    .select({
      id:              schema.campaigns.id,
      title:           schema.campaigns.title,
      slug:            schema.campaigns.slug,
      description:     schema.campaigns.description,
      campaignType:    schema.campaigns.campaignType,
      coverId:         schema.campaigns.coverId,
      targetAmount:    schema.campaigns.targetAmount,
      collectedAmount: schema.campaigns.collectedAmount,
      endsAt:          schema.campaigns.endsAt,
      categoryName:    schema.campaignCategories.name,
    })
    .from(schema.campaigns)
    .leftJoin(schema.campaignCategories, eq(schema.campaignCategories.id, schema.campaigns.categoryId))
    .where(and(...clauses))
    .orderBy(desc(schema.campaigns.createdAt))
    .limit(50);

  // Resolve covers
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  const coverMap = new Map<string, string>();
  if (coverIds.length > 0) {
    const media = await tenantDb.select({ id: schema.media.id, path: schema.media.path })
      .from(schema.media).where(inArray(schema.media.id, coverIds));
    media.forEach(m => coverMap.set(m.id, publicUrl(slug, m.path)));
  }

  // Batch resolve info block qurban — satu query untuk semua campaign qurban di arsip ini
  const qurbanIds     = rows.filter(r => r.campaignType === "qurban").map(r => r.id);
  const qurbanInfoMap = await resolveQurbanInfoBlocks(tenantClient, qurbanIds);
  const donorCountMap = await resolveDonorCounts(tenantClient, rows.map(r => r.id));

  const campaigns: CampaignCardData[] = rows.map(r => {
    const collected = parseFloat(r.collectedAmount ?? "0");
    const target    = r.targetAmount ? parseFloat(r.targetAmount) : null;
    return {
      id:              r.id,
      title:           r.title,
      slug:            r.slug,
      description:     r.description,
      campaignType:    (r.campaignType ?? "donasi") as CampaignCardData["campaignType"],
      coverUrl:        r.coverId ? (coverMap.get(r.coverId) ?? null) : null,
      categoryName:    r.categoryName ?? null,
      targetAmount:    r.targetAmount ?? null,
      collectedAmount: String(collected),
      progressPercent: target ? Math.min(100, Math.round((collected / target) * 100)) : null,
      endsAt:          r.endsAt ? r.endsAt.toISOString() : null,
      isRecurring:     false,
      infoBlock:       r.campaignType === "qurban"
        ? (qurbanInfoMap.get(r.id) ?? { kind: "qurban_habis" as const })
        : buildProgressInfoBlock(collected, target),
      donorCount:      donorCountMap.get(r.id) ?? 0,
    };
  });

  // Desain kartu arsip — lihat docs/arsitektur-donasi.md § 14l
  const donasiSettings   = await getSettings(tenantClient, "donasi");
  const archiveDesignRaw = donasiSettings.campaign_archive_design as { design?: string } | undefined;
  const archiveDesign: CampaignArchiveCardDesignId = CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS.includes(archiveDesignRaw?.design as CampaignArchiveCardDesignId)
    ? (archiveDesignRaw!.design as CampaignArchiveCardDesignId)
    : "1";

  // Semua kategori + tipe untuk filter chips
  const categories = await tenantDb.select({ id: schema.campaignCategories.id, name: schema.campaignCategories.name, slug: schema.campaignCategories.slug })
    .from(schema.campaignCategories).orderBy(schema.campaignCategories.name);

  const pageTitle = categoryName ?? (validType ? CAMPAIGN_TYPE_LABELS[validType] : "Donasi & Infaq");

  return (
    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{tenant.name}</p>
        </div>

        {/* Filter chips: tipe */}
        <div className="flex gap-2 flex-wrap mb-4">
          {([null, ...VALID_TYPES] as const).map(t => {
            const isActive = t === validType;
            const params = new URLSearchParams();
            if (t) params.set("type", t);
            if (category) params.set("category", category);
            return (
              <a key={t ?? "semua"}
                href={`/${slug}/campaign${params.toString() ? "?" + params.toString() : ""}`}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  isActive ? "bg-primary text-primary-foreground border-primary"
                           : "border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                {t ? CAMPAIGN_TYPE_LABELS[t] : "Semua"}
              </a>
            );
          })}
        </div>

        {/* Filter chips: kategori */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {[null, ...categories].map(cat => {
              const isActive = (cat?.slug ?? null) === (category ?? null);
              const params = new URLSearchParams();
              if (validType) params.set("type", validType);
              if (cat) params.set("category", cat.slug);
              return (
                <a key={cat?.id ?? "semua"}
                  href={`/${slug}/campaign${params.toString() ? "?" + params.toString() : ""}`}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    isActive ? "bg-muted-foreground/20 border-muted-foreground/50 font-medium"
                             : "border-border/50 hover:border-border text-muted-foreground"
                  }`}
                >
                  {cat?.name ?? "Semua Kategori"}
                </a>
              );
            })}
          </div>
        )}

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Heart className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Belum ada campaign aktif.</p>
          </div>
        ) : (
          <CampaignArchiveCards design={archiveDesign} campaigns={campaigns} tenantSlug={slug} />
        )}
      </div>
    </div>
  );
}
