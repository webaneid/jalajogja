"use client";

// Ubah batas jumlah produk satu produsen (K3: bawaan 3, admin bisa menaikkan bila tokonya ramai).
// Kosong = tanpa batas. Penegakan batas terjadi pada produk yang dibuat produsen sendiri (tahap produk); produk buatan admin tidak diblokir.
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProductLimitForm({ initial, used, onSave, onDone }: {
  initial: number | null; used: number;
  onSave: (limit: number | null) => Promise<{ success: boolean; error?: string }>;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = () => {
    setError("");
    const t = value.trim();
    const limit = t === "" ? null : /^\d+$/.test(t) ? Number(t) : NaN;
    if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 999)) { setError("Isi bilangan bulat 1–999, atau kosongkan untuk tanpa batas."); return; }
    start(async () => {
      const res = await onSave(limit);
      if (!res.success) setError(res.error ?? "Gagal menyimpan."); else onDone();
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Batas jumlah produk</Label>
        <Input type="number" min={1} max={999} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Kosong = tanpa batas" className="w-40" />
        <p className="text-xs text-muted-foreground">Produk saat ini: {used}. Batas hanya berlaku untuk produk yang dibuat produsen sendiri.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={pending} onClick={save}>{pending ? "Menyimpan…" : "Simpan"}</Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>Batal</Button>
      </div>
    </div>
  );
}
