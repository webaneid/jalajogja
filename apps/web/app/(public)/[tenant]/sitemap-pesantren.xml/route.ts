import { getTenantSeoBase } from "@/lib/tenant-seo";
import { fetchPesantrenEntries, buildUrlsetXml, xmlResponse } from "@/lib/sitemap-builder.server";

// Strategi A — sub-sitemap Direktori Pesantren (public.member_owned_pesantren, § 4.4).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const entries = await fetchPesantrenEntries(slug, base.baseUrl);
  return xmlResponse(buildUrlsetXml(entries));
}
