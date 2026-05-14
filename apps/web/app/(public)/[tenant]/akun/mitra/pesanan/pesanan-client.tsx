"use client";

import { useState, useTransition } from "react";
import { Package, Truck, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { updateShippingTrackingAction } from "./actions";

export type MitraOrderItem = {
  name:      string;
  quantity:  number;
  unitPrice: number;
};

export type MitraShippingLine = {
  id:             string;
  courier:        string;
  service:        string;
  etd:            string | null;
  weightGram:     number;
  cost:           number;
  trackingNumber: string | null;
  shippedAt:      string | null;
  status:         "pending" | "shipped" | "delivered";
};

export type MitraOrder = {
  invoiceId:        string;
  invoiceNumber:    string;
  customerName:     string;
  shippingCityName: string | null;
  shippingAddress:  string | null;
  invoiceStatus:    string;
  invoiceTotal:     number;
  createdAt:        string;
  items:            MitraOrderItem[];
  shipping:         MitraShippingLine | null;
};

type Props = {
  slug:   string;
  orders: MitraOrder[];
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(s: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(s));
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  pending:               "Menunggu Bayar",
  waiting_verification:  "Perlu Konfirmasi",
  partial:               "Bayar Sebagian",
  paid:                  "Lunas",
  cancelled:             "Dibatalkan",
  overdue:               "Lewat Jatuh Tempo",
};

const SHIPPING_STATUS_LABEL: Record<string, string> = {
  pending:   "Belum Dikirim",
  shipped:   "Dalam Pengiriman",
  delivered: "Terkirim",
};

const SHIPPING_STATUS_COLOR: Record<string, string> = {
  pending:   "text-yellow-600 bg-yellow-50",
  shipped:   "text-blue-600 bg-blue-50",
  delivered: "text-green-600 bg-green-50",
};

function ResiForm({ slug, line }: { slug: string; line: MitraShippingLine }) {
  const [pending, startTransition] = useTransition();
  const [resi,    setResi]         = useState(line.trackingNumber ?? "");
  const [saved,   setSaved]        = useState(false);
  const [error,   setError]        = useState("");

  function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await updateShippingTrackingAction(slug, line.id, resi);
      if ("success" in res) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(res.error);
      }
    });
  }

  if (line.status === "delivered") {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Resi: {line.trackingNumber ?? "—"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">
        Nomor Resi / Tracking
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={resi}
          onChange={(e) => setResi(e.target.value)}
          placeholder="Masukkan nomor resi..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {pending ? "Menyimpan…" : saved ? "✓ Tersimpan" : "Simpan"}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {line.trackingNumber && (
        <p className="text-xs text-muted-foreground">
          Terakhir disimpan: {line.trackingNumber}
          {line.shippedAt && ` · ${formatDate(line.shippedAt)}`}
        </p>
      )}
    </div>
  );
}

export function MitraPesananClient({ slug, orders }: Props) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-10 text-center space-y-2">
        <Package className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="font-medium">Belum ada pesanan masuk</p>
        <p className="text-sm text-muted-foreground">
          Pesanan yang mengandung produk Anda akan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map(order => (
        <div key={order.invoiceId} className="rounded-xl border border-border bg-card p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">{order.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(order.createdAt)} · {order.customerName}
              </p>
            </div>
            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              order.invoiceStatus === "paid" ? "bg-green-100 text-green-700" :
              order.invoiceStatus === "waiting_verification" ? "bg-yellow-100 text-yellow-700" :
              "bg-muted text-muted-foreground"
            }`}>
              {INVOICE_STATUS_LABEL[order.invoiceStatus] ?? order.invoiceStatus}
            </span>
          </div>

          {/* Items mitra */}
          <div className="divide-y divide-border text-sm">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between py-1.5">
                <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                <span className="tabular-nums">{formatRp(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Pengiriman */}
          {order.shipping ? (
            <div className="rounded-lg bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium uppercase">
                    {order.shipping.courier} {order.shipping.service}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  SHIPPING_STATUS_COLOR[order.shipping.status] ?? "bg-muted text-muted-foreground"
                }`}>
                  {SHIPPING_STATUS_LABEL[order.shipping.status]}
                </span>
              </div>

              {order.shippingCityName && (
                <p className="text-xs text-muted-foreground">
                  Tujuan: {order.shippingCityName}
                  {order.shippingAddress && ` — ${order.shippingAddress}`}
                </p>
              )}

              <div className="text-xs text-muted-foreground">
                Berat: {order.shipping.weightGram}g · Ongkir: {formatRp(order.shipping.cost)}
                {order.shipping.etd && ` · Est. ${order.shipping.etd}`}
              </div>

              {/* Resi input — hanya jika invoice sudah paid atau waiting_verification */}
              {(order.invoiceStatus === "paid" || order.invoiceStatus === "waiting_verification") && (
                <ResiForm slug={slug} line={order.shipping} />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Menunggu konfirmasi pembayaran sebelum pengiriman
            </div>
          )}

          {/* Link ke invoice */}
          <a
            href={`/${slug}/invoice/${order.invoiceId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            Lihat Invoice
          </a>
        </div>
      ))}
    </div>
  );
}
