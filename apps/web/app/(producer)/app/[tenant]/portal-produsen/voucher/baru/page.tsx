import { redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { getProducerCommercials } from "@/lib/producer-products.server";
import { ProducerVoucherForm } from "@/components/producer/producer-voucher-form";
import { createProducerVoucherAction } from "../actions";

export default async function NewProducerVoucherPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");
  const tc = createTenantDb(access.tenant.slug);
  const P = tc.schema.products;
  const [com, prods] = await Promise.all([
    getProducerCommercials(tc, access.producer.id),
    tc.db.select({ id: P.id, name: P.name, pub: P.publicPrice }).from(P)
      .where(and(eq(P.producerId, access.producer.id), isNull(P.mitraId), eq(P.productType, "simple"))).orderBy(asc(P.name)),
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
        products={prods.map((p) => ({ id: p.id, name: p.name, price: parseFloat(String(p.pub ?? 0)) }))}
        sharePercent={com.sharePercent} submitLabel="Simpan Voucher" backHref={back}
        onSubmit={createProducerVoucherAction.bind(null, access.tenant.slug)}
      />
    </div>
  );
}
