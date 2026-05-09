import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { getMitraApplications, getActiveMitras } from "./actions";
import { MitraAdminClient } from "./mitra-admin-client";

export default async function MitraPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const [applications, mitras] = await Promise.all([
    getMitraApplications(slug),
    getActiveMitras(slug),
  ]);

  const pendingCount = applications.filter(a => a.status === "pending").length;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mitra Toko</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola pengajuan dan mitra aktif yang berjualan di toko ini.
        </p>
      </div>
      <MitraAdminClient
        slug={slug}
        applications={applications}
        mitras={mitras}
        pendingCount={pendingCount}
      />
    </div>
  );
}
