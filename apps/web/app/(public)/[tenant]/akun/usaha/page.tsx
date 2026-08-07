import { auth }    from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { getEnabledEkosistemModules, getEkosistemModuleLabels } from "@/lib/ekosistem-modules.server";
import { resolveEkosistemModuleLabel } from "@/lib/ekosistem-modules";
import { getTaxonomyOverrides } from "@/lib/taxonomy-overrides.server";
import { UsahaClient } from "./usaha-client";

export default async function UsahaPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/usaha`);

  const tenantClient = createTenantDb(slug);

  // Modul dimatikan tenant ini — data tetap ada (single-ID global), cuma tidak ditawarkan di sini.
  const [enabledModules, taxonomyOverrides, moduleLabels] = await Promise.all([
    getEnabledEkosistemModules(tenantClient),
    getTaxonomyOverrides(tenantClient),
    getEkosistemModuleLabels(tenantClient),
  ]);
  if (!enabledModules.usaha) redirect(`${baseUrl}/akun`);
  const moduleLabel = resolveEkosistemModuleLabel("usaha", moduleLabels);

  return (
    <UsahaClient
      slug={slug}
      baseUrl={baseUrl}
      taxonomyOverrides={taxonomyOverrides}
      moduleLabel={moduleLabel}
    />
  );
}
