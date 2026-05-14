"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart } from "lucide-react";

type CartDonation = {
  invoiceId:     string;
  invoiceNumber: string;
  customerName:  string;
  invoiceStatus: string;
  createdAt:     Date;
  campaignId:    string | null;
  campaignTitle: string | null;
  itemName:      string;
  itemTotal:     string | number;
};

function fmt(n: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(typeof n === "string" ? parseFloat(n) : n);
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const INV_STATUS: Record<string, { label: string; color: string }> = {
  pending:              { label: "Belum Dibayar",      color: "bg-yellow-100 text-yellow-700" },
  waiting_verification: { label: "Perlu Konfirm.",     color: "bg-blue-100 text-blue-700"    },
  paid:                 { label: "Dikonfirmasi",        color: "bg-green-100 text-green-700"  },
  partial:              { label: "Sebagian",            color: "bg-orange-100 text-orange-700"},
  cancelled:            { label: "Dibatalkan",          color: "bg-zinc-100 text-zinc-500"    },
};

export function CartDonationsTable({
  slug,
  items,
}: {
  slug:  string;
  items: CartDonation[];
}) {
  const [search, setSearch] = useState("");

  const filtered = items.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.customerName.toLowerCase().includes(q) ||
      d.invoiceNumber.toLowerCase().includes(q) ||
      (d.campaignTitle ?? "").toLowerCase().includes(q)
    );
  });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Belum ada donasi via keranjang</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari donatur atau nomor invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada transaksi yang cocok</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">No. Invoice</th>
                <th className="px-4 py-2.5 text-left font-medium">Donatur</th>
                <th className="px-4 py-2.5 text-left font-medium">Campaign</th>
                <th className="px-4 py-2.5 text-right font-medium">Nominal</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => {
                const st = INV_STATUS[d.invoiceStatus] ?? { label: d.invoiceStatus, color: "bg-zinc-100" };
                return (
                  <tr key={d.invoiceId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${slug}/finance/billing/invoice/${d.invoiceId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {d.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{d.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {d.campaignTitle ?? <span className="italic">Donasi Umum</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(d.itemTotal)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {fmtDate(d.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
