// Chip filter status pengiriman untuk tabel pesanan (server component, hanya tautan). Doc: arsitektur-portal-produsen.md § 22.
import Link from "next/link";
import type { OrderStatusFilter, StatusCounts } from "@/lib/producer-orders.server";

const ITEMS: { key: OrderStatusFilter | null; label: string }[] = [
  { key: null, label: "Semua" }, { key: "pending", label: "Menunggu" }, { key: "processing", label: "Diproses" },
  { key: "packed", label: "Dikemas" }, { key: "shipped", label: "Dikirim" }, { key: "delivered", label: "Diterima" },
];

export function StatusFilter({ active, counts, hrefFor }: {
  active: OrderStatusFilter | null; counts: StatusCounts; hrefFor: (status: OrderStatusFilter | null) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter status pesanan">
      {ITEMS.map(({ key, label }) => {
        const on = key === active;
        const n = key === null ? counts.all : counts[key];
        return (
          <Link key={label} href={hrefFor(key)} role="tab" aria-selected={on}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
            {label}
            <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${on ? "bg-primary-foreground/20" : "bg-muted"}`}>{n}</span>
          </Link>
        );
      })}
    </div>
  );
}
