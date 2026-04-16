import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/components/donasi/campaign-form";

export default async function CampaignNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  return (
    <CampaignForm
      slug={slug}
      campaignId={null}
      initialData={{
        slug:          "",
        title:         "",
        description:   "",
        campaignType:  "donasi",
        targetAmount:  null,
        coverId:       null,
        coverUrl:      null,
        status:        "draft",
        startsAt:      null,
        endsAt:        null,
        showDonorList: true,
        showAmount:    true,
      }}
    />
  );
}
