import { redirect } from "next/navigation";

export default async function DokumenPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/${slug}/dokumen/semua`);
}
