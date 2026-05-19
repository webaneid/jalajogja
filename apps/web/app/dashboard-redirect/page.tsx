import { redirect } from "next/navigation";
import { getFirstTenantForUser, getCurrentSession } from "@/lib/tenant";

// Server component — tidak ada UI, hanya logic redirect
export default async function DashboardRedirectPage() {
  const session = await getCurrentSession();

  // Tidak ada session — kembali ke login admin
  if (!session?.user) {
    redirect("/app/login");
  }

  const slug = await getFirstTenantForUser();

  // User punya tenant — masuk dashboard
  if (slug) {
    redirect(`/app/${slug}/dashboard`);
  }

  // Edge case: user terdaftar tapi belum punya tenant
  redirect("/register?error=no-tenant");
}
