import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { canAccess } from "@/lib/permissions";
import { LettersNav } from "@/components/letters/letters-nav";

export default async function LettersLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");
  if (!canAccess(access.tenantUser, "surat", "own")) redirect(`/app/${slug}/dashboard`);

  return (
    <div className="flex min-h-screen">
      <LettersNav slug={slug} />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
