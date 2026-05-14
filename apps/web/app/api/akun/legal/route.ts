export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, and }                   from "drizzle-orm";
import { db, tenants, createTenantDb } from "@jalajogja/db";
import { renderBody }                  from "@/lib/letter-render";

export async function GET(req: NextRequest) {
  const slug     = req.nextUrl.searchParams.get("slug")?.trim();
  const template = req.nextUrl.searchParams.get("template")?.trim();

  if (!slug || (template !== "terms" && template !== "privacy")) {
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
  }

  const [tenant] = await db
    .select({ id: tenants.id, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant?.isActive) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [page] = await tenantDb
    .select({ title: schema.pages.title, content: schema.pages.content, updatedAt: schema.pages.updatedAt })
    .from(schema.pages)
    .where(and(
      eq(schema.pages.template, template),
      eq(schema.pages.status, "published"),
    ))
    .limit(1);

  if (!page) return NextResponse.json({ found: false }, { status: 200 });

  return NextResponse.json({
    found:     true,
    title:     page.title,
    html:      renderBody(page.content),
    updatedAt: page.updatedAt.toISOString(),
  });
}
