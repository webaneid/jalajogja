"use client";

import { useState, useEffect } from "react";
import { use }                 from "react";
import { Loader2, Package, Truck, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

type Params = Promise<{ tenant: string }>;

type ShippingLine = {
  id:             string;
  sellerName:     string;
  courier:        string;
  service:        string;
  etd:            string | null;
  cost:           number;
  trackingNumber: string | null;
  shippedAt:      string | null;
  status:         "pending" | "shipped" | "delivered";
};

type OrderItem = {
  id:          string;
  itemType:    string;
  name:        string;
  description: string | null;
  unitPrice:   number;
  quantity:    number;
  total:       number;
};

type Order = {
  id:            string;
  invoiceNumber: string;
  sourceType:    string;
  customerName:  string;
  total:         number;
  paidAmount:    number;
  status:        string;
  createdAt:     string;
  items:         OrderItem[];
  shippingLines: ShippingLine[];
};

const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  paid:                 { label: "Lunas",              cls: "bg-green-100 text-green-700" },
  waiting_verification: { label: "Menunggu Verifikasi", cls: "bg-blue-100 text-blue-700" },
  pending:              { label: "Belum Dibayar",       cls: "bg-yellow-100 text-yellow-700" },
  partial:              { label: "Terbayar Sebagian",   cls: "bg-orange-100 text-orange-700" },
  cancelled:            { label: "Dibatalkan",          cls: "bg-zinc-100 text-zinc-600" },
};

const SHIPPING_STATUS: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  pending:   { label: "Menunggu Pengiriman", icon: <Clock    size={14} />, cls: "text-yellow-600" },
  shipped:   { label: "Dalam Pengiriman",   icon: <Truck    size={14} />, cls: "text-blue-600"   },
  delivered: { label: "Sudah Diterima",     icon: <CheckCircle2 size={14} />, cls: "text-green-600" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function OrderCard({ order, slug }: { order: Order; slug: string }) {
  const payment = PAYMENT_STATUS[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" };
  const productItems = order.items.filter(it => it.itemType === "product");
  const otherItems   = order.items.filter(it => it.itemType !== "product");

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs text-muted-foreground shrink-0">{order.invoiceNumber}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">{fmtDate(order.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payment.cls}`}>
            {payment.label}
          </span>
          <Link
            href={`/${slug}/invoice/${order.id}`}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink size={12} />
            Bayar
          </Link>
        </div>
      </div>

      {/* ── Produk ── */}
      {order.items.length > 0 && (
        <div className="divide-y divide-border/60">
          {order.items.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3">
              {/* Icon tipe */}
              <div className="mt-0.5 rounded-md bg-muted/50 p-1.5 shrink-0">
                <Package size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmt(item.unitPrice)} × {item.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums shrink-0">{fmt(item.total)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Shipping ── */}
      {order.shippingLines.length > 0 && (
        <div className="border-t border-border">
          {order.shippingLines.map(sl => {
            const shSt = SHIPPING_STATUS[sl.status] ?? SHIPPING_STATUS.pending;
            return (
              <div key={sl.id} className="px-4 py-3 space-y-1.5">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${shSt.cls}`}>
                  {shSt.icon}
                  {shSt.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="uppercase font-medium">{sl.courier}</span> {sl.service}
                  {sl.etd && <span> · Est. {sl.etd}</span>}
                </div>
                {sl.trackingNumber ? (
                  <div className="rounded-md bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Nomor Resi</p>
                      <p className="font-mono text-sm font-semibold tracking-wide">{sl.trackingNumber}</p>
                    </div>
                    {sl.shippedAt && (
                      <p className="text-xs text-muted-foreground text-right shrink-0">
                        Dikirim<br />
                        {new Date(sl.shippedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Resi belum diinput oleh penjual.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer total ── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
        <span className="text-xs text-muted-foreground">Total Pesanan</span>
        <span className="text-sm font-bold tabular-nums">{fmt(order.total)}</span>
      </div>
    </div>
  );
}

export default function TransaksiPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);

  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/akun/transaksi?slug=${slug}`)
      .then(r => r.json())
      .then((res: { data?: Order[]; error?: string }) => {
        if (res.data) setOrders(res.data);
        else setError(res.error ?? "Gagal memuat data.");
      })
      .catch(() => setError("Gagal memuat data."))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Riwayat Pesanan</h1>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
        </div>
      )}

      <div className="space-y-4">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} slug={slug} />
        ))}
      </div>
    </div>
  );
}
