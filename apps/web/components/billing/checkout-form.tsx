"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkoutAction, type CartData } from "@/app/(public)/[tenant]/cart/actions";

type Props = {
  slug: string;
  cart: CartData;
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(n);
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai", transfer: "Transfer Bank", qris: "QRIS",
};

export function CheckoutForm({ slug, cart }: Props) {
  const router                      = useRouter();
  const [pending, startTransition]  = useTransition();
  const [error, setError]           = useState("");

  const [phone,  setPhone]   = useState("");
  const [email,  setEmail]   = useState("");
  const [name,   setName]    = useState("");
  const [method, setMethod]  = useState<"cash" | "transfer" | "qris">("transfer");
  const [notes,  setNotes]   = useState("");

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "block text-sm font-medium mb-1";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() && !email.trim()) {
      setError("Nomor HP atau email wajib diisi.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await checkoutAction(slug, { phone, email, name, method, notes });
      if (res.success) {
        router.push(`/${slug}/invoice/${res.data.invoiceId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
      {/* ── Form kiri ── */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="rounded-lg border border-border p-5 space-y-4">
          <p className="font-semibold text-sm">Informasi Pemesan</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Nomor HP <span className="text-muted-foreground text-xs">(atau email)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Nama <span className="text-muted-foreground text-xs">(opsional, diambil dari data anggota jika terdaftar)</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
              className={inputCls}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border p-5 space-y-3">
          <p className="font-semibold text-sm">Metode Pembayaran</p>
          <div className="flex flex-wrap gap-2">
            {(["cash", "transfer", "qris"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  method === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Catatan <span className="text-muted-foreground text-xs">(opsional)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Pesan atau catatan untuk admin..."
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {pending ? "Memproses..." : `Buat Invoice — ${formatRp(cart.subtotal)}`}
        </button>
      </form>

      {/* ── Ringkasan kanan ── */}
      <div className="rounded-lg border border-border p-5 space-y-3 sticky top-4">
        <p className="font-semibold text-sm">Ringkasan Pesanan</p>
        <div className="divide-y divide-border">
          {cart.items.map((item) => (
            <div key={item.id} className="flex justify-between py-2 text-sm">
              <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
              <span className="tabular-nums">{formatRp(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-semibold border-t border-border pt-3">
          <span>Total</span>
          <span className="tabular-nums">{formatRp(cart.subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
