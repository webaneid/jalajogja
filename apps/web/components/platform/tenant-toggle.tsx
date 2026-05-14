"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleTenantActiveAction } from "@/app/(platform)/platform/(protected)/actions";

export function PlatformTenantToggle({
  tenantId,
  isActive,
}: {
  tenantId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (!confirm(isActive ? "Non-aktifkan tenant ini?" : "Aktifkan tenant ini?")) return;
    startTransition(async () => {
      await toggleTenantActiveAction(tenantId, !isActive);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors border ${
        isActive
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-green-200 text-green-600 hover:bg-green-50"
      } disabled:opacity-60`}
    >
      {pending ? "..." : isActive ? "Non-aktifkan" : "Aktifkan"}
    </button>
  );
}
