import { auth }    from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { PesantrenClient } from "./pesantren-client";

export default async function PesantrenPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/pesantren`);

  // Modul dimatikan tenant ini — data tetap ada (single-ID global), cuma tidak ditawarkan di sini.
  const enabledModules = await getEnabledEkosistemModules(createTenantDb(slug));
  if (!enabledModules.pesantren) redirect(`${baseUrl}/akun`);

  return <PesantrenClient slug={slug} baseUrl={baseUrl} />;
}
