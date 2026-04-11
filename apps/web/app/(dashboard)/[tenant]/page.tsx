import { redirect } from "next/navigation";

// /{slug} → redirect ke /{slug}/dashboard
export default async function TenantRootPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/${slug}/dashboard`);
}
