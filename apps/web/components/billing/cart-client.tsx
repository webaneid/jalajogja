"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateCartItemQtyAction,
  removeCartItemAction,
  type CartData,
} from "@/app/(public)/[tenant]/cart/actions";
import { Minus, Plus, Trash2, ShoppingCart, Ticket, Heart, Package } from "lucide-react";

type Props = {
  slug:    string;
  cart:    CartData | null;
};

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  product:  "Produk",
  ticket:   "Tiket",
  donation: "Donasi",
  custom:   "Lainnya",
};

const ITEM_TYPE_FALLBACK_ICON: Record<string, typeof Package> = {
  product:  Package,
  ticket:   Ticket,
  donation: Heart,
  custom:   Package,
};

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

      {/* Items — card di mobile (foto + judul 2-baris + kontrol di baris terpisah), baris
          tunggal ringkas di desktop (sm: ke atas). */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {cart.items.map((item) => {
          const FallbackIcon = ITEM_TYPE_FALLBACK_ICON[item.itemType] ?? Package;
          return (
            <div key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              {/* Foto + judul */}
              <div className="flex items-start gap-3 sm:min-w-0 sm:flex-1">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 sm:h-12 sm:w-12">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <FallbackIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium sm:truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}</p>
                </div>
              </div>

              {/* Kontrol qty + harga + hapus */}
              <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end sm:gap-4">
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

                <p className="tabular-nums text-sm font-medium sm:w-28 sm:text-right">
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
            </div>
          );
        })}
      </div>

      {/* Total + Checkout — desktop saja. Versi mobile (sticky) ada TERPISAH di
          <CartMobileBar>, WAJIB dirender oleh halaman (page.tsx) sebagai elemen PALING
          TERAKHIR di halaman — bukan di sini — karena halaman keranjang punya konten
          TAMBAHAN setelah CartClient (banner donasi/produk terkait). Kalau versi sticky
          ditaruh di dalam CartClient, spacer-nya nyangkut di TENGAH halaman (sebelum banner
          itu), bukan di paling bawah tempat ia seharusnya berada (lihat lesson CLAUDE.md). */}
      <div className="hidden md:block space-y-4">
        <div className="flex justify-between items-center rounded-lg border border-border bg-muted/10 px-4 py-3">
          <span className="font-semibold">Total</span>
          <span className="tabular-nums font-semibold text-lg">{formatRp(cart.subtotal)}</span>
        </div>
        <a
          href={`/${slug}/checkout`}
          className="block w-full rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Konfirmasi Detail
        </a>
      </div>
    </div>
  );
}
