"use client";

import { useState, useTransition } from "react";
import { saveQurbanAnimalsAction, type QurbanAnimalInput } from "@/app/(dashboard)/[tenant]/donasi/actions";

const ANIMAL_LABELS: Record<string, string> = {
  domba: "Domba", kambing: "Kambing", sapi: "Sapi",
};

const DEFAULT_ANIMALS: QurbanAnimalInput[] = [
  { animalType: "domba",   price: 0, stock: 0, split: null, isActive: true },
  { animalType: "kambing", price: 0, stock: 0, split: null, isActive: true },
  { animalType: "sapi",    price: 0, stock: 0, split: 7,    isActive: true },
];

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

  function update(idx: number, patch: Partial<QurbanAnimalInput>) {
    setAnimals(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
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

  const inputCls = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="pb-2 pr-3 font-medium">Hewan</th>
              <th className="pb-2 pr-3 font-medium">Harga (Rp)</th>
              <th className="pb-2 pr-3 font-medium w-20">Stok</th>
              <th className="pb-2 pr-3 font-medium w-28">Patungan</th>
              <th className="pb-2 font-medium w-16">Aktif</th>
            </tr>
          </thead>
          <tbody className="space-y-2">
            {animals.map((a, i) => (
              <tr key={a.animalType} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-3 font-medium">{ANIMAL_LABELS[a.animalType]}</td>

                {/* Harga */}
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min={0}
                    value={a.price}
                    onChange={e => update(i, { price: parseInt(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </td>

                {/* Stok */}
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min={0}
                    value={a.stock}
                    onChange={e => update(i, { stock: parseInt(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </td>

                {/* Patungan — hanya sapi */}
                <td className="py-2 pr-3">
                  {a.animalType === "sapi" ? (
                    <select
                      value={a.split ?? 7}
                      onChange={e => update(i, { split: parseInt(e.target.value) })}
                      className={inputCls}
                    >
                      <option value={5}>5 orang</option>
                      <option value={7}>7 orang</option>
                    </select>
                  ) : (
                    <span className="text-muted-foreground text-xs">Individu</span>
                  )}
                </td>

                {/* Aktif toggle */}
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={a.isActive}
                    onChange={e => update(i, { isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Konfigurasi hewan disimpan.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-md border border-border bg-muted px-4 py-1.5 text-sm font-medium hover:bg-muted/70 disabled:opacity-60 transition-colors"
      >
        {pending ? "Menyimpan..." : "Simpan Konfigurasi Hewan"}
      </button>
    </div>
  );
}
