import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/components/donasi/campaign-form";
import type { SeoValues } from "@/components/seo/seo-panel";

const DEFAULT_SEO: SeoValues = {
  metaTitle:      "",
  metaDesc:       "",
  focusKeyword:   "",
  ogTitle:        "",
  ogDescription:  "",
  ogImageId:      null,
  ogImageUrl:     null,
  twitterCard:    "summary_large_image",
  canonicalUrl:   "",
  robots:         "index,follow",
  schemaType:     "WebPage",
  structuredData: "",
};

export default async function CampaignNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const categories = await db
    .select({ id: schema.campaignCategories.id, name: schema.campaignCategories.name })
    .from(schema.campaignCategories)
    .orderBy(schema.campaignCategories.sortOrder, schema.campaignCategories.name);

  return (
    <CampaignForm
      slug={slug}
      campaignId={null}
      categories={categories}
      initialData={{
        slug:          "",
        title:         "",
        description:   "",
        categoryId:    null,
        campaignType:  "donasi",
        targetAmount:  null,
        coverId:       null,
        coverUrl:      null,
        status:        "draft",
        startsAt:      null,
        endsAt:        null,
        showDonorList: true,
        showAmount:    true,
        seo:           DEFAULT_SEO,
      }}
    />
  );
}
