import { NextRequest, NextResponse } from "next/server";
import { db, createTenantDb, tenants } from "@jalajogja/db";
import { deleteFile } from "@/lib/minio";
import { eq, and, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTenants = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  let deleted = 0;

  for (const tenant of activeTenants) {
    const { db: tenantDb, schema } = createTenantDb(tenant.slug);

    const expired = await tenantDb
      .select({ id: schema.media.id, variants: schema.media.variants })
      .from(schema.media)
      .where(
        and(
          eq(schema.media.processingStatus, "done"),
          lte(schema.media.originalExpiresAt, new Date()),
        ),
      );

    for (const media of expired) {
      if (!media.variants?.original) continue;

      await deleteFile(tenant.slug, media.variants.original);

      const { original: _removed, ...rest } = media.variants;
      await tenantDb
        .update(schema.media)
        .set({ variants: rest, originalExpiresAt: null })
        .where(eq(schema.media.id, media.id));

      deleted++;
    }
  }

  return NextResponse.json({ deleted });
}
