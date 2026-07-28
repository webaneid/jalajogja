import { getTenantSeoBase } from "@/lib/tenant-seo";
import { fetchUsahaEntries, buildUrlsetXml, xmlResponse } from "@/lib/sitemap-builder.server";

// Strategi A — sub-sitemap Direktori Usaha (public.member_businesses, § 4.4).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const entries = await fetchUsahaEntries(slug, base.baseUrl);
  return xmlResponse(buildUrlsetXml(entries));
}
