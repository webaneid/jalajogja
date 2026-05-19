"use server";

import { redirect } from "next/navigation";
import { db, tenants, addons, tenantAddonInstallations } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";

export async function selfInstallAddonAction(slug: string, addonSlug: string) {
  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  // Hanya owner/admin yang boleh install addon
  if (!["owner", "admin"].includes(access.tenantUser.role)) {
    return { error: "Hanya owner atau admin yang boleh menginstall add-on." };
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) return { error: "Tenant tidak ditemukan." };

  const [addon] = await db
    .select({ id: addons.id, isFree: addons.isFree, status: addons.status })
    .from(addons)
    .where(eq(addons.slug, addonSlug))
    .limit(1);

  if (!addon) return { error: "Add-on tidak ditemukan." };
  if (addon.status === "coming_soon") return { error: "Add-on ini belum tersedia." };
  if (!addon.isFree) return { error: "Add-on berbayar harus diaktifkan oleh tim jalakarta." };

  // Cek sudah install
  const existing = await db
    .select({ id: tenantAddonInstallations.id })
    .from(tenantAddonInstallations)
    .where(and(
      eq(tenantAddonInstallations.tenantId, tenant.id),
      eq(tenantAddonInstallations.addonId, addon.id),
    ))
    .limit(1);

  if (existing.length > 0) return { error: "Add-on sudah terinstall." };

  await db.insert(tenantAddonInstallations).values({
    tenantId: tenant.id,
    addonId:  addon.id,
    status:   "active",
    config:   {},
  });

  return { success: true };
}

export async function selfUninstallAddonAction(slug: string, addonSlug: string) {
  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  if (!["owner", "admin"].includes(access.tenantUser.role)) {
    return { error: "Hanya owner atau admin yang boleh menonaktifkan add-on." };
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) return { error: "Tenant tidak ditemukan." };

  const [addon] = await db
    .select({ id: addons.id, isFree: addons.isFree })
    .from(addons)
    .where(eq(addons.slug, addonSlug))
    .limit(1);

  if (!addon) return { error: "Add-on tidak ditemukan." };
  if (!addon.isFree) return { error: "Add-on berbayar hanya bisa dinonaktifkan oleh tim jalakarta." };

  await db
    .delete(tenantAddonInstallations)
    .where(and(
      eq(tenantAddonInstallations.tenantId, tenant.id),
      eq(tenantAddonInstallations.addonId, addon.id),
    ));

  return { success: true };
}
