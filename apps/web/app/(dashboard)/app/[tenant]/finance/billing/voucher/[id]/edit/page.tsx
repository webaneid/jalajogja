import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { getVoucherDetailAction } from "../../../actions";
import { VoucherForm } from "@/components/keuangan/billing/voucher-form";

export default async function VoucherEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const result = await getVoucherDetailAction(slug, id);
  if (!result.success) notFound();
  const voucher = result.data;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Edit Voucher</h1>
        <p className="text-sm text-muted-foreground mt-0.5 font-mono">{voucher.code}</p>
      </div>

      <VoucherForm
        slug={slug}
        voucherId={voucher.id}
        initialValues={{
          code:                  voucher.code,
          name:                  voucher.name,
          description:           voucher.description ?? "",
          discountType:          voucher.discountType,
          discountValue:         voucher.discountValue,
          targetType:            voucher.targetType,
          targetItemIds:         voucher.targetItemIds,
          usageLimit:            voucher.usageLimit,
          usageLimitPerCustomer: voucher.usageLimitPerCustomer,
          restrictPhone:         voucher.restrictPhone,
          restrictEmail:         voucher.restrictEmail,
          validFrom:             voucher.validFrom,
          validUntil:            voucher.validUntil,
        }}
      />
    </div>
  );
}
