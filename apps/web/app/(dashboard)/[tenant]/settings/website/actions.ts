"use server";

import { createTenantDb } from "@jalajogja/db";
import { upsertSetting } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import type { NavMenu } from "@/lib/nav-menu";

export async function saveWebsiteSettingsAction(
  slug: string,
  data: { homepageSlug: string; navMenu: NavMenu }
) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const tenantClient = createTenantDb(slug);

  await Promise.all([
    upsertSetting(tenantClient, "homepage_slug", "website", data.homepageSlug),
    upsertSetting(tenantClient, "nav_menu",      "website", data.navMenu),
  ]);

  revalidatePath(`/${slug}/settings/website`);
  return { success: true };
}
