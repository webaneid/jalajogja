"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInvoicesToBatchAction, markPackedAction, removeInvoiceFromBatchAction } from "@/app/(producer)/app/[tenant]/portal-produsen/pengiriman/actions";
import { OrderPicker, type PickerOrder } from "./order-picker";

function useAct() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null);
    start(async () => { const r = await fn(); if (!r.success) setError(r.error ?? "Gagal."); router.refresh(); });
  };
  return { error, pending, run };
}

/** Tombol di atas batch: Tandai Dikemas (semua yang Diproses). */
export function BatchPackAll({ slug, batchId, processingCount }: { slug: string; batchId: string; processingCount: number }) {
  const { error, pending, run } = useAct();
  if (processingCount === 0) return null;
  return (
    <div className="space-y-1">
      <button disabled={pending} onClick={() => run(() => markPackedAction(slug, batchId))}
        className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
        {pending ? "Memproses…" : `Tandai Semua Dikemas (${processingCount})`}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Tombol per baris: Tandai Dikemas (bila Diproses) + Keluarkan (bila belum ada resi). */
export function BatchRowActions({ slug, batchId, invoiceId, status }: { slug: string; batchId: string; invoiceId: string; status: string | null }) {
  const { error, pending, run } = useAct();
  const canRemove = status === "processing" || status === "packed";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {status === "processing" && (
          <button disabled={pending} onClick={() => run(() => markPackedAction(slug, batchId, invoiceId))}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">Tandai Dikemas</button>
        )}
        {canRemove && (
          <button disabled={pending} onClick={() => { if (window.confirm("Keluarkan pesanan ini dari batch? Status kembali ke Menunggu.")) run(() => removeInvoiceFromBatchAction(slug, batchId, invoiceId)); }}
            className="rounded-md border border-border px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">Keluarkan</button>
        )}
      </div>
      {error && <p className="max-w-[220px] text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Tambah pesanan lain ke batch yang sudah ada. */
export function BatchAddOrders({ slug, batchId, orders }: { slug: string; batchId: string; orders: PickerOrder[] }) {
  const { error, pending, run } = useAct();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  if (!open) {
    return <button onClick={() => setOpen(true)} className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">+ Tambah Pesanan</button>;
  }
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <OrderPicker orders={orders} selected={selected} onChange={setSelected} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending || selected.size === 0}
          onClick={() => run(async () => { const r = await addInvoicesToBatchAction(slug, batchId, [...selected]); if (r.success) { setSelected(new Set()); setOpen(false); } return r; })}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Menyimpan…" : `Tambahkan (${selected.size})`}
        </button>
        <button onClick={() => setOpen(false)} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted">Batal</button>
      </div>
    </div>
  );
}
