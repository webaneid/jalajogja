"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

export function SyncRajaOngkirCitiesButton() {
  const [pending, startTransition] = useTransition();
  const [result,  setResult]       = useState<string | null>(null);

  function handleSync() {
    startTransition(async () => {
      setResult(null);
      const res = await fetch("/api/platform/rajaongkir/sync-cities", { method: "POST" });
      const data = await res.json() as { ok?: boolean; synced?: number; error?: string };
      if (data.ok) {
        setResult(`✓ ${data.synced?.toLocaleString("id-ID")} kota berhasil disinkronisasi`);
      } else {
        setResult(`✗ ${data.error ?? "Gagal sync"}`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className={`text-xs ${result.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
          {result}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Menyinkronisasi..." : "Sync Kota"}
      </button>
    </div>
  );
}
