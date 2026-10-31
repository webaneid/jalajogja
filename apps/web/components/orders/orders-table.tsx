// Tabel pesanan SATU-SATUNYA — dipakai menu Pesanan portal produsen dan tab "Pesanan Masuk" di halaman produk tunggal
// (admin + produsen). Edit di sini berlaku ke semuanya. Server component (tanpa state klien); data = ProducerOrderRow
// (tanpa uang, tanpa email). Doc: docs/arsitektur-portal-produsen.md § 19.1 & 19.14.
import Link from "next/link";
import { Eye, Printer } from "lucide-react";
import { displayPhone } from "@/lib/phone";
import { OrderStatusBadge } from "@/components/producer/order-status-badge";
import type { ProducerOrderRow } from "@/lib/producer-orders.server";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(d);

export function OrdersTable({ rows, viewHref, showMixed, emptyText }: {
  rows: ProducerOrderRow[];
  viewHref: (invoiceId: string) => string;
  /** true di menu Pesanan portal (penanda invoice campuran); false di tab produk (arti "campuran" di sana membingungkan). */
  showMixed: boolean;
  emptyText: string;
}) {
  return (
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
            <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{emptyText}</td></tr>
          )}
          {rows.map((o) => (
            <tr key={o.invoiceId} className="align-top">
              <td className="whitespace-nowrap px-3 py-2">{fmtDate(o.createdAt)}</td>
              <td className="px-3 py-2">
                <span className="font-mono text-xs">{o.invoiceNumber}</span>
                {showMixed && o.isMixed && (
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
                  <Link href={viewHref(o.invoiceId)} title="Lihat pesanan" aria-label="Lihat pesanan" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
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
  );
}
