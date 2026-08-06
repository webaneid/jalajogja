import { notFound } from "next/navigation";
import { eq }        from "drizzle-orm";
import { db, tenants, createTenantDb } from "@jalajogja/db";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import type { Metadata } from "next";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { computeMemberStatistics } from "@/lib/member-statistics.server";
import { StatistikSections } from "@/components/statistik/statistik-sections";

export const revalidate = 300;

type Params = Promise<{ tenant: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "statistik");
  return buildMetadata({
    title:         override?.metaTitle || "Statistik Anggota",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/statistik`,
    robots:        override?.robots || undefined,
  });
}

export default async function StatistikPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  // Modul ekosistem aktif tenant ini — breakdown Usaha/Pesantren/Profesional hilang kalau
  // modulnya dimatikan admin (lib/ekosistem-modules.ts). Query tetap jalan seperti biasa
  // (data global tidak pernah dihapus), cuma blok render-nya yang digate di StatistikSections.
  const enabledModules = await getEnabledEkosistemModules(createTenantDb(slug));

  const data = await computeMemberStatistics(tenant.id);

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Statistik</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Data statistik anggota, pesantren, usaha, dan profesional {tenant.name}
          </p>
        </div>

        <StatistikSections data={data} enabledModules={enabledModules} />
      </div>
    </div>
  );
}
