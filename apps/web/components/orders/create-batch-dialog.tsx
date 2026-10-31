"use client";

// Popup "Buat Batch Pengiriman" dari pesanan yang dicentang. Dua mode: produsen (createBatchAction; sukses → halaman batch)
// dan admin (createBatchAsAdminAction atas nama produsen; sukses → pesan + tabel disegarkan). Server tetap memeriksa ulang
// kelayakan tiap invoice (campuran/ambil-sendiri/belum lunas/bukan milik produsen → seluruh permintaan ditolak dengan pesan).
// Doc: arsitektur-portal-produsen.md § 22.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PackagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createBatchAction } from "@/app/(producer)/app/[tenant]/portal-produsen/pengiriman/actions";
import { createBatchAsAdminAction } from "@/app/(dashboard)/app/[tenant]/toko/produk/[id]/batch-actions";

export type BatchConfig = {
  mode: "producer" | "admin";
  producerId?: string;     // wajib untuk mode admin (produsen pemilik produk)
  suggestedName: string;   // DDMMYYYY####
  today: string;           // YYYY-MM-DD (WIB)
};

export function CreateBatchDialog({ open, onClose, slug, cfg, shipmentIds, skipped, onDone }: {
  open: boolean; onClose: () => void; slug: string; cfg: BatchConfig; shipmentIds: string[]; skipped: number; onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(cfg.suggestedName);
  const [date, setDate] = useState(cfg.today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; count: number } | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const input = { name, shippingDate: date, shipmentIds };
      const res = cfg.mode === "admin" && cfg.producerId
        ? await createBatchAsAdminAction(slug, cfg.producerId, input)
        : await createBatchAction(slug, input);
      if (!res.success) { setError(res.error); return; }
      onDone();
      if (cfg.mode === "producer") { router.push(`/app/${slug}/portal-produsen/pengiriman/${res.data.batchId}`); return; }
      setResult({ name: res.data.name, count: res.data.count });
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const close = () => { if (!busy) { setError(null); setResult(null); onClose(); } };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" /> Buat Batch Pengiriman</DialogTitle>
          <DialogDescription>
            {shipmentIds.length} pesanan akan dimasukkan ke satu batch dan berstatus <b>Diproses</b>. Batch tidak bisa dihapus.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Batch <b className="font-mono">{result.name}</b> dibuat dengan {result.count} pesanan. Produsen melihatnya di menu Pengiriman portal.</span>
            </p>
            <button type="button" onClick={close} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Selesai</button>
          </div>
        ) : (
          <div className="space-y-4">
            {skipped > 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {skipped} pesanan terpilih dilewati karena tidak layak batch (bukan berstatus Menunggu, ambil sendiri, atau campuran).
              </p>
            )}
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Nama batch</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm" />
              <span className="block text-xs text-muted-foreground">Bawaan: tanggal + nomor urut hari ini.</span>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Tanggal pengiriman</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
            </label>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={submit} disabled={busy || !name.trim() || !date || shipmentIds.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Buat Batch ({shipmentIds.length})
              </button>
              <button type="button" onClick={close} disabled={busy} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted">Batal</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
