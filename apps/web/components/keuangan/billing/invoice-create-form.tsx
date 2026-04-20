"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createInvoiceAction,
  type InvoiceItemInput,
} from "@/app/(dashboard)/[tenant]/finance/billing/actions";

type Props = { slug: string };

type ItemLocal = InvoiceItemInput & { _key: string };

const ITEM_TYPE_LABELS: Record<string, string> = {
  product:  "Produk",
  ticket:   "Tiket",
  donation: "Donasi",
  custom:   "Lainnya",
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function newItem(): ItemLocal {
  return {
    _key:      crypto.randomUUID(),
    itemType:  "custom",
    name:      "",
    unitPrice: 0,
    quantity:  1,
  };
}

export function InvoiceCreateForm({ slug }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Customer
  const [customerName,  setCustomerName]  = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Items
  const [items, setItems] = useState<ItemLocal[]>([newItem()]);

  // Invoice settings
  const [discount, setDiscount] = useState("");
  const [dueDate,  setDueDate]  = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");

  // ── Item helpers ────────────────────────────────────────────────────────────

  function updateItem(key: string, patch: Partial<ItemLocal>) {
    setItems((prev) => prev.map((it) => it._key === key ? { ...it, ...patch } : it));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it._key !== key));
  }

  // ── Totals ──────────────────────────────────────────────────────────────────

  const subtotal    = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const discountNum = parseFloat(discount.replace(/\D/g, "")) || 0;
  const total       = Math.max(0, subtotal - discountNum);

  // ── Submit ──────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const res = await createInvoiceAction(slug, {
        customerName:  customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        items: items.map(({ _key, ...item }) => item),
        discount: discountNum || undefined,
        dueDate,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        router.push(`/${slug}/finance/billing/invoice/${res.data.invoiceId}`);
      } else {
        setError(res.error);
      }
    });
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "block text-sm font-medium mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">

      {/* ── Customer ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informasi Customer</h2>
        <div>
          <label className={labelCls}>Nama Customer <span className="text-destructive">*</span></label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="mis. Ahmad Budi"
            className={inputCls}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nomor HP</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="08xx-xxxx-xxxx"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="email@domain.com"
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* ── Items ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Item Tagihan</h2>

        {items.map((item) => (
          <div key={item._key} className="rounded-lg border border-border p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Tipe</label>
                <select
                  value={item.itemType}
                  onChange={(e) => updateItem(item._key, { itemType: e.target.value as InvoiceItemInput["itemType"] })}
                  className={inputCls}
                >
                  {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Nama Item <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item._key, { name: e.target.value })}
                  placeholder="mis. Biaya pendaftaran"
                  className={inputCls}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>Harga Satuan</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                  <input
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item._key, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Qty</label>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item._key, { quantity: parseInt(e.target.value) || 1 })}
                  className={inputCls}
                />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                  <p className="text-sm font-semibold tabular-nums">
                    Rp {formatRp(item.unitPrice * item.quantity)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item._key)}
                  disabled={items.length === 1}
                  className="rounded-md border border-border p-2 text-muted-foreground hover:text-destructive hover:border-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, newItem()])}
          className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Tambah Item
        </button>

        {/* Ringkasan total */}
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">Rp {formatRp(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Diskon</span>
            <div className="relative w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex justify-between font-semibold border-t border-border pt-2">
            <span>Total</span>
            <span className="tabular-nums">Rp {formatRp(total)}</span>
          </div>
        </div>
      </section>

      {/* ── Invoice settings ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pengaturan Invoice</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Jatuh Tempo</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Catatan</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Keterangan tambahan (opsional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Buat Invoice"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
