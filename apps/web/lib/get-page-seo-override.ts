import "server-only";
import type { TenantDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { resolveMediaUrl } from "@/lib/minio";

export type PageSeoOverride = {
  metaTitle:     string | null;
  metaDesc:      string | null;
  ogTitle:       string | null;
  ogDescription: string | null;
  ogImageUrl:    string | null;
  robots:        string | null;
};

// Fase 3, docs/arsitektur-seo.md § 3.3 — dipanggil dari generateMetadata halaman Kelas C
// (arsip statis + login/register/dst) untuk merge dengan default hardcode yang sudah ada.
// Default TIDAK PERNAH dihapus di caller — hasil null di sini berarti "belum dikustomisasi admin".
export async function getPageSeoOverride(
  tenantClient: TenantDb,
  slug: string,
  pageKey: string,
): Promise<PageSeoOverride | null> {
  const { db, schema } = tenantClient;

  const [row] = await db
    .select({
      metaTitle:     schema.seoPageOverrides.metaTitle,
      metaDesc:      schema.seoPageOverrides.metaDesc,
      ogTitle:       schema.seoPageOverrides.ogTitle,
      ogDescription: schema.seoPageOverrides.ogDescription,
      ogImageId:     schema.seoPageOverrides.ogImageId,
      robots:        schema.seoPageOverrides.robots,
    })
    .from(schema.seoPageOverrides)
    .where(eq(schema.seoPageOverrides.pageKey, pageKey))
    .limit(1);

  if (!row) return null;

  let ogImageUrl: string | null = null;
  if (row.ogImageId) {
    const [media] = await db
      .select({ path: schema.media.path, variants: schema.media.variants })
      .from(schema.media)
      .where(eq(schema.media.id, row.ogImageId))
      .limit(1);
    if (media) {
      const variants = media.variants as Record<string, string> | null;
      ogImageUrl = resolveMediaUrl(slug, media.path, variants);
    }
  }

  return {
    metaTitle:     row.metaTitle,
    metaDesc:      row.metaDesc,
    ogTitle:       row.ogTitle,
    ogDescription: row.ogDescription,
    ogImageUrl,
    robots:        row.robots,
  };
}
