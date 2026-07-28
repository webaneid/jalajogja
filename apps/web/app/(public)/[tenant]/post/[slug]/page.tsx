import type { Metadata } from "next";
import { getPostDetailMetadata, PostDetailView } from "@/components/website/public/single/post-detail-view";

export const revalidate = 60;

type Params = Promise<{ tenant: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: tenantSlug, slug: postSlug } = await params;
  return getPostDetailMetadata(tenantSlug, postSlug);
}

export default async function BlogDetailPage({ params }: { params: Params }) {
  const { tenant: tenantSlug, slug: postSlug } = await params;
  return <PostDetailView tenantSlug={tenantSlug} postSlug={postSlug} />;
}
