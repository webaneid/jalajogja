import { getTenantSeoBase } from "@/lib/tenant-seo";
import { buildSitemapIndexXml, xmlResponse } from "@/lib/sitemap-builder.server";

// Strategi A — Native Jalakarta Sitemap Index (docs/arsitektur-seo.md § 4.1). Referensi 8
// sub-sitemap modular — masing-masing punya Route Handler sendiri (fetcher terpisah).
const SUB_SITEMAPS = [
  "sitemap-pages.xml",
  "sitemap-posts.xml",
  "sitemap-categories.xml",
  "sitemap-toko.xml",
  "sitemap-event.xml",
  "sitemap-donasi.xml",
  "sitemap-pesantren.xml",
  "sitemap-usaha.xml",
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
