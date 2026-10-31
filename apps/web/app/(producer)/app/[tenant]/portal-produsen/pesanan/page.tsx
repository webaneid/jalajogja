// Menu Pesanan Portal Produsen — invoice LUNAS yang memuat produk milik produsen (dari sesi), satu baris per invoice.
// Server component penuh (tanpa state klien); data lewat lib/producer-orders.server.ts. Doc: docs/arsitektur-portal-produsen.md § 19.
import { redirect } from "next/navigation";
import Link from "next/link";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { listProducerOrders } from "@/lib/producer-orders.server";
import { OrdersTable } from "@/components/orders/orders-table";

const PAGE_SIZE = 20;

export default async function ProducerOrdersPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, page } = await searchParams;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const currentPage = Math.min(10_000, Math.max(1, parseInt(page ?? "1") || 1));
  const query = (q ?? "").trim().slice(0, 80);
  const { rows, total } = await listProducerOrders(createTenantDb(access.tenant.slug), access.producer.id, {
    q: query, page: currentPage, pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/app/${slug}/portal-produsen/pesanan`;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
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
        {query && <Link href={base} className="text-sm text-muted-foreground hover:underline">Reset</Link>}
      </form>

      <OrdersTable rows={rows} showMixed print={{ slug, blockMixed: true }} viewHref={(id) => `${base}/${id}`}
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
