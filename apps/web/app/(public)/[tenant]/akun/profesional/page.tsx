import { auth }    from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { ProfesionalClient } from "./profesional-client";

export default async function ProfesionalPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/profesional`);

  // Modul dimatikan tenant ini — data tetap ada (single-ID global), cuma tidak ditawarkan di sini.
  const enabledModules = await getEnabledEkosistemModules(createTenantDb(slug));
  if (!enabledModules.profesional) redirect(`${baseUrl}/akun`);

  return <ProfesionalClient slug={slug} baseUrl={baseUrl} />;
}
