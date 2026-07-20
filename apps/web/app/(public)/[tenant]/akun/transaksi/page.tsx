"use client";

import { useState, useEffect, useTransition } from "react";
import { use }                 from "react";
import {
  Loader2, Package, Heart, Ticket, Truck, CheckCircle2, Clock,
  Settings2, PackageCheck, ExternalLink, MapPin, ChevronDown, ChevronUp, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { confirmDeliveryAction } from "@/app/(public)/[tenant]/actions";
import { useBaseUrl } from "@/lib/use-base-url";

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
  status:         "pending" | "processing" | "packed" | "shipped" | "delivered";
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

type TrackingManifest = { date: string; time: string; description: string; city: string };
type TrackingResult = {
  status:     "pending" | "in_transit" | "delivered" | "problem" | "unknown";
  summary:    string;
  lastUpdate: string | null;
  history:    TrackingManifest[];
};

const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  paid:                 { label: "Lunas",              cls: "bg-green-100 text-green-700" },
  waiting_verification: { label: "Menunggu Verifikasi", cls: "bg-blue-100 text-blue-700" },
  pending:              { label: "Belum Dibayar",       cls: "bg-yellow-100 text-yellow-700" },
  partial:              { label: "Terbayar Sebagian",   cls: "bg-orange-100 text-orange-700" },
  cancelled:            { label: "Dibatalkan",          cls: "bg-zinc-100 text-zinc-600" },
};

const SHIPPING_STATUS: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  pending:    { label: "Menunggu Diproses",  icon: <Clock        size={14} />, cls: "text-yellow-600" },
  processing: { label: "Sedang Disiapkan",  icon: <Settings2    size={14} />, cls: "text-indigo-600" },
  packed:     { label: "Sudah Dikemas",      icon: <PackageCheck size={14} />, cls: "text-violet-600" },
  shipped:    { label: "Dalam Pengiriman",   icon: <Truck        size={14} />, cls: "text-blue-600"   },
  delivered:  { label: "Sudah Diterima",     icon: <CheckCircle2 size={14} />, cls: "text-green-600"  },
};

const TRACK_STATUS_CLS: Record<string, string> = {
  in_transit: "text-blue-600",
  delivered:  "text-green-600",
  problem:    "text-destructive",
  pending:    "text-yellow-600",
  unknown:    "text-muted-foreground",
};

function fmt(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// ── Tracking panel ────────────────────────────────────────────────────────────
function TrackingPanel({ slug, trackingNumber, courier }: { slug: string; trackingNumber: string; courier: string }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<TrackingResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function load() {
    if (result) { setOpen(o => !o); return; }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/ongkir/track?waybill=${encodeURIComponent(trackingNumber)}&courier=${encodeURIComponent(courier)}&slug=${slug}`);
      const data = await res.json() as TrackingResult | { error: string };
      if ("error" in data) { setError(data.error); }
      else { setResult(data); }
    } catch {
      setError("Gagal menghubungi layanan pelacakan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={load}
        className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
      >
        <MapPin size={12} />
        Lacak Kiriman
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Memuat data pelacakan...
            </div>
          )}
          {error && <p className="text-destructive">{error}</p>}
          {result && !loading && (
            <>
              <p className={`font-medium ${TRACK_STATUS_CLS[result.status] ?? "text-foreground"}`}>
                {result.summary}
              </p>
              {result.history.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {result.history.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0 w-24">{h.date} {h.time}</span>
                      <div className="flex-1">
                        <span>{h.description}</span>
                        {h.city && <span className="text-muted-foreground ml-1">— {h.city}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Belum ada riwayat pengiriman.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shipping line section ─────────────────────────────────────────────────────
function ShippingSection({
  slug,
  invoiceId,
  shippingLines,
  onDelivered,
}: {
  slug:         string;
  invoiceId:    string;
  shippingLines: ShippingLine[];
  onDelivered:  (slId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function handleConfirm(slId: string) {
    setConfirmingId(slId);
    startTransition(async () => {
      const res = await confirmDeliveryAction(slug, invoiceId, slId);
      if (res.success) onDelivered(slId);
      setConfirmingId(null);
    });
  }

  return (
    <div className="border-t border-border">
      {shippingLines.map(sl => {
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
              <>
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

                {/* Lacak kiriman */}
                <TrackingPanel slug={slug} trackingNumber={sl.trackingNumber} courier={sl.courier} />

                {/* Tombol konfirmasi terima */}
                {sl.status === "shipped" && (
                  <button
                    onClick={() => handleConfirm(sl.id)}
                    disabled={pending && confirmingId === sl.id}
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {pending && confirmingId === sl.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    Konfirmasi Sudah Diterima
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">Resi belum diinput oleh penjual.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ order, slug }: { order: Order; slug: string }) {
  const payment = PAYMENT_STATUS[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" };

  // Local state untuk optimistic update shipping status
  const [shippingLines, setShippingLines] = useState(order.shippingLines);

  function handleDelivered(slId: string) {
    setShippingLines(prev => prev.map(sl =>
      sl.id === slId ? { ...sl, status: "delivered" as const } : sl
    ));
  }

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
            Detail
          </Link>
        </div>
      </div>

      {/* ── Items ── */}
      {order.items.length > 0 && (
        <div className="divide-y divide-border/60">
          {order.items.map(item => {
            const isDonation = item.itemType === "donation";
            const isTicket   = item.itemType === "ticket";
            return (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-0.5 rounded-md p-1.5 shrink-0 ${isDonation ? "bg-pink-50" : isTicket ? "bg-violet-50" : "bg-muted/50"}`}>
                  {isDonation ? (
                    <Heart size={16} className="text-pink-500" />
                  ) : isTicket ? (
                    <Ticket size={16} className="text-violet-500" />
                  ) : (
                    <Package size={16} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                  {!isDonation && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmt(item.unitPrice)} × {item.quantity}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0">{fmt(item.total)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Shipping ── */}
      {shippingLines.length > 0 && (
        <ShippingSection
          slug={slug}
          invoiceId={order.id}
          shippingLines={shippingLines}
          onDelivered={handleDelivered}
        />
      )}

      {/* ── Footer total ── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
        <span className="text-xs text-muted-foreground">Total Pesanan</span>
        <span className="text-sm font-bold tabular-nums">{fmt(order.total)}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TransaksiPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);
  const baseUrl = useBaseUrl(slug);

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

      <a href={`${baseUrl}/akun`}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
        <ArrowLeft className="size-4" />
        Kembali ke Dashboard
      </a>
    </div>
  );
}
