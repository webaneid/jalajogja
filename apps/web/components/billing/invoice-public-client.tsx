"use client";

import { useState, useTransition } from "react";
import { submitPaymentProofAction } from "@/app/(public)/[tenant]/cart/actions";

export type PublicInvoiceData = {
  id:             string;
  invoiceNumber:  string;
  status:         string;
  customerName:   string;
  customerPhone:  string | null;
  customerEmail:  string | null;
  subtotal:       number;
  discount:       number;
  total:          number;
  paidAmount:     number;
  remaining:      number;
  dueDate:        string | null;
  notes:          string | null;
  createdAt:      string;
  items: Array<{
    id:          string;
    name:        string;
    description: string | null;
    unitPrice:   number;
    quantity:    number;
    total:       number;
  }>;
  bankAccounts: Array<{
    bankName:      string;
    accountNumber: string;
    accountName:   string;
  }>;
};

type Props = {
  slug:    string;
  invoice: PublicInvoiceData;
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
  pending:              "Menunggu Pembayaran",
  waiting_verification: "Menunggu Verifikasi",
  partial:              "Terbayar Sebagian",
  paid:                 "Lunas",
  cancelled:            "Dibatalkan",
  overdue:              "Jatuh Tempo",
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const labelCls = "block text-sm font-medium mb-1";

export function InvoicePublicClient({ slug, invoice }: Props) {
  const [pending, startTransition] = useTransition();
  const [error,   setError]        = useState("");
  const [success, setSuccess]      = useState("");

  const [showPayForm,  setShowPayForm]  = useState(false);
  const [payerName,    setPayerName]    = useState(invoice.customerName);
  const [payMethod,    setPayMethod]    = useState<"cash" | "transfer" | "qris">("transfer");
  const [payerBank,    setPayerBank]    = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [payNotes,     setPayNotes]     = useState("");

  const canPay = ["pending", "partial", "overdue"].includes(invoice.status);

  function handleSubmitProof(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await submitPaymentProofAction(slug, invoice.id, {
        method:       payMethod,
        payerName:    payerName,
        payerBank:    payerBank.trim() || undefined,
        transferDate: transferDate || undefined,
        notes:        payNotes.trim() || undefined,
      });
      if (res.success) {
        setSuccess("Konfirmasi pembayaran berhasil dikirim. Admin akan memverifikasi dalam 1×24 jam.");
        setShowPayForm(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Header ── */}
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

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Info customer ── */}
      <div className="rounded-lg border border-border p-4 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pemesan</p>
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

      {/* ── Items ── */}
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

      {/* ── Ringkasan pembayaran ── */}
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

      {/* ── Instruksi pembayaran ── */}
      {canPay && invoice.bankAccounts.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">Cara Pembayaran</p>
          <p className="text-sm text-muted-foreground">Transfer ke salah satu rekening berikut:</p>
          <div className="space-y-2">
            {invoice.bankAccounts.map((acc, i) => (
              <div key={i} className="rounded-md bg-muted/30 p-3 text-sm">
                <p className="font-medium">{acc.bankName}</p>
                <p className="font-mono text-base">{acc.accountNumber}</p>
                <p className="text-muted-foreground">a.n. {acc.accountName}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Setelah transfer, klik tombol &quot;Konfirmasi Pembayaran&quot; di bawah untuk memberitahu kami.
          </p>
        </div>
      )}

      {/* ── Catatan ── */}
      {invoice.notes && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Catatan</p>
          <p className="text-sm">{invoice.notes}</p>
        </div>
      )}

      {/* ── Tombol konfirmasi ── */}
      {canPay && (
        <div>
          <button
            type="button"
            onClick={() => setShowPayForm((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {showPayForm ? "Tutup" : "Konfirmasi Pembayaran"}
          </button>
        </div>
      )}

      {/* ── Form konfirmasi ── */}
      {showPayForm && canPay && (
        <form onSubmit={handleSubmitProof} className="rounded-lg border border-border p-4 space-y-4">
          <p className="text-sm font-semibold">Konfirmasi Pembayaran</p>

          <div>
            <label className={labelCls}>Nama Pengirim</label>
            <input
              type="text"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className={labelCls}>Metode</label>
            <div className="flex gap-2 flex-wrap">
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
                  {m === "cash" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}
                </button>
              ))}
            </div>
          </div>

          {payMethod === "transfer" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bank Pengirim</label>
                <input
                  type="text"
                  value={payerBank}
                  onChange={(e) => setPayerBank(e.target.value)}
                  placeholder="BCA, BRI..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Tanggal Transfer</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Catatan <span className="text-muted-foreground text-xs">(opsional)</span></label>
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="Referensi atau catatan transfer"
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Mengirim..." : "Kirim Konfirmasi"}
          </button>
        </form>
      )}

      {/* ── Status final ── */}
      {invoice.status === "paid" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="font-semibold text-green-700">Invoice ini sudah lunas.</p>
          <p className="text-sm text-green-600 mt-1">Terima kasih atas pembayaran Anda.</p>
        </div>
      )}
      {invoice.status === "cancelled" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="font-semibold text-destructive">Invoice ini telah dibatalkan.</p>
        </div>
      )}
      {invoice.status === "waiting_verification" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="font-semibold text-blue-700">Pembayaran sedang diverifikasi.</p>
          <p className="text-sm text-blue-600 mt-1">Admin akan mengkonfirmasi dalam 1×24 jam.</p>
        </div>
      )}
    </div>
  );
}
