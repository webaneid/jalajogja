import { redirect } from "next/navigation";
import { getProducerAccess } from "@/lib/producer-access.server";

// Setiap page memanggil getProducerAccess sendiri (guard layout tidak melindungi page — render paralel).
export default async function Page({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  if (!(await getProducerAccess(slug))) redirect("/no-tenant-access");

  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold">Pengiriman</h1>
      <p className="text-sm text-muted-foreground">Segera hadir — batch pengiriman.</p>
    </div>
  );
}
