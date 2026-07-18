"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, ImagePlus, X, Loader2 } from "lucide-react";
import { submitPaymentProofAction } from "@/app/(public)/[tenant]/cart/actions";
import { compressImage } from "@/lib/client-image-compress";
import { parseTicketAttendee, humanizeFieldKey, formatFieldValue } from "@/lib/event-custom-form";

export type BankAccountPublic = {
  id:            string;
  bankName:      string;
  accountNumber: string;
  accountName:   string;
  categories:    string[];
};

export type QrisAccountPublic = {
  id:         string;
  name:       string;
  imageUrl:   string;
  isDynamic:  boolean;
  hasEmv:     boolean;
  categories: string[];
};

export type PublicShippingLine = {
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

export type PublicInvoiceData = {
  id:               string;
  invoiceNumber:    string;
  status:           string;
  customerName:     string;
  customerPhone:    string | null;
  customerEmail:    string | null;
  subtotal:         number;
  shippingTotal:    number;
  discount:         number;
  total:            number;
  uniqueCode:       number;
  amountDue:        number;
  paidAmount:       number;
  remaining:        number;
  dueDate:          string | null;
  notes:            string | null;
  createdAt:        string;
  shippingCityName: string | null;
  shippingAddress:  string | null;
  submittedProofUrl:    string | null;
  rejectedPaymentNote:  string | null;
  items: Array<{
    id:          string;
    itemType:    string;
    name:        string;
    description: string | null;
    unitPrice:   number;
    quantity:    number;
    total:       number;
  }>;
  shippingLines:  PublicShippingLine[];
  bankAccounts:   BankAccountPublic[];
  qrisAccounts:   QrisAccountPublic[];
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

// timeZone eksplisit WAJIB — komponen ini "use client", di-SSR di server (bisa TZ UTC/beda)
// lalu di-hydrate di browser (TZ lokal visitor). Tanpa timeZone eksplisit, toLocaleDateString()
// bisa hasilkan tanggal beda antara server-render dan client-hydration → React error #418
// (hydration text mismatch). Semua tanggal invoice diinterpretasikan sebagai WIB, konsisten
// dengan lokasi organisasi — bukan mengikuti timezone visitor.
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  });
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const labelCls = "block text-sm font-medium mb-1";

// ─── CopyButton ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title="Salin"
    >
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
    </button>
  );
}

// ─── QrisDisplay ─────────────────────────────────────────────────────────────
function QrisDisplay({
  slug,
  qris,
  amount,
  invoiceNumber,
}: {
  slug:          string;
  qris:          QrisAccountPublic;
  amount:        number;
  invoiceNumber: string;
}) {
  const [qrSrc,    setQrSrc]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [isStatic, setIsStatic] = useState(false);

  const loadQr = useCallback(async () => {
    if (qris.isDynamic && qris.hasEmv) {
      setLoading(true);
      try {
        const res  = await fetch(
          `/api/qris?slug=${slug}&qrisId=${qris.id}&amount=${Math.round(amount)}&ref=${encodeURIComponent(invoiceNumber)}`,
        );
        const data = await res.json() as { type: string; qrDataUrl?: string; imageUrl?: string };
        if (data.type === "dynamic" && data.qrDataUrl) {
          setQrSrc(data.qrDataUrl);
          setIsStatic(false);
        } else if (data.imageUrl) {
          setQrSrc(data.imageUrl);
          setIsStatic(true);
        }
      } catch { /* abaikan */ }
      setLoading(false);
    } else {
      setQrSrc(qris.imageUrl);
      setIsStatic(true);
    }
  }, [slug, qris, amount, invoiceNumber]);

  useEffect(() => { void loadQr(); }, [loadQr]);

  function handleDownload() {
    if (!qrSrc) return;
    const a = document.createElement("a");
    a.href     = qrSrc;
    a.download = `QRIS-${invoiceNumber}.png`;
    a.click();
  }

  return (
    <div className="space-y-3">
      <div className="font-medium text-sm">{qris.name}</div>
      {loading ? (
        <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
          Memuat QR Code...
        </div>
      ) : qrSrc ? (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="QRIS"
            className="w-56 h-56 object-contain rounded-md border border-border"
          />
          {!isStatic && (
            <p className="text-xs text-green-600 text-center">
              ✓ Nominal terkunci: {formatRp(amount)}
            </p>
          )}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download size={14} />
            Unduh QR
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">QR tidak tersedia</p>
      )}
    </div>
  );
}

// ─── PaymentMethodCard ────────────────────────────────────────────────────────
function PaymentMethodCard({
  slug,
  invoice,
}: {
  slug:    string;
  invoice: PublicInvoiceData;
}) {
  const hasBanks = invoice.bankAccounts.length > 0;
  const hasQris  = invoice.qrisAccounts.length  > 0;
  const [activeQris, setActiveQris] = useState(0);

  if (!hasBanks && !hasQris) return null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">

      {/* ── QRIS ── */}
      {hasQris && (
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bayar via QRIS</p>
          {invoice.qrisAccounts.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {invoice.qrisAccounts.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setActiveQris(i)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                    activeQris === i
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {q.name}
                </button>
              ))}
            </div>
          )}
          <QrisDisplay
            key={invoice.qrisAccounts[activeQris]?.id}
            slug={slug}
            qris={invoice.qrisAccounts[activeQris]!}
            amount={invoice.remaining}
            invoiceNumber={invoice.invoiceNumber}
          />
          <p className="text-xs text-muted-foreground">
            Setelah scan dan bayar, klik &quot;Konfirmasi Pembayaran&quot; di bawah.
          </p>
        </div>
      )}

      {/* ── Divider ── */}
      {hasQris && hasBanks && (
        <div className="border-t border-border" />
      )}

      {/* ── Transfer Bank ── */}
      {hasBanks && (
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transfer Bank</p>
          <div className="space-y-2">
            {invoice.bankAccounts.map((acc) => (
              <div key={acc.id} className="rounded-md bg-muted/30 p-3 text-sm">
                <p className="font-medium text-muted-foreground text-xs mb-0.5">{acc.bankName}</p>
                <div className="flex items-center">
                  <span className="font-mono text-base font-semibold">{acc.accountNumber}</span>
                  <CopyButton text={acc.accountNumber} />
                </div>
                <p className="text-muted-foreground text-xs mt-0.5">a.n. {acc.accountName}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Setelah transfer, klik &quot;Konfirmasi Pembayaran&quot; di bawah.
          </p>
        </div>
      )}

    </div>
  );
}

// ─── InvoicePublicClient ──────────────────────────────────────────────────────
export function InvoicePublicClient({ slug, invoice }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error,   setError]        = useState("");
  const [success, setSuccess]      = useState("");

  const [showPayForm,  setShowPayForm]  = useState(false);
  const [payAmount,    setPayAmount]    = useState(String(invoice.remaining));
  const [payerName,    setPayerName]    = useState(invoice.customerName);
  const [payMethod,    setPayMethod]    = useState<"transfer" | "qris">("transfer");
  const [payerBank,    setPayerBank]    = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [payNotes,     setPayNotes]     = useState("");

  const [proofUrl,       setProofUrl]       = useState<string | null>(null);
  const [proofPreview,   setProofPreview]   = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadError,    setUploadError]    = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxSrc, setLightboxSrc]      = useState<string | null>(null);

  const canPay = ["pending", "partial", "overdue"].includes(invoice.status);

  async function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setProofUrl(null);
    setProofPreview(URL.createObjectURL(file));
    setUploadingProof(true);
    try {
      const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.80 });
      const fd = new FormData();
      fd.append("file", compressed);
      const res  = await fetch(`/api/invoice/proof-upload?tenant=${slug}&invoiceId=${invoice.id}`, {
        method: "POST", body: fd,
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setUploadError(data.error ?? "Gagal upload bukti.");
        setProofPreview(null);
      } else {
        setProofUrl(data.url);
      }
    } catch {
      setUploadError("Gagal upload bukti.");
      setProofPreview(null);
    }
    setUploadingProof(false);
  }

  function clearProof() {
    setProofUrl(null);
    setProofPreview(null);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmitProof(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amountNum = parseInt(payAmount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum <= 0) {
      setError("Nominal transfer harus diisi dengan benar.");
      return;
    }
    const confirmed = window.confirm(
      `Pastikan nominal yang Anda tulis (${formatRp(amountNum)}) sama persis dengan bukti transfer. Lanjut kirim konfirmasi?`
    );
    if (!confirmed) return;
    startTransition(async () => {
      const res = await submitPaymentProofAction(slug, invoice.id, {
        amount:       amountNum,
        method:       payMethod,
        payerName:    payerName,
        payerBank:    payerBank.trim() || undefined,
        transferDate: transferDate || undefined,
        proofUrl:     proofUrl ?? undefined,
        notes:        payNotes.trim() || undefined,
      });
      if (res.success) {
        setSuccess("Konfirmasi pembayaran berhasil dikirim. Admin akan memverifikasi dalam 1×24 jam.");
        setShowPayForm(false);
        // Refresh data invoice dari server — status sekarang "waiting_verification",
        // supaya tombol "Konfirmasi Pembayaran" tidak muncul lagi (cegah submit ganda
        // kalau customer klik tombol yang sama sekali lagi tanpa reload manual).
        router.refresh();
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
            {invoice.items.map((item) => {
              const attendee = parseTicketAttendee(item.itemType, item.description);
              return (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{item.name}</p>
                  {attendee ? (
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {attendee.attendeeName && (
                        <p>Peserta: <span className="text-foreground">{attendee.attendeeName}</span></p>
                      )}
                      {attendee.customFieldAnswers && Object.entries(attendee.customFieldAnswers).map(([k, v]) => (
                        <p key={k}>{humanizeFieldKey(k)}: {formatFieldValue(v)}</p>
                      ))}
                    </div>
                  ) : (
                    item.description && <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{item.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRp(item.unitPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatRp(item.total)}</td>
              </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/20 text-sm">
            {(invoice.discount > 0 || invoice.shippingTotal > 0) && (
              <>
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRp(invoice.subtotal)}</td>
                </tr>
                {invoice.shippingTotal > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Ongkos Kirim</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatRp(invoice.shippingTotal)}</td>
                  </tr>
                )}
                {invoice.discount > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Diskon</td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-600">- {formatRp(invoice.discount)}</td>
                  </tr>
                )}
              </>
            )}
            <tr className="font-semibold">
              <td colSpan={3} className="px-4 py-3 text-right">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatRp(invoice.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Info pengiriman ── */}
      {invoice.shippingLines.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">Informasi Pengiriman</p>
          {invoice.shippingCityName && (
            <p className="text-xs text-muted-foreground">
              Tujuan: {invoice.shippingCityName}
              {invoice.shippingAddress && ` — ${invoice.shippingAddress}`}
            </p>
          )}
          {invoice.shippingLines.map(line => (
            <div key={line.id} className="rounded-md bg-muted/40 px-4 py-3 space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium uppercase">{line.courier} {line.service}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${
                  line.status === "shipped"   ? "bg-blue-100 text-blue-700" :
                  line.status === "delivered" ? "bg-green-100 text-green-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {line.status === "shipped" ? "Dalam Pengiriman" :
                   line.status === "delivered" ? "Terkirim" : "Menunggu Pengiriman"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Dari: {line.sellerName}
                {line.etd && ` · Estimasi ${line.etd}`}
                {" · "}{formatRp(line.cost)}
              </p>
              {line.trackingNumber && (
                <p className="text-xs font-medium">
                  Resi: <span className="font-mono">{line.trackingNumber}</span>
                  {line.shippedAt && (
                    <span className="ml-2 text-muted-foreground font-normal">
                      · Dikirim {new Date(line.shippedAt).toLocaleDateString("id-ID", {
                        day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta",
                      })}
                    </span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Ringkasan pembayaran ── */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Tagihan</span>
          <span className="tabular-nums font-medium">{formatRp(invoice.total)}</span>
        </div>
        {invoice.uniqueCode > 0 && (
          <div className="flex justify-between text-amber-700">
            <span>Kode Unik</span>
            <span className="tabular-nums">+{formatRp(invoice.uniqueCode)}</span>
          </div>
        )}
        {invoice.uniqueCode > 0 && (
          <div className="flex justify-between font-semibold border-t border-border pt-2">
            <span>Total yang Harus Dibayar</span>
            <span className="tabular-nums text-primary">{formatRp(invoice.amountDue)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Terbayar</span>
          <span className="tabular-nums text-green-600">{formatRp(invoice.paidAmount)}</span>
        </div>
        <div className={`flex justify-between font-semibold ${invoice.uniqueCode > 0 ? "" : "border-t border-border pt-2"}`}>
          <span>Sisa Tagihan</span>
          <span className={`tabular-nums ${invoice.remaining > 0 ? "text-destructive" : "text-green-600"}`}>
            {formatRp(invoice.remaining)}
          </span>
        </div>
        {invoice.uniqueCode > 0 && invoice.remaining > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
            Kode unik ditambahkan untuk memudahkan identifikasi pembayaran Anda.
          </p>
        )}
      </div>

      {/* ── Metode pembayaran ── */}
      {canPay && (
        <PaymentMethodCard slug={slug} invoice={invoice} />
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
            <label className={labelCls}>Nominal Transfer</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} pl-9`}
                required
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Default sesuai sisa tagihan — ubah kalau nominal transfer Anda beda (mencicil atau lebih).
            </p>
          </div>

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
            <div className="flex gap-2">
              {(["transfer", "qris"] as const).map((m) => (
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
                  {m === "transfer" ? "Transfer" : "QRIS"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {payMethod === "transfer" && (
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
            )}
            <div className={payMethod === "transfer" ? "" : "col-span-2"}>
              <label className={labelCls}>
                {payMethod === "transfer" ? "Tanggal Transfer" : "Tanggal Pembayaran"}
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

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

          {/* ── Bukti Pembayaran ── */}
          <div>
            <label className={labelCls}>
              {payMethod === "transfer" ? "Bukti Transfer / Screenshot" : "Screenshot QRIS / Bukti Bayar"}
              <span className="ml-1 text-muted-foreground text-xs">(opsional tapi disarankan)</span>
            </label>

            {!proofPreview ? (
              <label className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer transition-colors">
                <ImagePlus size={24} />
                <span>Klik untuk pilih foto</span>
                <span className="text-xs">JPG, PNG, WebP · Maks. 8 MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={handleProofFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative rounded-md overflow-hidden border border-border">
                <button
                  type="button"
                  onClick={() => proofPreview && setLightboxSrc(proofPreview)}
                  className="block w-full"
                  disabled={uploadingProof}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proofPreview}
                    alt="Bukti transfer"
                    className="w-full max-h-64 object-contain bg-muted/20 cursor-zoom-in"
                  />
                </button>
                {uploadingProof && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Loader2 size={28} className="animate-spin text-primary" />
                  </div>
                )}
                {!uploadingProof && (
                  <button
                    type="button"
                    onClick={clearProof}
                    className="absolute top-2 right-2 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-destructive border border-border"
                    title="Hapus foto"
                  >
                    <X size={14} />
                  </button>
                )}
                {proofUrl && !uploadingProof && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">
                    <Check size={12} />
                    Terupload · Klik untuk perbesar
                  </div>
                )}
              </div>
            )}

            {uploadError && (
              <p className="mt-1 text-xs text-destructive">{uploadError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending || uploadingProof}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Mengirim..." : "Kirim Konfirmasi"}
          </button>
        </form>
      )}

      {/* ── Bukti ditolak — tampil saat invoice kembali ke pending ── */}
      {invoice.rejectedPaymentNote && ["pending", "partial", "overdue"].includes(invoice.status) && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-1">
          <p className="font-semibold text-orange-700 text-sm">Bukti pembayaran sebelumnya ditolak</p>
          <p className="text-sm text-orange-600">{invoice.rejectedPaymentNote}</p>
          <p className="text-xs text-orange-500 mt-1">Silakan upload ulang bukti pembayaran yang benar.</p>
        </div>
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
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="text-center">
            <p className="font-semibold text-blue-700">Pembayaran sedang diverifikasi.</p>
            <p className="text-sm text-blue-600 mt-1">Admin akan mengkonfirmasi dalam 1×24 jam.</p>
          </div>
          {invoice.submittedProofUrl && (
            <div className="space-y-1">
              <p className="text-xs text-blue-600 font-medium text-center">Bukti yang dikirim:</p>
              <button
                type="button"
                onClick={() => setLightboxSrc(invoice.submittedProofUrl)}
                className="block mx-auto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={invoice.submittedProofUrl}
                  alt="Bukti transfer"
                  className="max-h-48 rounded-md border border-blue-200 object-contain bg-white hover:opacity-90 transition-opacity cursor-zoom-in"
                />
                <p className="text-xs text-blue-500 mt-1 text-center">Klik untuk perbesar</p>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox ── */}
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
