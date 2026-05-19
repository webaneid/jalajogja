import { redirect } from "next/navigation";

export default async function EventPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  redirect(`/app/${slug}/event/acara`);
}
