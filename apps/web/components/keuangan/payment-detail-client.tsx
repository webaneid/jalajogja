"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPaymentAction,
  rejectPaymentAction,
} from "@/app/(dashboard)/[tenant]/finance/actions";
import { CheckCircle2, XCircle } from "lucide-react";

type Props = {
  slug: string;
  paymentId: string;
  status: string;
};

export function PaymentActions({ slug, paymentId, status }: Props) {
  const router = useRouter();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason]                 = useState("");
  const [error, setError]                   = useState("");
  const [pending, startTransition]          = useTransition();

  if (status === "paid" || status === "cancelled" || status === "failed") {
    return (
      <p className="text-sm text-muted-foreground italic">Tidak ada tindakan tersedia.</p>
    );
  }

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      const res = await confirmPaymentAction(slug, paymentId);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!reason.trim()) {
      setError("Alasan penolakan wajib diisi.");
      return;
    }
    startTransition(async () => {
      const res = await rejectPaymentAction(slug, paymentId, reason);
      if (res.success) {
        router.refresh();
        setShowRejectForm(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" />
          Konfirmasi Lunas
        </button>

        {!showRejectForm && (
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" />
            Tolak
          </button>
        )}
      </div>

      {showRejectForm && (
        <form onSubmit={handleReject} className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-sm font-medium">Alasan Penolakan</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Tuliskan alasan penolakan untuk pembayar..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
            >
              {pending ? "Menolak..." : "Tolak Pembayaran"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
