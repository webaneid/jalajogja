import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql, ilike } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const PAGE_SIZE = 25;

export default async function JurnalPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, page } = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const whereClause = q
    ? ilike(schema.transactions.description, `%${q}%`)
    : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id:              schema.transactions.id,
        date:            schema.transactions.date,
        description:     schema.transactions.description,
        referenceNumber: schema.transactions.referenceNumber,
        createdAt:       schema.transactions.createdAt,
      })
      .from(schema.transactions)
      .where(whereClause)
      .orderBy(sql`${schema.transactions.date} DESC, ${schema.transactions.createdAt} DESC`)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<string>`COUNT(*)` })
      .from(schema.transactions)
      .where(whereClause),
  ]);

  const total      = parseInt(String(countResult[0]?.count ?? 0));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (overrides.q ?? q) sp.set("q", overrides.q ?? q ?? "");
    if (overrides.page) sp.set("page", overrides.page);
    return `/${slug}/finance/jurnal?${sp.toString()}`;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Jurnal Akuntansi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Semua entri jurnal — otomatis dan manual
          </p>
        </div>
        <Link
          href={`/${slug}/finance/jurnal/new`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Jurnal Manual
        </Link>
      </div>

      {/* Search */}
      <form method="GET" action={`/${slug}/finance/jurnal`}>
        <div className="relative max-w-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari keterangan jurnal..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </form>

      {/* Tabel */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Tanggal</th>
              <th className="px-4 py-3 text-left font-medium">No. Referensi</th>
              <th className="px-4 py-3 text-left font-medium">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  Belum ada jurnal
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{row.referenceNumber ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">{row.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info immutable */}
      <p className="text-xs text-muted-foreground italic">
        Jurnal bersifat permanen — tidak bisa diedit atau dihapus. Koreksi dilakukan dengan jurnal koreksi baru.
      </p>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} entri</span>
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
