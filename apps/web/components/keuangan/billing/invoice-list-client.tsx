"use client";

"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, Search, X } from "lucide-react";
import type { InvoiceListItem } from "@/app/(dashboard)/[tenant]/finance/billing/actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  all:                  "Semua",
  draft:                "Draft",
  pending:              "Menunggu",
  waiting_verification: "Verifikasi",
  partial:              "Sebagian",
  paid:                 "Lunas",
  cancelled:            "Batal",
  overdue:              "Jatuh Tempo",
};

const STATUS_BADGE: Record<string, string> = {
  draft:                "bg-muted text-muted-foreground",
  pending:              "bg-yellow-100 text-yellow-700",
  waiting_verification: "bg-blue-100 text-blue-700",
  partial:              "bg-orange-100 text-orange-700",
  paid:                 "bg-green-100 text-green-700",
  cancelled:            "bg-red-100 text-red-700",
  overdue:              "bg-red-200 text-red-800",
};

const SOURCE_LABELS: Record<string, string> = {
  cart:               "Cart",
  order:              "Toko",
  donation:           "Donasi",
  event_registration: "Event",
  manual:             "Manual",
};

const SOURCE_BADGE: Record<string, string> = {
  cart:               "bg-purple-100 text-purple-700",
  order:              "bg-sky-100 text-sky-700",
  donation:           "bg-emerald-100 text-emerald-700",
  event_registration: "bg-amber-100 text-amber-700",
  manual:             "bg-muted text-muted-foreground",
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  slug:          string;
  rows:          InvoiceListItem[];
  total:         number;
  currentStatus: string;
  currentPage:   number;
  currentSearch: string;
};

const PAGE_SIZE = 20;

export function InvoiceListClient({
  slug, rows, total, currentStatus, currentPage, currentSearch,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(currentSearch);

  function buildHref(overrides: Record<string, string | number>) {
    const sp = new URLSearchParams();
    const merged = { status: currentStatus, page: currentPage, search: currentSearch, ...overrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v && v !== "all" && v !== 1 && v !== "") sp.set(k, String(v));
    });
    return `${pathname}${sp.size ? `?${sp}` : ""}`;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref({ search, page: 1 }));
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filter status */}
      <div className="flex gap-1.5 flex-wrap">
        {Object.keys(STATUS_LABELS).map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s, page: 1 })}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              currentStatus === s
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor / nama customer..."
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(""); router.push(buildHref({ search: "", page: 1 })); }}
            className="rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Cari
        </button>
      </form>

      {/* Tabel */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">No. Invoice</th>
              <th className="text-left px-4 py-2.5 font-medium">Customer</th>
              <th className="text-right px-4 py-2.5 font-medium">Total</th>
              <th className="text-right px-4 py-2.5 font-medium">Terbayar</th>
              <th className="text-left px-4 py-2.5 font-medium">Jatuh Tempo</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Belum ada invoice.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">
                    <p>{row.invoiceNumber}</p>
                    <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${SOURCE_BADGE[row.sourceType] ?? "bg-muted text-muted-foreground"}`}>
                      {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.customerName}</p>
                    <p className="text-xs text-muted-foreground">{row.itemCount} item</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRp(row.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {row.paidAmount > 0 ? formatRp(row.paidAmount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {row.dueDate ? formatDate(row.dueDate + "T00:00:00") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/finance/billing/invoice/${row.id}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Detail
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} invoice ditemukan</span>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={buildHref({ page: p })}
                className={`rounded-md px-2.5 py-1 border text-xs ${
                  p === currentPage
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
