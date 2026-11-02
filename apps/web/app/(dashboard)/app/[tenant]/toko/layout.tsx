import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { hasReadAccess } from "@/lib/permissions";
import { createTenantDb } from "@jalajogja/db";
import { countPendingApplicationsSafe } from "@/lib/producer-application-review.server";
import { TokoNav } from "@/components/toko/toko-nav";

export default async function TokoLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: React.ReactNode;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");
  if (!hasReadAccess(access.tenantUser, "toko")) redirect(`/app/${slug}/dashboard`);

  // Lencana "Pengajuan" hanya untuk yang berhak membacanya (anggota:read); tabel belum ada → 0
  const pendingApplications = hasReadAccess(access.tenantUser, "anggota")
    ? await countPendingApplicationsSafe(createTenantDb(slug))
    : 0;

  return (
    <div className="flex flex-col md:flex-row h-full">
      <TokoNav slug={slug} badges={{ "/produsen/pengajuan": pendingApplications }} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
