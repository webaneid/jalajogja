// Menu Pesanan Portal Produsen — invoice LUNAS yang memuat produk milik produsen (dari sesi), satu baris per invoice.
// Server component penuh (tanpa state klien); data lewat lib/producer-orders.server.ts. Doc: docs/arsitektur-portal-produsen.md § 19.
import { redirect } from "next/navigation";
import Link from "next/link";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { listProducerOrders, parseStatusFilter, suggestBatchName, type OrderStatusFilter } from "@/lib/producer-orders.server";
import { todayWib } from "@/lib/producer-batch.server";
import { StatusFilter } from "@/components/orders/status-filter";
import { OrdersTable } from "@/components/orders/orders-table";

const PAGE_SIZE = 20;

export default async function ProducerOrdersPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, page, status } = await searchParams;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const currentPage = Math.min(10_000, Math.max(1, parseInt(page ?? "1") || 1));
  const query = (q ?? "").trim().slice(0, 80);
  const statusFilter = parseStatusFilter(status);
  const tenantClient = createTenantDb(access.tenant.slug);
  const [{ rows, total, statusCounts }, suggestedName] = await Promise.all([
    listProducerOrders(tenantClient, access.producer.id, { q: query, page: currentPage, pageSize: PAGE_SIZE, status: statusFilter }),
    suggestBatchName(tenantClient, access.producer.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/app/${slug}/portal-produsen/pesanan`;
  const href = (p: number, st: OrderStatusFilter | null = statusFilter) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (st) sp.set("status", st);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pesanan</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{total} pesanan lunas dari semua produk Anda.</p>
      </div>

      <form action={base} method="get" className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={query} placeholder="Cari nomor invoice / nama pemesan…" className="h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm" />
        <button type="submit" className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">Cari</button>
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        {(query || statusFilter) && <Link href={base} className="text-sm text-muted-foreground hover:underline">Reset</Link>}
      </form>

      <StatusFilter active={statusFilter} counts={statusCounts} hrefFor={(st) => href(1, st)} />

      <OrdersTable rows={rows} showMixed print={{ slug, blockMixed: true }} batch={{ mode: "producer", suggestedName, today: todayWib() }} viewHref={(id) => `${base}/${id}`}
        emptyText={query ? "Tidak ada pesanan yang cocok." : "Belum ada pesanan lunas."} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Halaman {currentPage} dari {totalPages}</span>
          <div className="flex gap-2">
            {currentPage > 1 && <Link href={href(currentPage - 1)} className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted">Sebelumnya</Link>}
            {currentPage < totalPages && <Link href={href(currentPage + 1)} className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted">Berikutnya</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
