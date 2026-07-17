import { eq, desc, and, inArray } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { buildProgressInfoBlock, type CampaignCardData } from "@/lib/campaign-card-templates";
import { resolveQurbanInfoBlocks } from "@/lib/campaign-info-block";
import { resolveDonorCounts } from "@/lib/campaign-donor-count";
import type { CampaignsSectionData, CampaignsSectionDesignId, CampaignsSectionProps } from "@/lib/campaigns-section-designs";
import { CampaignsDesign1 } from "./campaigns-design-1";
import { CampaignsDesign2 } from "./campaigns-design-2";
import { CampaignsDesign3 } from "./campaigns-design-3";
import { CampaignsDesign4 } from "./campaigns-design-4";

type Props = {
  data:         CampaignsSectionData;
  variant:      CampaignsSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
};

async function fetchCampaigns(
  tenantClient: TenantDb,
  data: CampaignsSectionData,
  tenantSlug: string,
): Promise<CampaignCardData[]> {
  const { db, schema } = tenantClient;
  const count = data.count ?? 6;

  const clauses = [
    eq(schema.campaigns.status, "active"),
    ...(data.categoryId   ? [eq(schema.campaigns.categoryId,   data.categoryId)]                                         : []),
    ...(data.campaignType ? [eq(schema.campaigns.campaignType, data.campaignType as "donasi"|"zakat"|"wakaf"|"qurban")] : []),
  ];

  const rows = await db
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
    .limit(count);

  // Resolve cover URLs
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  const coverMap = new Map<string, string>();
  if (coverIds.length > 0) {
    const mediaRows = await db
      .select({ id: schema.media.id, path: schema.media.path })
      .from(schema.media)
      .where(inArray(schema.media.id, coverIds));
    mediaRows.forEach(m => coverMap.set(m.id, publicUrl(tenantSlug, m.path)));
  }

  // Batch resolve info block qurban — satu query untuk semua campaign qurban di halaman ini
  const qurbanIds     = rows.filter(r => r.campaignType === "qurban").map(r => r.id);
  const qurbanInfoMap = await resolveQurbanInfoBlocks(tenantClient, qurbanIds);
  const donorCountMap = await resolveDonorCounts(tenantClient, rows.map(r => r.id));

  return rows.map(r => {
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
      isRecurring:     false, // Phase R: akan diisi saat kolom is_recurring ditambahkan
      infoBlock:       r.campaignType === "qurban"
        ? (qurbanInfoMap.get(r.id) ?? { kind: "qurban_habis" as const })
        : buildProgressInfoBlock(collected, target),
      donorCount:      donorCountMap.get(r.id) ?? 0,
    };
  });
}

export async function CampaignsSection({ data, variant, tenantClient, tenantSlug }: Props) {
  const { db, schema } = tenantClient;

  let sectionTitle = data.title || "Donasi & Infaq";
  let filterHref   = `/${tenantSlug}/campaign`;

  if (data.categoryId) {
    const [cat] = await db
      .select({ name: schema.campaignCategories.name, slug: schema.campaignCategories.slug })
      .from(schema.campaignCategories)
      .where(eq(schema.campaignCategories.id, data.categoryId))
      .limit(1);
    if (cat) {
      if (!data.title) sectionTitle = cat.name;
      filterHref = `/${tenantSlug}/campaign?category=${cat.slug}`;
    }
  }

  if (data.campaignType) {
    filterHref = `/${tenantSlug}/campaign?type=${data.campaignType}`;
  }

  const campaigns = await fetchCampaigns(tenantClient, data, tenantSlug);
  const props: CampaignsSectionProps = { data, campaigns, tenantSlug, sectionTitle, filterHref };

  switch (variant) {
    case "2": return <CampaignsDesign2 {...props} />;
    case "3": return <CampaignsDesign3 {...props} />;
    case "4": return <CampaignsDesign4 {...props} />;
    default:  return <CampaignsDesign1 {...props} />;
  }
}
