import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { DomainSettingsForm } from "@/components/settings/domain-settings-form";

export default async function DomainSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const [tenant] = await db
    .select({
      slug:                     tenants.slug,
      subdomain:                tenants.subdomain,
      customDomain:             tenants.customDomain,
      customDomainStatus:       tenants.customDomainStatus,
      customDomainVerifiedAt:   tenants.customDomainVerifiedAt,
    })
    .from(tenants)
    .where(eq(tenants.id, access.tenant.id))
    .limit(1);

  if (!tenant) redirect("/dashboard-redirect");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Domain</h2>
        <p className="text-sm text-muted-foreground">
          Atur subdomain jalajogja atau hubungkan domain kustom milikmu.
        </p>
      </div>

      <DomainSettingsForm
        slug={slug}
        defaultValues={{
          subdomain:          tenant.subdomain          ?? "",
          customDomain:       tenant.customDomain       ?? "",
          customDomainStatus: tenant.customDomainStatus ?? "none",
          verifiedAt:         tenant.customDomainVerifiedAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
