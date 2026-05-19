import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";

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
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  submitted: "bg-blue-100 text-blue-700",
  paid:      "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-500",
  refunded:  "bg-purple-100 text-purple-700",
};

const METHOD_LABEL: Record<string, string> = {
  cash:    "Tunai",
  transfer: "Transfer",
  qris:    "QRIS",
  midtrans: "Midtrans",
  xendit:  "Xendit",
  ipaymu:  "iPaymu",
};

const PAGE_SIZE = 20;

export default async function PemasukanPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, status, page } = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Build where conditions
  const conditions = [];
  if (status && status !== "all") {
    conditions.push(sql`${schema.payments.status} = ${status}`);
  }
  if (q) {
    conditions.push(
      or(
        ilike(schema.payments.payerName, `%${q}%`),
        ilike(schema.payments.number, `%${q}%`)
      )
    );
  }

  const whereClause = conditions.length > 0
    ? conditions.reduce((acc, c) => sql`${acc} AND ${c}`)
    : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id:        schema.payments.id,
        number:    schema.payments.number,
        payerName: schema.payments.payerName,
        amount:    schema.payments.amount,
        method:    schema.payments.method,
        status:    schema.payments.status,
        sourceType: schema.payments.sourceType,
        createdAt: schema.payments.createdAt,
      })
      .from(schema.payments)
      .where(whereClause)
      .orderBy(sql`${schema.payments.createdAt} DESC`)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<string>`COUNT(*)` })
      .from(schema.payments)
      .where(whereClause),
  ]);

  const total = parseInt(String(countResult[0]?.count ?? 0));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (overrides.q ?? q) sp.set("q", overrides.q ?? q ?? "");
    if (overrides.status ?? status) sp.set("status", overrides.status ?? status ?? "");
    if (overrides.page) sp.set("page", overrides.page);
    return `/${slug}/finance/pemasukan?${sp.toString()}`;
  };

  const statuses = ["all", "submitted", "paid", "pending", "rejected", "cancelled"];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pemasukan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Semua transaksi uang masuk</p>
        </div>
        <Link
          href={`/${slug}/finance/pemasukan/new`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Catat Pemasukan
        </Link>
      </div>

      {/* Filter status */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Link
            key={s}
            href={buildUrl({ status: s === "all" ? "" : s, page: "1" })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (s === "all" && !status) || status === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "Semua" : (STATUS_LABEL[s] ?? s)}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="GET" action={`/${slug}/finance/pemasukan`}>
        <div className="relative max-w-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari nama atau nomor..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {status && <input type="hidden" name="status" value={status} />}
        </div>
      </form>

      {/* Tabel */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nomor</th>
              <th className="px-4 py-3 text-left font-medium">Nama Pembayar</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Sumber</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Metode</th>
              <th className="px-4 py-3 text-right font-medium">Jumlah</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Tidak ada data pemasukan
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/${slug}/finance/pemasukan/${row.id}`} className="font-mono text-xs hover:underline text-primary">
                      {row.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/${slug}/finance/pemasukan/${row.id}`} className="hover:underline">
                      {row.payerName ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell capitalize text-muted-foreground">
                    {row.sourceType}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {METHOD_LABEL[row.method] ?? row.method}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    {formatRupiah(row.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} data</span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={buildUrl({ page: String(currentPage - 1) })} className="rounded border border-border px-3 py-1 hover:bg-muted/40">
                ← Sebelumnya
              </Link>
            )}
            <span className="rounded border border-border px-3 py-1 bg-muted/20">
              {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link href={buildUrl({ page: String(currentPage + 1) })} className="rounded border border-border px-3 py-1 hover:bg-muted/40">
                Berikutnya →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
