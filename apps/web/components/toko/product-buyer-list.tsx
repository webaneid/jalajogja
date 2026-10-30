"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import type { ProductBuyerRow } from "@/lib/product-buyers.server";
import { displayPhone } from "@/lib/phone";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  "Lunas":       "default",
  "Sebagian":    "secondary",
  "Belum Bayar": "destructive",
};

const PAGE_SIZE = 20;

function fmtRp(n: number | string) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// linkInvoices=false (Portal Produsen): nomor invoice jadi teks biasa — halaman invoice admin bukan untuk produsen.
export function ProductBuyerList({ slug, rows, linkInvoices = true }: { slug: string; rows: ProductBuyerRow[]; linkInvoices?: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  const filtered = rows.filter((r) =>
    r.customerName.toLowerCase().includes(search.toLowerCase()) ||
    r.invoiceNumber.toLowerCase().includes(search.toLowerCase())
  );

  // Paginasi (sisi klien — baris sudah ada di halaman; sama untuk admin & produsen karena komponennya satu)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current    = Math.min(page, totalPages);
  const visible    = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama pembeli atau nomor invoice..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border-2 border-dashed rounded-lg">
          <Users className="h-8 w-8" />
          <p className="text-sm">
            {search ? "Tidak ada pembeli yang sesuai pencarian." : "Belum ada pembeli untuk produk ini."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pembeli</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">HP</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Varian</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Jumlah</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Subtotal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pengiriman</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alamat Checkout</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alamat User</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ongkir</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r, idx) => (
                <tr key={`${r.invoiceId}-${idx}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    {linkInvoices ? (
                      <Link
                        href={`/app/${slug}/toko/pesanan/invoice/${r.invoiceId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs">{r.invoiceNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{r.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{displayPhone(r.customerPhone)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.variantLabel || "—"}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{r.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtRp(r.lineTotal)}
                    {r.discountAmount > 0 && (
                      <span className="block text-xs font-normal text-green-600">
                        − {fmtRp(r.discountAmount)} voucher{r.voucherCode && ` (${r.voucherCode})`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.shippingLabel}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={r.checkoutAddress}>
                    {r.checkoutAddress || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={r.memberAddress}>
                    {r.memberAddress || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {fmtRp(r.shippingCost)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[r.paymentStatusLabel] ?? "outline"}>
                      {r.paymentStatusLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Halaman {current} dari {totalPages} · {filtered.length} pesanan</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>← Sebelumnya</Button>
            <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>Berikutnya →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
