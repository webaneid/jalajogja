import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { VoucherForm } from "@/components/keuangan/billing/voucher-form";

export default async function VoucherNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Buat Voucher</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Diskon memotong harga item yang ditargetkan saja — item lain di keranjang tidak terpengaruh.
        </p>
      </div>

      <VoucherForm slug={slug} />
    </div>
  );
}
