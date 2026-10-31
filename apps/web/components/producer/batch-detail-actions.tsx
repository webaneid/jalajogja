"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addShipmentsToBatchAction, markPackedAction, removeShipmentFromBatchAction } from "@/app/(producer)/app/[tenant]/portal-produsen/pengiriman/actions";
import { compressImage } from "@/lib/client-image-compress";
import { OrderPicker, type PickerOrder } from "./order-picker";

function useAct() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null);
    start(async () => { const r = await fn(); if (!r.success) setError(r.error ?? "Gagal."); router.refresh(); });
  };
  return { error, pending, run };
}

/** Tombol di atas batch: Tandai Dikemas (semua yang Diproses). */
export function BatchPackAll({ slug, batchId, processingCount }: { slug: string; batchId: string; processingCount: number }) {
  const { error, pending, run } = useAct();
  if (processingCount === 0) return null;
  return (
    <div className="space-y-1">
      <button disabled={pending} onClick={() => run(() => markPackedAction(slug, batchId))}
        className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
        {pending ? "Memproses…" : `Tandai Semua Dikemas (${processingCount})`}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Tombol per baris: Tandai Dikemas (Diproses) · Input Resi (Dikemas) · Keluarkan (belum ada resi) · resi + foto (Dikirim). */
export function BatchRowActions({ slug, batchId, lineId, status, trackingNumber, proofUrl, canChangePhoto }: {
  slug: string; batchId: string; lineId: string; status: string | null; trackingNumber: string | null; proofUrl: string | null;
  canChangePhoto: boolean; // false bila foto resi sudah lewat masa simpan 30 hari (dihapus otomatis)
}) {
  const { error, pending, run } = useAct();
  const canRemove = status === "processing" || status === "packed";
  const [resiOpen, setResiOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      {(status === "shipped" || status === "delivered") && (
        <div className="text-right text-xs">
          {trackingNumber && <div className="font-mono font-medium">{trackingNumber}</div>}
          {proofUrl
            ? <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Foto resi</a>
            : <span className="text-muted-foreground">Foto resi sudah dihapus (lewat 30 hari)</span>}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-1">
        {status === "processing" && (
          <button disabled={pending} onClick={() => run(() => markPackedAction(slug, batchId, lineId))}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">Tandai Dikemas</button>
        )}
        {status === "packed" && !resiOpen && (
          <button onClick={() => setResiOpen(true)} className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">Input Resi</button>
        )}
        {status === "shipped" && !resiOpen && (
          <button onClick={() => setResiOpen(true)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Ubah Resi</button>
        )}
        {canRemove && (
          <button disabled={pending} onClick={() => { if (window.confirm("Keluarkan pesanan ini dari batch? Status kembali ke Menunggu.")) run(() => removeShipmentFromBatchAction(slug, batchId, lineId)); }}
            className="rounded-md border border-border px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">Keluarkan</button>
        )}
      </div>
      {resiOpen && (status === "packed" || status === "shipped") && (
        <ResiForm slug={slug} batchId={batchId} lineId={lineId} edit={status === "shipped"} initialResi={trackingNumber ?? ""} canChangePhoto={canChangePhoto} onClose={() => setResiOpen(false)} />
      )}
      {error && <p className="max-w-[220px] text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Form nomor resi + foto resi → POST /api/produsen/resi. Buat (Dikemas → Dikirim) atau ubah (sudah Dikirim; foto opsional). */
export function ResiForm({ slug, batchId, lineId, edit, initialResi, canChangePhoto, onClose }: {
  slug: string; batchId: string; lineId: string; edit: boolean; initialResi: string; canChangePhoto: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [resi, setResi] = useState(initialResi);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changed = edit ? (resi.trim() !== initialResi || !!file) : (resi.trim().length >= 3 && !!file);
  const submit = async () => {
    if (!edit && !file) { setError("Foto resi wajib diunggah."); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.set("batchId", batchId); fd.set("lineId", lineId);
      fd.set("trackingNumber", resi.trim() === initialResi && edit ? "" : resi.trim());
      if (file) fd.set("file", await compressImage(file));
      const res = await fetch(`/api/produsen/resi?tenant=${encodeURIComponent(slug)}`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Gagal menyimpan resi."); return; }
      onClose();
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-60 space-y-2 rounded-md border border-border bg-background p-2 text-left">
      <input value={resi} onChange={(e) => setResi(e.target.value)} placeholder="Nomor resi" maxLength={40} className="h-8 w-full rounded border border-border bg-background px-2 font-mono text-xs" />
      {(!edit || canChangePhoto) ? (
        <label className="block space-y-0.5">
          <span className="text-[11px] text-muted-foreground">{edit ? "Ganti foto resi (opsional)" : "Foto resi (wajib)"}</span>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
        </label>
      ) : (
        <p className="text-[11px] text-muted-foreground">Foto resi sudah lewat masa simpan 30 hari — hanya nomor resi yang bisa diubah.</p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-1">
        <button disabled={busy || !changed} onClick={submit} className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">{busy ? "Menyimpan…" : edit ? "Simpan" : "Kirim"}</button>
        <button disabled={busy} onClick={onClose} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Batal</button>
      </div>
    </div>
  );
}

/** Tambah pesanan lain ke batch yang sudah ada. */
export function BatchAddOrders({ slug, batchId, orders }: { slug: string; batchId: string; orders: PickerOrder[] }) {
  const { error, pending, run } = useAct();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  if (!open) {
    return <button onClick={() => setOpen(true)} className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">+ Tambah Pesanan</button>;
  }
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <OrderPicker orders={orders} selected={selected} onChange={setSelected} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending || selected.size === 0}
          onClick={() => run(async () => { const r = await addShipmentsToBatchAction(slug, batchId, [...selected]); if (r.success) { setSelected(new Set()); setOpen(false); } return r; })}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Menyimpan…" : `Tambahkan (${selected.size})`}
        </button>
        <button onClick={() => setOpen(false)} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted">Batal</button>
      </div>
    </div>
  );
}
