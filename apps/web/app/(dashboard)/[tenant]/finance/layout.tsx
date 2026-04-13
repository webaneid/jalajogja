import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { KeuanganNav } from "@/components/keuangan/keuangan-nav";

export default async function FinanceLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: React.ReactNode;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  return (
    <div className="flex h-full">
      <KeuanganNav slug={slug} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
