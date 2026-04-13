"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmOrderPaymentAction,
  cancelOrderAction,
  updateOrderStatusAction,
  addPaymentToOrderAction,
} from "@/app/(dashboard)/[tenant]/toko/actions";
import { CheckCircle2, XCircle, Truck, PackageCheck, CreditCard } from "lucide-react";

type Props = {
  slug:    string;
  orderId: string;
  status:  string;
  total:   number;
  // Payment terkait (jika ada)
  payment?: {
    id:     string;
    status: string;
    method: string;
  } | null;
};

// ─── AddPaymentForm ───────────────────────────────────────────────────────────

function AddPaymentForm({
  slug,
  orderId,
  total,
  onSuccess,
}: {
  slug: string;
  orderId: string;
  total: number;
  onSuccess: () => void;
}) {
  const [show,   setShow]   = useState(false);
  const [method, setMethod] = useState<"cash" | "transfer" | "qris">("cash");
  const [amount, setAmount] = useState(String(total));
  const [bank,   setBank]   = useState("");
  const [notes,  setNotes]  = useState("");
  const [error,  setError]  = useState("");
  const [pending, startTransition] = useTransition();

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <CreditCard className="h-4 w-4" />
        Input Pembayaran
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await addPaymentToOrderAction(slug, orderId, {
        method,
        amount:    parseFloat(amount) || total,
        payerBank: bank.trim() || undefined,
        notes:     notes.trim() || undefined,
      });
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <p className="text-sm font-medium">Input Pembayaran</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Jumlah (Rp)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Metode</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="cash">Tunai</option>
            <option value="transfer">Transfer</option>
            <option value="qris">QRIS</option>
          </select>
        </div>
      </div>

      {method === "transfer" && (
        <div>
          <label className="text-xs text-muted-foreground">Bank Pengirim</label>
          <input
            type="text"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="mis. BCA"
            className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1.5 text-sm"
          />
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">Catatan (opsional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan Pembayaran"}
        </button>
        <button type="button" onClick={() => setShow(false)} className="text-sm text-muted-foreground hover:text-foreground">
          Batal
        </button>
      </div>
    </form>
  );
}

// ─── OrderActions (export utama) ──────────────────────────────────────────────

export function OrderActions({ slug, orderId, status, total, payment }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleConfirmPayment() {
    if (!payment) return;
    setError("");
    startTransition(async () => {
      const res = await confirmOrderPaymentAction(slug, payment.id);
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  function handleUpdateStatus(newStatus: "processing" | "shipped" | "done") {
    setError("");
    startTransition(async () => {
      const res = await updateOrderStatusAction(slug, orderId, newStatus);
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  function handleCancel() {
    if (!confirm("Yakin ingin membatalkan pesanan ini?")) return;
    setError("");
    startTransition(async () => {
      const res = await cancelOrderAction(slug, orderId);
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {/* Pending — belum ada payment */}
        {status === "pending" && !payment && (
          <AddPaymentForm
            slug={slug}
            orderId={orderId}
            total={total}
            onSuccess={() => router.refresh()}
          />
        )}

        {/* Submitted — siap dikonfirmasi */}
        {status === "pending" && payment?.status === "submitted" && (
          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            Konfirmasi Lunas
          </button>
        )}

        {/* Paid → processing */}
        {status === "paid" && (
          <button
            type="button"
            onClick={() => handleUpdateStatus("processing")}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <PackageCheck className="h-4 w-4" />
            Tandai Diproses
          </button>
        )}

        {/* Processing → shipped */}
        {status === "processing" && (
          <button
            type="button"
            onClick={() => handleUpdateStatus("shipped")}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            <Truck className="h-4 w-4" />
            Tandai Dikirim
          </button>
        )}

        {/* Shipped → done */}
        {status === "shipped" && (
          <button
            type="button"
            onClick={() => handleUpdateStatus("done")}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            Tandai Selesai
          </button>
        )}

        {/* Batalkan — hanya jika belum done */}
        {!["done", "cancelled"].includes(status) && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" />
            Batalkan Pesanan
          </button>
        )}

        {/* Selesai / Dibatalkan */}
        {["done", "cancelled"].includes(status) && (
          <p className="text-sm text-muted-foreground italic">Tidak ada tindakan tersedia.</p>
        )}
      </div>
    </div>
  );
}
