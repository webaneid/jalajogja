"use server";

import { createTenantDb, upsertSetting } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import type { NavMenu } from "@/lib/nav-menu";
import type { HeaderDesignId } from "@/lib/header-designs";
import type { FooterDesignId } from "@/lib/footer-designs";

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

export async function saveDesignSettingsAction(
  slug: string,
  data: { headerDesign: HeaderDesignId; footerDesign: FooterDesignId }
) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const tenantClient = createTenantDb(slug);

  await Promise.all([
    upsertSetting(tenantClient, "header_design", "display", data.headerDesign),
    upsertSetting(tenantClient, "footer_design", "display", data.footerDesign),
  ]);

  revalidatePath(`/${slug}/settings/website`);
  revalidatePath(`/${slug}`);
  return { success: true };
}
