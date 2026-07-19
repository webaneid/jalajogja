import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getVoucherDetailAction } from "../../actions";
import { VoucherToggle } from "@/components/keuangan/billing/voucher-toggle";

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const TARGET_LABELS: Record<string, string> = {
  product: "Produk", ticket: "Tiket Event", donation: "Donasi / Qurban",
};

export default async function VoucherDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const result = await getVoucherDetailAction(slug, id);
  if (!result.success) notFound();
  const v = result.data;

  const discountLabel = v.discountType === "percentage" ? `${v.discountValue}%` : formatRp(v.discountValue);
  const activeRedemptions = v.redemptions.filter((r) => !r.cancelledAt);
  const totalDiscountGiven = activeRedemptions.reduce((s, r) => s + r.discountTotal, 0);

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/app/${slug}/finance/billing/voucher`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Kembali ke Voucher
          </Link>
          <h1 className="text-xl font-semibold mt-1 font-mono">{v.code}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{v.name}</p>
          {v.description && <p className="text-sm text-muted-foreground mt-0.5">{v.description}</p>}
        </div>
        <Link
          href={`/app/${slug}/finance/billing/voucher/${v.id}/edit`}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          Edit
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Diskon</p>
            <p className="font-medium">{discountLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Berlaku Untuk</p>
            <p className="font-medium">
              {TARGET_LABELS[v.targetType] ?? v.targetType}
              {v.targetItemIds.length > 0 && (
                <span className="block text-xs text-muted-foreground font-normal">
                  {v.targetItemIds.length} item spesifik
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pemakaian</p>
            <p className="font-medium">
              {v.usedCount}{v.usageLimit != null ? ` / ${v.usageLimit}` : " (tak terbatas)"}
              {v.usageLimitPerCustomer != null && (
                <span className="block text-xs text-muted-foreground font-normal">
                  Maks {v.usageLimitPerCustomer}× per orang
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Periode</p>
            <p className="font-medium">{formatDate(v.validFrom)} — {formatDate(v.validUntil)}</p>
          </div>
          {(v.restrictPhone || v.restrictEmail) && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Voucher Personal</p>
              <p className="font-medium">{[v.restrictPhone, v.restrictEmail].filter(Boolean).join(" · ")}</p>
            </div>
          )}
        </div>

        <VoucherToggle slug={slug} voucherId={v.id} isActive={v.isActive} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-xs">
            Riwayat Pemakaian ({activeRedemptions.length})
          </p>
          {activeRedemptions.length > 0 && (
            <p className="text-xs text-muted-foreground">Total potongan: {formatRp(totalDiscountGiven)}</p>
          )}
        </div>
        {v.redemptions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Belum pernah dipakai.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                  <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                  <th className="text-right px-4 py-2.5 font-medium">Potongan</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tanggal</th>
                  <th className="text-center px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {v.redemptions.map((r) => (
                  <tr key={r.id} className={`hover:bg-muted/20 ${r.cancelledAt ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/${slug}/finance/billing/invoice/${r.invoiceId}`}
                        className="font-mono text-xs hover:text-primary transition-colors"
                      >
                        {r.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.customerName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatRp(r.discountTotal)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {r.cancelledAt ? "Dibatalkan" : "Dipakai"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
