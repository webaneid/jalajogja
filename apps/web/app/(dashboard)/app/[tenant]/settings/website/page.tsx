import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { WebsiteSettingsClient } from "@/components/settings/website-settings-client";
import { parseNavMenu } from "@/lib/nav-menu";
import type { HeaderDesignId } from "@/lib/header-designs";
import type { FooterDesignId } from "@/lib/footer-designs";

export default async function WebsiteSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ instagram?: string; msg?: string }>;
}) {
  const { tenant: slug } = await params;
  const { instagram: instagramStatus, msg: instagramMsg } = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient   = createTenantDb(slug);
  const { db, schema } = tenantClient;

  const [websiteSettings, displaySettings, pages] = await Promise.all([
    getSettings(tenantClient, "website"),
    getSettings(tenantClient, "display"),
    db
      .select({ slug: schema.pages.slug, title: schema.pages.title })
      .from(schema.pages)
      .where(eq(schema.pages.status, "published"))
      .orderBy(schema.pages.order, schema.pages.title),
  ]);

  const initialMenu         = parseNavMenu(websiteSettings.nav_menu);
  const initialHome         = (websiteSettings.homepage_slug  as string | undefined) ?? "";
  const initialHeaderDesign = (displaySettings.header_design  as HeaderDesignId | undefined) ?? "flex";
  const initialFooterDesign = (displaySettings.footer_design  as FooterDesignId | undefined) ?? "dark";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pengaturan Website</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Atur halaman beranda, menu navigasi, dan tampilan header/footer website publik Anda.
        </p>
      </div>

      {instagramStatus === "connected" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ Akun Instagram berhasil terhubung. Kembali ke editor section landing page untuk melihat feed otomatis.
        </div>
      )}
      {instagramStatus === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Gagal menghubungkan Instagram{instagramMsg ? `: ${instagramMsg}` : "."} Coba lagi dari editor section.
        </div>
      )}

      <WebsiteSettingsClient
        slug={slug}
        initialMenu={initialMenu}
        initialHome={initialHome}
        initialHeaderDesign={initialHeaderDesign}
        initialFooterDesign={initialFooterDesign}
        pages={pages}
      />
    </div>
  );
}
