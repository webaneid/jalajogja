import { redirect } from "next/navigation";

export default async function FinancePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/app/${slug}/finance/dashboard`);
}
