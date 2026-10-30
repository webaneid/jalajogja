import { PUBLIC_DIRECTORY_MEMBER_STATUSES } from "@/lib/membership-statuses";
import { notFound } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createTenantDb, db, tenants, tenantMemberships, members, socialMedias, getSettings, refProvinces, refRegencies, refDistricts, refVillages } from "@jalajogja/db";
import { HeaderVisibility } from "@/components/website/public/layout/header-visibility";
import { PublicFooter } from "@/components/website/public/layout/public-footer";
import { FooterBottomNav } from "@/components/website/public/layout/footer-bottom-nav";
import { parseNavMenu } from "@/lib/nav-menu";
import { buildTenantThemeCss, getGoogleFontsUrl } from "@/lib/theme-palette";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { stripTenantPrefix } from "@/lib/strip-tenant-prefix";
import { extractOwnObjectPath } from "@/lib/tenant-icon.server";
import { TrackingScripts } from "@/components/website/public/tracking-scripts";
import { readTrackingConfig } from "@/lib/tracking-ids";
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
  const siteName         = (generalSettings.site_name   as string | undefined) ?? slug;
  // Verifikasi webmaster (Search Console / Bing) — kode sudah divalidasi regex, lihat lib/tracking-ids.ts
  const tracking = readTrackingConfig(await getSettings(tenantClient, "seo"));
  const verification: NonNullable<Metadata["verification"]> = {
    ...(tracking.google ? { google: tracking.google } : {}),
    ...(tracking.bing ? { other: { "msvalidate.01": tracking.bing } } : {}),
  };

  // Ikon tenant (docs/arsitektur-favicon.md § 3.2): PNG persegi dari endpoint /tenant-icon/{ukuran}, bukan URL WebP
  // mentah (iOS butuh PNG; WebP 150px buram). Sumber = favicon, lalu logo. Tanpa sumber → tidak menimpa ikon platform.
  const hasIcon = !!extractOwnObjectPath(slug, generalSettings.favicon_url) || !!extractOwnObjectPath(slug, generalSettings.logo_url);
  const baseUrl = await resolveBaseUrl(slug);

  return {
    title: { default: siteName, template: `%s — ${siteName}` },
    verification,
    ...(hasIcon
      ? {
          icons: {
            icon: [
              { url: `${baseUrl}/tenant-icon/32`, sizes: "32x32", type: "image/png" },
              { url: `${baseUrl}/tenant-icon/48`, sizes: "48x48", type: "image/png" },
            ],
            shortcut: `${baseUrl}/tenant-icon/48`,
            apple: [{ url: `${baseUrl}/tenant-icon/180`, sizes: "180x180", type: "image/png" }],
          },
        }
      : {}),
    manifest: `${baseUrl}/manifest.webmanifest`,
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

  const [generalSettings, websiteSettings, contactSettings, displaySettings, seoSettings] = await Promise.all([
    getSettings(tenantClient, "general"),
    getSettings(tenantClient, "website"),
    getSettings(tenantClient, "contact"),
    getSettings(tenantClient, "display"),
    getSettings(tenantClient, "seo"),
  ]);
  const tracking = readTrackingConfig(seoSettings);

  const siteName       = (generalSettings.site_name        as string | undefined) ?? tenant.name;
  const tagline        = (generalSettings.tagline           as string | undefined) ?? null;
  const description    = (generalSettings.site_description  as string | undefined) ?? null;
  const logoUrl        = (generalSettings.logo_url          as string | undefined) ?? null;
  const footerLogoUrl  = (generalSettings.footer_logo_url   as string | undefined) ?? null;
  const primaryColor   = (displaySettings.primary_color     as string | undefined) ?? "#2563eb";
  const secondaryColor = (displaySettings.secondary_color   as string | undefined) ?? "#64748b";
  const bodyFont       = (displaySettings.font              as string | undefined) ?? "Inter";
  const headingFont    = (displaySettings.heading_font      as string | undefined) ?? "Inter";
  // Jika custom domain: strip slug prefix dari semua nav href agar link tampil clean
  const rawNavMenu = parseNavMenu(websiteSettings.nav_menu, slug);
  const navMenu    = isCustomDomain
    ? rawNavMenu.map((item) => ({ ...item, href: stripTenantPrefix(item.href, slug) }))
    : rawNavMenu;
  const headerDesign   = (displaySettings.header_design     as string | undefined) ?? "flex";
  const footerDesign   = (displaySettings.footer_design     as string | undefined) ?? "dark";

  // Query member instagram usernames untuk footer Forcreator marquee
  let memberInstagrams: string[] = [];
  if (footerDesign === "forcreator") {
    try {
      const rows = await db
        .select({ instagram: socialMedias.instagram })
        .from(tenantMemberships)
        .innerJoin(members, eq(tenantMemberships.memberId, members.id))
        .innerJoin(socialMedias, eq(members.socialMediaId, socialMedias.id))
        .where(
          and(
            eq(tenantMemberships.tenantId, tenant.id),
            inArray(tenantMemberships.status, [...PUBLIC_DIRECTORY_MEMBER_STATUSES]),
            sql`${socialMedias.instagram} IS NOT NULL AND ${socialMedias.instagram} != ''`
          )
        )
        .limit(20);
      memberInstagrams = rows.map((r) => r.instagram!).filter(Boolean);
    } catch (err) {
      console.error("[PublicLayout] Gagal fetch memberInstagrams untuk footer Forcreator:", err);
    }
  }

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

      {/* GTM / GA4 / Meta Pixel — ID divalidasi, hanya front-end publik */}
      <TrackingScripts config={tracking} />

    <div className="public-layout min-h-screen flex flex-col">
      <HeaderVisibility
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
        footerLogoUrl={footerLogoUrl}
        tagline={tagline}
        description={description}
        navMenu={navMenu}
        contactSettings={enrichedContactSettings as Parameters<typeof PublicFooter>[0]["contactSettings"]}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        memberInstagrams={memberInstagrams}
        baseUrl={baseUrl}
      />

      {/* BottomNav (FlexHeader) + spacer-nya — WAJIB dirender di sini (setelah footer), bukan
          dibundel dengan <HeaderVisibility> di atas. Lihat komentar di footer-bottom-nav.tsx. */}
      <FooterBottomNav
        designId={headerDesign as import("@/lib/header-designs").HeaderDesignId}
        navMenu={navMenu}
        baseUrl={baseUrl}
      />
    </div>
    </>
  );
}
