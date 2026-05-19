import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { hasReadAccess } from "@/lib/permissions";
import { DokumenNav } from "@/components/dokumen/dokumen-nav";

export default async function DokumenLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: React.ReactNode;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");
  if (!hasReadAccess(access.tenantUser, "dokumen")) redirect(`/app/${slug}/dashboard`);

  return (
    <div className="flex h-full">
      <DokumenNav slug={slug} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
