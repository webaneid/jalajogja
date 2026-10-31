// Tab "Pesanan Masuk" di halaman produk tunggal — SATU tampilan untuk admin DAN produsen, isinya SAMA PERSIS dengan menu
// Pesanan portal produsen (komponen `OrdersTable`): invoice lunas yang memuat produk ini; tgl, invoice, pemesan, pesanan,
// jml, kurir, status, aksi. Permintaan user 2026-11-01 ("isinya sama persis dengan halaman pesanan"). Doc: arsitektur-portal-produsen.md § 19.14.
// Tombol export hanya untuk admin (`canExport`) — route export memakai getTenantAccess (produsen ditolak).
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrdersTable } from "@/components/orders/orders-table";
import type { ProducerOrderRow } from "@/lib/producer-orders.server";

export function TabPesanan({ slug, productId, rows, total, page, pageSize, q, basePath, viewHref, canExport }: {
  slug: string; productId: string; rows: ProducerOrderRow[]; total: number; page: number; pageSize: number; q: string;
  basePath: string;                       // /app/{slug}/toko/produk/{id} atau /app/{slug}/portal-produsen/produk/{id}
  viewHref: (invoiceId: string) => string;
  canExport: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams({ tab: "pesanan" });
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">Pesanan Masuk</h2>
          <p className="text-xs text-muted-foreground">{total} pesanan lunas untuk produk ini.</p>
        </div>
        {canExport && (
          <div className="flex items-center gap-1.5">
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <a href={`/api/products/${productId}/export-buyers?tenant=${slug}`}>
                <Download className="h-3 w-3 mr-1" />
                Export Pembeli (Sudah Bayar)
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <a href={`/api/products/${productId}/export-buyers?tenant=${slug}&all=1`}>
                <Download className="h-3 w-3 mr-1" />
                Export Semua Pembeli
              </a>
            </Button>
          </div>
        )}
      </div>

      <form action={basePath} method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value="pesanan" />
        <input name="q" defaultValue={q} placeholder="Cari nomor invoice / nama pemesan…" className="h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm" />
        <button type="submit" className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">Cari</button>
        {q && <Link href={`${basePath}?tab=pesanan`} className="text-sm text-muted-foreground hover:underline">Reset</Link>}
      </form>

      <OrdersTable rows={rows} showMixed={false} viewHref={viewHref}
        emptyText={q ? "Tidak ada pesanan yang cocok." : "Belum ada pesanan lunas untuk produk ini."} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href(page - 1)} className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted">Sebelumnya</Link>}
            {page < totalPages && <Link href={href(page + 1)} className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted">Berikutnya</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
