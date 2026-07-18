import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getInstallmentPlanDetailAction } from "../../actions";
import { InstallmentPlanToggles } from "@/components/keuangan/billing/installment-plan-toggles";

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu Bayar", waiting_verification: "Menunggu Verifikasi",
  partial: "Sebagian", paid: "Lunas", cancelled: "Dibatalkan", overdue: "Jatuh Tempo",
};

export default async function CicilanDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const result = await getInstallmentPlanDetailAction(slug, id);
  if (!result.success) notFound();
  const plan = result.data;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <Link
          href={`/app/${slug}/finance/billing/cicilan`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Kembali ke Cicilan
        </Link>
        <h1 className="text-xl font-semibold mt-1">{plan.name}</h1>
        {plan.description && <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>}
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Event / Tiket</p>
            <p className="font-medium">{plan.eventTitle ?? "—"}</p>
            <p className="text-muted-foreground">{plan.ticketName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Program</p>
            <p className="font-medium">{plan.totalAmount != null ? formatRp(plan.totalAmount) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Termin</p>
            <p className="font-medium">
              {plan.installmentCount}× — {plan.perTermAmount != null ? formatRp(plan.perTermAmount) : "—"} / termin
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Interval</p>
            <p className="font-medium">Setiap {plan.intervalDays} hari</p>
          </div>
        </div>

        <InstallmentPlanToggles slug={slug} planId={plan.id} isActive={plan.isActive} isPublished={plan.isPublished} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-xs">
          Terdaftar ({plan.invoices.length})
        </p>
        {plan.invoices.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Belum ada yang mendaftar program ini.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                  <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                  <th className="text-center px-4 py-2.5 font-medium">Progres Termin</th>
                  <th className="text-right px-4 py-2.5 font-medium">Terbayar</th>
                  <th className="text-center px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plan.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/${slug}/finance/billing/invoice/${inv.id}`}
                        className="font-mono text-xs hover:text-primary transition-colors"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{inv.customerName}</td>
                    <td className="px-4 py-3 text-center">{inv.paidTerms} / {inv.totalTerms}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatRp(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {STATUS_LABELS[inv.status] ?? inv.status}
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
