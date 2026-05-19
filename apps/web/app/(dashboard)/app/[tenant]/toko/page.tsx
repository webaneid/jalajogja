import { redirect } from "next/navigation";

export default async function TokoPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/app/${slug}/toko/produk`);
}
