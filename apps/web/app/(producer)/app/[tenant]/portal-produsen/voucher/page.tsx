// Voucher produsen ("Promo Produsen", K23): potongan DITANGGUNG produsen; tenant tidak ikut campur. docs/arsitektur-produk-produsen.md § 4.
import { redirect } from "next/navigation";
import Link from "next/link";
import { createTenantDb } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { getProducerCommercials } from "@/lib/producer-products.server";
import { listProducerVouchers } from "@/lib/producer-vouchers.server";
import { ProducerVoucherRowActions } from "@/components/producer/producer-voucher-row-actions";

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function ProducerVouchersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");
  const tc = createTenantDb(access.tenant.slug);
  const [rows, com] = await Promise.all([listProducerVouchers(tc, access.producer.id), getProducerCommercials(tc, access.producer.id)]);
  const base = `/app/${access.tenant.slug}/portal-produsen/voucher`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Voucher Saya</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Voucher yang Anda buat untuk produk Anda. Potongannya <strong>Anda yang menanggung</strong>; bagian tenant tidak berkurang.
            {com?.sharePercent != null && <> Diskon maksimal {com.sharePercent}% (sama dengan bagian tenant).</>}
          </p>
        </div>
        {com?.sharePercent != null && (
          <Link href={`${base}/baru`} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">Buat Voucher</Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Belum ada voucher.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Kode</th><th className="p-3">Diskon</th><th className="p-3">Produk</th><th className="p-3">Dipakai</th><th className="p-3">Berlaku</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="p-3"><span className="font-mono font-medium">{v.code}</span><span className="block max-w-[200px] truncate text-xs text-muted-foreground">{v.name}</span></td>
                  <td className="whitespace-nowrap p-3">{v.discountType === "percentage" ? `${v.discountValue}%` : rupiah(v.discountValue)}</td>
                  <td className="p-3">{v.targetItemIds.length} produk</td>
                  <td className="p-3">{v.usedCount}{v.usageLimit ? ` / ${v.usageLimit}` : ""}</td>
                  <td className="whitespace-nowrap p-3 text-xs">{fmtDate(v.validFrom)} – {fmtDate(v.validUntil)}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>{v.isActive ? "Aktif" : "Nonaktif"}</span></td>
                  <td className="p-3 text-right"><ProducerVoucherRowActions slug={access.tenant.slug} voucherId={v.id} isActive={v.isActive} editHref={`${base}/${v.id}/ubah`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
