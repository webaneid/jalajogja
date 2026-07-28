// Dual Sitemap Index Engine (Fase 5) — docs/arsitektur-seo.md § 4/§ 4.4. Satu helper server-only
// dipakai oleh SEMUA 14 Route Handler (`app/(public)/[tenant]/sitemap*.xml/route.ts`,
// `sitemap_index.xml`, dan 4 alias Yoast-style) — fetcher per tipe konten dipanggil oleh KEDUA
// strategi (Native + Yoast alias) untuk data yang sama, cuma nama file output yang beda.
//
// Route Handler manual (bukan Metadata Route convention `sitemap.ts`) — meski `sitemap.ts`
// TERBUKTI bisa di-nest ke dynamic segment (§ 6c.2a, regex Next.js tidak di-anchor untuk
// "sitemap"), convention itu hanya menghasilkan SATU <urlset> per file atau split via
// generateSitemaps() yang memaksa nama `/sitemap/{id}.xml` — tidak cocok untuk kebutuhan nama
// file arbitrer (demi kompatibilitas Yoast: `post-sitemap.xml`, `sitemap_index.xml`, dst).
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import {
  createTenantDb, db, tenants, tenantMemberships,
  memberOwnedPesantren, memberBusinesses,
  type TenantDb,
} from "@jalajogja/db";
import { resolvePostHrefs } from "./post-permalink.server";

export type SitemapEntry = { loc: string; lastmod?: string };

// Cap keamanan sesuai § 4.3 (1.000 URL per file) — pagination multi-file (sitemap-posts-1.xml,
// -2.xml, dst) BELUM diimplementasikan, di luar scope eksekusi awal ini. Tenant manapun yang
// tembus 1.000 item per satu tipe konten butuh perluasan terpisah nanti.
const ENTRY_CAP = 1000;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoDate(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function buildUrlsetXml(entries: SitemapEntry[]): string {
  const items = entries
    .map((e) => {
      const lastmod = e.lastmod ? `<lastmod>${xmlEscape(e.lastmod)}</lastmod>` : "";
      return `<url><loc>${xmlEscape(e.loc)}</loc>${lastmod}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}

export function buildSitemapIndexXml(entries: SitemapEntry[]): string {
  const items = entries
    .map((e) => {
      const lastmod = e.lastmod ? `<lastmod>${xmlEscape(e.lastmod)}</lastmod>` : "";
      return `<sitemap><loc>${xmlEscape(e.loc)}</loc>${lastmod}</sitemap>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}

// ── Fetcher per tipe konten — semua terima tenantClient (TenantDb utuh, BUKAN raw db hasil
// destructure, lihat lesson lama "getSettings butuh TenantDb lengkap") + baseUrl absolut
// (dari getTenantSeoBase(slug).baseUrl di titik pemanggilan, custom-domain-aware) ─────────────

export async function fetchPostEntries(tenantClient: TenantDb, baseUrl: string): Promise<SitemapEntry[]> {
  const { db: tenantDb, schema } = tenantClient;
  const rows = await tenantDb
    .select({
      slug: schema.posts.slug,
      categorySlug: schema.postCategories.slug,
      publishedAt: schema.posts.publishedAt,
      updatedAt: schema.posts.updatedAt,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(eq(schema.posts.status, "published"))
    .limit(ENTRY_CAP);

  const withHref = await resolvePostHrefs(tenantClient, rows);
  return withHref.map((r) => ({ loc: `${baseUrl}${r.href}`, lastmod: toIsoDate(r.updatedAt) }));
}

export async function fetchPageEntries(tenantClient: TenantDb, baseUrl: string): Promise<SitemapEntry[]> {
  const { db: tenantDb, schema } = tenantClient;
  const rows = await tenantDb
    .select({ slug: schema.pages.slug, updatedAt: schema.pages.updatedAt })
    .from(schema.pages)
    .where(eq(schema.pages.status, "published"))
    .limit(ENTRY_CAP);
  return rows.map((r) => ({ loc: `${baseUrl}/${r.slug}`, lastmod: toIsoDate(r.updatedAt) }));
}

export async function fetchProductEntries(tenantClient: TenantDb, baseUrl: string): Promise<SitemapEntry[]> {
  const { db: tenantDb, schema } = tenantClient;
  const rows = await tenantDb
    .select({ slug: schema.products.slug, updatedAt: schema.products.updatedAt })
    .from(schema.products)
    .where(eq(schema.products.status, "active"))
    .limit(ENTRY_CAP);
  return rows.map((r) => ({ loc: `${baseUrl}/produk/${r.slug}`, lastmod: toIsoDate(r.updatedAt) }));
}

export async function fetchEventEntries(tenantClient: TenantDb, baseUrl: string): Promise<SitemapEntry[]> {
  const { db: tenantDb, schema } = tenantClient;
  const rows = await tenantDb
    .select({ slug: schema.events.slug, updatedAt: schema.events.updatedAt })
    .from(schema.events)
    .where(eq(schema.events.status, "published"))
    .limit(ENTRY_CAP);
  return rows.map((r) => ({ loc: `${baseUrl}/agenda/${r.slug}`, lastmod: toIsoDate(r.updatedAt) }));
}

export async function fetchCampaignEntries(tenantClient: TenantDb, baseUrl: string): Promise<SitemapEntry[]> {
  const { db: tenantDb, schema } = tenantClient;
  const rows = await tenantDb
    .select({ slug: schema.campaigns.slug, updatedAt: schema.campaigns.updatedAt })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.status, "active"))
    .limit(ENTRY_CAP);
  return rows.map((r) => ({ loc: `${baseUrl}/campaign/${r.slug}`, lastmod: toIsoDate(r.updatedAt) }));
}

export async function fetchDocumentEntries(tenantClient: TenantDb, baseUrl: string): Promise<SitemapEntry[]> {
  const { db: tenantDb, schema } = tenantClient;
  const rows = await tenantDb
    .select({ id: schema.documents.id, updatedAt: schema.documents.updatedAt })
    .from(schema.documents)
    .where(eq(schema.documents.visibility, "public"))
    .limit(ENTRY_CAP);
  return rows.map((r) => ({ loc: `${baseUrl}/dokumen/view/${r.id}`, lastmod: toIsoDate(r.updatedAt) }));
}

// Kategori — produk/event/campaign/dokumen SAJA (post_categories SENGAJA dikecualikan, arsip
// /post belum punya filter ?category= yang benar-benar berfungsi — § 4.4). Tidak ada kolom
// updatedAt di tabel kategori manapun, jadi lastmod selalu di-skip untuk keempatnya.
export async function fetchCategoryEntries(tenantClient: TenantDb, baseUrl: string): Promise<SitemapEntry[]> {
  const { db: tenantDb, schema } = tenantClient;
  const [productCats, eventCats, campaignCats, documentCats] = await Promise.all([
    tenantDb.select({ slug: schema.productCategories.slug }).from(schema.productCategories).limit(ENTRY_CAP),
    tenantDb.select({ slug: schema.eventCategories.slug }).from(schema.eventCategories).limit(ENTRY_CAP),
    tenantDb.select({ slug: schema.campaignCategories.slug }).from(schema.campaignCategories).limit(ENTRY_CAP),
    tenantDb.select({ slug: schema.documentCategories.slug }).from(schema.documentCategories).limit(ENTRY_CAP),
  ]);
  return [
    ...productCats.map((r) => ({ loc: `${baseUrl}/produk/kategori/${r.slug}` })),
    ...eventCats.map((r) => ({ loc: `${baseUrl}/agenda?category=${r.slug}` })),
    ...campaignCats.map((r) => ({ loc: `${baseUrl}/campaign?category=${r.slug}` })),
    ...documentCats.map((r) => ({ loc: `${baseUrl}/dokumen?category=${r.slug}` })),
  ];
}

// Pesantren + Usaha — dua-duanya di PUBLIC schema (bukan tenant schema, lihat § 4.4), scoped
// via JOIN tenant_memberships persis pola query /pesantren dan /usaha publik yang sudah ada.
export async function fetchPesantrenEntries(tenantSlug: string, baseUrl: string): Promise<SitemapEntry[]> {
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) return [];
  const rows = await db
    .select({ id: memberOwnedPesantren.id, updatedAt: memberOwnedPesantren.updatedAt })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, memberOwnedPesantren.memberId),
      eq(tenantMemberships.tenantId, tenant.id),
      inArray(tenantMemberships.status, ["active", "alumni"]),
    ))
    .limit(ENTRY_CAP);
  return rows.map((r) => ({ loc: `${baseUrl}/pesantren/${r.id}`, lastmod: toIsoDate(r.updatedAt) }));
}

export async function fetchUsahaEntries(tenantSlug: string, baseUrl: string): Promise<SitemapEntry[]> {
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) return [];
  const rows = await db
    .select({ id: memberBusinesses.id, updatedAt: memberBusinesses.updatedAt })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, memberBusinesses.memberId),
      eq(tenantMemberships.tenantId, tenant.id),
      inArray(tenantMemberships.status, ["active", "alumni"]),
    ))
    .where(eq(memberBusinesses.isActive, true))
    .limit(ENTRY_CAP);
  return rows.map((r) => ({ loc: `${baseUrl}/usaha/${r.id}`, lastmod: toIsoDate(r.updatedAt) }));
}

// Helper kecil dipakai route.ts index — hindari duplikasi `createTenantDb(slug)` + destructure
// di setiap file (lesson lama: harus TenantDb utuh, bukan raw db hasil destructure dini).
export function getTenantClient(slug: string): TenantDb {
  return createTenantDb(slug);
}
