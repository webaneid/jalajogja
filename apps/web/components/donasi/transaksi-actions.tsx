"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmDonationAction, cancelDonationAction } from "@/app/(dashboard)/[tenant]/donasi/actions";

type Props = {
  slug:          string;
  donationId:    string;
  paymentId:     string;
  paymentStatus: string;
  campaignId:    string | null;
};

export function TransaksiActions({ slug, donationId, paymentId, paymentStatus, campaignId }: Props) {
  const router = useRouter();
  const [isConfirming, startConfirm] = useTransition();
  const [isCancelling, startCancel]  = useTransition();

  function handleConfirm() {
    startConfirm(async () => {
      const res = await confirmDonationAction(slug, paymentId);
      if (res.success) router.refresh();
    });
  }

  function handleCancel() {
    if (!confirm("Batalkan donasi ini?")) return;
    startCancel(async () => {
      const res = await cancelDonationAction(slug, donationId);
      if (res.success) router.refresh();
    });
  }

  const canConfirm = ["pending", "submitted"].includes(paymentStatus);
  const canCancel  = !["paid", "cancelled"].includes(paymentStatus);

  if (!canConfirm && !canCancel) {
    return (
      <p className="text-sm text-muted-foreground">
        {paymentStatus === "paid" ? "Donasi sudah dikonfirmasi." : "Donasi sudah dibatalkan."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canConfirm && (
        <Button
          onClick={handleConfirm}
          disabled={isConfirming}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          {isConfirming ? "Mengkonfirmasi..." : "Konfirmasi Diterima"}
        </Button>
      )}
      {canCancel && (
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isCancelling}
          className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <XCircle className="h-4 w-4 mr-1.5" />
          {isCancelling ? "Membatalkan..." : "Batalkan"}
        </Button>
      )}
    </div>
  );
}
