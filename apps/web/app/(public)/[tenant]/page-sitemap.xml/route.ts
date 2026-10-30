import { isActiveTenant } from "@/lib/tenant-active";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { fetchPageEntries, buildUrlsetXml, xmlResponse, getTenantClient } from "@/lib/sitemap-builder.server";

// Strategi B (alias Yoast) — data SAMA dengan sitemap-pages.xml — docs/arsitektur-seo.md § 4.4.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  if (!(await isActiveTenant(slug))) return new Response("Not Found", { status: 404 });
  const base = await getTenantSeoBase(slug);
  const entries = await fetchPageEntries(getTenantClient(slug), base.baseUrl);
  return xmlResponse(buildUrlsetXml(entries));
}
