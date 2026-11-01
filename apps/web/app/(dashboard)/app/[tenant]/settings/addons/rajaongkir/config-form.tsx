"use client";

import { useState, useTransition } from "react";
import { saveRajaOngkirConfigAction } from "./actions";

import { RAJAONGKIR_COURIER_OPTIONS as COURIER_OPTIONS } from "@/lib/rajaongkir-couriers";

type Props = {
  slug:           string;
  installationId: string;
  initialConfig: {
    couriers: string[];
  };
};

export function RajaOngkirConfigForm({ slug, installationId, initialConfig }: Props) {
  const [pending, startTransition] = useTransition();
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  const [couriers, setCouriers] = useState<string[]>(initialConfig.couriers);

  function toggleCourier(val: string) {
    setCouriers(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await saveRajaOngkirConfigAction(slug, installationId, {
        couriers,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Asal kirim dipindah ke Toko → Asal Kirim (docs/arsitektur-alamat.md § 20) */}
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        Kota asal pengiriman kini diatur di{" "}
        <a href={`/app/${slug}/toko/asal-kirim`} className="text-primary hover:underline">Toko → Asal Kirim</a>{" "}
        (bisa lebih dari satu alamat; produsen juga mengelola asalnya sendiri).
      </div>

      {/* Kurir */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Kurir yang Ditawarkan</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COURIER_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={couriers.includes(opt.value)}
                onChange={() => toggleCourier(opt.value)}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Kurir yang ditawarkan ke customer saat checkout.</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Tersimpan</span>}
      </div>
    </form>
  );
}
