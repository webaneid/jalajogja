import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DisbursementForm } from "@/components/keuangan/disbursement-form";

export default async function PengeluaranNewPage({
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
          href={`/${slug}/finance/pengeluaran`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Pengeluaran
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Ajukan Pengeluaran</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pengajuan pengeluaran perlu disetujui bendahara sebelum bisa dicairkan.
        </p>
      </div>

      <DisbursementForm slug={slug} />
    </div>
  );
}
