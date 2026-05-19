import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { hasReadAccess } from "@/lib/permissions";
import { TokoNav } from "@/components/toko/toko-nav";

export default async function TokoLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: React.ReactNode;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");
  if (!hasReadAccess(access.tenantUser, "toko")) redirect(`/${slug}/dashboard`);

  return (
    <div className="flex h-full">
      <TokoNav slug={slug} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
