import { redirect } from "next/navigation";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
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
    redirect(`/login?redirect=/${slug}/dashboard`);
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    redirect("/dashboard-redirect");
  }

  const { tenant, tenantUser } = access;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop — hidden di mobile */}
      <div className="hidden md:flex">
        <Sidebar slug={slug} orgName={tenant.name} />
      </div>

      {/* Konten utama */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between
                           border-b bg-card px-4 md:px-6">
          {/* Hamburger mobile */}
          <MobileSidebar slug={slug} orgName={tenant.name} />

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
