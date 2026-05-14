// GET /api/ref/public-links?slug={tenantSlug}&q={query}
// Kembalikan semua URL front-end publik yang cocok dengan query (statis + konten DB)
// Dipakai oleh PublicLinkPicker di admin dashboard

import { NextRequest, NextResponse } from "next/server";
import { eq, ilike, and } from "drizzle-orm";
import {
  createTenantDb,
  db,
  members,
  tenantMemberships,
  memberOwnedPesantren,
  memberBusinesses,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import {
  getStaticLinks,
  buildPageUrl,
  buildPostUrl,
  buildPostCategoryUrl,
  buildPostTagUrl,
  buildProductUrl,
  buildProductCategoryUrl,
  buildCampaignUrl,
  buildPesantrenUrl,
  buildUsahaUrl,
  type PublicLink,
} from "@/lib/public-url-registry";

const LIMIT = 6;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const q    = (req.nextUrl.searchParams.get("q") ?? "").trim();

  if (!slug) return NextResponse.json({ links: [] });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = access.tenant.id;

  // Rute statis — selalu tampil (filter by q jika ada)
  const staticLinks = getStaticLinks(slug, q || undefined);

  // Jika query kosong, kembalikan hanya statis
  if (!q) {
    return NextResponse.json({ links: staticLinks });
  }

  const qLike        = `%${q}%`;
  const tenantClient = createTenantDb(slug);
  const { db: tdb, schema } = tenantClient;

  // Fetch semua konten dinamis secara paralel
  const [
    pages,
    posts,
    postCats,
    postTags,
    products,
    productCats,
    campaigns,
    pesantrenList,
    usahaList,
  ] = await Promise.all([
    // Halaman CMS
    tdb.select({ slug: schema.pages.slug, title: schema.pages.title })
      .from(schema.pages)
      .where(and(eq(schema.pages.status, "published"), ilike(schema.pages.title, qLike)))
      .limit(LIMIT),

    // Post individual
    tdb.select({ slug: schema.posts.slug, title: schema.posts.title })
      .from(schema.posts)
      .where(and(eq(schema.posts.status, "published"), ilike(schema.posts.title, qLike)))
      .limit(LIMIT),

    // Kategori post
    tdb.select({ slug: schema.postCategories.slug, name: schema.postCategories.name })
      .from(schema.postCategories)
      .where(ilike(schema.postCategories.name, qLike))
      .limit(LIMIT),

    // Tag post
    tdb.select({ slug: schema.postTags.slug, name: schema.postTags.name })
      .from(schema.postTags)
      .where(ilike(schema.postTags.name, qLike))
      .limit(LIMIT),

    // Produk
    tdb.select({ slug: schema.products.slug, name: schema.products.name })
      .from(schema.products)
      .where(and(eq(schema.products.status, "active"), ilike(schema.products.name, qLike)))
      .limit(LIMIT),

    // Kategori produk
    tdb.select({ slug: schema.productCategories.slug, name: schema.productCategories.name })
      .from(schema.productCategories)
      .where(ilike(schema.productCategories.name, qLike))
      .limit(LIMIT),

    // Campaign / donasi
    tdb.select({ slug: schema.campaigns.slug, title: schema.campaigns.title })
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.status, "active"), ilike(schema.campaigns.title, qLike)))
      .limit(LIMIT),

    // Pesantren (public schema, scope ke tenant)
    db.select({ id: memberOwnedPesantren.id, name: memberOwnedPesantren.name })
      .from(memberOwnedPesantren)
      .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenantId),
      ))
      .where(ilike(memberOwnedPesantren.name, qLike))
      .limit(LIMIT),

    // Usaha (public schema, scope ke tenant)
    db.select({ id: memberBusinesses.id, name: memberBusinesses.name })
      .from(memberBusinesses)
      .innerJoin(members, eq(members.id, memberBusinesses.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenantId),
      ))
      .where(and(eq(memberBusinesses.isActive, true), ilike(memberBusinesses.name, qLike)))
      .limit(LIMIT),
  ]);

  const dynamicLinks: PublicLink[] = [
    ...pages.map(p => ({ label: p.title,  url: buildPageUrl(slug, p.slug),             group: "Halaman",         type: "page"             as const })),
    ...posts.map(p => ({ label: p.title,  url: buildPostUrl(slug, p.slug),             group: "Postingan",       type: "post"             as const })),
    ...postCats.map(c => ({ label: c.name, url: buildPostCategoryUrl(slug, c.slug),    group: "Kategori Post",   type: "post-category"    as const })),
    ...postTags.map(t => ({ label: t.name, url: buildPostTagUrl(slug, t.slug),         group: "Tag Post",        type: "post-tag"         as const })),
    ...products.map(p => ({ label: p.name, url: buildProductUrl(slug, p.slug),         group: "Produk",          type: "product"          as const })),
    ...productCats.map(c => ({ label: c.name, url: buildProductCategoryUrl(slug, c.slug), group: "Kategori Produk", type: "product-category" as const })),
    ...campaigns.map(c => ({ label: c.title, url: buildCampaignUrl(slug, c.slug),      group: "Donasi",          type: "campaign"         as const })),
    ...pesantrenList.map(p => ({ label: p.name, url: buildPesantrenUrl(slug, p.id),    group: "Direktori",       type: "pesantren"        as const })),
    ...usahaList.map(u => ({ label: u.name,  url: buildUsahaUrl(slug, u.id),           group: "Direktori",       type: "usaha"            as const })),
  ];

  return NextResponse.json({ links: [...staticLinks, ...dynamicLinks] });
}
