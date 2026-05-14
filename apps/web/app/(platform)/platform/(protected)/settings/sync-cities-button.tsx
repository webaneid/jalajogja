"use client";

import { useState, useTransition } from "react";
import { Wifi } from "lucide-react";

export function TestRajaOngkirButton() {
  const [pending, startTransition] = useTransition();
  const [result,  setResult]       = useState<string | null>(null);

  function handleTest() {
    startTransition(async () => {
      setResult(null);
      const res  = await fetch("/api/platform/rajaongkir/sync-cities", { method: "POST" });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (data.ok) {
        setResult(`✓ ${data.message ?? "Koneksi berhasil"}`);
      } else {
        setResult(`✗ ${data.error ?? "Gagal terhubung"}`);
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
        onClick={handleTest}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-60"
      >
        <Wifi className={`h-3.5 w-3.5 ${pending ? "animate-pulse" : ""}`} />
        {pending ? "Menghubungkan..." : "Test Koneksi"}
      </button>
    </div>
  );
}
