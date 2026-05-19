import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantDb = createTenantDb(slug);
  const settings = await getSettings(tenantDb, "general");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Umum</h2>
        <p className="text-sm text-muted-foreground">
          Informasi dasar organisasi kamu.
        </p>
      </div>

      <GeneralSettingsForm
        slug={slug}
        defaultValues={{
          siteName:        (settings.site_name        as string) ?? "",
          tagline:         (settings.tagline          as string) ?? "",
          siteDescription: (settings.site_description as string) ?? "",
          logoUrl:         (settings.logo_url         as string) ?? "",
          faviconUrl:      (settings.favicon_url      as string) ?? "",
          timezone:        (settings.timezone         as string) ?? "Asia/Jakarta",
          language:        (settings.language         as string) ?? "id",
          currency:        (settings.currency         as string) ?? "IDR",
        }}
      />
    </div>
  );
}
