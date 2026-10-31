// Shell Portal Produsen — pintu terpisah dari dashboard pengurus (grup rute (producer), BUKAN (dashboard)).
// Produsen = status pada akun (public.producer_logins), bukan baris tenant.users. Doc: docs/arsitektur-portal-produsen.md.
// Guard di sini hanya untuk shell — SETIAP page tetap memanggil getProducerAccess sendiri (layout, page, dan
// generateMetadata dirender paralel; guard layout tidak melindungi page). Portal TIDAK punya Server Action.
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentSession } from "@/lib/tenant";
import { getProducerAccess } from "@/lib/producer-access.server";
import { UserMenu } from "@/components/dashboard/user-menu";
import { ProducerSidebar, ProducerMobileSidebar } from "@/components/producer/producer-sidebar";

export const metadata: Metadata = { title: "Portal Produsen", robots: { index: false, follow: false } };

export default async function ProducerPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/app/login?redirect=/app/${slug}/portal-produsen`);

  const access = await getProducerAccess(slug);
  // Bukan /dashboard-redirect: halaman itu bisa mengarahkan balik ke sini → loop. /no-tenant-access aman (di luar /app/*).
  if (!access) redirect("/no-tenant-access");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop — hidden di mobile */}
      <div className="hidden md:flex">
        <ProducerSidebar slug={slug} orgName={access.tenant.name} producerName={access.producer.displayName} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
          <ProducerMobileSidebar slug={slug} orgName={access.tenant.name} producerName={access.producer.displayName} />
          <span className="truncate text-sm font-semibold md:hidden">{access.tenant.name}</span>
          <div className="ml-auto">
            <UserMenu name={session.user.name} email={session.user.email} role="Produsen" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
