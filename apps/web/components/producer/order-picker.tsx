"use client";

// Daftar centang pesanan untuk batch (dipakai form buat batch & tambah ke batch). Menerima hanya field minimal
// (bukan seluruh ProducerOrderRow) — yang dikirim ke klien = yang tampil.
export type PickerOrder = { invoiceId: string; invoiceNumber: string; customerName: string; summary: string; qty: number };

export function OrderPicker({ orders, selected, onChange }: {
  orders: PickerOrder[]; selected: Set<string>; onChange: (next: Set<string>) => void;
}) {
  if (orders.length === 0) {
    return <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Tidak ada pesanan yang siap dikirim (lunas, belum masuk batch, bukan invoice campuran).</p>;
  }
  const all = orders.every((o) => selected.has(o.invoiceId));
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); onChange(n); };
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <label className="flex items-center gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
        <input type="checkbox" checked={all} onChange={() => onChange(all ? new Set() : new Set(orders.map((o) => o.invoiceId)))} />
        Pilih semua ({orders.length}) · terpilih {selected.size}
      </label>
      <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
        {orders.map((o) => (
          <li key={o.invoiceId}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-muted/40">
              <input type="checkbox" className="mt-1" checked={selected.has(o.invoiceId)} onChange={() => toggle(o.invoiceId)} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{o.customerName}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{o.invoiceNumber}</span>
                <span className="block truncate text-xs text-muted-foreground">{o.summary} · {o.qty} pcs</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
