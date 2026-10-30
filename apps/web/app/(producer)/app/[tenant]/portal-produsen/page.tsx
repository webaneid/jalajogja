import { redirect } from "next/navigation";
import { getProducerAccess } from "@/lib/producer-access.server";

export default async function ProducerPortalHome({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  if (!(await getProducerAccess(slug))) redirect("/no-tenant-access");
  redirect(`/app/${slug}/portal-produsen/produk`);
}
