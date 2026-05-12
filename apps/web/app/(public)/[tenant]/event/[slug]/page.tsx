import { redirect } from "next/navigation";

// Redirect lama /event/{slug} → /agenda/{slug} (backward compatibility)
export default async function EventDetailRedirect({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}) {
  const { tenant, slug } = await params;
  redirect(`/${tenant}/agenda/${slug}`);
}
