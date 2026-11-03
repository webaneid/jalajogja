// Pengiriman produsen yang sudah SELESAI + refund/tahan, dan hutang produsen (BENDAHARA/KETUA). docs/arsitektur-pencairan-produsen.md § 13.
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { resolveProducers } from "@/lib/producer.server";
import { ShipmentRowActions, RepaymentButton } from "@/components/pencairan/admin-payout-client";
import { rupiah, fmtDate } from "@/lib/rupiah";

export default async function PencairanPengirimanPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");
  if (!hasFullAccess(access.tenantUser, "keuangan")) return <div className="p-6 text-sm text-muted-foreground">Halaman ini hanya untuk Bendahara/Ketua (akses penuh Keuangan).</div>;

  const tc = createTenantDb(slug);
  const { db, schema: s } = tc;
  const ships = await db.select({
    id: s.invoiceShippingLines.id, producerId: s.invoiceShippingLines.producerId, completedAt: s.invoiceShippingLines.completedAt, source: s.invoiceShippingLines.completionSource,
    holdAt: s.invoiceShippingLines.payoutHoldAt, holdReason: s.invoiceShippingLines.payoutHoldReason, invoiceNumber: s.invoices.invoiceNumber,
  }).from(s.invoiceShippingLines).innerJoin(s.invoices, eq(s.invoices.id, s.invoiceShippingLines.invoiceId))
    .where(and(isNotNull(s.invoiceShippingLines.producerId), isNotNull(s.invoiceShippingLines.completedAt))).orderBy(desc(s.invoiceShippingLines.completedAt)).limit(100);

  const ids = ships.map((x) => x.id);
  const entries = ids.length ? await db.select({ shippingLineId: s.producerLedgerEntries.shippingLineId, amount: s.producerLedgerEntries.amount, status: s.producerLedgerEntries.status })
    .from(s.producerLedgerEntries).where(and(inArray(s.producerLedgerEntries.shippingLineId, ids), inArray(s.producerLedgerEntries.kind, ["sale", "shipping"]))) : [];
  const refunds = ids.length ? await db.select({ sl: sql<string>`${s.producerLedgerEntries.meta}->>'shippingLineId'`, amount: s.producerLedgerEntries.amount })
    .from(s.producerLedgerEntries).where(and(eq(s.producerLedgerEntries.kind, "refund_debt"), sql`${s.producerLedgerEntries.meta}->>'shippingLineId' IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)) : [];

  const agg = new Map<string, { total: number; statuses: Set<string>; refunded: number }>();
  for (const e of entries) {
    const a = agg.get(e.shippingLineId!) ?? { total: 0, statuses: new Set<string>(), refunded: 0 };
    a.total += Number(e.amount); a.statuses.add(e.status); agg.set(e.shippingLineId!, a);
  }
  for (const r of refunds) { const a = agg.get(r.sl); if (a) a.refunded += -Number(r.amount); }

  const debtRows = await db.select({ producerId: s.producerLedgerEntries.producerId, sum: sql<string>`sum(${s.producerLedgerEntries.amount})` }).from(s.producerLedgerEntries)
    .where(and(inArray(s.producerLedgerEntries.kind, ["refund_debt", "adjustment"]), inArray(s.producerLedgerEntries.status, ["available", "reserved"]))).groupBy(s.producerLedgerEntries.producerId);
  const debts = debtRows.map((r) => ({ producerId: r.producerId, debt: Math.max(0, -Number(r.sum)) })).filter((r) => r.debt > 0);

  const pids = [...new Set([...ships.map((x) => x.producerId!), ...debts.map((d) => d.producerId)])];
  const names = await resolveProducers(tc, { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType }, pids);
  const base = `/app/${slug}/toko/pencairan`;

  const state = (sh: typeof ships[number]) => {
    const a = agg.get(sh.id);
    if (sh.holdAt) return { label: "Ditahan", cls: "bg-amber-100 text-amber-800" };
    if (a?.statuses.has("paid")) return { label: "Sudah dicairkan", cls: "bg-emerald-100 text-emerald-800" };
    if (a?.statuses.has("reserved")) return { label: "Dalam pengajuan", cls: "bg-sky-100 text-sky-800" };
    return { label: "Bisa dicairkan", cls: "bg-muted text-foreground" };
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <Link href={base} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Pencairan produsen</Link>
        <h1 className="mt-2 text-xl font-semibold">Pengiriman, refund & hutang</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Tahan pencairan pengiriman yang bermasalah, bebankan refund ke produsen, dan catat pelunasan hutang.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Hutang produsen</h2>
        {debts.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Tidak ada produsen yang berhutang.</p> : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {debts.map((d) => (
              <div key={d.producerId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div><p className="text-sm font-medium">{names.get(d.producerId)?.name ?? "Produsen"}</p><p className="text-xs text-muted-foreground">Dipotong otomatis dari pencairan berikutnya, atau dilunasi lewat transfer.</p></div>
                <div className="flex items-center gap-3"><p className="text-sm font-semibold tabular-nums text-rose-600">{rupiah(d.debt)}</p><RepaymentButton slug={slug} producerId={d.producerId} debt={d.debt} producerName={names.get(d.producerId)?.name ?? "Produsen"} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Pengiriman yang sudah selesai (100 terbaru)</h2>
        {ships.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada pengiriman produsen yang selesai.</p> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-2.5 font-medium">Pesanan</th><th className="px-2 py-2.5 font-medium">Produsen</th><th className="px-2 py-2.5 font-medium">Selesai</th><th className="px-2 py-2.5 text-right font-medium">Hak produsen</th><th className="px-2 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 text-right font-medium">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ships.map((sh) => {
                    const a = agg.get(sh.id); const st = state(sh);
                    const total = a?.total ?? 0; const remaining = Math.max(0, total - (a?.refunded ?? 0));
                    const locked = !!(a?.statuses.has("reserved") || a?.statuses.has("paid"));
                    return (
                      <tr key={sh.id}>
                        <td className="px-4 py-3"><p className="font-mono text-xs">{sh.invoiceNumber}</p>{sh.holdReason && <p className="mt-0.5 max-w-xs truncate text-[11px] text-amber-700" title={sh.holdReason}>Ditahan: {sh.holdReason}</p>}</td>
                        <td className="px-2 py-3">{names.get(sh.producerId!)?.name ?? "Produsen"}</td>
                        <td className="px-2 py-3 text-xs text-muted-foreground">{fmtDate(sh.completedAt)} · {sh.source === "buyer" ? "pembeli" : "otomatis"}</td>
                        <td className="px-2 py-3 text-right tabular-nums">{rupiah(total)}{(a?.refunded ?? 0) > 0 && <p className="text-[11px] text-rose-600">refund −{rupiah(a!.refunded)}</p>}</td>
                        <td className="px-2 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span></td>
                        <td className="px-4 py-3"><ShipmentRowActions slug={slug} shippingLineId={sh.id} held={!!sh.holdAt} canHold={!locked} remaining={remaining} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
