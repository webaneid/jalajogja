export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, createTenantDb, tenants, getSetting, upsertSetting } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { refreshLongLivedToken } from "@/lib/instagram-oauth.server";

type InstagramConfig = {
  igUserId: string;
  username: string;
  accessToken: string;
  tokenExpiresAt: string;
  connectedAt: string;
};

// Refresh token Instagram Graph API (valid 60 hari) sebelum expired — dipicu crontab VPS harian.
// Refresh hanya untuk token yang tersisa < 10 hari lagi. Auth via x-cron-secret, pola sama
// cleanup-images/invoice-reminder. Belum dijadwalkan di crontab VPS — perlu ditambahkan manual.
export async function GET(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTenants = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  let refreshed = 0;
  let failed = 0;

  for (const tenant of activeTenants) {
    const tenantClient = createTenantDb(tenant.slug);
    const config = await getSetting<InstagramConfig>(tenantClient, "instagram_config", "website");
    if (!config?.accessToken) continue;

    const expiresAt = new Date(config.tokenExpiresAt).getTime();
    const daysLeft = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft > 10) continue;

    try {
      const { accessToken, expiresInSec } = await refreshLongLivedToken(config.accessToken);
      await upsertSetting(tenantClient, "instagram_config", "website", {
        ...config,
        accessToken,
        tokenExpiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
      });
      refreshed++;
    } catch (err) {
      console.error(`[refresh-instagram-tokens] Gagal refresh token tenant ${tenant.slug}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ refreshed, failed });
}
