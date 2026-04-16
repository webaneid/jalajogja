"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, Search, ListOrdered } from "lucide-react";

type Donation = {
  id:             string;
  donationNumber: string;
  donorName:      string;
  isAnonymous:    boolean;
  donationType:   string;
  campaignId:     string | null;
  campaignTitle:  string | null;
  createdAt:      Date;
  paymentId:      string | null;
  paymentStatus:  string | null;
  paymentMethod:  string | null;
  paymentAmount:  string | null;
};

function formatRupiah(amount: string | null) {
  if (!amount) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(parseFloat(amount));
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "Menunggu",     color: "bg-yellow-100 text-yellow-700" },
  submitted: { label: "Perlu Konfirm", color: "bg-blue-100 text-blue-700"   },
  paid:      { label: "Dikonfirmasi", color: "bg-green-100 text-green-700"  },
  cancelled: { label: "Dibatalkan",   color: "bg-zinc-100 text-zinc-500"    },
};

const METHOD_LABEL: Record<string, string> = {
  cash:     "Tunai",
  transfer: "Transfer",
  qris:     "QRIS",
};

const TYPE_LABEL: Record<string, string> = {
  donasi: "Donasi",
  zakat:  "Zakat",
  wakaf:  "Wakaf",
  qurban: "Qurban",
};

export function TransaksiTable({
  slug,
  donations,
}: {
  slug:      string;
  donations: Donation[];
}) {
  const [search, setSearch] = useState("");

  const filtered = donations.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.donorName.toLowerCase().includes(q) ||
      d.donationNumber.toLowerCase().includes(q) ||
      (d.campaignTitle ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari donatur atau nomor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ListOrdered className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi donasi"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Nomor</th>
                <th className="px-4 py-2.5 text-left font-medium">Donatur</th>
                <th className="px-4 py-2.5 text-left font-medium">Campaign</th>
                <th className="px-4 py-2.5 text-left font-medium">Jenis</th>
                <th className="px-4 py-2.5 text-left font-medium">Metode</th>
                <th className="px-4 py-2.5 text-right font-medium">Nominal</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => {
                const ps = d.paymentStatus ? (PAY_STATUS[d.paymentStatus] ?? { label: d.paymentStatus, color: "bg-zinc-100" }) : null;
                return (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {d.donationNumber}
                    </td>
                    <td className="px-4 py-3">
                      {d.isAnonymous ? (
                        <span className="text-muted-foreground italic">Anonim</span>
                      ) : (
                        d.donorName
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {d.campaignTitle ?? <span className="italic">Donasi Umum</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {TYPE_LABEL[d.donationType] ?? d.donationType}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.paymentMethod ? (METHOD_LABEL[d.paymentMethod] ?? d.paymentMethod) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatRupiah(d.paymentAmount)}
                    </td>
                    <td className="px-4 py-3">
                      {ps ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ps.color}`}>
                          {ps.label}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(d.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/${slug}/donasi/transaksi/${d.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
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
