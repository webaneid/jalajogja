"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { selfInstallAddonAction, selfUninstallAddonAction } from "./actions";

type Props = {
  slug:      string;
  addonSlug: string;
  installed: boolean;
  isFree:    boolean;
};

export function AddonToggleClient({ slug, addonSlug, installed, isFree }: Props) {
  const router                     = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError]          = useState("");

  if (!isFree) {
    return (
      <span className="text-xs text-muted-foreground italic">
        Hubungi tim jalakarta
      </span>
    );
  }

  function handleInstall() {
    setError("");
    startTransition(async () => {
      const res = await selfInstallAddonAction(slug, addonSlug);
      if ("error" in res) {
        setError(res.error ?? "Gagal install");
      } else {
        router.refresh();
      }
    });
  }

  function handleUninstall() {
    if (!confirm("Nonaktifkan add-on ini?")) return;
    setError("");
    startTransition(async () => {
      const res = await selfUninstallAddonAction(slug, addonSlug);
      if ("error" in res) {
        setError(res.error ?? "Gagal nonaktifkan");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {installed ? (
        <button
          onClick={handleUninstall}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          {pending ? "Memproses..." : "Nonaktifkan"}
        </button>
      ) : (
        <button
          onClick={handleInstall}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {pending ? "Menginstall..." : "Install"}
        </button>
      )}
    </div>
  );
}
