"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmInvoicePaymentAction,
  cancelInvoiceAction,
  type InvoiceDetail,
} from "@/app/(dashboard)/[tenant]/finance/billing/actions";

type Props = {
  slug:    string;
  invoice: InvoiceDetail;
};

const STATUS_BADGE: Record<string, string> = {
  draft:                "bg-muted text-muted-foreground",
  pending:              "bg-yellow-100 text-yellow-700",
  waiting_verification: "bg-blue-100 text-blue-700",
  partial:              "bg-orange-100 text-orange-700",
  paid:                 "bg-green-100 text-green-700",
  cancelled:            "bg-red-100 text-red-700",
  overdue:              "bg-red-200 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  draft:                "Draft",
  pending:              "Menunggu Bayar",
  waiting_verification: "Menunggu Verifikasi",
  partial:              "Terbayar Sebagian",
  paid:                 "Lunas",
  cancelled:            "Dibatalkan",
  overdue:              "Jatuh Tempo",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai", transfer: "Transfer", qris: "QRIS",
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export function InvoiceDetailClient({ slug, invoice }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error,   setError]        = useState("");
  const [success, setSuccess]      = useState("");

  // Payment form state
  const [showPayForm, setShowPayForm]   = useState(false);
  const [payAmount,   setPayAmount]     = useState(String(Math.round(invoice.remaining)));
  const [payMethod,   setPayMethod]     = useState<"cash" | "transfer" | "qris">("cash");
  const [payBank,     setPayBank]       = useState("");
  const [payDate,     setPayDate]       = useState("");
  const [payNotes,    setPayNotes]      = useState("");

  // Cancel state
  const [showCancel,  setShowCancel]    = useState(false);
  const [cancelNote,  setCancelNote]    = useState("");

  const canPay    = !["paid", "cancelled"].includes(invoice.status) && invoice.remaining > 0;
  const canCancel = !["paid", "cancelled"].includes(invoice.status);

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    startTransition(async () => {
      const res = await confirmInvoicePaymentAction(slug, invoice.id, {
        amount:       parseFloat(payAmount.replace(/\D/g, "")) || 0,
        method:       payMethod,
        payerBank:    payBank.trim() || undefined,
        transferDate: payDate || undefined,
        notes:        payNotes.trim() || undefined,
      });
      if (res.success) {
        setSuccess("Pembayaran berhasil dicatat.");
        setShowPayForm(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await cancelInvoiceAction(slug, invoice.id, cancelNote);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "block text-sm font-medium mb-1";

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold font-mono">{invoice.invoiceNumber}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[invoice.status] ?? ""}`}>
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Dibuat {formatDate(invoice.createdAt)}</p>
        </div>
      </div>

      {success && <p className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{success}</p>}
      {error   && <p className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-destructive">{error}</p>}

      {/* ── Customer info ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border p-4 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
        <p className="font-medium">{invoice.customerName}</p>
        {invoice.customerPhone && <p className="text-sm text-muted-foreground">{invoice.customerPhone}</p>}
        {invoice.customerEmail && <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>}
        {invoice.dueDate && (
          <p className="text-sm">
            <span className="text-muted-foreground">Jatuh tempo: </span>
            {formatDate(invoice.dueDate + "T00:00:00")}
          </p>
        )}
      </div>

      {/* ── Items ───────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Item</th>
              <th className="text-center px-4 py-2.5 font-medium">Qty</th>
              <th className="text-right px-4 py-2.5 font-medium">Harga</th>
              <th className="text-right px-4 py-2.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{item.name}</p>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{item.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRp(item.unitPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatRp(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/20 text-sm">
            {invoice.discount > 0 && (
              <>
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRp(invoice.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Diskon</td>
                  <td className="px-4 py-2 text-right tabular-nums text-green-600">- {formatRp(invoice.discount)}</td>
                </tr>
              </>
            )}
            <tr className="font-semibold">
              <td colSpan={3} className="px-4 py-3 text-right">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatRp(invoice.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Ringkasan pembayaran ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Tagihan</span>
          <span className="tabular-nums font-medium">{formatRp(invoice.total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Terbayar</span>
          <span className="tabular-nums text-green-600">{formatRp(invoice.paidAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-border pt-2">
          <span>Sisa Tagihan</span>
          <span className={`tabular-nums ${invoice.remaining > 0 ? "text-destructive" : "text-green-600"}`}>
            {formatRp(invoice.remaining)}
          </span>
        </div>
      </div>

      {/* ── Riwayat pembayaran ──────────────────────────────────────────── */}
      {invoice.payments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-xs">Riwayat Pembayaran</p>
          <div className="rounded-lg border border-border divide-y divide-border">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{formatRp(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{METHOD_LABELS[p.method] ?? p.method} · {formatDate(p.createdAt)}</p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Dikonfirmasi</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Catatan ─────────────────────────────────────────────────────── */}
      {invoice.notes && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Catatan</p>
          <p className="text-sm">{invoice.notes}</p>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      {(canPay || canCancel) && (
        <div className="flex gap-3 pt-2">
          {canPay && (
            <button
              type="button"
              onClick={() => setShowPayForm((v) => !v)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {showPayForm ? "Tutup Form" : "Konfirmasi Pembayaran"}
            </button>
          )}
          {canCancel && !showPayForm && (
            <button
              type="button"
              onClick={() => setShowCancel((v) => !v)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
            >
              {showCancel ? "Batal" : "Batalkan Invoice"}
            </button>
          )}
        </div>
      )}

      {/* ── Form konfirmasi pembayaran ──────────────────────────────────── */}
      {showPayForm && canPay && (
        <form onSubmit={handlePay} className="rounded-lg border border-border p-4 space-y-4">
          <p className="text-sm font-semibold">Konfirmasi Pembayaran</p>

          <div>
            <label className={labelCls}>Jumlah Diterima <span className="text-destructive">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sisa tagihan: {formatRp(invoice.remaining)}</p>
          </div>

          <div>
            <label className={labelCls}>Metode</label>
            <div className="flex gap-2">
              {(["cash", "transfer", "qris"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayMethod(m)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    payMethod === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {payMethod === "transfer" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bank Pengirim</label>
                <input type="text" value={payBank} onChange={(e) => setPayBank(e.target.value)} placeholder="BCA, BRI..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tanggal Transfer</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Catatan</label>
            <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opsional" className={inputCls} />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Menyimpan..." : "Konfirmasi"}
          </button>
        </form>
      )}

      {/* ── Form batalkan invoice ──────────────────────────────────────── */}
      {showCancel && canCancel && (
        <form onSubmit={handleCancel} className="rounded-lg border border-destructive/30 bg-red-50/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-destructive">Batalkan Invoice</p>
          <div>
            <label className={labelCls}>Alasan Pembatalan</label>
            <input
              type="text"
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder="Tulis alasan..."
              className={inputCls}
              required
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            {pending ? "Memproses..." : "Ya, Batalkan Invoice"}
          </button>
        </form>
      )}
    </div>
  );
}
