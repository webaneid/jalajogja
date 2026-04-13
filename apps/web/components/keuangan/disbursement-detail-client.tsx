"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveDisbursementAction,
  markDisbursementPaidAction,
  cancelDisbursementAction,
} from "@/app/(dashboard)/[tenant]/finance/actions";
import { CheckCircle2, CreditCard, XCircle } from "lucide-react";

type Props = {
  slug: string;
  disbursementId: string;
  status: string;
};

export function DisbursementActions({ slug, disbursementId, status }: Props) {
  const router = useRouter();
  const [error,   setError]   = useState("");
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    setError("");
    startTransition(async () => {
      const res = await approveDisbursementAction(slug, disbursementId);
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  function handlePaid() {
    setError("");
    startTransition(async () => {
      const res = await markDisbursementPaidAction(slug, disbursementId);
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  function handleCancel() {
    if (!confirm("Yakin ingin membatalkan pengeluaran ini?")) return;
    setError("");
    startTransition(async () => {
      const res = await cancelDisbursementAction(slug, disbursementId);
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  if (status === "paid" || status === "cancelled") {
    return (
      <p className="text-sm text-muted-foreground italic">Tidak ada tindakan tersedia.</p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {status === "draft" && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            Setujui
          </button>
        )}

        {status === "approved" && (
          <button
            type="button"
            onClick={handlePaid}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            <CreditCard className="h-4 w-4" />
            Tandai Sudah Dibayar
          </button>
        )}

        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
        >
          <XCircle className="h-4 w-4" />
          Batalkan
        </button>
      </div>
    </div>
  );
}
