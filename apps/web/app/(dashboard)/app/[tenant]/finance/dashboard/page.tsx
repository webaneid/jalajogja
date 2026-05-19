import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, and, gte, sql, or } from "drizzle-orm";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

function formatRupiah(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

const STATUS_LABEL: Record<string, string> = {
  pending:   "Menunggu",
  submitted: "Perlu Konfirmasi",
  paid:      "Lunas",
  rejected:  "Ditolak",
  cancelled: "Dibatalkan",
  refunded:  "Dikembalikan",
  draft:     "Draft",
  approved:  "Disetujui",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  submitted: "bg-blue-100 text-blue-700",
  paid:      "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-500",
  refunded:  "bg-purple-100 text-purple-700",
  draft:     "bg-zinc-100 text-zinc-600",
  approved:  "bg-indigo-100 text-indigo-700",
};

export default async function FinanceDashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  // Periode bulan ini
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Statistik pemasukan bulan ini (status = paid)
  const [incomeStat] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(schema.payments)
    .where(and(
      eq(schema.payments.status, "paid"),
      gte(schema.payments.confirmedAt, startOfMonth)
    ));

  // Statistik pengeluaran bulan ini (status = paid)
  const [expenseStat] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(schema.disbursements)
    .where(and(
      eq(schema.disbursements.status, "paid"),
      gte(schema.disbursements.paidAt, startOfMonth)
    ));

  // Pemasukan pending konfirmasi
  const [pendingIncome] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(schema.payments)
    .where(eq(schema.payments.status, "submitted"));

  // Pengeluaran perlu tindakan (draft + approved)
  const [pendingExpense] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(schema.disbursements)
    .where(or(
      eq(schema.disbursements.status, "draft"),
      eq(schema.disbursements.status, "approved")
    ));

  // 5 pemasukan terbaru
  const recentPayments = await db
    .select({
      id:        schema.payments.id,
      number:    schema.payments.number,
      payerName: schema.payments.payerName,
      amount:    schema.payments.amount,
      status:    schema.payments.status,
      createdAt: schema.payments.createdAt,
    })
    .from(schema.payments)
    .orderBy(sql`${schema.payments.createdAt} DESC`)
    .limit(5);

  // 5 pengeluaran terbaru
  const recentDisbursements = await db
    .select({
      id:            schema.disbursements.id,
      number:        schema.disbursements.number,
      recipientName: schema.disbursements.recipientName,
      amount:        schema.disbursements.amount,
      status:        schema.disbursements.status,
      createdAt:     schema.disbursements.createdAt,
    })
    .from(schema.disbursements)
    .orderBy(sql`${schema.disbursements.createdAt} DESC`)
    .limit(5);

  const incomeTotal  = parseFloat(String(incomeStat?.total  ?? 0));
  const expenseTotal = parseFloat(String(expenseStat?.total ?? 0));
  const saldo        = incomeTotal - expenseTotal;

  const bulanIndo = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard Keuangan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{bulanIndo}</p>
      </div>

      {/* Kartu statistik */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Saldo Bulan Ini
          </div>
          <p className={`mt-2 text-xl font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatRupiah(saldo)}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
            Pemasukan
          </div>
          <p className="mt-2 text-xl font-bold text-green-600">{formatRupiah(incomeTotal)}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
            Pengeluaran
          </div>
          <p className="mt-2 text-xl font-bold text-red-600">{formatRupiah(expenseTotal)}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-orange-500" />
            Perlu Tindakan
          </div>
          <p className="mt-2 text-xl font-bold">
            {parseInt(String(pendingIncome?.count ?? 0)) + parseInt(String(pendingExpense?.count ?? 0))}
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingIncome?.count ?? 0} pemasukan · {pendingExpense?.count ?? 0} pengeluaran
          </p>
        </div>
      </div>

      {/* Tabel terbaru */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pemasukan terbaru */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-medium text-sm">Pemasukan Terbaru</h2>
            <Link
              href={`/${slug}/finance/pemasukan`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Lihat semua →
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada pemasukan
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentPayments.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/${slug}/finance/pemasukan/${p.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.payerName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">{formatRupiah(p.amount)}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[p.status] ?? ""}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pengeluaran terbaru */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-medium text-sm">Pengeluaran Terbaru</h2>
            <Link
              href={`/${slug}/finance/pengeluaran`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Lihat semua →
            </Link>
          </div>
          {recentDisbursements.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada pengeluaran
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentDisbursements.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/${slug}/finance/pengeluaran/${d.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{d.recipientName}</p>
                      <p className="text-xs text-muted-foreground">{d.number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">{formatRupiah(d.amount)}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[d.status] ?? ""}`}>
                        {STATUS_LABEL[d.status] ?? d.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${slug}/finance/pemasukan/new`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <ArrowDownCircle className="h-4 w-4 text-green-500" />
          Catat Pemasukan
        </Link>
        <Link
          href={`/${slug}/finance/pengeluaran/new`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <ArrowUpCircle className="h-4 w-4 text-red-500" />
          Catat Pengeluaran
        </Link>
        <Link
          href={`/${slug}/finance/jurnal/new`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          Buat Jurnal Manual
        </Link>
      </div>
    </div>
  );
}
