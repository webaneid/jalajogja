// Detail pengajuan pencairan (BENDAHARA/KETUA). Rekening tujuan ditampilkan UTUH hanya di sini (didekripsi server) untuk keperluan transfer.
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink, Landmark, User } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { createTenantDb, getPayoutSettings, getPayoutWithLines, suggestTransferFee, guessBankCode, MAX_TRANSFER_FEE } from "@jalajogja/db";
import { decryptPii } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { isValidUuid } from "@/lib/is-uuid";
import { resolveProducers } from "@/lib/producer.server";
import { PayoutBreakdown } from "@/components/pencairan/payout-breakdown";
import { PayoutStatusBadge, PayoutStepper } from "@/components/pencairan/payout-status";
import { PayoutDecisionPanel, CopyButton, type SourceOption } from "@/components/pencairan/admin-payout-client";
import { rupiah, fmtDateTime } from "@/lib/rupiah";

const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);

export default async function PencairanDetailPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");
  if (!hasFullAccess(access.tenantUser, "keuangan")) return <div className="p-6 text-sm text-muted-foreground">Halaman ini hanya untuk Bendahara/Ketua (akses penuh Keuangan).</div>;
  if (!isValidUuid(id)) notFound();

  const tc = createTenantDb(slug);
  const d = await getPayoutWithLines(tc, id);
  if (!d) notFound();
  const { payout: p, lines } = d;
  const [settings, names, [prod]] = await Promise.all([
    getPayoutSettings(tc),
    resolveProducers(tc, { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType }, [p.producerId]),
    tc.db.select({ memberId: tc.schema.producers.memberId }).from(tc.schema.producers).where(eq(tc.schema.producers.id, p.producerId)).limit(1),
  ]);
  const isSelf = !!prod?.memberId && prod.memberId === access.tenantUser.memberId;

  // Nomor rekening utuh: hanya untuk pengajuan yang masih perlu ditransfer atau sudah dibayar; didekripsi di server.
  const fullNumber = p.status === "requested" || p.status === "approved" || p.status === "paid" ? decryptPii(p.accountNumberEnc) : null;

  // Rekening tenant sebagai sumber transfer (pengaturan pembayaran) → saran biaya transfer per bank.
  const [bankRow] = await tc.db.select({ value: tc.schema.settings.value }).from(tc.schema.settings).where(and(eq(tc.schema.settings.key, "bank_accounts"), eq(tc.schema.settings.group, "payment"))).limit(1);
  const bankList = (Array.isArray(bankRow?.value) ? bankRow.value : []) as { id?: string; bankName?: string; accountNumber?: string }[];
  const sources: SourceOption[] = bankList.filter((b) => b.bankName).map((b, i) => ({
    value: b.id ?? String(i), label: `${b.bankName} ••••${String(b.accountNumber ?? "").slice(-4)}`,
    fee: suggestTransferFee(settings, p.bankCode, guessBankCode(b.bankName)),
  }));

  const producerName = names.get(p.producerId)?.name ?? "Produsen";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href={`/app/${slug}/toko/pencairan`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Pencairan produsen</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-semibold">{p.number}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><User className="h-3.5 w-3.5" /> {producerName} · diajukan {fmtDateTime(p.requestedAt)}</p>
        </div>
        <PayoutStatusBadge status={p.status} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5"><PayoutStepper status={p.status} requestedAt={p.requestedAt} approvedAt={p.approvedAt} paidAt={p.paidAt} /></div>

      {/* Rekening tujuan */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4" /> Rekening tujuan transfer</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
          <div>
            <p className="text-xs text-muted-foreground">{p.bankName}</p>
            <p className="font-mono text-xl font-semibold tracking-wider">{fullNumber ?? `•••• ${p.accountLast4}`}</p>
            <p className="mt-0.5 text-sm">a.n. {p.accountHolder}</p>
          </div>
          {fullNumber && <CopyButton value={fullNumber} label="Salin no. rekening" />}
        </div>
      </section>

      <PayoutBreakdown
        lines={lines.map((l) => ({ key: l.id, label: l.label, productAmount: Number(l.productAmount), shippingAmount: Number(l.shippingAmount), adjustmentAmount: Number(l.adjustmentAmount), total: Number(l.total) }))}
        summary={{
          creditsTotal: Number(p.creditsTotal), debtTotal: Number(p.debtTotal), adjustmentTotal: Number(p.adjustmentTotal), subtotal: Number(p.subtotal),
          transferFee: p.status === "paid" ? Number(p.transferFee) : null, netAmount: p.status === "paid" ? Number(p.netAmount) : null,
        }}
      />

      {isSelf && (p.status === "requested" || p.status === "approved") && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Ini pencairan milik Anda sendiri — bendahara/ketua lain yang harus memprosesnya.</p>
      )}
      {!isSelf && (p.status === "requested" || p.status === "approved") && (
        <PayoutDecisionPanel slug={slug} payoutId={p.id} status={p.status} subtotal={Number(p.subtotal)} sources={sources}
          defaultFee={suggestTransferFee(settings, p.bankCode, null)} maxFee={MAX_TRANSFER_FEE} />
      )}

      {p.status === "rejected" && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><b>Ditolak.</b> {p.rejectedReason}</p>}

      {p.status === "paid" && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
          <p className="text-xs font-medium text-emerald-800">Ditransfer {fmtDateTime(p.paidAt)}{p.sourceBankLabel ? ` · dari ${p.sourceBankLabel}` : ""}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">{rupiah(Number(p.netAmount))}</p>
          <p className="text-xs text-emerald-900/80">Jumlah pencairan {rupiah(Number(p.subtotal))} − biaya transfer {rupiah(Number(p.transferFee))}</p>
          {p.proofUrl && (
            <div className="mt-4 rounded-xl bg-card p-4">
              <p className="mb-2 text-sm font-semibold">Bukti transfer</p>
              {isPdf(p.proofUrl) ? (
                <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"><FileText className="h-4 w-4" /> Buka bukti (PDF) <ExternalLink className="h-3.5 w-3.5" /></a>
              ) : (
                <a href={p.proofUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.proofUrl} alt="Bukti transfer" className="max-h-80 w-auto rounded-lg border border-border" />
                </a>
              )}
              {p.note && <p className="mt-3 text-xs text-muted-foreground">Catatan: {p.note}</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">Jurnal Keuangan tercatat otomatis (Dr Hutang Produsen / Cr Kas-Bank).</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
