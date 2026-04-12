import { redirect } from "next/navigation";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/${slug}/settings/general`);
}
