// Tampilan detail pesanan SATU-SATUNYA — dipakai halaman admin (`toko/pesanan/invoice/{id}`) DAN produsen (`portal-produsen/pesanan/{id}`).
// Permintaan user 2026-11-01: "isinya sama persis" → edit di sini berlaku ke keduanya (jangan membuat tampilan alternatif per peran).
// Server component; semua data sudah disiapkan pemanggil (view-model) sehingga pemanggil yang menentukan APA yang boleh terlihat
// (mis. produsen: hanya item miliknya, tanpa email, tanpa tautan pembayaran). Doc: arsitektur-portal-produsen.md § 23.4.
import Link from "next/link";
import { ChevronLeft, ExternalLink, Package } from "lucide-react";
import { FulfillmentCard, type FulfillmentShippingLine } from "@/components/toko/fulfillment-client";

export type OrderDetailItem = {
  id: string; name: string; description: string | null; thumb: string | null; unitPrice: number; quantity: number; total: number;
};

export type OrderDetailVM = {
  slug: string;
  backHref: string;
  backLabel: string;
  statusBadge: { label: string; cls: string };
  invoiceNumber: string;
  customerName: string;
  createdAt: Date;
  /** Bilah aksi (OrderDetailActions) — null bila tak ada. */
  actions: React.ReactNode;
  /** Baris kartu Info Pelanggan (nilai boleh elemen React, mis. tautan). */
  info: [label: string, value: React.ReactNode][];
  items: OrderDetailItem[];
  breakdown: { subtotal: number; shipping: number; discount: number; total: number; paid: number; note?: string };
  lines: FulfillmentShippingLine[];
  invoicePaid: boolean;
  /** true = kartu pengiriman tanpa tombol ubah status (produsen). */
  readOnlyFulfillment: boolean;
  /** Tautan "Detail Pembayaran" (halaman keuangan admin); null = disembunyikan. */
  billingHref: string | null;
  /** false bila layout pembungkus sudah memberi padding (portal produsen); default true (layout admin tanpa padding). */
  padded?: boolean;
};

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function OrderDetailView({ vm }: { vm: OrderDetailVM }) {
  const b = vm.breakdown;
  return (
    <div className={`${vm.padded === false ? "" : "p-6 "}space-y-6 max-w-2xl`}>
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href={vm.backHref} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {vm.backLabel}
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${vm.statusBadge.cls}`}>{vm.statusBadge.label}</span>
      </div>

      {/* Header invoice */}
      <div>
        <p className="font-mono text-xs text-muted-foreground">{vm.invoiceNumber}</p>
        <h1 className="text-xl font-semibold mt-1">{vm.customerName}</h1>
        <p className="text-sm text-muted-foreground">{fmtDate(vm.createdAt)}</p>
        {vm.actions && <div className="mt-3">{vm.actions}</div>}
      </div>

      {/* Info pelanggan */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border text-sm">
        {vm.info.map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 gap-3">
            <span className="text-muted-foreground shrink-0 w-28">{label}</span>
            <span className="text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* Item pesanan */}
      <div>
        <h2 className="font-semibold text-sm mb-2">Item Pesanan</h2>
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Produk</th>
                <th className="px-4 py-2 text-center font-medium w-12">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vm.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumb} alt={item.name} className="w-9 h-9 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-muted shrink-0 flex items-center justify-center">
                          <Package size={14} className="text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium leading-snug">{item.name}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        <p className="text-xs text-muted-foreground">{fmt(item.unitPrice)} / item</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-muted/10 text-sm">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                <td className="px-4 py-2 text-right">{fmt(b.subtotal)}</td>
              </tr>
              {b.shipping > 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-muted-foreground">Ongkos Kirim</td>
                  <td className="px-4 py-2 text-right">{fmt(b.shipping)}</td>
                </tr>
              )}
              {b.discount > 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-muted-foreground">Diskon</td>
                  <td className="px-4 py-2 text-right text-red-600">-{fmt(b.discount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right font-semibold">Total</td>
                <td className="px-4 py-2 text-right font-semibold text-base">{fmt(b.total)}</td>
              </tr>
              {b.paid < b.total && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-muted-foreground">Terbayar</td>
                  <td className="px-4 py-2 text-right text-green-600">{fmt(b.paid)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
        {b.note && <p className="mt-1.5 text-xs text-muted-foreground">{b.note}</p>}
      </div>

      {/* Fulfillment cards */}
      {vm.lines.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-sm">Pengiriman &amp; Fulfillment</h2>
          {vm.lines.map((line) => (
            <FulfillmentCard key={line.id} slug={vm.slug} line={line} invoicePaid={vm.invoicePaid} readOnly={vm.readOnlyFulfillment} />
          ))}
        </div>
      )}

      {/* Link ke detail billing (pembayaran) — hanya admin */}
      {vm.billingHref && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Detail Pembayaran</p>
            <p className="text-xs text-muted-foreground">Verifikasi bukti transfer, konfirmasi manual</p>
          </div>
          <Link href={vm.billingHref} className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0">
            Buka Invoice
            <ExternalLink size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
