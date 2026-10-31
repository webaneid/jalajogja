"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBatchAction } from "@/app/(producer)/app/[tenant]/portal-produsen/pengiriman/actions";
import { OrderPicker, type PickerOrder } from "./order-picker";

export function BatchCreateForm({ slug, suggestedName, today, orders }: {
  slug: string; suggestedName: string; today: string; orders: PickerOrder[];
}) {
  const router = useRouter();
  const [name, setName] = useState(suggestedName);
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await createBatchAction(slug, { name, shippingDate: date, invoiceIds: [...selected] });
      if (!res.success) { setError(res.error); return; }
      router.push(`/app/${slug}/portal-produsen/pengiriman/${res.data.batchId}`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nama batch</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm" />
          <span className="block text-xs text-muted-foreground">Bawaan: tanggal + nomor urut hari ini.</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tanggal pengiriman</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Pesanan yang dikirim</p>
        <OrderPicker orders={orders} selected={selected} onChange={setSelected} />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-xs text-muted-foreground">Setelah batch dibuat, status pesanan menjadi <b>Diproses</b> dan batch tidak bisa dihapus.</p>
      <button onClick={submit} disabled={pending || selected.size === 0 || !name.trim() || !date}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Menyimpan…" : `Buat Batch (${selected.size} pesanan)`}
      </button>
    </div>
  );
}
