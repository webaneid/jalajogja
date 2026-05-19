import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql, ilike, eq, desc, or, and, inArray } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";

function fmt(n: number | string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(n) || 0);
}
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  pending:              { label: "Belum Dibayar",       cls: "bg-yellow-100 text-yellow-700" },
  waiting_verification: { label: "Menunggu Verifikasi", cls: "bg-blue-100 text-blue-700"    },
  partial:              { label: "Terbayar Sebagian",   cls: "bg-orange-100 text-orange-700" },
  paid:                 { label: "Lunas",               cls: "bg-green-100 text-green-700"  },
  cancelled:            { label: "Dibatalkan",          cls: "bg-zinc-100 text-zinc-500"    },
};

const PAGE_SIZE = 25;

export default async function PesananPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, status, page } = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const { db, schema } = createTenantDb(slug);
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const offset      = (currentPage - 1) * PAGE_SIZE;

  // ── Temukan invoice ID yang relevan (punya shipping line tenant) ────────────
  // Ini untuk membatasi cart invoices hanya yang ada produk fisik (bukan pure donasi/tiket)
  const cartInvoiceIds = await db
    .selectDistinct({ id: schema.invoiceShippingLines.invoiceId })
    .from(schema.invoiceShippingLines)
    .where(eq(schema.invoiceShippingLines.sellerType, "tenant"));

  const cartIds = cartInvoiceIds.map((r) => r.id);

  // ── Bangun kondisi filter ───────────────────────────────────────────────────
  // Pesanan = invoice sourceType='order' (admin) ATAU cart dengan shipping tenant
  const sourceFilter = cartIds.length > 0
    ? or(
        eq(schema.invoices.sourceType, "order"),
        inArray(schema.invoices.id, cartIds),
      )
    : eq(schema.invoices.sourceType, "order");

  const conditions = [sourceFilter!];
  if (status && status !== "all") {
    conditions.push(sql`${schema.invoices.status} = ${status}`);
  }
  if (q) {
    conditions.push(
      sql`(${ilike(schema.invoices.customerName, `%${q}%`)} OR ${ilike(schema.invoices.invoiceNumber, `%${q}%`)})`
    );
  }
  const whereClause = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id:            schema.invoices.id,
        invoiceNumber: schema.invoices.invoiceNumber,
        sourceType:    schema.invoices.sourceType,
        sourceId:      schema.invoices.sourceId,
        customerName:  schema.invoices.customerName,
        total:         schema.invoices.total,
        status:        schema.invoices.status,
        createdAt:     schema.invoices.createdAt,
      })
      .from(schema.invoices)
      .where(whereClause)
      .orderBy(desc(schema.invoices.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<string>`COUNT(*)` })
      .from(schema.invoices)
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

  const statuses = ["all", "pending", "waiting_verification", "partial", "paid", "cancelled"];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pesanan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} pesanan</p>
        </div>
        <Link
          href={`/app/${slug}/toko/pesanan/new`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Buat Pesanan
        </Link>
      </div>

      {/* Filter status */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => {
          const label = s === "all" ? "Semua" : (INV_STATUS[s]?.label ?? s);
          return (
            <Link
              key={s}
              href={buildUrl({ status: s === "all" ? "" : s, page: "1" })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                (s === "all" && !status) || status === s
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form method="GET" action={`/${slug}/toko/pesanan`}>
        {status && <input type="hidden" name="status" value={status} />}
        <div className="max-w-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari nama pelanggan atau nomor invoice..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </form>

      {/* Tabel */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nomor Invoice</th>
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
                  {q || status ? "Tidak ada pesanan yang cocok." : "Belum ada pesanan."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const st = INV_STATUS[row.status] ?? { label: row.status, cls: "bg-zinc-100 text-zinc-500" };
                // Admin order → detail lama; cart → halaman fulfillment
                const isAdmin = row.sourceType === "order";
                const detailHref = isAdmin
                  ? `/${slug}/toko/pesanan/${row.sourceId}`
                  : `/${slug}/toko/pesanan/invoice/${row.id}`;
                return (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={detailHref} className="font-mono text-xs text-primary hover:underline">
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={detailHref} className="hover:underline">
                        {row.customerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {fmt(row.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })
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
