import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CampaignForm } from "@/components/donasi/campaign-form";

export default async function CampaignEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: campaignId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [[campaign], categories] = await Promise.all([
    db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)).limit(1),
    db.select({ id: schema.campaignCategories.id, name: schema.campaignCategories.name })
      .from(schema.campaignCategories)
      .orderBy(schema.campaignCategories.sortOrder, schema.campaignCategories.name),
  ]);

  if (!campaign) notFound();

  // Ambil URL cover image jika ada
  let coverUrl: string | null = null;
  if (campaign.coverId) {
    const [media] = await db
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, campaign.coverId))
      .limit(1);
    coverUrl = media?.path ?? null;
  }

  return (
    <CampaignForm
      slug={slug}
      campaignId={campaignId}
      categories={categories}
      initialData={{
        slug:          campaign.slug,
        title:         campaign.title,
        description:   campaign.description ?? "",
        categoryId:    campaign.categoryId  ?? null,
        campaignType:  campaign.campaignType as "donasi" | "zakat" | "wakaf" | "qurban",
        targetAmount:  campaign.targetAmount ? parseFloat(campaign.targetAmount) : null,
        coverId:       campaign.coverId    ?? null,
        coverUrl,
        status:        campaign.status as "draft" | "active" | "closed" | "archived",
        startsAt:      campaign.startsAt
          ? new Date(campaign.startsAt).toISOString().slice(0, 16)
          : null,
        endsAt:        campaign.endsAt
          ? new Date(campaign.endsAt).toISOString().slice(0, 16)
          : null,
        showDonorList: campaign.showDonorList,
        showAmount:    campaign.showAmount,
      }}
    />
  );
}
