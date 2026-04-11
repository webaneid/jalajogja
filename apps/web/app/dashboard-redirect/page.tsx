import { redirect } from "next/navigation";
import { getFirstTenantForUser, getCurrentSession } from "@/lib/tenant";

// Server component — tidak ada UI, hanya logic redirect
export default async function DashboardRedirectPage() {
  const session = await getCurrentSession();

  // Tidak ada session — kembali ke login
  if (!session?.user) {
    redirect("/login");
  }

  const slug = await getFirstTenantForUser();

  // User punya tenant — masuk dashboard
  if (slug) {
    redirect(`/${slug}/dashboard`);
  }

  // Edge case: user terdaftar tapi belum punya tenant
  // (misal: proses register gagal di tengah jalan)
  redirect("/register?error=no-tenant");
}
