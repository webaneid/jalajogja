import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { getProducerCommercials } from "@/lib/producer-products.server";
import { getProducerVoucher } from "@/lib/producer-vouchers.server";
import { getTenantTimezone } from "@/lib/tenant-timezone.server";
import { ProducerVoucherForm } from "@/components/producer/producer-voucher-form";
import { updateProducerVoucherAction } from "../../actions";

export default async function EditProducerVoucherPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");
  const tc = createTenantDb(access.tenant.slug);
  const P = tc.schema.products;
  const [voucher, com, prods, tz] = await Promise.all([
    getProducerVoucher(tc, access.producer.id, id),
    getProducerCommercials(tc, access.producer.id),
    tc.db.select({ id: P.id, name: P.name, pub: P.publicPrice }).from(P)
      .where(and(eq(P.producerId, access.producer.id), isNull(P.mitraId), eq(P.productType, "simple"))).orderBy(asc(P.name)),
    getTenantTimezone(tc),
  ]);
  if (!voucher) notFound();   // milik produsen lain / voucher admin / id acak = 404
  const back = `/app/${access.tenant.slug}/portal-produsen/voucher`;
  if (!com || !com.isActive || com.sharePercent === null) {
    return <div className="max-w-2xl space-y-3"><h1 className="text-xl font-semibold">Ubah Voucher</h1><p className="rounded-lg border border-border bg-card p-4 text-sm">Persentase bagi hasil Anda belum ditetapkan pengurus. Silakan hubungi pengurus.</p><Link href={back} className="text-sm text-primary hover:underline">← Kembali</Link></div>;
  }
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso)) : "");
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Ubah Voucher</h1>
      <ProducerVoucherForm
        codeLocked
        products={prods.map((p) => ({ id: p.id, name: p.name, price: parseFloat(String(p.pub ?? 0)) }))}
        sharePercent={com.sharePercent} submitLabel="Simpan Perubahan" backHref={back}
        onSubmit={updateProducerVoucherAction.bind(null, access.tenant.slug, voucher.id)}
        initial={{
          code: voucher.code, name: voucher.name, description: voucher.description ?? "", discountType: voucher.discountType, discountValue: String(voucher.discountValue),
          targetItemIds: voucher.targetItemIds, usageLimit: voucher.usageLimit ? String(voucher.usageLimit) : "", usageLimitPerCustomer: voucher.usageLimitPerCustomer ? String(voucher.usageLimitPerCustomer) : "",
          restrictPhone: voucher.restrictPhone ?? "", restrictEmail: voucher.restrictEmail ?? "", validFrom: day(voucher.validFrom), validUntil: day(voucher.validUntil), isActive: voucher.isActive,
        }}
      />
    </div>
  );
}
