import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createPageDraftAction } from "../../actions";

export default async function NewPagePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/login`);

  const res = await createPageDraftAction(slug);
  if (res.success) {
    redirect(`/${slug}/website/pages/${res.data.pageId}/edit`);
  }

  redirect(`/${slug}/website/pages?error=create_failed`);
}
