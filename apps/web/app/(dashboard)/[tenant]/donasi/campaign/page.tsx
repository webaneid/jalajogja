import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { CreateCampaignButton, CampaignTable } from "@/components/donasi/campaign-list-client";

export default async function CampaignListPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const campaigns = await db
    .select({
      id:              schema.campaigns.id,
      slug:            schema.campaigns.slug,
      title:           schema.campaigns.title,
      campaignType:    schema.campaigns.campaignType,
      status:          schema.campaigns.status,
      targetAmount:    schema.campaigns.targetAmount,
      collectedAmount: schema.campaigns.collectedAmount,
      createdAt:       schema.campaigns.createdAt,
    })
    .from(schema.campaigns)
    .orderBy(desc(schema.campaigns.createdAt));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campaign Donasi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola program penggalangan dana
          </p>
        </div>
        <CreateCampaignButton slug={slug} />
      </div>

      <CampaignTable slug={slug} campaigns={campaigns} />
    </div>
  );
}
