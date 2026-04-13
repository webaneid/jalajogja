import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { createLetterDraftAction } from "../../../letters/actions";

export default async function NotaDinasNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const result = await createLetterDraftAction(slug, "internal");
  if (!result.success) redirect(`/${slug}/letters/nota`);

  redirect(`/${slug}/letters/nota/${result.letterId}/edit`);
}
