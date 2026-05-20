"use client";

import { useState, useTransition } from "react";
import { X, Plus } from "lucide-react";
import { saveDonationSettingsAction } from "@/app/(dashboard)/app/[tenant]/donasi/actions";

function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function DonationSettingsClient({
  slug,
  initialAmounts,
}: {
  slug:           string;
  initialAmounts: number[];
}) {
  const [amounts, setAmounts]   = useState<number[]>(initialAmounts);
  const [input,   setInput]     = useState("");
  const [error,   setError]     = useState("");
  const [saved,   setSaved]     = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const val = parseInt(input.replace(/\D/g, ""), 10);
    if (!val || val <= 0) { setError("Masukkan nominal yang valid."); return; }
    if (amounts.length >= 4) { setError("Maksimal 4 rekomendasi."); return; }
    if (amounts.includes(val)) { setError("Nominal sudah ada."); return; }
    setAmounts(prev => [...prev, val].sort((a, b) => a - b));
    setInput("");
    setError("");
  }

  function handleRemove(n: number) {
    setAmounts(prev => prev.filter(a => a !== n));
  }

  function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await saveDonationSettingsAction(slug, amounts);
      if (res.success) setSaved(true);
      else setError(res.error ?? "Gagal menyimpan.");
    });
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-base font-semibold">Rekomendasi Nominal</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tampil sebagai pilihan cepat di form donasi. Maksimal 4 rekomendasi.
          Tidak berlaku jika campaign memiliki nominal tetap.
        </p>
      </div>

      {/* Chip list */}
      <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
        {amounts.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Belum ada rekomendasi.</p>
        )}
        {amounts.map(n => (
          <span
            key={n}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium"
          >
            {formatRupiah(n)}
            <button
              type="button"
              onClick={() => handleRemove(n)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      {/* Input tambah */}
      {amounts.length < 4 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={input}
              onChange={e => {
                setInput(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="contoh: 50000"
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 rounded-md bg-muted border border-border px-3 py-2 text-sm font-medium hover:bg-muted/70 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Pengaturan berhasil disimpan.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending ? "Menyimpan..." : "Simpan Pengaturan"}
      </button>
    </div>
  );
}
