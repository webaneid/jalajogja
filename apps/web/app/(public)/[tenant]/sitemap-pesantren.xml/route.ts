import { isActiveTenant } from "@/lib/tenant-active";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { fetchPesantrenEntries, buildUrlsetXml, xmlResponse } from "@/lib/sitemap-builder.server";

// Strategi A — sub-sitemap Direktori Pesantren (public.member_owned_pesantren, § 4.4).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  if (!(await isActiveTenant(slug))) return new Response("Not Found", { status: 404 });
  const base = await getTenantSeoBase(slug);
  const entries = await fetchPesantrenEntries(slug, base.baseUrl);
  return xmlResponse(buildUrlsetXml(entries));
}
