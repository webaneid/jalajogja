import { redirect } from "next/navigation";

export default async function LettersPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/app/${slug}/letters/keluar`);
}
