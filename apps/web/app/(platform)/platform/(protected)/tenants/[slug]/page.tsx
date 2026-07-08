import { notFound } from "next/navigation";
import { db, tenants, addons, tenantAddonInstallations, refIkpmCabang, createTenantDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Globe, ExternalLink } from "lucide-react";
import { PlatformTenantToggle } from "@/components/platform/tenant-toggle";
import { AddonToggle } from "./addon-toggle";
import { LinkCabangClient } from "./link-cabang-client";
import { CreateOwnerClient } from "./create-owner-client";

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

  // Ambil daftar cabang resmi (hanya untuk tenant bertipe cabang)
  const cabangList = tenant.tenantType === "cabang"
    ? await db.select({ id: refIkpmCabang.id, nama: refIkpmCabang.nama })
        .from(refIkpmCabang)
        .where(eq(refIkpmCabang.isActive, true))
        .orderBy(refIkpmCabang.nama)
    : [];

  // Nama cabang yang sudah terhubung (jika ada)
  let linkedCabangNama: string | null = null;
  if (tenant.refCabangId) {
    const [linked] = await db.select({ nama: refIkpmCabang.nama })
      .from(refIkpmCabang).where(eq(refIkpmCabang.id, tenant.refCabangId)).limit(1);
    linkedCabangNama = linked?.nama ?? null;
  }

  // Cek apakah sudah ada owner di tenant.users
  const { db: tenantDb, schema } = createTenantDb(slug);
  const [firstUser] = await tenantDb
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .limit(1);
  const hasOwner = !!firstUser;

  // Semua add-on tersedia + status instalasi untuk tenant ini
  const [allAddons, installations] = await Promise.all([
    db.select().from(addons).orderBy(addons.name),
    db
      .select({ addonId: tenantAddonInstallations.addonId, status: tenantAddonInstallations.status })
      .from(tenantAddonInstallations)
      .where(eq(tenantAddonInstallations.tenantId, tenant.id)),
  ]);

  const installedIds = new Set(installations.map(i => i.addonId));

  const TYPE_LABEL: Record<string, string> = {
    cabang: "Cabang", marhalah: "Marhalah / Angkatan", forum: "Forum",
  };

  // Ambil nama parent tenant jika ada
  let parentTenantName: string | null = null;
  if (tenant.parentTenantId) {
    const [parent] = await db.select({ name: tenants.name, slug: tenants.slug })
      .from(tenants).where(eq(tenants.id, tenant.parentTenantId)).limit(1);
    parentTenantName = parent?.name ?? null;
  }

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "ID",            value: <span className="font-mono text-xs">{tenant.id}</span> },
    { label: "Slug",          value: <span className="font-mono">{tenant.slug}</span> },
    { label: "Nama",          value: tenant.name },
    { label: "Tipe",          value: (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        tenant.tenantType === "marhalah" ? "bg-purple-100 text-purple-700"
        : tenant.tenantType === "forum"  ? "bg-orange-100 text-orange-700"
        :                                   "bg-blue-100 text-blue-700"
      }`}>
        {TYPE_LABEL[tenant.tenantType] ?? tenant.tenantType}
      </span>
    )},
    ...(tenant.tenantType === "marhalah" ? [
      { label: "Angkatan", value: tenant.marhalahYear
        ? `${tenant.marhalahYear}${tenant.marhalahPeriod ? ` (${tenant.marhalahPeriod})` : ""}`
        : <span className="text-muted-foreground">—</span>
      },
    ] : []),
    ...(tenant.parentTenantId ? [
      { label: "Induk", value: parentTenantName
        ? <Link href={`/platform/tenants/${tenant.parentTenantId}`} className="hover:underline">{parentTenantName}</Link>
        : <span className="font-mono text-xs">{tenant.parentTenantId}</span>
      },
    ] : []),
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

      {/* Link ke PC IKPM Resmi — hanya untuk tenant bertipe cabang */}
      {tenant.tenantType === "cabang" && (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold">PC IKPM Resmi</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hubungkan tenant ini ke data resmi cabang IKPM. Anggota yang sudah mendaftar di cabang tersebut akan otomatis ditambahkan.
            </p>
          </div>
          <LinkCabangClient
            tenantId={tenant.id}
            currentRefId={tenant.refCabangId ?? null}
            currentRefNama={linkedCabangNama}
            cabangList={cabangList}
          />
        </div>
      )}

      {/* Owner Pertama — tampil jika belum ada pengurus */}
      {!hasOwner && (
        <div className="rounded-xl border border-amber-300 bg-background overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 bg-amber-50 dark:bg-amber-950">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Belum Ada Pengurus</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Buat akun owner pertama agar tenant ini bisa dikelola. Owner bisa login di{" "}
              <span className="font-mono">jalakarta.com/app/login</span>.
            </p>
          </div>
          <CreateOwnerClient tenantSlug={slug} />
        </div>
      )}

      {hasOwner && (
        <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950 px-5 py-3">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Pengurus sudah ada — tenant siap dikelola via{" "}
            <a
              href={`${appUrl}/app/${tenant.slug}/dashboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              dashboard tenant
            </a>
          </p>
        </div>
      )}

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
