import { getTenantAccess } from "@/lib/tenant";

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  // access dijamin tidak null — layout sudah redirect jika tidak ada
  const access = await getTenantAccess(slug);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{access!.tenant.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Selamat datang di dashboard organisasi Anda.
      </p>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Role Anda:{" "}
          <span className="font-medium text-foreground">{access!.tenantUser.role}</span>
        </p>
      </div>
    </div>
  );
}
