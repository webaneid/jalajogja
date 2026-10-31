"use client";

// Popup "Print Format" — pilih ukuran label lalu PDF dibuka di tab baru. Dua kolom: Kertas Biasa | Thermal (7 format dari
// lib/shipping-label/formats.ts, modul murni tanpa server-only). Klik kartu = langsung mencetak (seperti referensi popup user).
// Alur: buka tab kosong SINKRON saat klik (agar tidak diblokir pop-up blocker) → fetch POST /api/labels → tab diarahkan ke PDF.
// Kegagalan (mis. pesanan campuran) tampil di popup, bukan sebagai JSON mentah di tab baru. Doc: arsitektur-portal-produsen.md § 21.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FORMAT_SPECS, type FormatSpec } from "@/lib/shipping-label/formats";
import type { LabelFormat } from "@/lib/shipping-label/types";

const PAPER: LabelFormat[] = ["a4-1", "a4-2", "a4-4", "a4-6"];
const THERMAL: LabelFormat[] = ["th-10x10", "th-10x15", "th-8x6"];

/** Pictogram kecil proporsional: halaman + grid label. */
function Glyph({ spec }: { spec: FormatSpec }) {
  const maxH = 40, maxW = 44;
  const ratio = spec.page.w / spec.page.h;
  const h = ratio >= 1 ? Math.min(maxH, maxW / ratio) : maxH;
  const w = h * ratio;
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-50">
      <span className="grid border border-slate-400 bg-white p-[2px]"
        style={{ width: w * 0.8, height: h * 0.8, gridTemplateColumns: `repeat(${spec.cols}, 1fr)`, gridTemplateRows: `repeat(${spec.rows}, 1fr)`, gap: 1.5 }}>
        {Array.from({ length: spec.cols * spec.rows }).map((_, i) => (
          <span key={i} className="rounded-[1px] border border-slate-500 bg-amber-100" />
        ))}
      </span>
    </span>
  );
}

export function PrintLabelDialog({ open, onClose, slug, shipmentIds, onDone }: {
  open: boolean; onClose: () => void; slug: string; shipmentIds: string[]; onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<LabelFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function print(format: LabelFormat) {
    if (busy) return;
    setError(null);
    setBusy(format);
    const win = window.open("", "_blank");
    if (win) win.document.write("<p style=\"font-family:system-ui,sans-serif;padding:24px;color:#475569\">Membuat label…</p>");
    try {
      const res = await fetch(`/api/labels?tenant=${encodeURIComponent(slug)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format, shipmentIds }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        win?.close();
        setError((d as { error?: string }).error ?? "Gagal membuat label.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url; else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
      onDone?.();
      router.refresh(); // status Diproses → Dikemas sudah diubah server sebelum respons dikirim
      onClose();
    } catch {
      win?.close();
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(null);
    }
  }

  const Card = ({ f }: { f: LabelFormat }) => {
    const spec = FORMAT_SPECS[f];
    const loading = busy === f;
    return (
      <button type="button" onClick={() => print(f)} disabled={!!busy}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/40 disabled:cursor-wait disabled:opacity-60">
        <Glyph spec={spec} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{spec.title}</span>
          <span className="block text-xs text-muted-foreground">{spec.hint}</span>
        </span>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { setError(null); onClose(); } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Print Format</DialogTitle>
          <DialogDescription>
            {shipmentIds.length} label akan dibuat sebagai PDF. Pesanan berstatus <b>Diproses</b> otomatis menjadi <b>Dikemas</b>.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-border">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Kertas Biasa</p>
            {PAPER.map((f) => <Card key={f} f={f} />)}
          </div>
          <div className="space-y-3 sm:pl-6">
            <p className="text-sm font-semibold">Kertas Thermal</p>
            {THERMAL.map((f) => <Card key={f} f={f} />)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Tombol mandiri (punya popup sendiri) — untuk halaman batch, halaman fulfillment admin, dan baris tabel sederhana. */
export function PrintLabelsButton({ slug, shipmentIds, label, iconOnly = false, disabled = false, title }: {
  slug: string; shipmentIds: string[]; label?: string; iconOnly?: boolean; disabled?: boolean; title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" disabled={disabled || shipmentIds.length === 0} onClick={() => setOpen(true)}
        title={title ?? label ?? "Cetak label"} aria-label={title ?? label ?? "Cetak label"}
        className={iconOnly
          ? "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          : "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"}>
        <Printer className="h-4 w-4" />{!iconOnly && (label ?? "Cetak Label")}
      </button>
      <PrintLabelDialog open={open} onClose={() => setOpen(false)} slug={slug} shipmentIds={shipmentIds} />
    </>
  );
}
