import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { PengurusNav } from "@/components/pengurus/pengurus-nav";

export default async function PengurusLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <PengurusNav slug={slug} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
