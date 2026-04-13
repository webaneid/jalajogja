import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { createLetterDraftAction } from "../../../letters/actions";

export default async function SuratKeluarNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  // Pre-create draft → redirect ke edit
  const result = await createLetterDraftAction(slug, "outgoing");
  if (!result.success) redirect(`/${slug}/letters/keluar`);

  redirect(`/${slug}/letters/keluar/${result.letterId}/edit`);
}
