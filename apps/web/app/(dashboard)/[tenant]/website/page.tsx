import { redirect } from "next/navigation";

export default async function WebsitePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  redirect(`/${tenant}/website/posts`);
}
