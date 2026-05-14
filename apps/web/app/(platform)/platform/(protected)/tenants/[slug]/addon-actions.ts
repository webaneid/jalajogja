"use server";

import { db, tenants, addons, tenantAddonInstallations } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getPlatformSession } from "@/lib/platform-auth";

export async function installAddonAction(
  tenantId: string,
  addonSlug: string,
): Promise<{ success: true } | { error: string }> {
  const session = await getPlatformSession();
  if (!session) return { error: "Tidak terautentikasi" };

  const [addon] = await db
    .select({ id: addons.id })
    .from(addons)
    .where(eq(addons.slug, addonSlug))
    .limit(1);
  if (!addon) return { error: "Add-on tidak ditemukan" };

  await db
    .insert(tenantAddonInstallations)
    .values({
      tenantId,
      addonId:     addon.id,
      status:      "active",
      config:      {},
      installedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [tenantAddonInstallations.tenantId, tenantAddonInstallations.addonId],
      set:    { status: "active" },
    });

  revalidatePath(`/platform/tenants/${tenantId}`);
  return { success: true };
}

export async function uninstallAddonAction(
  tenantId: string,
  addonSlug: string,
): Promise<{ success: true } | { error: string }> {
  const session = await getPlatformSession();
  if (!session) return { error: "Tidak terautentikasi" };

  const [addon] = await db
    .select({ id: addons.id })
    .from(addons)
    .where(eq(addons.slug, addonSlug))
    .limit(1);
  if (!addon) return { error: "Add-on tidak ditemukan" };

  await db
    .delete(tenantAddonInstallations)
    .where(
      and(
        eq(tenantAddonInstallations.tenantId, tenantId),
        eq(tenantAddonInstallations.addonId,  addon.id),
      ),
    );

  revalidatePath(`/platform/tenants/${tenantId}`);
  return { success: true };
}
