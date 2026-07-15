import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createTenantDb, db, tenants, getSettings, refProvinces, refRegencies, refDistricts, refVillages } from "@jalajogja/db";
import { PublicHeader } from "@/components/website/public/layout/public-header";
import { PublicFooter } from "@/components/website/public/layout/public-footer";
import { parseNavMenu } from "@/lib/nav-menu";
import { buildTenantThemeCss, getGoogleFontsUrl } from "@/lib/theme-palette";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import type { Metadata } from "next";

type Params = Promise<{ tenant: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;

  // Cek tenant exists sebelum query tenant schema — cegah DB error dari bot/scraper
  const [tenantRow] = await db
    .select({ isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenantRow?.isActive) return {};

  const tenantClient     = createTenantDb(slug);
  const generalSettings  = await getSettings(tenantClient, "general");
  const faviconUrl       = (generalSettings.favicon_url as string | undefined) ?? null;
  const siteName         = (generalSettings.site_name   as string | undefined) ?? slug;
  if (!faviconUrl) return { title: { default: siteName, template: `%s — ${siteName}` } };
  return {
    title: { default: siteName, template: `%s — ${siteName}` },
    icons: {
      icon:     faviconUrl,
      shortcut: faviconUrl,
      apple:    faviconUrl,
    },
  };
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params:   Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  // baseUrl: "" di custom domain (white-label), "/{slug}" di path mode
  const baseUrl        = await resolveBaseUrl(slug);
  const isCustomDomain = baseUrl === "";

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

  const siteName       = (generalSettings.site_name        as string | undefined) ?? tenant.name;
  const tagline        = (generalSettings.tagline           as string | undefined) ?? null;
  const description    = (generalSettings.site_description  as string | undefined) ?? null;
  const logoUrl        = (generalSettings.logo_url          as string | undefined) ?? null;
  const primaryColor   = (displaySettings.primary_color     as string | undefined) ?? "#2563eb";
  const secondaryColor = (displaySettings.secondary_color   as string | undefined) ?? "#64748b";
  const bodyFont       = (displaySettings.font              as string | undefined) ?? "Inter";
  const headingFont    = (displaySettings.heading_font      as string | undefined) ?? "Inter";
  // Jika custom domain: strip slug prefix dari semua nav href agar link tampil clean
  const rawNavMenu = parseNavMenu(websiteSettings.nav_menu, slug);
  const navMenu    = isCustomDomain
    ? rawNavMenu.map((item) => ({
        ...item,
        href: item.href.startsWith(`/${slug}/`) ? item.href.slice(`/${slug}`.length)
            : item.href === `/${slug}`           ? "/"
            : item.href,
      }))
    : rawNavMenu;
  const headerDesign   = (displaySettings.header_design     as string | undefined) ?? "flex";
  const footerDesign   = (displaySettings.footer_design     as string | undefined) ?? "dark";

  const themeCss      = buildTenantThemeCss({ primaryColor, secondaryColor, bodyFont, headingFont });
  const googleFontUrl = getGoogleFontsUrl([bodyFont, headingFont]);

  // Resolve nama wilayah dari IDs (selalu — agar data lama tetap tampil)
  type StoredAddress = {
    provinceId?:  number;
    regencyId?:   number;
    districtId?:  number;
    villageId?:   number;
    detail?:      string;
    postalCode?:  string;
    provinceName?: string;
    regencyName?:  string;
    districtName?: string;
    villageName?:  string;
  };
  const storedAddr = (contactSettings.contact_address as StoredAddress | undefined) ?? {};
  const { provinceId, regencyId, districtId, villageId } = storedAddr;

  const [provinceName, regencyName, districtName, villageName] = await Promise.all([
    provinceId && !storedAddr.provinceName
      ? db.select({ name: refProvinces.name }).from(refProvinces).where(eq(refProvinces.id, provinceId)).limit(1).then(r => r[0]?.name ?? null)
      : (storedAddr.provinceName ?? null),
    regencyId && !storedAddr.regencyName
      ? db.select({ name: refRegencies.name }).from(refRegencies).where(eq(refRegencies.id, regencyId)).limit(1).then(r => r[0]?.name ?? null)
      : (storedAddr.regencyName ?? null),
    districtId && !storedAddr.districtName
      ? db.select({ name: refDistricts.name }).from(refDistricts).where(eq(refDistricts.id, districtId)).limit(1).then(r => r[0]?.name ?? null)
      : (storedAddr.districtName ?? null),
    villageId && !storedAddr.villageName
      ? db.select({ name: refVillages.name }).from(refVillages).where(eq(refVillages.id, villageId)).limit(1).then(r => r[0]?.name ?? null)
      : (storedAddr.villageName ?? null),
  ]);

  const enrichedContactSettings = {
    ...contactSettings,
    contact_address: {
      ...storedAddr,
      provinceName,
      regencyName,
      districtName,
      villageName,
    },
  };

  return (
    <>
      {/* Google Fonts — di-hoist Next.js ke <head> otomatis */}
      {googleFontUrl && (
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      )}
      {googleFontUrl && (
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      )}
      {googleFontUrl && (
        <link rel="stylesheet" href={googleFontUrl} />
      )}

      {/* CSS variables tema tenant — override Tailwind di scope .public-layout */}
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />

    <div className="public-layout min-h-screen flex flex-col">
      <PublicHeader
        designId={headerDesign as import("@/lib/header-designs").HeaderDesignId}
        tenantSlug={slug}
        siteName={siteName}
        logoUrl={logoUrl}
        navMenu={navMenu}
        primaryColor={primaryColor}
        baseUrl={baseUrl}
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
        description={description}
        navMenu={navMenu}
        contactSettings={enrichedContactSettings as Parameters<typeof PublicFooter>[0]["contactSettings"]}
        primaryColor={primaryColor}
        baseUrl={baseUrl}
      />
    </div>
    </>
  );
}
