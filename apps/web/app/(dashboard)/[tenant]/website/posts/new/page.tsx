import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createPostDraftAction } from "../../actions";

/**
 * Route ini langsung pre-create draft → redirect ke edit page.
 * Dipanggil saat user klik tombol "Post Baru" tanpa client-side JS (fallback).
 * Normalnya CreateButton di PostListClient handle ini via client action + router.push.
 */
export default async function NewPostPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/login`);

  const res = await createPostDraftAction(slug);
  if (res.success) {
    redirect(`/${slug}/website/posts/${res.data.postId}/edit`);
  }

  // Gagal buat draft — redirect ke list dengan pesan error via searchParam
  redirect(`/${slug}/website/posts?error=create_failed`);
}
