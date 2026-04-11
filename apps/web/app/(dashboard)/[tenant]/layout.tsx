import { redirect } from "next/navigation";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  // Layer 2 auth: verifikasi session nyata + akses tenant
  // Layer 1 (cookie check) sudah dilakukan di middleware.ts
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect(`/login?redirect=/${slug}/dashboard`);
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    // Tenant tidak ada atau user tidak punya akses
    redirect("/dashboard-redirect");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* TODO: tambah sidebar/navbar setelah shell UI selesai */}
      <main>{children}</main>
    </div>
  );
}
