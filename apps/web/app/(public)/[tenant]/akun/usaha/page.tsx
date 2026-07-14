import { auth }    from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isOwnHost } from "@/lib/is-own-host";
import { UsahaClient } from "./usaha-client";

export default async function UsahaPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = isOwnHost(hdrs.get("host") ?? "") ? `/${slug}` : "";

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/usaha`);

  return <UsahaClient slug={slug} baseUrl={baseUrl} />;
}
