import "server-only";
import { createTenantDb, db, tenants, getSettings } from "@jalajogja/db";
import { eq } from "drizzle-orm";

/** Fetch data SEO dasar tenant: siteName, logoUrl, tagline, description, appUrl */
export async function getTenantSeoBase(slug: string): Promise<{
  siteName:    string;
  logoUrl:     string | null;
  tagline:     string | null;
  description: string | null;
  appUrl:      string;
  baseUrl:     string;
}> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com";

  const [tenant] = await db
    .select({ name: tenants.name, customDomain: tenants.customDomain, customDomainStatus: tenants.customDomainStatus, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  // Tenant tidak ada / tidak aktif — return fallback tanpa query tenant schema
  if (!tenant?.isActive) {
    return { siteName: slug, logoUrl: null, tagline: null, description: null, appUrl, baseUrl: `${appUrl}/${slug}` };
  }

  const tenantClient    = createTenantDb(slug);
  const generalSettings = await getSettings(tenantClient, "general");

  const baseUrl = (tenant.customDomainStatus === "active" && tenant.customDomain)
    ? `https://${tenant.customDomain}`
    : `${appUrl}/${slug}`;

  return {
    siteName:    (generalSettings.site_name as string | undefined) || tenant.name || slug,
    logoUrl:     (generalSettings.logo_url  as string | undefined) || null,
    tagline:     (generalSettings.tagline   as string | undefined) || null,
    description: (generalSettings.site_description as string | undefined) || null,
    appUrl,
    baseUrl,
  };
}
