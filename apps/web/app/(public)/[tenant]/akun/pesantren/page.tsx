import { auth }    from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { getEnabledEkosistemModules, getEkosistemModuleLabels } from "@/lib/ekosistem-modules.server";
import { resolveEkosistemModuleLabel } from "@/lib/ekosistem-modules";
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
  const tenantClient = createTenantDb(slug);
  const [enabledModules, moduleLabels] = await Promise.all([
    getEnabledEkosistemModules(tenantClient),
    getEkosistemModuleLabels(tenantClient),
  ]);
  if (!enabledModules.pesantren) redirect(`${baseUrl}/akun`);
  const moduleLabel = resolveEkosistemModuleLabel("pesantren", moduleLabels);

  return <PesantrenClient slug={slug} baseUrl={baseUrl} moduleLabel={moduleLabel} />;
}
