"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateCartItemQtyAction,
  removeCartItemAction,
  type CartData,
} from "@/app/(public)/[tenant]/cart/actions";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";

type Props = {
  slug:    string;
  cart:    CartData | null;
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(n);
}

export function CartClient({ slug, cart }: Props) {
  const router                  = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError]       = useState("");

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <ShoppingCart className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Keranjang kosong</p>
        <p className="text-sm mt-1">Tambahkan produk, tiket, atau donasi untuk melanjutkan.</p>
      </div>
    );
  }

  function handleQty(itemId: string, newQty: number) {
    if (newQty < 1) return;
    setError("");
    startTransition(async () => {
      const res = await updateCartItemQtyAction(slug, itemId, newQty);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  function handleRemove(itemId: string) {
    setError("");
    startTransition(async () => {
      const res = await removeCartItemAction(slug, itemId);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Items */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{item.itemType}</p>
            </div>

            {/* Qty control */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleQty(item.id, item.quantity - 1)}
                disabled={pending || item.quantity <= 1}
                className="rounded border border-border w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
              <button
                type="button"
                onClick={() => handleQty(item.id, item.quantity + 1)}
                disabled={pending}
                className="rounded border border-border w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <p className="tabular-nums text-sm font-medium w-28 text-right">
              {formatRp(item.unitPrice * item.quantity)}
            </p>

            <button
              type="button"
              onClick={() => handleRemove(item.id)}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center rounded-lg border border-border bg-muted/10 px-4 py-3">
        <span className="font-semibold">Total</span>
        <span className="tabular-nums font-semibold text-lg">{formatRp(cart.subtotal)}</span>
      </div>

      {/* Checkout button */}
      <div className="pt-2">
        <a
          href={`/${slug}/checkout`}
          className="block w-full rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Lanjut ke Checkout
        </a>
      </div>
    </div>
  );
}
