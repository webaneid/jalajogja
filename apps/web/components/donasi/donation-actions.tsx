"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle2, XCircle } from "lucide-react";
import { confirmDonationAction, cancelDonationAction } from "@/app/(dashboard)/[tenant]/donasi/actions";

type Props = {
  slug:          string;
  donationId:    string;
  paymentId:     string | null;
  paymentStatus: string | null;
};

export function DonationActions({ slug, donationId, paymentId, paymentStatus }: Props) {
  const [isConfirming, startConfirm] = useTransition();
  const [isCancelling, startCancel]  = useTransition();

  function handleConfirm() {
    if (!paymentId) return;
    startConfirm(async () => {
      await confirmDonationAction(slug, paymentId);
    });
  }

  function handleCancel() {
    if (!confirm("Batalkan donasi ini?")) return;
    startCancel(async () => {
      await cancelDonationAction(slug, donationId);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/${slug}/donasi/transaksi/${donationId}`}>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </Link>
      {paymentStatus === "submitted" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-green-600 hover:text-green-700"
          onClick={handleConfirm}
          disabled={isConfirming}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>
      )}
      {paymentStatus && !["paid", "cancelled"].includes(paymentStatus) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          <XCircle className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
