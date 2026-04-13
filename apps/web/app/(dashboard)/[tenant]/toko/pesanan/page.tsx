import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql, ilike } from "drizzle-orm";
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

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending:    "Menunggu Bayar",
  paid:       "Lunas",
  processing: "Diproses",
  shipped:    "Dikirim",
  done:       "Selesai",
  cancelled:  "Dibatalkan",
};

const STATUS_COLOR: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  paid:       "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped:    "bg-purple-100 text-purple-700",
  done:       "bg-green-100 text-green-700",
  cancelled:  "bg-zinc-100 text-zinc-500",
};

const PAGE_SIZE = 20;

export default async function PesananPage({
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
  const offset      = (currentPage - 1) * PAGE_SIZE;

  const conditions = [];
  if (status && status !== "all") {
    conditions.push(sql`${schema.orders.status} = ${status}`);
  }
  if (q) {
    conditions.push(
      sql`(${ilike(schema.orders.customerName, `%${q}%`)} OR ${ilike(schema.orders.orderNumber, `%${q}%`)})`
    );
  }

  const whereClause = conditions.length > 0
    ? conditions.reduce((acc, c) => sql`${acc} AND ${c}`)
    : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id:           schema.orders.id,
        orderNumber:  schema.orders.orderNumber,
        customerName: schema.orders.customerName,
        total:        schema.orders.total,
        status:       schema.orders.status,
        createdAt:    schema.orders.createdAt,
      })
      .from(schema.orders)
      .where(whereClause)
      .orderBy(sql`${schema.orders.createdAt} DESC`)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<string>`COUNT(*)` })
      .from(schema.orders)
      .where(whereClause),
  ]);

  const total      = parseInt(String(countResult[0]?.count ?? 0));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (overrides.q      ?? q)      sp.set("q",      overrides.q      ?? q ?? "");
    if (overrides.status ?? status) sp.set("status", overrides.status ?? status ?? "");
    if (overrides.page)             sp.set("page",   overrides.page);
    return `/${slug}/toko/pesanan?${sp.toString()}`;
  };

  const statuses = ["all", "pending", "paid", "processing", "shipped", "done", "cancelled"];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pesanan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} pesanan</p>
        </div>
        <Link
          href={`/${slug}/toko/pesanan/new`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Buat Pesanan
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
      <form method="GET" action={`/${slug}/toko/pesanan`}>
        <div className="max-w-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari nama pelanggan atau nomor pesanan..."
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
              <th className="px-4 py-3 text-left font-medium">Pelanggan</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Tanggal</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Belum ada pesanan
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/${slug}/toko/pesanan/${row.id}`} className="font-mono text-xs text-primary hover:underline">
                      {row.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/${slug}/toko/pesanan/${row.id}`} className="hover:underline">
                      {row.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatRupiah(row.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status] ?? "bg-zinc-100"}`}>
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
          <span>{total} pesanan</span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={buildUrl({ page: String(currentPage - 1) })} className="rounded border border-border px-3 py-1 hover:bg-muted/40">← Sebelumnya</Link>
            )}
            <span className="rounded border border-border px-3 py-1 bg-muted/20">{currentPage} / {totalPages}</span>
            {currentPage < totalPages && (
              <Link href={buildUrl({ page: String(currentPage + 1) })} className="rounded border border-border px-3 py-1 hover:bg-muted/40">Berikutnya →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
