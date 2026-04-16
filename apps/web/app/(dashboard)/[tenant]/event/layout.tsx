import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { EventNav } from "@/components/event/event-nav";

export default async function EventLayout({
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
      <EventNav slug={slug} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
