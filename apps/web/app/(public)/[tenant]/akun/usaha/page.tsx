import { auth }            from "@/lib/auth";
import { headers }         from "next/headers";
import { redirect }        from "next/navigation";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { UsahaClient }     from "./usaha-client";

export default async function UsahaPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login?redirect=/${slug}/akun/usaha`);

  const tenantDb = createTenantDb(slug);
  const settings = await getSettings(tenantDb, "contact");
  const address  = (settings.contact_address as { provinceId?: number } | null) ?? {};

  return (
    <UsahaClient
      slug={slug}
      defaultProvinceId={address.provinceId ?? undefined}
    />
  );
}
