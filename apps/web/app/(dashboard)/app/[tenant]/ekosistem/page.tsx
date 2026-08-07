import { redirect } from "next/navigation";

export default async function EkosistemPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/app/${slug}/ekosistem/pengaturan`);
}
