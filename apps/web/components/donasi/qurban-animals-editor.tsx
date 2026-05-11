"use client";

import { useState, useTransition } from "react";
import { saveQurbanAnimalsAction, type QurbanAnimalInput } from "@/app/(dashboard)/[tenant]/donasi/actions";

const ANIMALS: { type: QurbanAnimalInput["animalType"]; label: string; emoji: string }[] = [
  { type: "domba",   label: "Domba",   emoji: "🐑" },
  { type: "kambing", label: "Kambing", emoji: "🐐" },
  { type: "sapi",    label: "Sapi",    emoji: "🐄" },
];

const DEFAULT_ANIMALS: QurbanAnimalInput[] = [
  { animalType: "domba",   price: 0, stock: 0, split: null, isActive: true },
  { animalType: "kambing", price: 0, stock: 0, split: null, isActive: true },
  { animalType: "sapi",    price: 0, stock: 0, split: 7,    isActive: true },
];

function formatRp(n: number) {
  return n > 0 ? `Rp ${n.toLocaleString("id-ID")}` : "—";
}

type Props = {
  slug:        string;
  campaignId:  string;
  initialData: QurbanAnimalInput[];
};

export function QurbanAnimalsEditor({ slug, campaignId, initialData }: Props) {
  const [animals, setAnimals] = useState<QurbanAnimalInput[]>(
    initialData.length > 0 ? initialData : DEFAULT_ANIMALS
  );
  const [error,   setError]  = useState("");
  const [saved,   setSaved]  = useState(false);
  const [pending, start]     = useTransition();

  function update(type: string, patch: Partial<QurbanAnimalInput>) {
    setAnimals(prev => prev.map(a => a.animalType === type ? { ...a, ...patch } : a));
    setSaved(false);
  }

  function handleSave() {
    setError(""); setSaved(false);
    start(async () => {
      const res = await saveQurbanAnimalsAction(slug, campaignId, animals);
      if (res.success) setSaved(true);
      else setError(res.error ?? "Gagal menyimpan.");
    });
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-3">
      {ANIMALS.map(({ type, label, emoji }) => {
        const a = animals.find(x => x.animalType === type);
        if (!a) return null;
        const isSapi       = type === "sapi";
        const pricePerSlot = isSapi && a.split && a.price > 0 ? Math.ceil(a.price / a.split) : null;

        return (
          <div
            key={type}
            className={`rounded-xl border p-3 space-y-2.5 transition-colors ${a.isActive ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"}`}
          >
            {/* Header card */}
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm flex items-center gap-1.5">
                <span>{emoji}</span> {label}
              </span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={a.isActive}
                  onChange={e => update(type, { isActive: e.target.checked })}
                  className="h-3.5 w-3.5 rounded accent-primary"
                />
                Aktif
              </label>
            </div>

            {/* Harga */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Harga {isSapi ? "per ekor" : ""}</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                <input
                  type="number"
                  min={0}
                  value={a.price || ""}
                  onChange={e => update(type, { price: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className={`${inputCls} pl-8`}
                />
              </div>
            </div>

            {/* Stok + Patungan (satu baris) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Stok (ekor)</label>
                <input
                  type="number"
                  min={0}
                  value={a.stock || ""}
                  onChange={e => update(type, { stock: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tipe</label>
                {isSapi ? (
                  <select
                    value={a.split ?? "individu"}
                    onChange={e => update(type, { split: e.target.value === "individu" ? null : parseInt(e.target.value) })}
                    className={inputCls}
                  >
                    <option value="individu">Individu</option>
                    <option value={5}>Patungan 5</option>
                    <option value={7}>Patungan 7</option>
                  </select>
                ) : (
                  <div className={`${inputCls} bg-muted/30 text-muted-foreground text-xs flex items-center`}>
                    Individu
                  </div>
                )}
              </div>
            </div>

            {/* Info harga per orang untuk sapi patungan */}
            {pricePerSlot && (
              <p className="text-xs text-muted-foreground bg-primary/5 rounded-lg px-2.5 py-1.5">
                Per orang: <span className="font-semibold text-primary">{formatRp(pricePerSlot)}</span>
                {" "}({a.price.toLocaleString("id-ID")} ÷ {a.split})
              </p>
            )}
          </div>
        );
      })}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Tersimpan.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="w-full rounded-lg border border-border bg-muted/50 py-1.5 text-sm font-medium hover:bg-muted/80 disabled:opacity-60 transition-colors"
      >
        {pending ? "Menyimpan..." : "Simpan Konfigurasi Hewan"}
      </button>
    </div>
  );
}
