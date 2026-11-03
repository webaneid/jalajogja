// Pencairan produsen — sisi BENDAHARA/KETUA (hasFullAccess keuangan). Daftar pengajuan, ringkasan, pengaturan. docs/arsitektur-pencairan-produsen.md § 13.
import { redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { Banknote, Clock, CheckCircle2, Scale, ChevronRight, Truck } from "lucide-react";
import { createTenantDb, getPayoutSettings, listPayouts } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { resolveProducers } from "@/lib/producer.server";
import { PayoutStatusBadge, PAYOUT_STATUS_LABEL } from "@/components/pencairan/payout-status";
import { PayoutSettingsForm } from "@/components/pencairan/admin-payout-client";
import { rupiah, fmtDate } from "@/lib/rupiah";

export default async function PencairanAdminPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ status?: string }> }) {
  const { tenant: slug } = await params;
  const { status } = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");
  if (!hasFullAccess(access.tenantUser, "keuangan")) {
    return <div className="p-6"><h1 className="text-xl font-semibold">Pencairan Produsen</h1><p className="mt-2 text-sm text-muted-foreground">Halaman ini hanya untuk Bendahara/Ketua (akses penuh Keuangan).</p></div>;
  }

  const tc = createTenantDb(slug);
  const filter = status && status in PAYOUT_STATUS_LABEL ? status : "";
  const [all, settings, debtRows] = await Promise.all([
    listPayouts(tc, { limit: 300 }),
    getPayoutSettings(tc),
    tc.db.execute(sql`SELECT COALESCE(SUM(GREATEST(-d, 0)), 0) AS total FROM (
      SELECT SUM(amount) AS d FROM ${tc.schema.producerLedgerEntries}
      WHERE kind IN ('refund_debt','adjustment') AND status IN ('available','reserved') GROUP BY producer_id) x`),
  ]);
  const rows = filter ? all.filter((p) => p.status === filter) : all;
  const names = await resolveProducers(tc, { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType }, [...new Set(all.map((p) => p.producerId))]);

  const waiting = all.filter((p) => p.status === "requested");
  const approved = all.filter((p) => p.status === "approved");
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const paidMonth = all.filter((p) => p.status === "paid" && p.paidAt && p.paidAt >= monthStart);
  const debtTotal = Number((Array.from(debtRows)[0] as { total?: string } | undefined)?.total ?? 0);
  const sum = (xs: typeof all) => xs.reduce((a, p) => a + Number(p.subtotal), 0);
  const base = `/app/${slug}/toko/pencairan`;

  const chips: [string, string][] = [["", "Semua"], ["requested", "Menunggu persetujuan"], ["approved", "Menunggu transfer"], ["paid", "Sudah ditransfer"], ["rejected", "Ditolak"], ["cancelled", "Dibatalkan"]];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pencairan Produsen</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Proses pengajuan pencairan dana produsen. Wajib melampirkan bukti transfer; jurnal Keuangan dibuat otomatis.</p>
        </div>
        <Link href={`${base}/pengiriman`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/50"><Truck className="h-4 w-4" /> Pengiriman, refund & hutang</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center gap-2 text-xs font-medium text-amber-800"><Clock className="h-4 w-4" /> Menunggu persetujuan</div><p className="mt-2 text-2xl font-semibold tabular-nums">{waiting.length}</p><p className="text-xs text-amber-900/70">{rupiah(sum(waiting))}</p></div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4"><div className="flex items-center gap-2 text-xs font-medium text-sky-800"><Banknote className="h-4 w-4" /> Disetujui, menunggu transfer</div><p className="mt-2 text-2xl font-semibold tabular-nums">{approved.length}</p><p className="text-xs text-sky-900/70">{rupiah(sum(approved))}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="flex items-center gap-2 text-xs font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Ditransfer bulan ini</div><p className="mt-2 text-2xl font-semibold tabular-nums">{paidMonth.length}</p><p className="text-xs text-emerald-900/70">{rupiah(paidMonth.reduce((a, p) => a + Number(p.netAmount ?? 0), 0))}</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Scale className="h-4 w-4" /> Hutang refund produsen</div><p className="mt-2 text-2xl font-semibold tabular-nums">{rupiah(debtTotal)}</p><p className="text-xs text-muted-foreground">dipotong otomatis dari pencairan berikutnya</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map(([v, label]) => (
          <Link key={v} href={v ? `${base}?status=${v}` : base} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === v ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{label}</Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Belum ada pengajuan{filter ? " dengan status ini" : ""}.</p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((p) => (
            <Link key={p.id} href={`${base}/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">{p.number}</p>
                <p className="truncate text-sm">{names.get(p.producerId)?.name ?? "Produsen"}</p>
                <p className="text-xs text-muted-foreground">Diajukan {fmtDate(p.requestedAt)} · {p.bankName} ••••{p.accountLast4}</p>
              </div>
              <div className="flex items-center gap-4">
                <PayoutStatusBadge status={p.status} />
                <div className="text-right"><p className="text-sm font-semibold tabular-nums">{rupiah(Number(p.subtotal))}</p>{p.status === "paid" && <p className="text-[11px] text-muted-foreground">transfer {rupiah(Number(p.netAmount))}</p>}</div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <details className="rounded-xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">Pengaturan pencairan</summary>
        <div className="border-t border-border p-4"><PayoutSettingsForm slug={slug} initial={settings} /></div>
      </details>
    </div>
  );
}
