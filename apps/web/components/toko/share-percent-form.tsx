"use client";

// Admin menetapkan / mengubah persentase bagi hasil produsen (K20 — hanya admin). Persentase = bagian TENANT dari harga yang dibayar pembeli.
// Mengubahnya menghitung ulang harga dasar produk produsen (K24); pesanan lama tidak berubah (snapshot K25).
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SharePercentForm({ initial, onSave, onDone }: {
  initial: string | null;
  onSave: (percent: number) => Promise<{ success: boolean; error?: string; data?: { updatedProducts: number } }>;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = () => {
    setError("");
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n >= 100) { setError("Isi angka lebih dari 0 dan kurang dari 100."); return; }
    start(async () => {
      const res = await onSave(n);
      if (!res.success) setError(res.error ?? "Gagal menyimpan."); else onDone();
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Bagi hasil untuk tenant (%)</Label>
        <Input type="number" min={0.01} max={99.99} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Mis. 10" className="w-40" />
        <p className="text-xs text-muted-foreground">
          Bagian tenant dari harga yang dibayar pembeli (harga umum maupun harga anggota). Harga dasar produk produsen ini dihitung ulang otomatis.
          Pesanan yang sudah masuk tidak berubah. Produsen tidak bisa mengubahnya sendiri.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={pending} onClick={save}>{pending ? "Menyimpan…" : "Simpan"}</Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>Batal</Button>
      </div>
    </div>
  );
}
