export const dynamic = "force-dynamic";
import { NextResponse }             from "next/server";
import { eq, ilike, or, and }       from "drizzle-orm";
import { db, tenants, members, tenantMemberships, createTenantDb } from "@jalajogja/db";
import { resolvePostHrefs } from "@/lib/post-permalink.server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug  = searchParams.get("slug")?.trim() ?? "";
  const query = searchParams.get("q")?.trim()    ?? "";

  const empty = { posts: [], pages: [], events: [], products: [], members: [] };

  if (!slug || query.length < 2) {
    return NextResponse.json(empty, { status: 200 });
  }

  // Validasi tenant
  const [tenant] = await db
    .select({ id: tenants.id, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant?.isActive) {
    return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
  }

  const tenantClient = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;
  const pattern = `%${query}%`;
  const LIMIT   = 5;

  const [posts, pages, events, products, memberResults] = await Promise.all([
    // Blog posts
    tenantDb
      .select({
        title:        schema.posts.title,
        slug:         schema.posts.slug,
        excerpt:      schema.posts.excerpt,
        publishedAt:  schema.posts.publishedAt,
        categorySlug: schema.postCategories.slug,
      })
      .from(schema.posts)
      .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
      .where(and(
        eq(schema.posts.status, "published"),
        or(
          ilike(schema.posts.title, pattern),
          ilike(schema.posts.excerpt, pattern),
        ),
      ))
      .limit(LIMIT),

    // Pages
    tenantDb
      .select({ title: schema.pages.title, slug: schema.pages.slug })
      .from(schema.pages)
      .where(and(
        eq(schema.pages.status, "published"),
        ilike(schema.pages.title, pattern),
      ))
      .limit(LIMIT),

    // Events (published) — kolom "title" bukan "name"
    tenantDb
      .select({ name: schema.events.title, slug: schema.events.slug })
      .from(schema.events)
      .where(and(
        eq(schema.events.status, "published"),
        ilike(schema.events.title, pattern),
      ))
      .limit(LIMIT),

    // Products (active)
    tenantDb
      .select({ name: schema.products.name, slug: schema.products.slug, price: schema.products.price })
      .from(schema.products)
      .where(and(
        eq(schema.products.status, "active"),
        ilike(schema.products.name, pattern),
      ))
      .limit(LIMIT),

    // Members via tenant_memberships
    db
      .select({ name: members.name, memberNumber: members.memberNumber })
      .from(members)
      .innerJoin(tenantMemberships, eq(tenantMemberships.memberId, members.id))
      .where(and(
        eq(tenantMemberships.tenantId, tenant.id),
        or(
          ilike(members.name, pattern),
          ilike(members.memberNumber, pattern),
        ),
      ))
      .limit(LIMIT),
  ]);

  const postsWithHref = await resolvePostHrefs(tenantClient, posts);

  return NextResponse.json({
    posts:    postsWithHref,
    pages:    pages,
    events:   events,
    products: products.map((p) => ({ ...p, price: Number(p.price) })),
    members:  memberResults,
  });
}
