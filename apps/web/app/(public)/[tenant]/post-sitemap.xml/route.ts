import { getTenantSeoBase } from "@/lib/tenant-seo";
import { fetchPostEntries, buildUrlsetXml, xmlResponse, getTenantClient } from "@/lib/sitemap-builder.server";

// Strategi B (alias Yoast) — data SAMA dengan sitemap-posts.xml — docs/arsitektur-seo.md § 4.4.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const entries = await fetchPostEntries(getTenantClient(slug), base.baseUrl);
  return xmlResponse(buildUrlsetXml(entries));
}
