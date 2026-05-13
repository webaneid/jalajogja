import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { db, tenants, tenantAddonInstallations, addons } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Package, Truck } from "lucide-react";

const CONFIGURABLE_ADDONS = ["rajaongkir"] as const;

export default async function AddonsSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)
    .then(r => r[0]);

  if (!tenant) redirect("/dashboard-redirect");

  const installations = await db
    .select({
      addonSlug:   addons.slug,
      addonName:   addons.name,
      addonDesc:   addons.description,
      addonCat:    addons.category,
      addonFree:   addons.isFree,
      status:      tenantAddonInstallations.status,
      installedAt: tenantAddonInstallations.installedAt,
    })
    .from(tenantAddonInstallations)
    .innerJoin(addons, eq(addons.id, tenantAddonInstallations.addonId))
    .where(eq(tenantAddonInstallations.tenantId, tenant.id))
    .orderBy(addons.name);

  const installedSlugs = new Set(installations.map(i => i.addonSlug));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Add-on Terinstall</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola konfigurasi add-on yang sudah aktif
        </p>
      </div>

      {installations.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed border-border">
          Belum ada add-on terinstall. Hubungi tim jalakarta untuk mengaktifkan add-on.
        </p>
      ) : (
        <div className="space-y-3">
          {installations.map((inst) => {
            const hasConfig = CONFIGURABLE_ADDONS.includes(inst.addonSlug as typeof CONFIGURABLE_ADDONS[number]);
            return (
              <div key={inst.addonSlug} className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <AddonIcon slug={inst.addonSlug} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{inst.addonName}</p>
                    <p className="text-xs text-muted-foreground">{inst.addonDesc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    inst.status === "active" ? "bg-green-100 text-green-700" :
                    inst.status === "trial"  ? "bg-yellow-100 text-yellow-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {inst.status === "active" ? "Aktif" :
                     inst.status === "trial"  ? "Uji Coba" :
                     inst.status === "expired" ? "Kedaluwarsa" : "Nonaktif"}
                  </span>
                  {hasConfig && (
                    <Link
                      href={`/${slug}/settings/addons/${inst.addonSlug}`}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                    >
                      Konfigurasi
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Untuk menginstall add-on baru atau mengelola langganan, hubungi tim jalakarta.
      </div>
    </div>
  );
}

function AddonIcon({ slug }: { slug: string }) {
  if (slug === "rajaongkir") return <Truck className="h-4 w-4" />;
  return <Package className="h-4 w-4" />;
}
