import { redirect } from "next/navigation";
import Link from "next/link";
import { createTenantDb } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { getProducerCommercials } from "@/lib/producer-products.server";
import { listVoucherTargetProducts } from "@/lib/producer-vouchers.server";
import { ProducerVoucherForm } from "@/components/producer/producer-voucher-form";
import { createProducerVoucherAction } from "../actions";

export default async function NewProducerVoucherPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");
  const tc = createTenantDb(access.tenant.slug);
  const [com, prods] = await Promise.all([
    getProducerCommercials(tc, access.producer.id),
    listVoucherTargetProducts(tc, access.producer.id),
  ]);
  const back = `/app/${access.tenant.slug}/portal-produsen/voucher`;
  if (!com || !com.isActive || com.sharePercent === null) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-xl font-semibold">Buat Voucher</h1>
        <p className="rounded-lg border border-border bg-card p-4 text-sm">Persentase bagi hasil Anda belum ditetapkan pengurus, jadi voucher belum bisa dibuat. Silakan hubungi pengurus.</p>
        <Link href={back} className="text-sm text-primary hover:underline">← Kembali</Link>
      </div>
    );
  }
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Buat Voucher</h1>
      <ProducerVoucherForm
        products={prods.map((p) => ({ id: p.id, name: p.variable ? `${p.name} (bervariasi)` : p.name, price: p.price }))}
        sharePercent={com.sharePercent} submitLabel="Simpan Voucher" backHref={back}
        onSubmit={createProducerVoucherAction.bind(null, access.tenant.slug)}
      />
    </div>
  );
}
