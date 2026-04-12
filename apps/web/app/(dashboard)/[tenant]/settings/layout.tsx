import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  return (
    <div className="flex flex-col gap-6 p-6 lg:flex-row lg:gap-10">
      {/* Sidebar nav kiri — horizontal scroll di mobile, vertikal di desktop */}
      <aside className="w-full shrink-0 lg:w-52">
        <SettingsNav slug={slug} />
      </aside>

      {/* Konten section */}
      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
