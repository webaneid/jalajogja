export const dynamic = "force-dynamic";
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
  memberProfessionals,
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
  buildEventUrl,
  buildEventCategoryUrl,
  buildCampaignUrl,
  buildCampaignCategoryUrl,
  buildDocumentUrl,
  buildDocumentCategoryUrl,
  buildPesantrenUrl,
  buildUsahaUrl,
  buildProfesionalUrl,
  type PublicLink,
} from "@/lib/public-url-registry";

const LIMIT        = 6;   // konten yang bisa banyak (post/produk/event/dst) — wajib search dulu
const BROWSE_LIMIT = 50;  // list pendek & admin-curated (halaman, kategori, tag) — aman ditampilkan semua tanpa search

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const q    = (req.nextUrl.searchParams.get("q") ?? "").trim();

  if (!slug) return NextResponse.json({ links: [] });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = access.tenant.id;

  // Rute statis — selalu tampil (filter by q jika ada)
  const staticLinks = getStaticLinks(slug, q || undefined);

  const qLike         = q ? `%${q}%` : null;
  const tenantClient  = createTenantDb(slug);
  const { db: tdb, schema } = tenantClient;

  // Fetch semua konten dinamis secara paralel.
  // Halaman + taksonomi (kategori/tag) SELALU di-fetch — list-nya pendek & admin-curated
  // (LIMIT 50), jadi aman langsung tampil begitu popover dibuka tanpa perlu ketik dulu, persis
  // seperti rute statis. Konten yang bisa terus bertambah (post/produk/event/campaign/dokumen/
  // pesantren/usaha/profesional) TETAP butuh `q` dulu — listnya bisa panjang.
  const [
    pages,
    postCats,
    postTags,
    productCats,
    eventCats,
    campaignCats,
    documentCats,
    posts,
    products,
    events,
    campaigns,
    documents,
    pesantrenList,
    usahaList,
    profesionalList,
  ] = await Promise.all([
    // Halaman CMS
    tdb.select({ slug: schema.pages.slug, title: schema.pages.title })
      .from(schema.pages)
      .where(qLike ? and(eq(schema.pages.status, "published"), ilike(schema.pages.title, qLike)) : eq(schema.pages.status, "published"))
      .limit(BROWSE_LIMIT),

    // Kategori post
    tdb.select({ slug: schema.postCategories.slug, name: schema.postCategories.name })
      .from(schema.postCategories)
      .where(qLike ? ilike(schema.postCategories.name, qLike) : undefined)
      .limit(BROWSE_LIMIT),

    // Tag post
    tdb.select({ slug: schema.postTags.slug, name: schema.postTags.name })
      .from(schema.postTags)
      .where(qLike ? ilike(schema.postTags.name, qLike) : undefined)
      .limit(BROWSE_LIMIT),

    // Kategori produk
    tdb.select({ slug: schema.productCategories.slug, name: schema.productCategories.name })
      .from(schema.productCategories)
      .where(qLike ? ilike(schema.productCategories.name, qLike) : undefined)
      .limit(BROWSE_LIMIT),

    // Kategori event
    tdb.select({ slug: schema.eventCategories.slug, name: schema.eventCategories.name })
      .from(schema.eventCategories)
      .where(qLike ? ilike(schema.eventCategories.name, qLike) : undefined)
      .limit(BROWSE_LIMIT),

    // Kategori campaign
    tdb.select({ slug: schema.campaignCategories.slug, name: schema.campaignCategories.name })
      .from(schema.campaignCategories)
      .where(qLike ? ilike(schema.campaignCategories.name, qLike) : undefined)
      .limit(BROWSE_LIMIT),

    // Kategori dokumen (URL builder pakai id, bukan slug — lihat § 2d dokumen arsitektur)
    tdb.select({ id: schema.documentCategories.id, name: schema.documentCategories.name })
      .from(schema.documentCategories)
      .where(qLike ? ilike(schema.documentCategories.name, qLike) : undefined)
      .limit(BROWSE_LIMIT),

    // Post individual — hanya kalau ada query
    !qLike ? Promise.resolve([]) : tdb.select({ slug: schema.posts.slug, title: schema.posts.title })
      .from(schema.posts)
      .where(and(eq(schema.posts.status, "published"), ilike(schema.posts.title, qLike)))
      .limit(LIMIT),

    // Produk — hanya kalau ada query
    !qLike ? Promise.resolve([]) : tdb.select({ slug: schema.products.slug, name: schema.products.name })
      .from(schema.products)
      .where(and(eq(schema.products.status, "active"), ilike(schema.products.name, qLike)))
      .limit(LIMIT),

    // Event individual — hanya kalau ada query
    !qLike ? Promise.resolve([]) : tdb.select({ slug: schema.events.slug, title: schema.events.title })
      .from(schema.events)
      .where(and(eq(schema.events.status, "published"), ilike(schema.events.title, qLike)))
      .limit(LIMIT),

    // Campaign / donasi — hanya kalau ada query
    !qLike ? Promise.resolve([]) : tdb.select({ slug: schema.campaigns.slug, title: schema.campaigns.title })
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.status, "active"), ilike(schema.campaigns.title, qLike)))
      .limit(LIMIT),

    // Dokumen individual — hanya yang visibility publik, hanya kalau ada query
    !qLike ? Promise.resolve([]) : tdb.select({ id: schema.documents.id, title: schema.documents.title })
      .from(schema.documents)
      .where(and(eq(schema.documents.visibility, "public"), ilike(schema.documents.title, qLike)))
      .limit(LIMIT),

    // Pesantren (public schema, scope ke tenant) — hanya kalau ada query
    !qLike ? Promise.resolve([]) : db.select({ id: memberOwnedPesantren.id, name: memberOwnedPesantren.name })
      .from(memberOwnedPesantren)
      .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenantId),
      ))
      .where(ilike(memberOwnedPesantren.name, qLike))
      .limit(LIMIT),

    // Usaha (public schema, scope ke tenant) — hanya kalau ada query
    !qLike ? Promise.resolve([]) : db.select({ id: memberBusinesses.id, name: memberBusinesses.name })
      .from(memberBusinesses)
      .innerJoin(members, eq(members.id, memberBusinesses.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenantId),
      ))
      .where(and(eq(memberBusinesses.isActive, true), ilike(memberBusinesses.name, qLike)))
      .limit(LIMIT),

    // Profesional (public schema, scope ke tenant) — hanya kalau ada query
    !qLike ? Promise.resolve([]) : db.select({ id: memberProfessionals.id, title: memberProfessionals.title, professionType: memberProfessionals.professionType })
      .from(memberProfessionals)
      .innerJoin(members, eq(members.id, memberProfessionals.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenantId),
      ))
      .where(and(eq(memberProfessionals.isActive, true), ilike(memberProfessionals.professionType, qLike)))
      .limit(LIMIT),
  ]);

  const dynamicLinks: PublicLink[] = [
    ...pages.map(p => ({ label: p.title,  url: buildPageUrl(slug, p.slug),             group: "Halaman",         type: "page"             as const })),
    ...posts.map(p => ({ label: p.title,  url: buildPostUrl(slug, p.slug),             group: "Postingan",       type: "post"             as const })),
    ...postCats.map(c => ({ label: c.name, url: buildPostCategoryUrl(slug, c.slug),    group: "Kategori Post",   type: "post-category"    as const })),
    ...postTags.map(t => ({ label: t.name, url: buildPostTagUrl(slug, t.slug),         group: "Tag Post",        type: "post-tag"         as const })),
    ...products.map(p => ({ label: p.name, url: buildProductUrl(slug, p.slug),         group: "Produk",          type: "product"          as const })),
    ...productCats.map(c => ({ label: c.name, url: buildProductCategoryUrl(slug, c.slug), group: "Kategori Produk", type: "product-category" as const })),
    ...events.map(e => ({ label: e.title, url: buildEventUrl(slug, e.slug),            group: "Agenda",          type: "event"            as const })),
    ...eventCats.map(c => ({ label: c.name, url: buildEventCategoryUrl(slug, c.slug),  group: "Kategori Agenda", type: "event-category"   as const })),
    ...campaigns.map(c => ({ label: c.title, url: buildCampaignUrl(slug, c.slug),      group: "Donasi",          type: "campaign"         as const })),
    ...campaignCats.map(c => ({ label: c.name, url: buildCampaignCategoryUrl(slug, c.slug), group: "Kategori Donasi", type: "campaign-category" as const })),
    ...documents.map(d => ({ label: d.title, url: buildDocumentUrl(slug, d.id),        group: "Dokumen",         type: "document"         as const })),
    ...documentCats.map(c => ({ label: c.name, url: buildDocumentCategoryUrl(slug, c.id), group: "Kategori Dokumen", type: "document-category" as const })),
    ...pesantrenList.map(p => ({ label: p.name, url: buildPesantrenUrl(slug, p.id),    group: "Direktori",       type: "pesantren"        as const })),
    ...usahaList.map(u => ({ label: u.name,  url: buildUsahaUrl(slug, u.id),           group: "Direktori",       type: "usaha"            as const })),
    ...profesionalList.map(p => ({ label: [p.title, p.professionType].filter(Boolean).join(" "), url: buildProfesionalUrl(slug, p.id), group: "Direktori", type: "profesional" as const })),
  ];

  return NextResponse.json({ links: [...staticLinks, ...dynamicLinks] });
}
