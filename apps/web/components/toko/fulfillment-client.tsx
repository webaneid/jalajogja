"use client";

import { useState, useTransition } from "react";
import {
  Clock, Settings2, PackageCheck, Truck, CheckCircle2,
  ChevronRight, Loader2,
} from "lucide-react";
import {
  updateFulfillmentStatusAction,
  updateAdminShippingTrackingAction,
} from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FulfillmentShippingLine = {
  id:             string;
  sellerType:     "tenant" | "mitra";
  sellerName:     string;
  courier:        string;
  service:        string;
  etd:            string | null;
  cost:           number;
  trackingNumber: string | null;
  shippedAt:      string | null;
  status:         "pending" | "processing" | "packed" | "shipped" | "delivered";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: {
  key: FulfillmentShippingLine["status"];
  label: string;
  sublabel: string;
  icon: React.ElementType;
}[] = [
  { key: "pending",    label: "Menunggu",        sublabel: "Belum diproses",    icon: Clock },
  { key: "processing", label: "Diproses",        sublabel: "Sedang disiapkan",  icon: Settings2 },
  { key: "packed",     label: "Dikemas",          sublabel: "Siap dikirim",      icon: PackageCheck },
  { key: "shipped",    label: "Dikirim",          sublabel: "Dalam pengiriman",  icon: Truck },
  { key: "delivered",  label: "Diterima",         sublabel: "Selesai",           icon: CheckCircle2 },
];

const STATUS_IDX: Record<string, number> = {
  pending: 0, processing: 1, packed: 2, shipped: 3, delivered: 4,
};

function fmt(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

// ─── FulfillmentTimeline ──────────────────────────────────────────────────────

function FulfillmentTimeline({ status }: { status: FulfillmentShippingLine["status"] }) {
  const current = STATUS_IDX[status] ?? 0;
  return (
    <div className="flex items-start gap-0 w-full">
      {STAGES.map((stage, i) => {
        const done    = i < current;
        const active  = i === current;
        const pending = i > current;
        const Icon = stage.icon;
        return (
          <div key={stage.key} className="flex-1 flex flex-col items-center gap-1 relative">
            {/* Connector line sebelum icon */}
            {i > 0 && (
              <div
                className={`absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2 transition-colors ${
                  done ? "bg-green-500" : "bg-border"
                }`}
              />
            )}
            {/* Icon */}
            <div
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                done    ? "bg-green-500 border-green-500 text-white" :
                active  ? "bg-primary border-primary text-primary-foreground" :
                          "bg-background border-border text-muted-foreground"
              }`}
            >
              <Icon size={14} />
            </div>
            {/* Label */}
            <p className={`text-xs font-medium text-center leading-tight ${
              done ? "text-green-600" : active ? "text-primary" : "text-muted-foreground"
            }`}>
              {stage.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── FulfillmentActions ───────────────────────────────────────────────────────

function FulfillmentActions({
  slug,
  line,
  invoicePaid,
}: {
  slug:        string;
  line:        FulfillmentShippingLine;
  invoicePaid: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [resi,      setResi]         = useState(line.trackingNumber ?? "");
  const [error,     setError]        = useState<string | null>(null);

  const statusIdx = STATUS_IDX[line.status] ?? 0;

  function act(newStatus: "processing" | "packed" | "shipped" | "delivered", resiInput?: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateFulfillmentStatusAction(slug, line.id, newStatus, resiInput);
      if (!res.success) setError(res.error);
    });
  }

  // Mitra shipping — read-only
  if (line.sellerType === "mitra") {
    return (
      <p className="text-xs text-muted-foreground italic">
        Pengiriman ini dikelola oleh Mitra. Admin mitra dapat input resi dari dashboard mereka.
      </p>
    );
  }

  // Invoice belum lunas
  if (!invoicePaid) {
    return (
      <p className="text-xs text-yellow-600">
        Tunggu pembayaran lunas sebelum memproses pesanan.
      </p>
    );
  }

  // Sudah selesai
  if (line.status === "delivered") {
    return (
      <p className="text-sm text-green-600 font-medium">✓ Pesanan selesai diterima pelanggan.</p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Stage: pending → processing */}
      {statusIdx === 0 && (
        <button
          onClick={() => act("processing")}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />}
          Proses Pesanan
        </button>
      )}

      {/* Stage: processing → packed */}
      {statusIdx === 1 && (
        <button
          onClick={() => act("packed")}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
          Selesai Packing
        </button>
      )}

      {/* Stage: packed → shipped (butuh resi) */}
      {statusIdx === 2 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Nomor Resi / AWB</label>
          <div className="flex gap-2">
            <input
              value={resi}
              onChange={(e) => setResi(e.target.value)}
              placeholder={`Masukkan resi ${line.courier.toUpperCase()}`}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
            <button
              onClick={() => act("shipped", resi)}
              disabled={isPending || !resi.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              Kirim
            </button>
          </div>
        </div>
      )}

      {/* Stage: shipped → delivered */}
      {statusIdx === 3 && (
        <div className="space-y-2">
          {/* Resi edit setelah shipped */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Resi pengiriman</label>
            <div className="flex gap-2">
              <input
                value={resi}
                onChange={(e) => setResi(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <ResiSaveButton slug={slug} lineId={line.id} resi={resi} />
            </div>
          </div>
          <button
            onClick={() => act("delivered")}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Konfirmasi Diterima
          </button>
        </div>
      )}
    </div>
  );
}

// Tombol simpan resi terpisah (tidak trigger fulfillment stage)
function ResiSaveButton({ slug, lineId, resi }: { slug: string; lineId: string; resi: string }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <button
      onClick={() => {
        setSaved(false);
        startTransition(async () => {
          await updateAdminShippingTrackingAction(slug, lineId, resi);
          setSaved(true);
        });
      }}
      disabled={isPending}
      className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50 transition-colors"
    >
      {isPending ? "..." : saved ? "✓" : "Simpan"}
    </button>
  );
}

// ─── FulfillmentCard — satu kartu per shipping line ──────────────────────────

export function FulfillmentCard({
  slug,
  line,
  invoicePaid,
}: {
  slug:        string;
  line:        FulfillmentShippingLine;
  invoicePaid: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header kurir */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{line.sellerName}</p>
          <p className="text-sm font-semibold uppercase">
            {line.courier} <span className="font-normal text-muted-foreground">{line.service}</span>
          </p>
          {line.etd && <p className="text-xs text-muted-foreground">Est. {line.etd}</p>}
        </div>
        <p className="text-sm font-medium shrink-0">{fmt(line.cost)}</p>
      </div>

      {/* Timeline */}
      <div className="px-4 pt-5 pb-3">
        <FulfillmentTimeline status={line.status} />
      </div>

      {/* Resi (jika sudah ada) */}
      {line.trackingNumber && (
        <div className="mx-4 mb-3 rounded-lg bg-muted/40 px-3 py-2 flex items-center gap-3">
          <Truck size={14} className="text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Nomor Resi</p>
            <p className="font-mono text-sm font-semibold">{line.trackingNumber}</p>
          </div>
          {line.shippedAt && (
            <p className="ml-auto text-xs text-muted-foreground text-right shrink-0">
              Dikirim<br />
              {new Date(line.shippedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </p>
          )}
        </div>
      )}

      {/* Aksi */}
      <div className="px-4 pb-4">
        <FulfillmentActions slug={slug} line={line} invoicePaid={invoicePaid} />
      </div>
    </div>
  );
}
