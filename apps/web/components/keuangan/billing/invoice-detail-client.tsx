"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, ImagePlus, Loader2, Check } from "lucide-react";
import {
  confirmInvoicePaymentAction,
  cancelInvoiceAction,
  verifySubmittedPaymentAction,
  rejectPaymentAction,
  updatePaymentEvidenceAction,
  updateAdminShippingTrackingAction,
  backfillEventRegistrationsAction,
  confirmCodPaymentAction,
  type InvoiceDetail,
} from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";
import { parseTicketAttendee, humanizeFieldKey, formatFieldValue } from "@/lib/event-custom-form";
import { compressImage } from "@/lib/client-image-compress";
import { displayPhone } from "@/lib/phone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProofUploadField } from "@/components/keuangan/proof-upload-field";

type Props = {
  slug:     string;
  invoice:  InvoiceDetail;
  timezone: string;
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
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

// timeZone eksplisit WAJIB — komponen ini "use client", rentan hydration mismatch (React
// error #418) kalau TZ server dan browser beda. Lihat komentar sama di invoice-public-client.tsx.
// timezone dinamis dari prop (setting tenant), bukan hardcode WIB.
function formatDate(iso: string, timezone: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: timezone });
}

// Peringatan non-blocking (bukan validasi keras) saat nominal yang diketik admin beda dari
// yang diharapkan — keputusan produk 2026-07-19: kurang → beri tahu, lebih → tetap boleh
// dicatat tapi beri tahu kelebihan di luar tanggung jawab kami. Field tetap bebas diedit,
// warning ini murni informasional (tidak mencegah submit).
function amountWarning(entered: number, expected: number): string | null {
  if (!entered || expected <= 0) return null;
  if (entered < expected) {
    return `⚠ Angka yang Anda masukkan kurang dari nominal yang seharusnya (${formatRp(expected)}).`;
  }
  if (entered > expected) {
    return `ℹ Nominal yang Anda catat lebih dari tagihan (${formatRp(expected)}). Kelebihan nominal di luar tanggung jawab kami — tetap boleh dicatat.`;
  }
  return null;
}

export function InvoiceDetailClient({ slug, invoice, timezone }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error,   setError]        = useState("");
  const [success, setSuccess]      = useState("");

  // Payment form state
  const amountDue = invoice.total + (invoice.uniqueCode ?? 0);

  // Termin cicilan belum lunas paling awal — dipakai untuk hint teks + referensi pembanding
  // amountWarning() di form "✓ Verifikasi" (BUKAN untuk mengubah default field, lihat aturan
  // di bawah). Lihat docs/arsitektur-billing.md § "Program Cicilan".
  const nextUnpaidTerm = invoice.installmentSchedules.find((s) => s.status !== "paid") ?? null;

  // ATURAN MUTLAK (2026-07-19, ditegaskan eksplisit oleh user setelah insiden gap nominal):
  // default form "✓ Verifikasi" WAJIB persis sama dengan payment.amount — nominal yang CUSTOMER
  // SESUNGGUHNYA submit via form konfirmasi. TIDAK ADA pengurangan/perhitungan otomatis apa pun
  // (dulu sempat dikurangi kode unik termin di sini — itu SALAH, menciptakan gap diam-diam
  // antara yang customer konfirmasi kirim dan yang tercatat ke admin — berbahaya). Kalau nominal
  // yang customer submit berbeda dari yang "seharusnya" (term.amount+kode), itu tanggung jawab
  // amountWarning() untuk memberi tahu admin secara eksplisit — BUKAN tanggung jawab kode ini
  // untuk diam-diam "membetulkan" angkanya. Admin yang punya keputusan akhir untuk koreksi.

  // Nominal yang "seharusnya" ditransfer customer untuk termin berikutnya (term.amount + kode
  // unik termin) — HANYA dipakai sebagai referensi pembanding di amountWarning(), TIDAK PERNAH
  // dipakai sebagai default field (lihat aturan di atas).
  function verifyExpected(): number {
    if (!nextUnpaidTerm) return invoice.remaining;
    return nextUnpaidTerm.amount + (nextUnpaidTerm.uniqueCode ?? 0);
  }

  // Nominal yang "seharusnya" dicatat via form Konfirmasi Pembayaran manual — dipakai baik
  // untuk default field maupun untuk warning kurang/lebih (amountWarning).
  const payExpected = nextUnpaidTerm ? nextUnpaidTerm.amount : invoice.remaining;

  const [showPayForm, setShowPayForm]   = useState(false);
  // Nilai awal tidak penting (form belum tampil) — nilai SESUNGGUHNYA di-set oleh
  // togglePayForm() setiap kali form dibuka, cicilan-aware (angka bersih termin berikutnya,
  // BUKAN invoice.remaining penuh). Tanpa ini, admin yang catat pembayaran manual (mis. tunai)
  // untuk SATU termin bisa tanpa sadar mengonfirmasi SELURUH sisa tagihan sekaligus — bug
  // nyata yang dilaporkan user, lihat lesson CLAUDE.md.
  const [payAmount,   setPayAmount]     = useState(String(Math.round(invoice.remaining)));
  const [payMethod,   setPayMethod]     = useState<"cash" | "transfer" | "qris">("cash");
  const [payBank,     setPayBank]       = useState("");
  const [payDate,     setPayDate]       = useState("");
  const [payNotes,    setPayNotes]      = useState("");
  const [payProofUrl, setPayProofUrl]   = useState<string | null>(null);

  // Cancel state
  const [showCancel,  setShowCancel]    = useState(false);
  const [cancelNote,  setCancelNote]    = useState("");

  // Verifikasi payment submitted — form inline (pola sama dengan Tolak di bawah), admin bisa
  // koreksi nominal sebelum konfirmasi, lihat docs/arsitektur-billing.md § "Nominal Pembayaran
  // Terlihat + Bisa Diedit"
  const [verifyingId,   setVerifyingId]   = useState<string | null>(null);  // payment id yang form-nya terbuka
  const [verifyAmount,  setVerifyAmount]  = useState("");
  const [verifyPending, startVerifyTr]    = useTransition();

  // Tolak bukti pembayaran
  const [rejectingId,    setRejectingId]    = useState<string | null>(null);
  const [rejectReason,   setRejectReason]   = useState("");
  const [rejectPending,  startRejectTr]     = useTransition();

  // Edit bukti transfer + metadata payment — untuk kasus bukti gagal terlampir
  // (bug upload lama) atau data pengirim salah ketik. Tersedia di status manapun;
  // nominal ikut disable oleh server kalau status sudah "paid" (lihat
  // updatePaymentEvidenceAction — sudah tercatat di jurnal, tidak boleh diubah diam-diam).
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [editAmount,        setEditAmount]        = useState("");
  const [editPayerName,     setEditPayerName]     = useState("");
  const [editPayerBank,     setEditPayerBank]     = useState("");
  const [editTransferDate,  setEditTransferDate]  = useState("");
  const [editPayerNote,     setEditPayerNote]     = useState("");
  const [editProofUrl,      setEditProofUrl]      = useState<string | null>(null);
  const [editProofPreview,  setEditProofPreview]  = useState<string | null>(null);
  const [editUploadingProof, setEditUploadingProof] = useState(false);
  const [editUploadError,    setEditUploadError]    = useState("");
  const [editPending,       startEditTr]          = useTransition();
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightboxSrc, setLightboxSrc]  = useState<string | null>(null);

  // Shipping tracking
  const [resiInputs,  setResiInputs]   = useState<Record<string, string>>({});
  const [savingResi,  setSavingResi]   = useState<string | null>(null);
  const [confirmingCod, setConfirmingCod] = useState<string | null>(null);

  // Sinkronkan peserta event — perbaikan untuk invoice tiket yang lunas tapi belum
  // menghasilkan event_registrations (bug lama sebelum admin bisa isi "Data Peserta" di
  // invoice manual). Idempotent, aman diklik berkali-kali.
  const hasTicketItems = invoice.items.some((i) => i.itemType === "ticket");
  const [backfillPending, startBackfillTr] = useTransition();

  function handleBackfillRegistrations() {
    setError("");
    setSuccess("");
    startBackfillTr(async () => {
      const res = await backfillEventRegistrationsAction(slug, invoice.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      const { created, existingRegistrations, alreadySynced, unlinkedItemId, ticketNotFound, totalTicketItems } = res.data;
      if (created.length > 0) {
        const ev = created[0];
        setSuccess(`${created.length} peserta berhasil disinkronkan ke event "${ev.eventTitle}".`);
      } else if (totalTicketItems === 0) {
        setError("Invoice ini tidak memiliki item bertipe tiket event — tidak ada yang bisa disinkronkan.");
      } else if (unlinkedItemId > 0) {
        setError(
          `Ditemukan ${unlinkedItemId} item tiket yang TIDAK terhubung ke tiket event manapun — kemungkinan diketik manual sebagai teks bebas saat invoice dibuat (bukan dipilih dari hasil pencarian tiket), sehingga sistem tidak tahu ini peserta event mana. Tidak bisa disinkronkan otomatis — periksa item invoice ini, atau tambahkan peserta secara manual di halaman detail event.`
        );
      } else if (ticketNotFound > 0) {
        setError(
          `Ditemukan ${ticketNotFound} item tiket yang mereferensikan tiket event yang sudah tidak ada lagi (mungkin dihapus/diubah setelah invoice dibuat). Tidak bisa disinkronkan otomatis.`
        );
      } else if (alreadySynced > 0) {
        const ex = existingRegistrations[0];
        setSuccess(
          ex
            ? `Sudah terdaftar: "${ex.attendeeName}" — event "${ex.eventTitle}" (No. Reg ${ex.regNumber}, status: ${ex.status}). Kalau tidak muncul di halaman event yang Anda cek, pastikan Anda membuka event "${ex.eventTitle}" — bukan event lain.`
            : "Semua peserta di invoice ini sudah tersinkron sebelumnya — tidak ada yang perlu ditambahkan."
        );
      } else {
        setSuccess("Tidak ada yang perlu disinkronkan.");
      }
      router.refresh();
    });
  }

  function handleReject(paymentId: string) {
    if (!rejectReason.trim()) return;
    setError("");
    setSuccess("");
    startRejectTr(async () => {
      const res = await rejectPaymentAction(slug, paymentId, rejectReason.trim());
      if (res.success) {
        setSuccess("Bukti pembayaran berhasil ditolak. Invoice kembali ke status Menunggu Bayar.");
        setRejectingId(null);
        setRejectReason("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  // Buka/tutup form verifikasi inline — prefill nominal dari yang customer submit
  function toggleVerifyForm(paymentId: string, currentAmount: number) {
    setError("");
    setSuccess("");
    if (verifyingId === paymentId) {
      setVerifyingId(null);
      return;
    }
    setVerifyingId(paymentId);
    setVerifyAmount(String(Math.round(currentAmount)));
  }

  function handleVerify(paymentId: string) {
    const amountNum = parseInt(verifyAmount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum <= 0) {
      setError("Nominal terverifikasi harus diisi dengan benar.");
      return;
    }
    setError("");
    setSuccess("");
    startVerifyTr(async () => {
      const res = await verifySubmittedPaymentAction(slug, paymentId, amountNum);
      if (res.success) {
        setSuccess("Pembayaran berhasil diverifikasi.");
        setVerifyingId(null);
        setVerifyAmount("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  // Buka/tutup form edit bukti+metadata — prefill dari data payment yang ada
  function toggleEditForm(p: InvoiceDetail["payments"][number]) {
    setError("");
    setSuccess("");
    if (editingId === p.id) {
      setEditingId(null);
      return;
    }
    setEditingId(p.id);
    setEditAmount(String(Math.round(p.amount)));
    setEditPayerName(p.payerName ?? "");
    setEditPayerBank(p.payerBank ?? "");
    setEditTransferDate(p.transferDate ?? "");
    setEditPayerNote(p.payerNote ?? "");
    setEditProofUrl(p.proofUrl ?? null);
    setEditProofPreview(p.proofUrl ?? null);
    setEditUploadError("");
  }

  async function handleEditProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditUploadError("");
    setEditProofUrl(null);
    setEditProofPreview(URL.createObjectURL(file));
    setEditUploadingProof(true);
    try {
      const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.80 });
      const fd = new FormData();
      fd.append("file", compressed);
      const res  = await fetch(`/api/invoice/proof-upload?tenant=${slug}&invoiceId=${invoice.id}`, {
        method: "POST", body: fd,
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setEditUploadError(data.error ?? "Gagal upload bukti.");
      } else {
        setEditProofUrl(data.url);
        setEditProofPreview(data.url);
      }
    } catch {
      setEditUploadError("Gagal upload bukti.");
    }
    setEditUploadingProof(false);
  }

  function handleSaveEdit(p: InvoiceDetail["payments"][number]) {
    const amountNum = parseInt(editAmount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum <= 0) {
      setError("Nominal harus diisi dengan benar.");
      return;
    }
    setError("");
    setSuccess("");
    startEditTr(async () => {
      const res = await updatePaymentEvidenceAction(slug, p.id, {
        // Nominal hanya dikirim kalau berubah DAN status bukan "paid" — server tetap
        // validasi ulang, ini cuma menghindari kirim field yang pasti ditolak.
        amount:       p.status !== "paid" ? amountNum : undefined,
        proofUrl:     editProofUrl,
        payerName:    editPayerName,
        payerBank:    editPayerBank,
        transferDate: editTransferDate,
        payerNote:    editPayerNote,
      });
      if (res.success) {
        setSuccess("Data pembayaran berhasil diperbarui.");
        setEditingId(null);
        router.refresh();
      } else {
        setError(res.error);
      }
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

  function handleConfirmCod(lineId: string) {
    setConfirmingCod(lineId);
    setError("");
    startTransition(async () => {
      const res = await confirmCodPaymentAction(slug, lineId);
      if (res.success) {
        setSuccess("Pembayaran COD berhasil dikonfirmasi.");
        router.refresh();
      } else {
        setError(res.error);
      }
      setConfirmingCod(null);
    });
  }

  const canPay    = !["paid", "cancelled"].includes(invoice.status) && invoice.remaining > 0;
  const canCancel = !["paid", "cancelled"].includes(invoice.status);

  // Buka/tutup form "Konfirmasi Pembayaran" manual — SETIAP kali dibuka, payAmount di-reset
  // ke default yang benar saat itu (cicilan-aware). Jangan andalkan useState initializer saja
  // (nilainya statis dari saat mount, tidak ikut berubah walau invoice/nextUnpaidTerm berubah
  // setelah router.refresh() dari transaksi sebelumnya).
  function togglePayForm() {
    setError("");
    setSuccess("");
    if (showPayForm) {
      setShowPayForm(false);
      return;
    }
    setPayAmount(String(Math.round(payExpected)));
    setPayProofUrl(null);
    setShowPayForm(true);
  }

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
        proofUrl:     payProofUrl ?? undefined,
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
          <p className="text-sm text-muted-foreground">Dibuat {formatDate(invoice.createdAt, timezone)}</p>
        </div>
      </div>

      {success && <p className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{success}</p>}
      {error   && <p className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-destructive">{error}</p>}

      {/* ── Customer info ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border p-4 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
        <p className="font-medium">{invoice.customerName}</p>
        {invoice.customerPhone && <p className="text-sm text-muted-foreground">{displayPhone(invoice.customerPhone)}</p>}
        {invoice.customerEmail && <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>}
        {invoice.dueDate && (
          <p className="text-sm">
            <span className="text-muted-foreground">Jatuh tempo: </span>
            {formatDate(invoice.dueDate + "T00:00:00", timezone)}
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
                      {attendee.attendeePhone && <p>HP: {displayPhone(attendee.attendeePhone)}</p>}
                      {attendee.attendeeEmail && <p>Email: {attendee.attendeeEmail}</p>}
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
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {formatRp(item.total)}
                  {item.discountAmount > 0 && (
                    <span className="block text-xs font-normal text-green-600">
                      − {formatRp(item.discountAmount)} voucher
                    </span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/20 text-sm">
            {/* invoice.subtotal SUDAH net-of-voucher (checkoutAction hitung subtotal setelah
                potongan per item) — beda dari invoice.discount (legacy, admin-manual) yang
                dipotong DARI subtotal gross. Rekonstruksi gross di sini supaya baris "Subtotal"
                selalu tampil sebelum potongan apa pun, tidak pernah dipotong dobel. */}
            {(invoice.discount > 0 || invoice.voucherDiscountTotal > 0) && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatRp(invoice.subtotal + invoice.voucherDiscountTotal)}
                </td>
              </tr>
            )}
            {invoice.discount > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Diskon</td>
                <td className="px-4 py-2 text-right tabular-nums text-green-600">- {formatRp(invoice.discount)}</td>
              </tr>
            )}
            {invoice.voucherDiscountTotal > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
                  Diskon Voucher {invoice.voucherCode && <span className="font-mono">({invoice.voucherCode})</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-green-600">
                  − {formatRp(invoice.voucherDiscountTotal)}
                </td>
              </tr>
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
        {(invoice.uniqueCode ?? 0) > 0 && (
          <>
            <div className="flex justify-between text-amber-700">
              <span>Kode Unik</span>
              <span className="tabular-nums">+{formatRp(invoice.uniqueCode ?? 0)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-2">
              <span>Total yang Harus Dibayar</span>
              <span className="tabular-nums text-primary">{formatRp(amountDue)}</span>
            </div>
          </>
        )}
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

      {/* ── Jadwal Cicilan ──────────────────────────────────────────────── */}
      {invoice.installmentSchedules.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-xs">Jadwal Cicilan</p>
          <div className="rounded-lg border border-border divide-y divide-border">
            {invoice.installmentSchedules.map((s) => {
              // Perbandingan string "YYYY-MM-DD" langsung, bukan Date object — hindari bug
              // timezone (dueDate vs "hari ini" browser bisa beda TZ → false "Terlambat").
              const todayWib = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
              const isOverdue = s.status === "pending" && s.dueDate < todayWib;
              const isNext = nextUnpaidTerm?.id === s.id;
              return (
                <div key={s.id} className={`px-4 py-2.5 flex items-center justify-between text-sm ${isNext ? "bg-primary/5" : ""}`}>
                  <div>
                    <p className="font-medium">
                      Termin {s.termNumber}
                      {s.uniqueCode != null && (
                        <span className="ml-2 text-xs font-mono text-muted-foreground">kode {s.uniqueCode}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(s.dueDate, timezone)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{formatRp(s.amount)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "paid" ? "bg-green-100 text-green-700"
                      : isOverdue ? "bg-red-100 text-red-700"
                      : "bg-muted text-muted-foreground"
                    }`}>
                      {s.status === "paid" ? "Lunas" : isOverdue ? "Terlambat" : "Menunggu"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                      {" · "}{formatDate(p.createdAt, timezone)}
                    </p>
                    {p.payerNote && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">{p.payerNote}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status === "submitted" && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleVerifyForm(p.id, p.amount)}
                          disabled={verifyPending || rejectPending}
                          className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                        >
                          ✓ Verifikasi
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(rejectingId === p.id ? null : p.id)}
                          disabled={pending || rejectPending}
                          className="rounded-md border border-destructive/50 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60 transition-colors"
                        >
                          Tolak
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleEditForm(p)}
                      disabled={editPending}
                      className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
                      title="Edit bukti transfer / nominal / data pengirim"
                    >
                      ✎ Edit
                    </button>
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
                {!p.proofUrl && editingId !== p.id && (
                  <p className="text-xs text-amber-600">⚠ Belum ada bukti transfer terlampir — klik &quot;Edit&quot; untuk menambahkan.</p>
                )}
                {/* Form verifikasi — nominal ter-prefill dari yang customer submit, admin bisa koreksi */}
                {verifyingId === p.id && (
                  <div className="rounded-md border border-green-600/30 bg-green-50/40 p-3 space-y-2">
                    <p className="text-xs font-semibold text-green-700">Konfirmasi Nominal Diterima</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={verifyAmount}
                        onChange={(e) => setVerifyAmount(e.target.value.replace(/\D/g, ""))}
                        className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {nextUnpaidTerm
                        ? `Default = PERSIS nominal yang customer submit (tidak dikurangi apa pun). Termin ${nextUnpaidTerm.termNumber} seharusnya Rp ${formatRp(nextUnpaidTerm.amount).replace("Rp ", "")} + kode unik ${nextUnpaidTerm.uniqueCode ?? "-"} — kalau nominal ini termasuk kode unik, kurangi manual sebelum konfirmasi (kode bukan bagian dari nominal cicilan).`
                        : "Default = PERSIS nominal yang customer submit — cocokkan dengan bukti transfer di bawah sebelum konfirmasi."}
                    </p>
                    {(() => {
                      const warn = amountWarning(parseInt(verifyAmount.replace(/\D/g, ""), 10) || 0, verifyExpected());
                      return warn ? (
                        <p className={`text-xs font-medium ${warn.startsWith("⚠") ? "text-amber-700" : "text-blue-700"}`}>{warn}</p>
                      ) : null;
                    })()}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerify(p.id)}
                        disabled={verifyPending}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        {verifyPending ? "Memverifikasi..." : "Konfirmasi"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVerifyingId(null); setVerifyAmount(""); }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
                {/* Form alasan penolakan */}
                {rejectingId === p.id && (
                  <div className="rounded-md border border-destructive/30 bg-red-50/40 p-3 space-y-2">
                    <p className="text-xs font-semibold text-destructive">Alasan Penolakan</p>
                    <textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Tulis alasan penolakan untuk customer..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReject(p.id)}
                        disabled={rejectPending || !rejectReason.trim()}
                        className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 transition-colors"
                      >
                        {rejectPending ? "Menolak..." : "Tolak Bukti Ini"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
                {/* Form edit bukti transfer + metadata — tersedia di status manapun */}
                {editingId === p.id && (
                  <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Data Pembayaran</p>

                    <div>
                      <label className="block text-xs font-medium mb-1">Nominal</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, ""))}
                          disabled={p.status === "paid"}
                          className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 disabled:bg-muted"
                        />
                      </div>
                      {p.status === "paid" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nominal yang sudah dikonfirmasi tidak bisa diubah — sudah tercatat di buku besar keuangan.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Nama Pengirim</label>
                        <input
                          type="text"
                          value={editPayerName}
                          onChange={(e) => setEditPayerName(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Bank</label>
                        <input
                          type="text"
                          value={editPayerBank}
                          onChange={(e) => setEditPayerBank(e.target.value)}
                          placeholder="BCA, BRI..."
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Tanggal Transfer</label>
                      <input
                        type="date"
                        value={editTransferDate}
                        onChange={(e) => setEditTransferDate(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Catatan</label>
                      <input
                        type="text"
                        value={editPayerNote}
                        onChange={(e) => setEditPayerNote(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Bukti Transfer</label>
                      {!editProofPreview ? (
                        <label className="flex flex-col items-center gap-1.5 rounded-md border-2 border-dashed border-border px-4 py-4 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer transition-colors">
                          <ImagePlus size={20} />
                          <span>Klik untuk pilih/ganti foto</span>
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                            onChange={handleEditProofFileChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="relative rounded-md overflow-hidden border border-border">
                          <button
                            type="button"
                            onClick={() => editProofPreview && setLightboxSrc(editProofPreview)}
                            className="block w-full"
                            disabled={editUploadingProof}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={editProofPreview}
                              alt="Bukti transfer"
                              className="w-full max-h-48 object-contain bg-muted/20 cursor-zoom-in"
                            />
                          </button>
                          {editUploadingProof && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                              <Loader2 size={24} className="animate-spin text-primary" />
                            </div>
                          )}
                          {!editUploadingProof && (
                            <button
                              type="button"
                              onClick={() => { setEditProofUrl(null); setEditProofPreview(null); if (editFileInputRef.current) editFileInputRef.current.value = ""; }}
                              className="absolute top-2 right-2 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-destructive border border-border"
                              title="Hapus foto"
                            >
                              <X size={12} />
                            </button>
                          )}
                          {editProofUrl && !editUploadingProof && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">
                              <Check size={12} />
                              Terupload
                            </div>
                          )}
                        </div>
                      )}
                      {editUploadError && (
                        <p className="mt-1 text-xs text-destructive">⚠ {editUploadError}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(p)}
                        disabled={editPending || editUploadingProof}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                      >
                        {editPending ? "Menyimpan..." : "Simpan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
                {/* Tampilkan alasan jika sudah ditolak */}
                {p.status === "rejected" && p.rejectionNote && (
                  <p className="text-xs text-destructive/80 bg-red-50 rounded px-2 py-1">
                    Alasan: {p.rejectionNote}
                  </p>
                )}
                {p.proofUrl && editingId !== p.id && (
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

      {/* ── Sinkronkan Peserta Event ────────────────────────────────────── */}
      {invoice.status === "paid" && hasTicketItems && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sinkronisasi Data Event</p>
          <p className="text-sm text-muted-foreground">
            Invoice ini berisi tiket event. Jika peserta belum muncul di daftar pendaftar event
            (mis. invoice dibuat sebelum peserta sempat dilengkapi), klik tombol ini untuk
            menyinkronkan ulang — aman diklik berkali-kali, data yang sudah ada tidak akan diduplikasi.
          </p>
          <button
            type="button"
            onClick={handleBackfillRegistrations}
            disabled={backfillPending}
            className="rounded-md border border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-60 transition-colors"
          >
            {backfillPending ? "Menyinkronkan..." : "Sinkronkan Peserta Event"}
          </button>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      {(canPay || canCancel) && (
        <div className="flex gap-3 pt-2">
          {canPay && (
            <button
              type="button"
              onClick={togglePayForm}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Konfirmasi Pembayaran
            </button>
          )}
          {canCancel && (
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

      {/* ── Modal Konfirmasi Pembayaran Popup ──────────────────────────── */}
      {canPay && (
        <Dialog open={showPayForm} onOpenChange={setShowPayForm}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
              <DialogDescription>
                Catat penerimaan pembayaran manual untuk invoice <span className="font-mono font-semibold">{invoice.invoiceNumber}</span>.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handlePay} className="space-y-4 py-2">
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
                <p className="text-xs text-muted-foreground mt-1">
                  {nextUnpaidTerm
                    ? `Default sesuai nominal termin ${nextUnpaidTerm.termNumber} (angka bersih, TANPA kode unik${nextUnpaidTerm.uniqueCode ? ` ${nextUnpaidTerm.uniqueCode}` : ""}) — jangan catat sisa tagihan penuh kecuali memang menerima pelunasan sekaligus. Sisa tagihan total: ${formatRp(invoice.remaining)}.`
                    : `Sisa tagihan: ${formatRp(invoice.remaining)}`}
                </p>
                {(() => {
                  const warn = amountWarning(parseInt(payAmount.replace(/\D/g, ""), 10) || 0, payExpected);
                  return warn ? (
                    <p className={`text-xs font-medium mt-1 ${warn.startsWith("⚠") ? "text-amber-700" : "text-blue-700"}`}>{warn}</p>
                  ) : null;
                })()}
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

              {/* Unggah Bukti Transfer / Kwitansi */}
              <ProofUploadField
                slug={slug}
                label={payMethod === "cash" ? "Tanda Terima / Kwitansi" : "Bukti Transfer"}
                hint={payMethod === "cash" ? "Foto kwitansi atau tanda terima · Maks. 8 MB" : "JPG, PNG, WebP · Maks. 8 MB"}
                onUploaded={setPayProofUrl}
              />

              <div>
                <label className={labelCls}>Catatan</label>
                <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opsional" className={inputCls} />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowPayForm(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {pending ? "Menyimpan..." : "Konfirmasi Pembayaran"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
            {invoice.shippingLines.filter(sl => sl.sellerType === "tenant").map((sl) => {
              const isPickup = sl.deliveryMethod === "pickup";
              const isCod    = sl.paymentMethod === "cod";
              return (
              <div key={sl.id} className="px-4 py-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {isPickup ? "Ambil Sendiri" : <span className="uppercase">{sl.courier} {sl.service}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sl.sellerName}
                      {!isPickup && sl.etd && ` · Est. ${sl.etd}`}
                      {sl.cost > 0 && ` · Rp ${sl.cost.toLocaleString("id-ID")}`}
                    </p>
                  </div>
                  {!isPickup && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      sl.status === "shipped"   ? "bg-blue-100 text-blue-700" :
                      sl.status === "delivered" ? "bg-green-100 text-green-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {sl.status === "shipped" ? "Dikirim" : sl.status === "delivered" ? "Terkirim" : "Menunggu"}
                    </span>
                  )}
                </div>

                {isPickup && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {sl.pickupLocationName && <p className="font-medium text-foreground">{sl.pickupLocationName}</p>}
                    {sl.pickupAddress && <p>{sl.pickupAddress}</p>}
                    {sl.pickupMapsUrl && (
                      <a href={sl.pickupMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-primary hover:underline">
                        Buka di Google Maps →
                      </a>
                    )}
                  </div>
                )}

                {!isPickup && sl.trackingNumber && (
                  <p className="text-xs">
                    Resi: <span className="font-mono font-medium">{sl.trackingNumber}</span>
                    {sl.shippedAt && (
                      <span className="ml-2 text-muted-foreground">
                        · Dikirim {new Date(sl.shippedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: timezone })}
                      </span>
                    )}
                  </p>
                )}

                {!isPickup && (
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
                )}

                {isCod && (
                  sl.codConfirmedAt ? (
                    <p className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      ✓ Tunai diterima {formatDate(sl.codConfirmedAt, timezone)}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="flex-1 rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                        Menunggu pembayaran tunai (COD)
                      </p>
                      <button
                        type="button"
                        onClick={() => handleConfirmCod(sl.id)}
                        disabled={pending || confirmingCod === sl.id}
                        className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        {confirmingCod === sl.id ? "Memproses..." : "Konfirmasi Tunai Diterima"}
                      </button>
                    </div>
                  )
                )}
              </div>
              );
            })}
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
