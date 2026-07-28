// Route nested untuk permalink "category_name" (docs/arsitektur-import-export-post-wordpress.md
// § 5.1/§ 5.4, Fase 2.6) — /post/{category}/{slug}. Folder ini BERNAMA [slug]/[postSlug] (BUKAN
// [category]/[slug]) karena Next.js App Router mewajibkan SATU nama dynamic segment yang sama
// di posisi kedalaman yang sama untuk semua route sibling — post/[slug]/page.tsx (mode default,
// 1 segmen) sudah menetapkan nama "slug" di posisi pertama, jadi route nested ini WAJIB pakai
// nama yang sama di posisi itu ("You cannot use different slug names for the same dynamic path"
// — dikonfirmasi via next dev, BUKAN via next build biasa yang tidak menangkap ini). Segmen
// pertama ("slug" di sini) MURNI KOSMETIK — mewakili category, TIDAK dipakai untuk lookup, cuma
// segmen KEDUA ("postSlug") yang benar-benar dipakai — post dicari by slug unik saja, sama
// seperti catch-all's date_name/category_date_name (lihat [...slug]/page.tsx).
import type { Metadata } from "next";
import { getPostDetailMetadata, PostDetailView } from "@/components/website/public/single/post-detail-view";

export const revalidate = 60;

type Params = Promise<{ tenant: string; slug: string; postSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: tenantSlug, postSlug } = await params;
  return getPostDetailMetadata(tenantSlug, postSlug);
}

export default async function PostCategoryDetailPage({ params }: { params: Params }) {
  const { tenant: tenantSlug, postSlug } = await params;
  return <PostDetailView tenantSlug={tenantSlug} postSlug={postSlug} />;
}
