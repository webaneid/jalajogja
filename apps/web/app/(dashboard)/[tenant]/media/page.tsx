import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { redirect } from "next/navigation";
import { publicUrl } from "@/lib/minio";
import { MediaShell } from "@/components/media/media-shell";
import { desc } from "drizzle-orm";

export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ module?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { module: moduleFilter, page: pageStr } = await searchParams;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Ambil semua media, urutkan terbaru dulu
  const mediaList = await tenantDb
    .select()
    .from(schema.media)
    .orderBy(desc(schema.media.createdAt));

  // Tambah URL publik + serialize createdAt ke string
  const mediaWithUrl = mediaList.map((m) => ({
    ...m,
    url: publicUrl(slug, m.path),
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <MediaShell
      slug={slug}
      media={mediaWithUrl}
      initialModule={moduleFilter}
    />
  );
}
