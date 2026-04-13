import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { createProductDraftAction } from "../../actions";

// Pre-create pattern — buat draft dulu, redirect ke edit
export default async function ProdukNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const res = await createProductDraftAction(slug);
  if (res.success) {
    redirect(`/${slug}/toko/produk/${res.data.productId}/edit`);
  }

  // Fallback — seharusnya tidak pernah sampai sini
  redirect(`/${slug}/toko/produk`);
}
