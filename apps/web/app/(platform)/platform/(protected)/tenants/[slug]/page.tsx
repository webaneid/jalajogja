import { notFound } from "next/navigation";
import { db, tenants, addons, tenantAddonInstallations } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Globe, ExternalLink } from "lucide-react";
import { PlatformTenantToggle } from "@/components/platform/tenant-toggle";
import { AddonToggle } from "./addon-toggle";

type Props = { params: Promise<{ slug: string }> };

export default async function PlatformTenantDetailPage({ params }: Props) {
  const { slug } = await params;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Semua add-on tersedia + status instalasi untuk tenant ini
  const [allAddons, installations] = await Promise.all([
    db.select().from(addons).orderBy(addons.name),
    db
      .select({ addonId: tenantAddonInstallations.addonId, status: tenantAddonInstallations.status })
      .from(tenantAddonInstallations)
      .where(eq(tenantAddonInstallations.tenantId, tenant.id)),
  ]);

  const installedIds = new Set(installations.map(i => i.addonId));

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "ID",            value: <span className="font-mono text-xs">{tenant.id}</span> },
    { label: "Slug",          value: <span className="font-mono">{tenant.slug}</span> },
    { label: "Nama",          value: tenant.name },
    { label: "Subdomain",     value: tenant.subdomain ?? <span className="text-muted-foreground">—</span> },
    { label: "Custom Domain", value: tenant.customDomain ?? <span className="text-muted-foreground">—</span> },
    { label: "Status Domain", value: (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        tenant.customDomainStatus === "active" ? "bg-green-100 text-green-700"
        : tenant.customDomainStatus === "pending" ? "bg-yellow-100 text-yellow-700"
        : tenant.customDomainStatus === "failed" ? "bg-red-100 text-red-700"
        : "bg-muted text-muted-foreground"
      }`}>
        {tenant.customDomainStatus}
      </span>
    )},
    { label: "Dibuat",        value: tenant.createdAt.toLocaleDateString("id-ID", { dateStyle: "long" }) },
    { label: "Diperbarui",    value: tenant.updatedAt.toLocaleDateString("id-ID", { dateStyle: "long" }) },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/platform/tenants" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> Semua Tenant
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              tenant.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
            }`}>
              {tenant.isActive ? "Aktif" : "Non-aktif"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${appUrl}/${tenant.slug}/dashboard`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Globe size={14} />
            Buka Tenant
            <ExternalLink size={12} className="text-muted-foreground" />
          </a>
          <PlatformTenantToggle tenantId={tenant.id} isActive={tenant.isActive} />
        </div>
      </div>

      {/* Detail */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold">Informasi Tenant</p>
        </div>
        <dl className="divide-y divide-border">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex px-5 py-3 gap-4 text-sm">
              <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="flex-1">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Add-on */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold">Add-on</p>
          <p className="text-xs text-muted-foreground mt-0.5">Install atau cabut add-on untuk tenant ini</p>
        </div>
        <div className="divide-y divide-border">
          {allAddons.map((addon) => {
            const installed = installedIds.has(addon.id);
            const inst      = installations.find(i => i.addonId === addon.id);
            return (
              <div key={addon.id} className="flex items-center justify-between px-5 py-3 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{addon.name}</p>
                    {installed && (
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        inst?.status === "active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {inst?.status === "active" ? "Aktif" : inst?.status}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">{addon.slug}</span>
                  </div>
                  {addon.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{addon.description}</p>
                  )}
                </div>
                <AddonToggle
                  tenantId={tenant.id}
                  addonSlug={addon.slug}
                  isInstalled={installed}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
