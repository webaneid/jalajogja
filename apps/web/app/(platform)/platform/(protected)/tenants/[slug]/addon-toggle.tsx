"use client";

import { useTransition } from "react";
import { installAddonAction, uninstallAddonAction } from "./addon-actions";

type Props = {
  tenantId:    string;
  addonSlug:   string;
  isInstalled: boolean;
};

export function AddonToggle({ tenantId, addonSlug, isInstalled }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      if (isInstalled) {
        await uninstallAddonAction(tenantId, addonSlug);
      } else {
        await installAddonAction(tenantId, addonSlug);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
        isInstalled
          ? "border border-border hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
      }`}
    >
      {pending
        ? "..."
        : isInstalled
        ? "Uninstall"
        : "Install"}
    </button>
  );
}
