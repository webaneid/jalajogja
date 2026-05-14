"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  confirmInvoicePaymentAction,
  cancelInvoiceAction,
  verifySubmittedPaymentAction,
  updateAdminShippingTrackingAction,
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

  // Verifikasi payment submitted
  const [verifyingId, setVerifyingId]   = useState<string | null>(null);

  // Lightbox
  const [lightboxSrc, setLightboxSrc]  = useState<string | null>(null);

  // Shipping tracking
  const [resiInputs,  setResiInputs]   = useState<Record<string, string>>({});
  const [savingResi,  setSavingResi]   = useState<string | null>(null);

  function handleVerify(paymentId: string) {
    if (!confirm("Verifikasi bahwa pembayaran ini sudah diterima?")) return;
    setError("");
    setSuccess("");
    setVerifyingId(paymentId);
    startTransition(async () => {
      const res = await verifySubmittedPaymentAction(slug, paymentId);
      if (res.success) {
        setSuccess("Pembayaran berhasil diverifikasi.");
        router.refresh();
      } else {
        setError(res.error);
      }
      setVerifyingId(null);
    });
  }

  function handleSaveResi(lineId: string) {
    const resi = (resiInputs[lineId] ?? "").trim();
    setSavingResi(lineId);
    startTransition(async () => {
      const res = await updateAdminShippingTrackingAction(slug, lineId, resi);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error);
      }
      setSavingResi(null);
    });
  }

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
              <div key={p.id} className="px-4 py-3 text-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{formatRp(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABELS[p.method] ?? p.method}
                      {p.payerBank && ` · ${p.payerBank}`}
                      {p.payerName && ` · a.n. ${p.payerName}`}
                      {" · "}{formatDate(p.createdAt)}
                    </p>
                    {p.payerNote && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">{p.payerNote}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status === "submitted" && (
                      <button
                        type="button"
                        onClick={() => handleVerify(p.id)}
                        disabled={pending || verifyingId === p.id}
                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        {verifyingId === p.id ? "Memverifikasi..." : "✓ Verifikasi"}
                      </button>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "paid"      ? "bg-green-100 text-green-700" :
                      p.status === "submitted" ? "bg-blue-100 text-blue-700" :
                      p.status === "rejected"  ? "bg-red-100 text-red-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {p.status === "paid"      ? "Dikonfirmasi" :
                       p.status === "submitted" ? "Menunggu Verifikasi" :
                       p.status === "rejected"  ? "Ditolak" : p.status}
                    </span>
                  </div>
                </div>
                {p.proofUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(p.proofUrl)}
                    className="block text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.proofUrl}
                      alt="Bukti transfer"
                      className="max-h-48 rounded-md border border-border object-contain bg-muted/20 hover:opacity-90 transition-opacity cursor-zoom-in"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Klik untuk perbesar</p>
                  </button>
                )}
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

      {/* ── Kelola Pengiriman (tenant lines only) ─────────────────────── */}
      {invoice.shippingLines.filter(sl => sl.sellerType === "tenant").length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kelola Pengiriman</p>
          <div className="rounded-lg border border-border divide-y divide-border">
            {invoice.shippingLines.filter(sl => sl.sellerType === "tenant").map((sl) => (
              <div key={sl.id} className="px-4 py-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium uppercase">{sl.courier} {sl.service}</p>
                    <p className="text-xs text-muted-foreground">
                      {sl.sellerName}
                      {sl.etd && ` · Est. ${sl.etd}`}
                      {" · "}Rp {sl.cost.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    sl.status === "shipped"   ? "bg-blue-100 text-blue-700" :
                    sl.status === "delivered" ? "bg-green-100 text-green-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {sl.status === "shipped" ? "Dikirim" : sl.status === "delivered" ? "Terkirim" : "Menunggu"}
                  </span>
                </div>
                {sl.trackingNumber && (
                  <p className="text-xs">
                    Resi: <span className="font-mono font-medium">{sl.trackingNumber}</span>
                    {sl.shippedAt && (
                      <span className="ml-2 text-muted-foreground">
                        · Dikirim {new Date(sl.shippedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resiInputs[sl.id] ?? (sl.trackingNumber ?? "")}
                    onChange={(e) => setResiInputs(prev => ({ ...prev, [sl.id]: e.target.value }))}
                    placeholder="Nomor resi pengiriman"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveResi(sl.id)}
                    disabled={pending || savingResi === sl.id}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {savingResi === sl.id ? "Menyimpan..." : "Simpan Resi"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Bukti transfer"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
