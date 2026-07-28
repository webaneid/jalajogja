import { getTenantSeoBase } from "@/lib/tenant-seo";
import { buildSitemapIndexXml, xmlResponse } from "@/lib/sitemap-builder.server";

// Strategi B — Yoast SEO Migration Sitemap Index (docs/arsitektur-seo.md § 4.2). Alias nama
// file konvensi Yoast — 4 sub-sitemap di bawah memanggil FETCHER YANG SAMA dengan Strategi A
// (post-sitemap.xml ≡ sitemap-posts.xml, dst), bukan implementasi kedua yang independen.
const SUB_SITEMAPS = [
  "post-sitemap.xml",
  "page-sitemap.xml",
  "category-sitemap.xml",
  "product-sitemap.xml",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const entries = SUB_SITEMAPS.map((name) => ({ loc: `${base.baseUrl}/${name}` }));
  return xmlResponse(buildSitemapIndexXml(entries));
}
