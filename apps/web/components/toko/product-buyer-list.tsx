"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import type { ProductBuyerRow } from "@/lib/product-buyers.server";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  "Lunas":       "default",
  "Sebagian":    "secondary",
  "Belum Bayar": "destructive",
};

function fmtRp(n: number | string) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProductBuyerList({ slug, rows }: { slug: string; rows: ProductBuyerRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) =>
    r.customerName.toLowerCase().includes(search.toLowerCase()) ||
    r.invoiceNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama pembeli atau nomor invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pembeli</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Varian</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Jumlah</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Subtotal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pengiriman</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r, idx) => (
                <tr key={`${r.invoiceId}-${idx}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/${slug}/toko/pesanan/invoice/${r.invoiceId}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {r.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.variantLabel || "—"}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{r.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtRp(r.lineTotal)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.shippingLabel}</td>
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
    </div>
  );
}
