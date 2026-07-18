"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleInstallmentPlanAction } from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";

type Props = {
  slug:        string;
  planId:      string;
  isActive:    boolean;
  isPublished: boolean;
};

export function InstallmentPlanToggles({ slug, planId, isActive, isPublished }: Props) {
  const router = useRouter();
  const [pendingField, setPendingField] = useState<"isActive" | "isPublished" | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(field: "isActive" | "isPublished") {
    setPendingField(field);
    startTransition(async () => {
      await toggleInstallmentPlanAction(slug, planId, field);
      router.refresh();
      setPendingField(null);
    });
  }

  return (
    <div className="flex gap-2 pt-2 border-t border-border">
      <button
        type="button"
        disabled={pendingField === "isActive"}
        onClick={() => handleToggle("isActive")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          isActive ? "bg-green-100 text-green-700" : "border border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {isActive ? "✓ Aktif" : "Aktifkan"}
      </button>
      <button
        type="button"
        disabled={pendingField === "isPublished"}
        onClick={() => handleToggle("isPublished")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          isPublished ? "bg-blue-100 text-blue-700" : "border border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {isPublished ? "✓ Tampil di Publik" : "Publish ke Publik"}
      </button>
      {!isActive && (
        <p className="text-xs text-muted-foreground self-center">
          Belum aktif — tidak bisa didaftar meski sudah publish.
        </p>
      )}
    </div>
  );
}
