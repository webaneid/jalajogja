// Label + warna status pengiriman (5 tahap fulfillment, docs/arsitektur-fulfillment.md) — dipakai menu Pesanan & Pengiriman portal.
const LABEL: Record<string, string> = {
  pending: "Menunggu", processing: "Diproses", packed: "Dikemas", shipped: "Dikirim", delivered: "Diterima",
};
const COLOR: Record<string, string> = {
  pending: "bg-muted text-muted-foreground", processing: "bg-blue-100 text-blue-700", packed: "bg-amber-100 text-amber-700",
  shipped: "bg-green-100 text-green-700", delivered: "bg-emerald-100 text-emerald-800",
};

export function OrderStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COLOR[status] ?? "bg-muted"}`}>
      {LABEL[status] ?? status}
    </span>
  );
}
