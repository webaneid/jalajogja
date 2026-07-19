"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleVoucherActiveAction } from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";

type Props = {
  slug:      string;
  voucherId: string;
  isActive:  boolean;
};

export function VoucherToggle({ slug, voucherId, isActive }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleVoucherActiveAction(slug, voucherId);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 pt-2 border-t border-border">
      <button
        type="button"
        disabled={pending}
        onClick={handleToggle}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          isActive ? "bg-green-100 text-green-700" : "border border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {isActive ? "✓ Aktif" : "Aktifkan"}
      </button>
      {!isActive && (
        <p className="text-xs text-muted-foreground">Voucher nonaktif tidak bisa dipakai customer.</p>
      )}
    </div>
  );
}
