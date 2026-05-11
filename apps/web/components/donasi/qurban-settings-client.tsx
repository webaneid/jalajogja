"use client";

import { useState, useTransition } from "react";
import { saveQurbanConfigAction, type QurbanConfig } from "@/app/(dashboard)/[tenant]/donasi/actions";

const ANIMALS = [
  { key: "domba",   label: "Domba"   },
  { key: "kambing", label: "Kambing" },
  { key: "sapi",    label: "Sapi"    },
] as const;

type AnimalKey = "domba" | "kambing" | "sapi";

type Props = {
  slug:   string;
  config: QurbanConfig;
};

export function QurbanSettingsClient({ slug, config }: Props) {
  const [fees, setFees] = useState<Record<AnimalKey, string>>({
    domba:   String(config.slaughterFees.domba),
    kambing: String(config.slaughterFees.kambing),
    sapi:    String(config.slaughterFees.sapi),
  });
  const [error,   setError]  = useState("");
  const [saved,   setSaved]  = useState(false);
  const [pending, start]     = useTransition();

  function handleSave() {
    setError(""); setSaved(false);
    start(async () => {
      const res = await saveQurbanConfigAction(slug, {
        slaughterFees: {
          domba:   parseInt(fees.domba.replace(/\D/g, ""), 10) || 0,
          kambing: parseInt(fees.kambing.replace(/\D/g, ""), 10) || 0,
          sapi:    parseInt(fees.sapi.replace(/\D/g, ""), 10) || 0,
        },
      });
      if (res.success) setSaved(true);
      else setError(res.error ?? "Gagal menyimpan.");
    });
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-base font-semibold">Biaya Administrasi Penyembelihan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Biaya admin yang ditambahkan ke harga hewan, berbeda per jenis.
          Harga hewan itu sendiri diatur per campaign (bisa berubah setiap tahun).
        </p>
      </div>

      <div className="space-y-3">
        {ANIMALS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <label className="w-20 text-sm font-medium">{label}</label>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={Number(fees[key]).toLocaleString("id-ID")}
                onChange={e => setFees(prev => ({ ...prev, [key]: e.target.value.replace(/\D/g, "") }))}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Biaya penyembelihan berhasil disimpan.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </div>
  );
}
