import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { WebsiteSettingsClient } from "@/components/settings/website-settings-client";
import { parseNavMenu } from "@/lib/nav-menu";

export default async function WebsiteSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const tenantClient             = createTenantDb(slug);
  const { db, schema }           = tenantClient;

  // Fetch settings + pages published dalam satu batch
  const [websiteSettings, pages] = await Promise.all([
    getSettings(tenantClient, "website"),
    db
      .select({ slug: schema.pages.slug, title: schema.pages.title })
      .from(schema.pages)
      .where(eq(schema.pages.status, "published"))
      .orderBy(schema.pages.order, schema.pages.title),
  ]);

  const initialMenu = parseNavMenu(websiteSettings.nav_menu);
  const initialHome = (websiteSettings.homepage_slug as string | undefined) ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pengaturan Website</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Atur halaman beranda dan menu navigasi website publik Anda.
        </p>
      </div>

      <WebsiteSettingsClient
        slug={slug}
        initialMenu={initialMenu}
        initialHome={initialHome}
        pages={pages}
      />
    </div>
  );
}
