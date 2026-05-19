import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { DonationForm } from "@/components/donasi/donation-form";

export default async function DonationNewPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tenant: string }>;
  searchParams: Promise<{ campaign?: string }>;
}) {
  const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const campaigns = await db
    .select({
      id:           schema.campaigns.id,
      title:        schema.campaigns.title,
      campaignType: schema.campaigns.campaignType,
    })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.status, "active"))
    .orderBy(schema.campaigns.title);

  return (
    <DonationForm
      slug={slug}
      campaigns={campaigns}
      defaultCampaignId={sp.campaign ?? null}
    />
  );
}
