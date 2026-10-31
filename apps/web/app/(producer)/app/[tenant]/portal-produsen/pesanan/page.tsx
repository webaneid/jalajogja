// Menu Pesanan Portal Produsen — invoice LUNAS yang memuat produk milik produsen (dari sesi), satu baris per invoice.
// Server component penuh (tanpa state klien); data lewat lib/producer-orders.server.ts. Doc: docs/arsitektur-portal-produsen.md § 19.
import { redirect } from "next/navigation";
import Link from "next/link";
import { Eye, Printer } from "lucide-react";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { listProducerOrders } from "@/lib/producer-orders.server";
import { displayPhone } from "@/lib/phone";
import { OrderStatusBadge } from "@/components/producer/order-status-badge";

const PAGE_SIZE = 20;
const fmtDate = (d: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(d);

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

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Tgl Pesan</th>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Pemesan</th>
              <th className="px-3 py-2 font-medium">Pesanan</th>
              <th className="px-3 py-2 text-right font-medium">Jml</th>
              <th className="px-3 py-2 font-medium">Kurir</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{query ? "Tidak ada pesanan yang cocok." : "Belum ada pesanan lunas."}</td></tr>
            )}
            {rows.map((o) => (
              <tr key={o.invoiceId} className="align-top">
                <td className="whitespace-nowrap px-3 py-2">{fmtDate(o.createdAt)}</td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{o.invoiceNumber}</span>
                  {o.isMixed && (
                    <span title="Invoice ini juga memuat barang dari penjual lain — ditangani admin, tidak bisa dimasukkan ke batch pengiriman."
                      className="mt-1 block w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Campuran</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{o.customerName}</div>
                  <div className="text-xs text-muted-foreground">{o.customerPhone ? displayPhone(o.customerPhone) : "—"}</div>
                </td>
                <td className="px-3 py-2">
                  <ul className="space-y-0.5">
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.name}
                        {it.variantLabel && <span className="block text-xs text-muted-foreground">{it.variantLabel}</span>}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{o.totalQty}</td>
                <td className="whitespace-nowrap px-3 py-2">{o.courierLabel}</td>
                <td className="px-3 py-2"><OrderStatusBadge status={o.status} /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`${base}/${o.invoiceId}`} title="Lihat pesanan" aria-label="Lihat pesanan" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                      <Eye className="h-4 w-4" />
                    </Link>
                    {/* Mesin cetak dibuat terpisah — nonaktif dulu */}
                    <button type="button" disabled title="Cetak (segera hadir)" aria-label="Cetak (segera hadir)" className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground opacity-40">
                      <Printer className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
