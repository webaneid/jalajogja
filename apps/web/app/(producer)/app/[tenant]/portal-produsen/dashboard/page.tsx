// Dashboard Produsen — docs/arsitektur-portal-produsen.md § 29. Semua data dari producerId SESI (getProducerPageAccess, fail-closed T&C); hanya baca.
import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet, Hourglass, ClipboardList, BadgeCheck, Package, Ticket, ArrowRight } from "lucide-react";
import { createTenantDb } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { loadProducerDashboard, parsePeriode } from "@/lib/producer-dashboard.server";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { Card, KpiCard, TopProducts, ShippingFunnel, CityBars, ActionList, MiniStat } from "@/components/producer/dashboard-widgets";
import { PayoutStatusBadge } from "@/components/pencairan/payout-status";
import { rupiah, fmtDate } from "@/lib/rupiah";

const PERIODS: [string, string][] = [["30", "30 hari"], ["90", "90 hari"], ["semua", "Semua"]];

// Setiap page memanggil getProducerPageAccess sendiri (guard layout tidak melindungi page — render paralel).
export default async function Page({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ periode?: string }> }) {
  const { tenant: slug } = await params;
  const { periode: periodeRaw } = await searchParams;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const periode = parsePeriode(periodeRaw);
  const d = await loadProducerDashboard(createTenantDb(access.tenant.slug), access.producer.id, periode);
  const base = `/app/${access.tenant.slug}/portal-produsen`;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";
  const canRequest = !d.activePayout && d.hasBank && d.available >= d.minAmount;
  const periodLabel = PERIODS.find(([v]) => v === periode)?.[1] ?? "30 hari";

  const actions: { label: string; count?: number; href: string; tone: "amber" | "rose" | "sky" }[] = [
    ...(d.shipping.pending > 0 ? [{ label: "Pesanan lunas menunggu diproses", count: d.shipping.pending, href: `${base}/pesanan`, tone: "amber" as const }] : []),
    ...(d.products.empty > 0 ? [{ label: "Produk aktif yang stoknya habis", count: d.products.empty, href: `${base}/produk`, tone: "rose" as const }] : []),
    ...(d.products.low > 0 ? [{ label: "Produk aktif stok menipis (≤ 5)", count: d.products.low, href: `${base}/produk`, tone: "amber" as const }] : []),
    ...(!d.hasBank ? [{ label: "Isi rekening tujuan pencairan", href: `${base}/pencairan`, tone: "rose" as const }] : []),
    ...(canRequest ? [{ label: `Saldo ${rupiah(d.available)} siap diajukan`, href: `${base}/pencairan`, tone: "sky" as const }] : []),
    ...(d.activePayout ? [{ label: `Pengajuan ${d.activePayout.number} sedang diproses`, href: `${base}/pencairan/${d.activePayout.id}`, tone: "sky" as const }] : []),
    ...(d.debt > 0 ? [{ label: `Hutang refund ${rupiah(d.debt)} (dipotong dari pencairan berikutnya)`, href: `${base}/pencairan`, tone: "amber" as const }] : []),
    ...(d.heldShipments > 0 ? [{ label: "Pengiriman yang ditahan pengurus", count: d.heldShipments, href: `${base}/saldo`, tone: "amber" as const }] : []),
    ...(d.balance.reviewCount > 0 ? [{ label: "Pesanan perlu ditinjau pengurus (persentase belum tercatat)", count: d.balance.reviewCount, href: `${base}/saldo`, tone: "amber" as const }] : []),
  ];

  const funnel = [
    { label: "Menunggu diproses", n: d.shipping.pending, tone: "bg-amber-500" },
    { label: "Diproses", n: d.shipping.processing, tone: "bg-sky-500" },
    { label: "Dikemas", n: d.shipping.packed, tone: "bg-indigo-500" },
    { label: "Dalam pengiriman", n: d.shipping.shipped, tone: "bg-violet-500" },
    { label: "Menunggu konfirmasi", n: d.shipping.delivered, tone: "bg-emerald-500" },
  ];
  const quota = d.products.limit > 0 ? Math.min(100, Math.round((d.products.total / d.products.limit) * 100)) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Sapaan */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{greet},</p>
          <h1 className="text-2xl font-semibold">{access.producer.displayName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Ringkasan penjualan dan saldo Anda di {access.tenant.name}.</p>
        </div>
        {canRequest && (
          <Link href={`${base}/pencairan`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90">
            Ajukan pencairan {rupiah(d.available)} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Bisa dicairkan" value={rupiah(d.available)} sub={d.heldCount > 0 ? `${d.heldCount} pengiriman ditahan` : "Siap diajukan"} icon={Wallet} tone="green" href={`${base}/pencairan`} />
        <KpiCard label="Menunggu konfirmasi" value={rupiah(d.balance.waiting)} sub="Pesanan lunas, belum diterima pembeli" icon={Hourglass} tone="amber" href={`${base}/saldo`} />
        <KpiCard label="Perlu diproses" value={String(d.shipping.pending)} sub="Pesanan lunas belum dikirim" icon={ClipboardList} tone="sky" href={`${base}/pesanan`} />
        <KpiCard label="Total sudah diterima" value={rupiah(d.paidTotal)} sub={`${d.paidCount} pencairan`} icon={BadgeCheck} href={`${base}/pencairan`} />
      </div>

      {/* Tren — komponen grafik SAMA dengan dashboard admin */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tren Pemasukan vs Pencairan</h2>
          <p className="text-xs text-muted-foreground">30 hari terakhir</p>
        </div>
        <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-600" /> Pemasukan (hak dari pesanan lunas)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" /> Pencairan (ditransfer)</span>
        </div>
        <IncomeExpenseChart data={d.chart} labels={{ income: "Pemasukan", expense: "Pencairan" }} emptyText="Belum ada pemasukan atau pencairan 30 hari terakhir." />
      </div>

      {/* Produk paling laku + perlu tindakan */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Produk paling laku" hint={`Menurut unit terjual · ${periodLabel}`}
          action={
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              {PERIODS.map(([v, label]) => (
                <Link key={v} href={`${base}/dashboard?periode=${v}`} className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${periode === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</Link>
              ))}
            </div>
          }>
          <TopProducts items={d.topProducts} base={base} />
        </Card>
        <Card className="lg:col-span-2" title="Perlu tindakan" hint="Yang sebaiknya Anda kerjakan sekarang">
          <ActionList items={actions} />
        </Card>
      </div>

      {/* Ringkasan penjualan + alur pengiriman + daerah */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Ringkasan penjualan" hint={periodLabel}>
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Pesanan lunas" value={String(d.summary.orders)} />
            <MiniStat label="Unit terjual" value={String(d.summary.units)} />
            <MiniStat label="Pembeli unik" value={String(d.summary.buyers)} />
            <MiniStat label="Pembeli berulang" value={String(d.summary.repeatBuyers)} sub={d.summary.buyers ? `${Math.round((d.summary.repeatBuyers / d.summary.buyers) * 100)}% dari pembeli` : undefined} />
          </div>
          <div className="mt-2.5"><MiniStat label="Rata-rata nilai pesanan" value={rupiah(d.summary.avgValue)} sub="dibayar pembeli untuk produk Anda" /></div>
        </Card>
        <Card title="Alur pengiriman" hint="Pesanan lunas yang belum selesai"><ShippingFunnel steps={funnel} base={base} /></Card>
        <Card title="Daerah pembeli teratas" hint={`Jumlah pesanan · ${periodLabel}`}><CityBars items={d.cities} /></Card>
      </div>

      {/* Produk, voucher, pencairan terakhir */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Produk & kuota" action={<Link href={`${base}/produk`} className="text-xs text-primary hover:underline">Kelola</Link>}>
          <div className="flex items-end justify-between"><p className="text-2xl font-semibold tabular-nums">{d.products.total}<span className="text-sm font-normal text-muted-foreground"> / {d.products.limit} produk</span></p><Package className="h-5 w-5 text-muted-foreground" /></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${quota >= 100 ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${quota}%` }} /></div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{d.products.active} aktif</span>
            <span className="rounded-full bg-muted px-2 py-0.5">{d.products.draft} draft</span>
            <span className="rounded-full bg-muted px-2 py-0.5">{d.products.archived} arsip</span>
            {d.products.frozen > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">{d.products.frozen} dibekukan</span>}
          </div>
        </Card>
        <Card title="Voucher" action={<Link href={`${base}/voucher`} className="text-xs text-primary hover:underline">Kelola</Link>}>
          <div className="flex items-end justify-between"><p className="text-2xl font-semibold tabular-nums">{d.vouchers.active}<span className="text-sm font-normal text-muted-foreground"> aktif</span></p><Ticket className="h-5 w-5 text-muted-foreground" /></div>
          <p className="mt-2 text-sm text-muted-foreground">Dipakai pembeli <b className="text-foreground">{d.vouchers.used}</b> kali.</p>
        </Card>
        <Card title="Pencairan terakhir" action={<Link href={`${base}/pencairan`} className="text-xs text-primary hover:underline">Lihat semua</Link>}>
          {d.lastPayout ? (
            <Link href={`${base}/pencairan/${d.lastPayout.id}`} className="block">
              <div className="flex items-center justify-between"><p className="font-mono text-sm font-medium">{d.lastPayout.number}</p><PayoutStatusBadge status={d.lastPayout.status} /></div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{rupiah(d.lastPayout.status === "paid" ? d.lastPayout.net ?? 0 : d.lastPayout.subtotal)}</p>
              <p className="text-xs text-muted-foreground">{d.lastPayout.status === "paid" ? "diterima" : "diajukan"} · {fmtDate(d.lastPayout.at)}</p>
            </Link>
          ) : <p className="text-sm text-muted-foreground">Belum ada pencairan. Saldo yang sudah bisa dicairkan dapat diajukan dari menu Pencairan.</p>}
        </Card>
      </div>
    </div>
  );
}
