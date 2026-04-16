import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { createCampaignDraftAction } from "../../actions";

// Pre-create pattern — buat draft kosong, redirect ke edit
export default async function CampaignNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const res = await createCampaignDraftAction(slug);
  if (res.success) {
    redirect(`/${slug}/donasi/campaign/${res.data.campaignId}/edit`);
  }

  redirect(`/${slug}/donasi/campaign`);
}
