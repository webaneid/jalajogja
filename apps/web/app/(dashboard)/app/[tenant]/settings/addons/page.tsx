import { redirect }   from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { db, tenants, tenantAddonInstallations, addons } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import Link           from "next/link";
import {
  Package, Truck, MessageCircle, CreditCard,
  BarChart2, Webhook, CheckCircle2, Lock,
} from "lucide-react";
import { AddonToggleClient } from "./addon-toggle-client";

const CONFIGURABLE_ADDONS = ["rajaongkir"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  logistics:      "Pengiriman",
  communication:  "Komunikasi",
  payment:        "Pembayaran",
  analytics:      "Analitik",
  integration:    "Integrasi",
};

function AddonIcon({ slug }: { slug: string }) {
  if (slug === "rajaongkir")         return <Truck           className="h-4 w-4" />;
  if (slug.startsWith("whatsapp"))   return <MessageCircle   className="h-4 w-4" />;
  if (slug === "midtrans" || slug === "xendit" || slug === "ipaymu" || slug === "qris-dynamic")
                                     return <CreditCard      className="h-4 w-4" />;
  if (slug === "google-analytics" || slug === "meta-pixel")
                                     return <BarChart2       className="h-4 w-4" />;
  if (slug === "webhook-out")        return <Webhook         className="h-4 w-4" />;
  return <Package className="h-4 w-4" />;
}

export default async function AddonsSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) redirect("/dashboard-redirect");

  // Ambil semua addon aktif + status instalasi tenant ini
  const allAddons = await db
    .select({
      id:           addons.id,
      slug:         addons.slug,
      name:         addons.name,
      description:  addons.description,
      category:     addons.category,
      isFree:       addons.isFree,
      priceMonthly: addons.priceMonthly,
      status:       addons.status,
    })
    .from(addons)
    .where(eq(addons.status, "active"))
    .orderBy(addons.category, addons.name);

  const installations = await db
    .select({
      addonId:     tenantAddonInstallations.addonId,
      instStatus:  tenantAddonInstallations.status,
    })
    .from(tenantAddonInstallations)
    .where(eq(tenantAddonInstallations.tenantId, tenant.id));

  const installedMap = new Map(installations.map(i => [i.addonId, i.instStatus]));

  // Kelompokkan per kategori
  const byCategory = new Map<string, typeof allAddons>();
  for (const addon of allAddons) {
    const cat = addon.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(addon);
  }

  const isAdminOrOwner = ["owner", "admin"].includes(access.tenantUser.role);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold">Add-on</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tambah fitur opsional ke aplikasi Anda
        </p>
      </div>

      {[...byCategory.entries()].map(([category, items]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </h3>

          <div className="space-y-2">
            {items.map(addon => {
              const instStatus = installedMap.get(addon.id);
              const isInstalled = !!instStatus && instStatus !== "expired" && instStatus !== "inactive";
              const hasConfig = isInstalled && CONFIGURABLE_ADDONS.includes(addon.slug as typeof CONFIGURABLE_ADDONS[number]);

              return (
                <div
                  key={addon.slug}
                  className={`flex items-center justify-between rounded-lg border bg-background p-4 gap-4 ${
                    isInstalled ? "border-border" : "border-border/60"
                  }`}
                >
                  {/* Ikon + info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`shrink-0 rounded-md p-2 ${isInstalled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <AddonIcon slug={addon.slug} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{addon.name}</p>
                        {isInstalled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            {instStatus === "trial" ? "Uji Coba" : "Aktif"}
                          </span>
                        )}
                        {!addon.isFree && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <Lock className="h-3 w-3" />
                            {addon.priceMonthly
                              ? `Rp ${addon.priceMonthly.toLocaleString("id-ID")}/bln`
                              : "Berbayar"}
                          </span>
                        )}
                      </div>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{addon.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Aksi */}
                  <div className="flex items-center gap-2 shrink-0">
                    {hasConfig && (
                      <Link
                        href={`/${slug}/settings/addons/${addon.slug}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                      >
                        Konfigurasi
                      </Link>
                    )}
                    {isAdminOrOwner && (
                      <AddonToggleClient
                        slug={slug}
                        addonSlug={addon.slug}
                        installed={isInstalled}
                        isFree={addon.isFree}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Add-on berbayar membutuhkan langganan terpisah.
        Hubungi tim jalakarta untuk informasi harga dan aktivasi.
      </p>
    </div>
  );
}
