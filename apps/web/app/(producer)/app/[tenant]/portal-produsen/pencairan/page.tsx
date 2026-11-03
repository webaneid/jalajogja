// Pencairan produsen — ringkasan saldo, ajukan, rekening tujuan, riwayat. producerId dari SESI (getProducerPageAccess, fail-closed T&C).
// docs/arsitektur-pencairan-produsen.md § 13.
import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet, AlertTriangle, ChevronRight, CheckCircle2, Hourglass } from "lucide-react";
import { createTenantDb, BANKS, computeEligible, getBankAccounts, getPayoutSettings, getProducerDebt, listPayouts, suggestTransferFee } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { PayoutBreakdown } from "@/components/pencairan/payout-breakdown";
import { PayoutStatusBadge } from "@/components/pencairan/payout-status";
import { BankAccountCard, RequestPayoutButton } from "@/components/pencairan/producer-payout-client";
import { rupiah, fmtDate } from "@/lib/rupiah";

export default async function ProducerPayoutPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const tc = createTenantDb(access.tenant.slug);
  const pid = access.producer.id;
  const [settings, el, debt, banks, payouts] = await Promise.all([
    getPayoutSettings(tc), computeEligible(tc, pid), getProducerDebt(tc, pid), getBankAccounts(tc, pid), listPayouts(tc, { producerId: pid, limit: 20 }),
  ]);
  const activePayout = payouts.find((p) => p.status === "requested" || p.status === "approved") ?? null;
  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.netAmount ?? 0), 0);
  const estFee = banks.active ? suggestTransferFee(settings, banks.active.bankCode, null) : settings.feeOtherBank;

  let disabledReason: string | null = null;
  if (activePayout) disabledReason = "Masih ada pengajuan yang berjalan.";
  else if (!banks.active) disabledReason = banks.pending ? "Rekening baru belum berlaku (menunggu masa jeda keamanan 24 jam)." : "Isi rekening tujuan terlebih dahulu.";
  else if (el.subtotal < settings.minAmount) disabledReason = `Saldo yang bisa dicairkan harus minimal ${rupiah(settings.minAmount)}.`;

  const base = `/app/${access.tenant.slug}/portal-produsen`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pencairan</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Ajukan dana hasil penjualan Anda. Diproses bendahara paling lambat {settings.slaDays} hari kerja; minimal pencairan {rupiah(settings.minAmount)}.</p>
      </div>

      {/* Ringkasan */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800"><Wallet className="h-4 w-4" /> Bisa dicairkan</div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-900">{rupiah(Math.max(0, el.subtotal))}</p>
          {el.heldCount > 0 && <p className="mt-1 text-xs text-amber-700">{el.heldCount} pengiriman ({rupiah(el.heldAmount)}) ditahan pengurus.</p>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Hourglass className="h-4 w-4" /> Sedang diproses</div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{rupiah(activePayout ? Number(activePayout.subtotal) : 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{activePayout ? activePayout.number : "Tidak ada pengajuan berjalan"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Total sudah diterima</div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{rupiah(totalPaid)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{payouts.filter((p) => p.status === "paid").length} pencairan</p>
        </div>
      </div>

      {debt > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Anda memiliki <b>hutang refund {rupiah(debt)}</b> (pesanan yang dikembalikan ke pembeli). Otomatis dipotong dari pencairan berikutnya; Anda juga dapat mentransfer langsung ke tenant dan meminta bendahara mencatatnya.</p>
        </div>
      )}

      {/* Pengajuan berjalan */}
      {activePayout && (
        <Link href={`${base}/pencairan/${activePayout.id}`} className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
          <div>
            <p className="text-xs text-muted-foreground">Pengajuan berjalan</p>
            <p className="font-mono text-sm font-semibold">{activePayout.number} · {rupiah(Number(activePayout.subtotal))}</p>
            <div className="mt-1.5"><PayoutStatusBadge status={activePayout.status} /></div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}

      {/* Rincian yang akan diajukan */}
      {!activePayout && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Yang akan diajukan</h2>
          <PayoutBreakdown
            lines={el.lines.map((l, i) => ({ key: `${l.shippingLineId ?? "a"}${i}`, label: l.label, productAmount: l.productAmount, shippingAmount: l.shippingAmount, adjustmentAmount: l.adjustmentAmount, total: l.total }))}
            summary={{ creditsTotal: el.creditsTotal, debtTotal: el.debtTotal, adjustmentTotal: el.adjustmentTotal, subtotal: Math.max(0, el.subtotal), transferFee: estFee, feeIsEstimate: true, netAmount: Math.max(0, el.subtotal - estFee) }}
            emptyText="Belum ada pesanan yang selesai. Dana tersedia setelah pembeli mengonfirmasi barang diterima (atau otomatis 10 hari setelah dikirim)."
          />
          <RequestPayoutButton slug={access.tenant.slug} subtotal={Math.max(0, el.subtotal)} disabledReason={disabledReason}
            bankLabel={banks.active ? `${banks.active.bankName} ••••${banks.active.accountLast4}` : "—"} />
        </section>
      )}

      <BankAccountCard slug={access.tenant.slug} banks={BANKS}
        active={banks.active ? { ...banks.active, effectiveAt: banks.active.effectiveAt.toISOString() } : null}
        pending={banks.pending ? { ...banks.pending, effectiveAt: banks.pending.effectiveAt.toISOString() } : null} />

      {/* Riwayat */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Riwayat pencairan</h2>
          <Link href={`${base}/saldo`} className="text-xs text-primary hover:underline">Lihat laporan per pengiriman →</Link>
        </div>
        {payouts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada pencairan.</p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {payouts.map((p) => (
              <Link key={p.id} href={`${base}/pencairan/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{p.number}</p>
                  <p className="text-xs text-muted-foreground">Diajukan {fmtDate(p.requestedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <PayoutStatusBadge status={p.status} />
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{rupiah(p.status === "paid" ? Number(p.netAmount) : Number(p.subtotal))}</p>
                    {p.status === "paid" && <p className="text-[11px] text-muted-foreground">diterima</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
