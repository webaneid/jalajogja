import { createTenantDb, getSettings } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { publicUrl } from "@/lib/minio";
import { CampaignForm } from "@/components/donasi/campaign-form";
import type { SeoValues } from "@/components/seo/seo-panel";
import type { QurbanAnimalInput } from "@/app/(dashboard)/app/[tenant]/donasi/actions";

export default async function CampaignEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: campaignId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient             = createTenantDb(slug);
  const { db, schema }          = tenantClient;

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
    coverUrl = media ? publicUrl(slug, media.path) : null;
  }

  // Fetch qurban animals jika campaign type = qurban
  let qurbanAnimals: QurbanAnimalInput[] = [];
  if (campaign.campaignType === "qurban") {
    const qRows = await db.select().from(schema.qurbanAnimals)
      .where(eq(schema.qurbanAnimals.campaignId, campaignId));
    qurbanAnimals = qRows.map(r => ({
      animalType: r.animalType as "domba" | "kambing" | "sapi",
      price:      parseFloat(r.price),
      stock:      r.stock,
      split:      r.split ?? null,
      isActive:   r.isActive,
    }));
  }

  return (
    <CampaignForm
      slug={slug}
      campaignId={campaignId}
      categories={categories}
      qurbanAnimals={qurbanAnimals}
      initialData={{
        slug:          campaign.slug,
        title:         campaign.title,
        description:   campaign.description ?? "",
        categoryId:    campaign.categoryId  ?? null,
        campaignType:  campaign.campaignType as "donasi" | "zakat" | "wakaf" | "qurban",
        targetAmount:  campaign.targetAmount  ? parseFloat(campaign.targetAmount)  : null,
        defaultAmount: campaign.defaultAmount ? parseFloat(campaign.defaultAmount) : null,
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
        seo: {
          metaTitle:      campaign.metaTitle     ?? "",
          metaDesc:       campaign.metaDesc      ?? "",
          focusKeyword:   campaign.focusKeyword  ?? "",
          ogTitle:        campaign.ogTitle       ?? "",
          ogDescription:  campaign.ogDescription ?? "",
          ogImageId:      campaign.ogImageId     ?? null,
          ogImageUrl:     null,
          twitterCard:    (campaign.twitterCard  ?? "summary_large_image") as SeoValues["twitterCard"],
          canonicalUrl:   campaign.canonicalUrl  ?? "",
          robots:         (campaign.robots       ?? "index,follow") as SeoValues["robots"],
          schemaType:     (campaign.schemaType   ?? "WebPage") as SeoValues["schemaType"],
          structuredData: "",
        },
      }}
    />
  );
}
