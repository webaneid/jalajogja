import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("tenant");
  if (!slug) {
    return NextResponse.json({ error: "tenant required" }, { status: 400 });
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { db: tenantDb, schema } = createTenantDb(slug);
  const mediaList = await tenantDb
    .select()
    .from(schema.media)
    .orderBy(desc(schema.media.createdAt));

  const result = mediaList.map((m) => ({
    ...m,
    url: publicUrl(slug, m.path),
    // Resolve variant paths → full URLs
    variants: m.variants
      ? Object.fromEntries(
          Object.entries(m.variants).map(([k, v]) => [k, publicUrl(slug, v as string)]),
        )
      : null,
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json(result);
}
