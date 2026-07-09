import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ tenant: string; id: string }> };

export default async function OldOrderDetailPage({ params }: Props) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  // Halaman pesanan lama sudah tidak dipakai — semua pesanan kini via invoice
  redirect(`/app/${slug}/toko/pesanan`);
}
