import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { publicUrl } from "@/lib/minio";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as {
    tenant: string;
    altText?: string;
    title?: string;
    caption?: string;
    description?: string;
  };

  const { tenant: slug, ...fields } = body;
  if (!slug) {
    return NextResponse.json({ error: "tenant required" }, { status: 400 });
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [updated] = await tenantDb
    .update(schema.media)
    .set({
      altText:     fields.altText     ?? null,
      title:       fields.title       ?? null,
      caption:     fields.caption     ?? null,
      description: fields.description ?? null,
    })
    .where(eq(schema.media.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    ...updated,
    url: publicUrl(slug, updated.path),
    createdAt: updated.createdAt.toISOString(),
  });
}
