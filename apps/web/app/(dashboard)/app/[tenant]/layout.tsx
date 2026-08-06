import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { isOwnHost } from "@/lib/is-own-host";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { foregroundFor } from "@/lib/theme-palette";
import { Sidebar } from "@/components/dashboard/sidebar";
import { UserMenu } from "@/components/dashboard/user-menu";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  // Layer 2 auth: verifikasi session nyata + akses tenant
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect(`/app/login?redirect=/app/${slug}/dashboard`);
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    redirect("/dashboard-redirect");
  }

  const { tenant, tenantUser } = access;
  const isPusatTenant = tenant.tenantType === "pusat";

  // Admin-on-Custom-Domain: diakses lewat /admin/* di custom domain tenant sendiri (bukan
  // jalakarta.com) → dashboard WAJIB tenant-branded (Prinsip #2, docs/arsitektur-domain.md § 1).
  // Host header tidak berubah oleh rewrite middleware, jadi ini deteksi yang reliable.
  const hdrs = await headers();
  const isCustomDomainAdmin = !isOwnHost(hdrs.get("host") ?? "");

  let brandLogoUrl: string | null      = null;
  let brandPrimaryColor: string | null = null;
  if (isCustomDomainAdmin) {
    const tenantClient = createTenantDb(slug);
    const [generalSettings, displaySettings] = await Promise.all([
      getSettings(tenantClient, "general"),
      getSettings(tenantClient, "display"),
    ]);
    brandLogoUrl      = (generalSettings.logo_url     as string | undefined) ?? null;
    brandPrimaryColor = (displaySettings.primary_color as string | undefined) ?? null;
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-background ${isCustomDomainAdmin ? "tenant-admin-branded" : ""}`}>
      {brandPrimaryColor && (
        // eslint-disable-next-line react/no-danger
        <style dangerouslySetInnerHTML={{ __html:
          `.tenant-admin-branded { --primary: ${brandPrimaryColor}; --primary-foreground: ${foregroundFor(brandPrimaryColor)}; }`
        }} />
      )}

      {/* Sidebar desktop — hidden di mobile */}
      <div className="hidden md:flex">
        <Sidebar
          slug={slug}
          orgName={tenant.name}
          tenantUser={tenantUser}
          logoUrl={isCustomDomainAdmin ? brandLogoUrl : null}
          showPlatformFooter={!isCustomDomainAdmin}
          isPusatTenant={isPusatTenant}
        />
      </div>

      {/* Konten utama */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between
                           border-b bg-card px-4 md:px-6">
          {/* Hamburger mobile */}
          <MobileSidebar
            slug={slug}
            orgName={tenant.name}
            tenantUser={tenantUser}
            logoUrl={isCustomDomainAdmin ? brandLogoUrl : null}
            showPlatformFooter={!isCustomDomainAdmin}
            isPusatTenant={isPusatTenant}
          />

          {/* Nama org — hanya muncul di mobile */}
          <span className="text-sm font-semibold md:hidden">{tenant.name}</span>

          {/* User menu */}
          <div className="ml-auto">
            <UserMenu
              name={session.user.name}
              email={session.user.email}
              role={tenantUser.role}
            />
          </div>
        </header>

        {/* Area konten scroll */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
