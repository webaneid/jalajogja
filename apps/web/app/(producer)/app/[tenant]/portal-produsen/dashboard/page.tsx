import { redirect } from "next/navigation";
import { getProducerPageAccess } from "@/lib/producer-access.server";

// Setiap page memanggil getProducerPageAccess sendiri (guard layout tidak melindungi page — render paralel).
export default async function Page({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  if (!(await getProducerPageAccess(slug))) redirect("/no-tenant-access");

  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Segera hadir — ringkasan akan dikembangkan nanti.</p>
    </div>
  );
}
