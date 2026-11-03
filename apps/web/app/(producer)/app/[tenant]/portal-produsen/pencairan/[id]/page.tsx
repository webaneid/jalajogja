// Detail pencairan produsen — status, rincian lengkap (nominal, potongan, biaya), rekening, dan BUKTI TRANSFER. Hanya milik produsen sesi.
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink } from "lucide-react";
import { createTenantDb, getPayoutWithLines } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { isValidUuid } from "@/lib/is-uuid";
import { PayoutBreakdown } from "@/components/pencairan/payout-breakdown";
import { PayoutStatusBadge, PayoutStepper } from "@/components/pencairan/payout-status";
import { CancelPayoutButton } from "@/components/pencairan/producer-payout-client";
import { rupiah, fmtDateTime } from "@/lib/rupiah";

const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);

export default async function ProducerPayoutDetailPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");
  if (!isValidUuid(id)) notFound();

  const d = await getPayoutWithLines(createTenantDb(access.tenant.slug), id, access.producer.id);   // filter produsen sesi → milik orang lain = 404
  if (!d) notFound();
  const { payout: p, lines } = d;
  const base = `/app/${access.tenant.slug}/portal-produsen`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${base}/pencairan`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Pencairan</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-semibold">{p.number}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Diajukan {fmtDateTime(p.requestedAt)}</p>
        </div>
        <PayoutStatusBadge status={p.status} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5"><PayoutStepper status={p.status} requestedAt={p.requestedAt} approvedAt={p.approvedAt} paidAt={p.paidAt} /></div>

      {p.status === "rejected" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Pengajuan belum dapat diproses</p>
          <p className="mt-1">{p.rejectedReason}</p>
          <p className="mt-2 text-xs">Saldo Anda tetap utuh. Perbaiki hal di atas, lalu ajukan kembali dari halaman Pencairan.</p>
        </div>
      )}
      {p.status === "approved" && <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">Pengajuan disetujui pada {fmtDateTime(p.approvedAt)}. Bendahara akan mentransfer ke rekening Anda; Anda akan diberi tahu beserta bukti transfernya.</p>}

      {p.status === "paid" && (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50">
          <div className="p-5">
            <p className="text-xs font-medium text-emerald-800">Dana sudah ditransfer — {fmtDateTime(p.paidAt)}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-emerald-900">{rupiah(Number(p.netAmount))}</p>
            <p className="mt-1 text-xs text-emerald-900/80">ke {p.bankName} ••••{p.accountLast4} a.n. {p.accountHolder}</p>
          </div>
          {p.proofUrl && (
            <div className="border-t border-emerald-200 bg-card p-5">
              <p className="mb-2 text-sm font-semibold">Bukti transfer</p>
              {isPdf(p.proofUrl) ? (
                <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"><FileText className="h-4 w-4" /> Buka bukti transfer (PDF) <ExternalLink className="h-3.5 w-3.5" /></a>
              ) : (
                <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.proofUrl} alt="Bukti transfer" className="max-h-96 w-auto rounded-lg border border-border" />
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Buka ukuran penuh <ExternalLink className="h-3 w-3" /></span>
                </a>
              )}
              {p.note && <p className="mt-3 text-xs text-muted-foreground">Catatan bendahara: {p.note}</p>}
            </div>
          )}
        </div>
      )}

      <PayoutBreakdown
        lines={lines.map((l) => ({ key: l.id, label: l.label, productAmount: Number(l.productAmount), shippingAmount: Number(l.shippingAmount), adjustmentAmount: Number(l.adjustmentAmount), total: Number(l.total) }))}
        summary={{
          creditsTotal: Number(p.creditsTotal), debtTotal: Number(p.debtTotal), adjustmentTotal: Number(p.adjustmentTotal), subtotal: Number(p.subtotal),
          transferFee: p.status === "paid" ? Number(p.transferFee) : null, netAmount: p.status === "paid" ? Number(p.netAmount) : null,
        }}
      />

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="text-xs text-muted-foreground">Rekening tujuan (saat diajukan)</p>
        <p className="mt-0.5 font-medium">{p.bankName} ••••{p.accountLast4} · a.n. {p.accountHolder}</p>
      </div>

      {p.status === "requested" && <CancelPayoutButton slug={access.tenant.slug} payoutId={p.id} />}
    </div>
  );
}
