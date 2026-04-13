import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PaymentForm } from "@/components/keuangan/payment-form";

export default async function PemasukanNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/finance/pemasukan`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Pemasukan
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Catat Pemasukan Manual</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Input uang masuk secara manual (iuran, donasi, atau sumber lainnya).
        </p>
      </div>

      <PaymentForm slug={slug} />
    </div>
  );
}
