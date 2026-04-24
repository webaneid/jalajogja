import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createTenantDb, db, tenants, getSettings } from "@jalajogja/db";
import { PublicHeader } from "@/components/website/public/layout/public-header";
import { PublicFooter } from "@/components/website/public/layout/public-footer";
import { parseNavMenu } from "@/lib/nav-menu";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params:   Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select({
      id:       tenants.id,
      name:     tenants.name,
      isActive: tenants.isActive,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant?.isActive) notFound();

  const tenantClient = createTenantDb(slug);

  const [generalSettings, websiteSettings, contactSettings, displaySettings] = await Promise.all([
    getSettings(tenantClient, "general"),
    getSettings(tenantClient, "website"),
    getSettings(tenantClient, "contact"),
    getSettings(tenantClient, "display"),
  ]);

  const siteName     = (generalSettings.site_name    as string | undefined) ?? tenant.name;
  const tagline      = (generalSettings.tagline       as string | undefined) ?? null;
  const logoUrl      = (generalSettings.logo_url      as string | undefined) ?? null;
  const primaryColor = (generalSettings.primary_color as string | undefined) ?? "#2563eb";
  const navMenu      = parseNavMenu(websiteSettings.nav_menu);
  const headerDesign = (displaySettings.header_design as string | undefined) ?? "flex";
  const footerDesign = (displaySettings.footer_design as string | undefined) ?? "dark";

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader
        designId={headerDesign as import("@/lib/header-designs").HeaderDesignId}
        tenantSlug={slug}
        siteName={siteName}
        logoUrl={logoUrl}
        navMenu={navMenu}
        primaryColor={primaryColor}
      />

      <main className="flex-1">
        {children}
      </main>

      <PublicFooter
        designId={footerDesign as import("@/lib/footer-designs").FooterDesignId}
        tenantSlug={slug}
        siteName={siteName}
        logoUrl={logoUrl}
        tagline={tagline}
        navMenu={navMenu}
        contactSettings={contactSettings as Parameters<typeof PublicFooter>[0]["contactSettings"]}
        primaryColor={primaryColor}
      />
    </div>
  );
}
