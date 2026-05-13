"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, ToggleLeft, ToggleRight } from "lucide-react";
import { toggleTenantActiveAction } from "@/app/(platform)/platform/actions";

export function PlatformTenantActions({
  tenantId,
  tenantSlug,
  isActive,
}: {
  tenantId:   string;
  tenantSlug: string;
  isActive:   boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleTenantActiveAction(tenantId, !isActive);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <Link
        href={`/platform/tenants/${tenantSlug}`}
        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Detail"
      >
        <Eye size={15} />
      </Link>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`rounded-md p-1.5 transition-colors ${
          isActive
            ? "text-green-600 hover:text-red-600 hover:bg-red-50"
            : "text-muted-foreground hover:text-green-600 hover:bg-green-50"
        }`}
        title={isActive ? "Non-aktifkan" : "Aktifkan"}
      >
        {isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
      </button>
    </div>
  );
}
