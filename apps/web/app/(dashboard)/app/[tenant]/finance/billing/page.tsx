import { redirect } from "next/navigation";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/app/${slug}/finance/billing/invoice`);
}
