import { redirect } from "next/navigation";

export default async function DonasiPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/${slug}/donasi/campaign`);
}
