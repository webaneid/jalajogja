import { redirect } from "next/navigation";
import { getProducerPageAccess } from "@/lib/producer-access.server";

export default async function ProducerPortalHome({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  if (!(await getProducerPageAccess(slug))) redirect("/no-tenant-access");
  redirect(`/app/${slug}/portal-produsen/dashboard`);
}
