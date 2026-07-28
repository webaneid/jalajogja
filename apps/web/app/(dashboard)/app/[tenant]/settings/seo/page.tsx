import { redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { inArray } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";
import { resolveMediaUrl } from "@/lib/minio";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { SEO_PAGE_KEYS } from "@/lib/seo-page-keys";
import { SeoOverridesManageClient } from "@/components/settings/seo-overrides-manage-client";
import { SitemapUrlsCard } from "@/components/settings/sitemap-urls-card";

export default async function SettingsSeoPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  // Sama persis sumber baseUrl yang dipakai Route Handler sitemap sendiri
  // (lib/sitemap-builder.server.ts) — absolut, custom-domain-aware.
  const base = await getTenantSeoBase(slug);
  const nativeSitemapUrl = `${base.baseUrl}/sitemap.xml`;
  const yoastSitemapUrl  = `${base.baseUrl}/sitemap_index.xml`;

  const { db: tenantDb, schema } = createTenantDb(slug);

  const rows = await tenantDb
    .select({
      pageKey:       schema.seoPageOverrides.pageKey,
      metaTitle:     schema.seoPageOverrides.metaTitle,
      metaDesc:      schema.seoPageOverrides.metaDesc,
      ogTitle:       schema.seoPageOverrides.ogTitle,
      ogDescription: schema.seoPageOverrides.ogDescription,
      ogImageId:     schema.seoPageOverrides.ogImageId,
      robots:        schema.seoPageOverrides.robots,
    })
    .from(schema.seoPageOverrides);

  const imageIds = [...new Set(rows.map(r => r.ogImageId).filter((v): v is string => !!v))];
  const imageMap = new Map<string, string>();
  if (imageIds.length > 0) {
    const media = await tenantDb
      .select({ id: schema.media.id, path: schema.media.path, variants: schema.media.variants })
      .from(schema.media)
      .where(inArray(schema.media.id, imageIds));
    for (const m of media) {
      const variants = m.variants as Record<string, string> | null;
      imageMap.set(m.id, resolveMediaUrl(slug, m.path, variants));
    }
  }

  const overrideByKey = new Map(rows.map(r => [r.pageKey, r]));

  const entries = SEO_PAGE_KEYS.map(def => {
    const row = overrideByKey.get(def.key);
    return {
      key:   def.key,
      label: def.label,
      group: def.group,
      path:  def.path(slug),
      override: row
        ? {
            metaTitle:     row.metaTitle,
            metaDesc:      row.metaDesc,
            ogTitle:       row.ogTitle,
            ogDescription: row.ogDescription,
            ogImageId:     row.ogImageId,
            ogImageUrl:    row.ogImageId ? (imageMap.get(row.ogImageId) ?? null) : null,
            robots:        row.robots,
          }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">SEO Halaman Statis</h2>
        <p className="text-sm text-muted-foreground">
          Kustomisasi judul, deskripsi, dan gambar bagikan untuk halaman yang tidak punya
          &quot;rumah&quot; sendiri — login, registrasi, arsip, dan direktori. Halaman yang belum
          dikustomisasi memakai judul bawaan.
        </p>
      </div>

      <SitemapUrlsCard nativeUrl={nativeSitemapUrl} yoastUrl={yoastSitemapUrl} />

      <SeoOverridesManageClient slug={slug} entries={entries} />
    </div>
  );
}
