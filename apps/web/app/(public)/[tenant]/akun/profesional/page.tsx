import { auth }    from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isOwnHost } from "@/lib/is-own-host";
import { ProfesionalClient } from "./profesional-client";

export default async function ProfesionalPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = isOwnHost(hdrs.get("host") ?? "") ? `/${slug}` : "";

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/profesional`);

  return <ProfesionalClient slug={slug} baseUrl={baseUrl} />;
}
