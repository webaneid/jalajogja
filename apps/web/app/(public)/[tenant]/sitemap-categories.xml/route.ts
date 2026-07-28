import { getTenantSeoBase } from "@/lib/tenant-seo";
import { fetchCategoryEntries, buildUrlsetXml, xmlResponse, getTenantClient } from "@/lib/sitemap-builder.server";

// Strategi A — sub-sitemap Kategori (produk+event+campaign+dokumen) — docs/arsitektur-seo.md § 4.4.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const entries = await fetchCategoryEntries(getTenantClient(slug), base.baseUrl);
  return xmlResponse(buildUrlsetXml(entries));
}
